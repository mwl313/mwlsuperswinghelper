import asyncio
import logging
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import delete, desc, select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.candle_history import CandleHistory
from app.models.signal_log import SignalLog
from app.models.strategy_settings import StrategySettings
from app.models.watchlist import WatchlistItem
from app.services.candles import Candle, CandleAggregator
from app.services.market_data.base import MarketCandle, MarketDataProvider
from app.services.market_data.kis_adapter import KoreaInvestmentAdapter
from app.services.market_data.mock_provider import MockMarketDataProvider
from app.services.notifications.telegram import send_telegram_message
from app.services.signals.engine import SignalDecision, evaluate_signals
from app.services.system_config import (
    RuntimeProviderConfig,
    load_runtime_provider_config,
    normalize_provider_mode,
    save_kis_credentials as save_kis_credentials_to_store,
    update_provider_mode as update_provider_mode_to_store,
)
from app.services.ws_manager import WSManager

logger = logging.getLogger(__name__)


class MarketRuntime:
    def __init__(self, ws_manager: WSManager) -> None:
        settings = get_settings()
        self.settings = settings
        self.ws_manager = ws_manager

        config = self._load_provider_config_from_store()
        self.provider_mode: Literal["mock", "kis"] = config.mode
        self.kis_app_key = config.kis_app_key
        self.kis_app_secret = config.kis_app_secret
        self.kis_base_url = config.kis_base_url

        self.provider = self._build_provider(self.provider_mode)
        self.aggregator = CandleAggregator(
            candle_seconds=settings.candle_seconds,
            max_candles_per_symbol=settings.max_candles_per_symbol,
        )
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()
        self._switch_lock = asyncio.Lock()
        self.last_signal_times: dict[tuple[str, str], datetime] = {}
        self.latest_quotes: dict[str, dict] = {}
        self.recent_signals: deque[dict] = deque(maxlen=200)
        self.history_seeded_symbols: set[str] = set()
        self.last_runtime_error: str | None = None
        self.last_quote_update_at: datetime | None = None
        self.last_provider_switch_at: datetime | None = None

    @staticmethod
    def _candle_event_payload(event_type: str, symbol: str, candle: Candle) -> dict:
        return {
            "type": event_type,
            "symbol": symbol,
            "timeframe": "1m",
            "candle": {
                "timestamp": candle.timestamp.isoformat(),
                "open": candle.open,
                "high": candle.high,
                "low": candle.low,
                "close": candle.close,
                "volume": candle.volume,
            },
        }

    def _load_provider_config_from_store(self) -> RuntimeProviderConfig:
        with SessionLocal() as db:
            return load_runtime_provider_config(db, self.settings)

    def _is_kis_configured(self) -> bool:
        return bool(self.kis_app_key and self.kis_app_secret)

    def _build_provider(self, mode: Literal["mock", "kis"]) -> MarketDataProvider:
        if mode == "kis":
            return KoreaInvestmentAdapter(
                app_key=self.kis_app_key,
                app_secret=self.kis_app_secret,
                base_url=self.kis_base_url,
                poll_interval_seconds=self.settings.kis_poll_interval_seconds,
                request_timeout_seconds=self.settings.kis_request_timeout_seconds,
                market_div_code=self.settings.kis_market_div_code,
                quote_tr_id=self.settings.kis_quote_tr_id,
                intraday_tr_id=self.settings.kis_intraday_tr_id,
            )
        return MockMarketDataProvider(
            interval_seconds=self.settings.mock_tick_interval_seconds,
            volatility=self.settings.mock_price_volatility,
        )

    def _reset_runtime_state(self) -> None:
        self.aggregator = CandleAggregator(
            candle_seconds=self.settings.candle_seconds,
            max_candles_per_symbol=self.settings.max_candles_per_symbol,
        )
        self.last_signal_times.clear()
        self.latest_quotes.clear()
        self.recent_signals.clear()
        self.history_seeded_symbols.clear()
        self.last_quote_update_at = None
        self.last_runtime_error = None

    async def _restart_runtime_for_provider(self, mode: Literal["mock", "kis"]) -> None:
        await self.stop()
        self.provider_mode = mode
        self.provider = self._build_provider(mode)
        self._reset_runtime_state()
        await self.start()

    def get_provider_status(self) -> dict:
        runtime_running = bool(self._task and not self._task.done())
        return {
            "mode": self.provider_mode,
            "kisConfigured": self._is_kis_configured(),
            "runtimeHealthy": runtime_running and self.last_runtime_error is None,
            "lastError": self.last_runtime_error,
            "lastUpdateAt": self.last_quote_update_at,
            "supportsSwitching": True,
            "lastSwitchAt": self.last_provider_switch_at,
            "hasAppKey": bool(self.kis_app_key),
            "hasAppSecret": bool(self.kis_app_secret),
        }

    async def save_kis_credentials(self, app_key: str, app_secret: str, base_url: str | None) -> dict:
        if not app_key.strip() or not app_secret.strip():
            raise ValueError("KIS App Key/App Secret는 필수입니다.")

        async with self._switch_lock:
            with SessionLocal() as db:
                save_kis_credentials_to_store(
                    db=db,
                    settings=self.settings,
                    app_key=app_key,
                    app_secret=app_secret,
                    base_url=base_url,
                )
                loaded = load_runtime_provider_config(db, self.settings)

            self.kis_app_key = loaded.kis_app_key
            self.kis_app_secret = loaded.kis_app_secret
            self.kis_base_url = loaded.kis_base_url

            if self.provider_mode == "kis":
                await self._restart_runtime_for_provider("kis")

        return self.get_provider_status()

    async def switch_provider_mode(self, mode: Literal["mock", "kis"]) -> dict:
        target = normalize_provider_mode(mode)
        if target == "kis" and not self._is_kis_configured():
            raise ValueError("KIS 자격증명이 설정되지 않았습니다. 먼저 저장하세요.")

        async with self._switch_lock:
            if target == self.provider_mode:
                with SessionLocal() as db:
                    update_provider_mode_to_store(db=db, settings=self.settings, mode=target)
                return self.get_provider_status()

            previous_mode = self.provider_mode
            try:
                with SessionLocal() as db:
                    update_provider_mode_to_store(db=db, settings=self.settings, mode=target)

                if target == "kis" and previous_mode != "kis":
                    enabled_symbols = [item.symbol for item in self._get_enabled_items()]
                    self._purge_persisted_candles(enabled_symbols)

                await self._restart_runtime_for_provider(target)
                self.last_provider_switch_at = datetime.now(timezone.utc)
            except Exception as exc:
                logger.exception("provider switch failed: %s", exc)
                with SessionLocal() as db:
                    update_provider_mode_to_store(db=db, settings=self.settings, mode=previous_mode)
                try:
                    await self._restart_runtime_for_provider(previous_mode)
                except Exception as rollback_exc:
                    logger.exception("provider rollback failed: %s", rollback_exc)
                raise ValueError("Provider 모드 전환에 실패했습니다.") from exc

        return self.get_provider_status()

    async def test_kis_connection(self) -> dict:
        tested_at = datetime.now(timezone.utc)
        if not self._is_kis_configured():
            return {
                "ok": False,
                "mode": self.provider_mode,
                "message": "KIS 자격증명이 저장되지 않았습니다.",
                "testedAt": tested_at,
            }

        adapter = KoreaInvestmentAdapter(
            app_key=self.kis_app_key,
            app_secret=self.kis_app_secret,
            base_url=self.kis_base_url,
            poll_interval_seconds=self.settings.kis_poll_interval_seconds,
            request_timeout_seconds=self.settings.kis_request_timeout_seconds,
            market_div_code=self.settings.kis_market_div_code,
            quote_tr_id=self.settings.kis_quote_tr_id,
            intraday_tr_id=self.settings.kis_intraday_tr_id,
        )
        try:
            token = await adapter._ensure_access_token()  # noqa: SLF001
            if not token:
                return {
                    "ok": False,
                    "mode": self.provider_mode,
                    "message": "KIS 토큰 발급 실패",
                    "testedAt": tested_at,
                }
            return {
                "ok": True,
                "mode": self.provider_mode,
                "message": "KIS 연결 테스트 성공",
                "testedAt": tested_at,
            }
        except Exception as exc:
            return {
                "ok": False,
                "mode": self.provider_mode,
                "message": f"KIS 연결 테스트 실패: {exc}",
                "testedAt": tested_at,
            }

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task:
            await self._task
        self._task = None

    def _get_enabled_items(self) -> list[WatchlistItem]:
        with SessionLocal() as db:
            return list(db.scalars(select(WatchlistItem).where(WatchlistItem.enabled.is_(True))).all())

    def _get_settings(self) -> StrategySettings | None:
        with SessionLocal() as db:
            return db.scalar(select(StrategySettings).where(StrategySettings.user_id == 1))

    def _save_signal(self, decision: SignalDecision) -> dict:
        payload = {
            "symbol": decision.symbol,
            "symbol_name": decision.symbol_name,
            "signal_type": decision.signal_type,
            "signal_strength": decision.signal_strength,
            "price": decision.price,
            "volume": decision.volume,
            "reason_text": decision.reason_text,
            "created_at": decision.timestamp.isoformat(),
        }

        with SessionLocal() as db:
            row = SignalLog(
                user_id=1,
                symbol=decision.symbol,
                symbol_name=decision.symbol_name,
                signal_type=decision.signal_type,
                signal_strength=decision.signal_strength,
                price=decision.price,
                volume=decision.volume,
                reason_text=decision.reason_text,
                raw_payload_json=decision.raw_payload,
                created_at=decision.timestamp,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            payload["id"] = row.id

        return payload

    def _is_duplicate(self, decision: SignalDecision, cooldown_minutes: int) -> bool:
        key = (decision.symbol, decision.signal_type)
        last_seen = self.last_signal_times.get(key)
        if last_seen is None:
            self.last_signal_times[key] = decision.timestamp
            return False
        if decision.timestamp - last_seen < timedelta(minutes=cooldown_minutes):
            return True
        self.last_signal_times[key] = decision.timestamp
        return False

    def _upsert_closed_candle(self, candle: Candle) -> None:
        with SessionLocal() as db:
            existing = db.scalar(
                select(CandleHistory).where(
                    CandleHistory.symbol == candle.symbol,
                    CandleHistory.timeframe == "1m",
                    CandleHistory.timestamp == candle.timestamp,
                )
            )
            if existing is None:
                db.add(
                    CandleHistory(
                        symbol=candle.symbol,
                        timeframe="1m",
                        timestamp=candle.timestamp,
                        open=candle.open,
                        high=candle.high,
                        low=candle.low,
                        close=candle.close,
                        volume=candle.volume,
                    )
                )
            else:
                existing.open = candle.open
                existing.high = candle.high
                existing.low = candle.low
                existing.close = candle.close
                existing.volume = candle.volume
            db.commit()

    @staticmethod
    def _normalize_ts(ts: datetime) -> datetime:
        if ts.tzinfo is None:
            return ts.replace(tzinfo=timezone.utc)
        return ts.astimezone(timezone.utc)

    def _upsert_market_candles(self, symbol: str, rows: list[MarketCandle]) -> int:
        if not rows:
            return 0

        upper_bound = self._history_upper_time_bound()
        normalized_rows: list[MarketCandle] = []
        seen: set[datetime] = set()
        for row in rows:
            ts = self._normalize_ts(row.timestamp)
            if ts > upper_bound:
                continue
            if ts in seen:
                continue
            seen.add(ts)
            normalized_rows.append(
                MarketCandle(
                    symbol=symbol,
                    timestamp=ts,
                    open=row.open,
                    high=row.high,
                    low=row.low,
                    close=row.close,
                    volume=row.volume,
                )
            )

        if not normalized_rows:
            return 0

        with SessionLocal() as db:
            timestamps = [row.timestamp for row in normalized_rows]
            existing_rows = {
                self._normalize_ts(row.timestamp): row
                for row in db.scalars(
                    select(CandleHistory).where(
                        CandleHistory.symbol == symbol,
                        CandleHistory.timeframe == "1m",
                        CandleHistory.timestamp.in_(timestamps),
                    )
                ).all()
            }

            affected = 0
            for row in normalized_rows:
                existing = existing_rows.get(row.timestamp)
                if existing is None:
                    db.add(
                        CandleHistory(
                            symbol=symbol,
                            timeframe="1m",
                            timestamp=row.timestamp,
                            open=row.open,
                            high=row.high,
                            low=row.low,
                            close=row.close,
                            volume=row.volume,
                        )
                    )
                    affected += 1
                    continue

                if (
                    existing.open == row.open
                    and existing.high == row.high
                    and existing.low == row.low
                    and existing.close == row.close
                    and existing.volume == row.volume
                ):
                    continue

                existing.open = row.open
                existing.high = row.high
                existing.low = row.low
                existing.close = row.close
                existing.volume = row.volume
                affected += 1

            db.commit()

        return affected

    @staticmethod
    def _history_upper_time_bound() -> datetime:
        # Guardrail: treat candles too far in the future as invalid noise.
        return datetime.now(timezone.utc) + timedelta(minutes=2)

    def _purge_persisted_candles(self, symbols: list[str]) -> None:
        if not symbols:
            return
        with SessionLocal() as db:
            db.execute(
                delete(CandleHistory).where(
                    CandleHistory.timeframe == "1m",
                    CandleHistory.symbol.in_(symbols),
                )
            )
            db.commit()

    def _purge_future_candles(self) -> None:
        upper_bound = self._history_upper_time_bound()
        with SessionLocal() as db:
            db.execute(
                delete(CandleHistory).where(
                    CandleHistory.timeframe == "1m",
                    CandleHistory.timestamp > upper_bound,
                )
            )
            db.commit()

    def _load_recent_closed_candles(self, symbol: str, limit: int) -> list[Candle]:
        upper_bound = self._history_upper_time_bound()
        with SessionLocal() as db:
            rows = list(
                db.scalars(
                    select(CandleHistory)
                    .where(
                        CandleHistory.symbol == symbol,
                        CandleHistory.timeframe == "1m",
                        CandleHistory.timestamp <= upper_bound,
                    )
                    .order_by(desc(CandleHistory.timestamp))
                    .limit(limit)
                ).all()
            )
        rows.reverse()
        return [
            Candle(
                symbol=row.symbol,
                timestamp=row.timestamp if row.timestamp.tzinfo else row.timestamp.replace(tzinfo=timezone.utc),
                open=row.open,
                high=row.high,
                low=row.low,
                close=row.close,
                volume=row.volume,
            )
            for row in rows
        ]

    def _load_oldest_closed_candle_timestamp(self, symbol: str) -> datetime | None:
        upper_bound = self._history_upper_time_bound()
        with SessionLocal() as db:
            row = db.scalar(
                select(CandleHistory)
                .where(
                    CandleHistory.symbol == symbol,
                    CandleHistory.timeframe == "1m",
                    CandleHistory.timestamp <= upper_bound,
                )
                .order_by(CandleHistory.timestamp.asc())
                .limit(1)
            )
            if row is None:
                return None
            return self._normalize_ts(row.timestamp)

    async def _backfill_older_1m_history(self, symbol: str, max_chunks: int) -> None:
        if max_chunks <= 0:
            return

        cursor = self._load_oldest_closed_candle_timestamp(symbol)
        if cursor is None:
            return

        for _ in range(max_chunks):
            try:
                fetched = await self.provider.get_recent_candles(
                    symbol=symbol,
                    limit=self.settings.kis_history_seed_limit,
                    before=cursor,
                )
            except Exception as exc:
                logger.warning("older history backfill failed for %s: %s", symbol, exc)
                return

            if not fetched:
                return

            older_rows = [row for row in fetched if self._normalize_ts(row.timestamp) < cursor]
            if not older_rows:
                return

            self._upsert_market_candles(symbol=symbol, rows=older_rows)
            next_cursor = min(self._normalize_ts(row.timestamp) for row in older_rows)
            if next_cursor >= cursor:
                return
            cursor = next_cursor

    async def _seed_symbol_history(self, symbol: str) -> None:
        backfill_chunks = max(1, self.settings.kis_history_backfill_chunks)
        target_limit = self.settings.kis_history_seed_limit * backfill_chunks
        persisted = self._load_recent_closed_candles(symbol=symbol, limit=target_limit)
        if persisted and isinstance(self.provider, MockMarketDataProvider):
            self.provider.align_virtual_time(persisted[-1].timestamp)

        if len(persisted) >= min(target_limit, 60):
            self.aggregator.seed_closed_candles(symbol=symbol, candles=persisted)
            self.history_seeded_symbols.add(symbol)
            return

        fetched_rows: list[MarketCandle] = []
        try:
            fetched_rows = await self.provider.get_recent_candles(symbol=symbol, limit=self.settings.kis_history_seed_limit)
        except Exception as exc:
            logger.warning("history seed fetch failed for %s: %s", symbol, exc)
            fetched_rows = []

        self._upsert_market_candles(symbol=symbol, rows=fetched_rows)

        if backfill_chunks > 1:
            await self._backfill_older_1m_history(symbol=symbol, max_chunks=backfill_chunks - 1)

        merged = self._load_recent_closed_candles(symbol=symbol, limit=target_limit)
        if merged and isinstance(self.provider, MockMarketDataProvider):
            self.provider.align_virtual_time(merged[-1].timestamp)
        if merged:
            self.aggregator.seed_closed_candles(symbol=symbol, candles=merged)
        self.history_seeded_symbols.add(symbol)

    async def _ensure_seeded_histories(self, symbols: list[str]) -> None:
        missing = [symbol for symbol in symbols if symbol not in self.history_seeded_symbols]
        for symbol in missing:
            await self._seed_symbol_history(symbol)

    async def _handle_closed_candle(
        self,
        symbol: str,
        symbol_name: str,
        strategy_settings: StrategySettings,
        candles: list[Candle],
    ) -> None:
        decisions = evaluate_signals(
            candles=candles,
            settings=strategy_settings,
            symbol=symbol,
            symbol_name=symbol_name,
            volume_lookback=self.settings.volume_lookback,
            sr_lookback=self.settings.support_resistance_lookback,
        )
        for decision in decisions:
            if self._is_duplicate(decision, strategy_settings.cooldown_minutes):
                continue

            payload = self._save_signal(decision)
            self.recent_signals.appendleft(payload)
            await self.ws_manager.broadcast({"type": "signal", "data": payload})

            if strategy_settings.enable_telegram_notifications:
                text = (
                    f"[{decision.signal_type}] {decision.symbol_name}({decision.symbol})\n"
                    f"강도: {decision.signal_strength}\n"
                    f"{decision.reason_text}\n"
                    f"가격: {decision.price:.2f}"
                )
                await send_telegram_message(
                    token=self.settings.telegram_bot_token,
                    chat_id=self.settings.telegram_chat_id,
                    message=text,
                )

    async def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._purge_future_candles()
                items = self._get_enabled_items()
                if not items:
                    await asyncio.sleep(1)
                    continue

                symbol_to_name = {item.symbol: item.symbol_name for item in items}
                symbols = list(symbol_to_name.keys())
                await self._ensure_seeded_histories(symbols)
                ticks = await self.provider.get_ticks(symbols)
                strategy_settings = self._get_settings()
                if strategy_settings is None:
                    continue

                if ticks:
                    self.last_runtime_error = None

                for tick in ticks:
                    prev = self.latest_quotes.get(tick.symbol)
                    prev_price = prev["price"] if prev else tick.price
                    change_percent = ((tick.price - prev_price) / prev_price * 100) if prev_price else 0.0
                    quote_payload = {
                        "symbol": tick.symbol,
                        "symbol_name": symbol_to_name.get(tick.symbol, tick.symbol),
                        "price": tick.price,
                        "volume": tick.volume,
                        "timestamp": tick.timestamp.isoformat(),
                        "change_percent": round(change_percent, 3),
                    }
                    self.latest_quotes[tick.symbol] = quote_payload
                    self.last_quote_update_at = tick.timestamp
                    await self.ws_manager.broadcast({"type": "live", "data": quote_payload})

                    closed = self.aggregator.add_tick(tick)
                    current_candles = self.aggregator.get_recent_candles(tick.symbol, include_current=True)
                    if current_candles:
                        current_candle = current_candles[-1]
                        await self.ws_manager.broadcast(self._candle_event_payload("candle_update", tick.symbol, current_candle))

                    if closed is None:
                        continue

                    self._upsert_closed_candle(closed)
                    await self.ws_manager.broadcast(self._candle_event_payload("candle_closed", tick.symbol, closed))
                    candles = self.aggregator.get_recent_candles(tick.symbol, include_current=False)
                    await self._handle_closed_candle(
                        symbol=tick.symbol,
                        symbol_name=symbol_to_name.get(tick.symbol, tick.symbol),
                        strategy_settings=strategy_settings,
                        candles=candles,
                    )
            except Exception as exc:
                logger.exception("runtime loop error: %s", exc)
                self.last_runtime_error = str(exc)
                await asyncio.sleep(1)

    def get_dashboard_summary(self) -> dict:
        with SessionLocal() as db:
            start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            today_signals = list(
                db.scalars(
                    select(SignalLog)
                    .where(SignalLog.created_at >= start_of_day)
                    .order_by(desc(SignalLog.created_at))
                ).all()
            )
            items = list(db.scalars(select(WatchlistItem)).all())

        strong_symbols = list(
            {
                f"{signal.symbol_name}({signal.symbol})"
                for signal in today_signals
                if signal.signal_strength == "strong"
            }
        )
        market_status = "mock-open" if self.provider_mode == "mock" else "broker-link"
        return {
            "market_status": market_status,
            "today_signal_count": len(today_signals),
            "strong_signal_count": len([s for s in today_signals if s.signal_strength == "strong"]),
            "strong_symbols": strong_symbols[:5],
            "watchlist_total": len(items),
            "watchlist_enabled": len([item for item in items if item.enabled]),
        }
