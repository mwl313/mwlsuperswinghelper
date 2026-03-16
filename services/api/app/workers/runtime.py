import asyncio
from collections import deque
from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.signal_log import SignalLog
from app.models.strategy_settings import StrategySettings
from app.models.watchlist import WatchlistItem
from app.services.candles import Candle, CandleAggregator
from app.services.market_data.base import MarketDataProvider
from app.services.market_data.kis_adapter import KoreaInvestmentAdapter
from app.services.market_data.mock_provider import MockMarketDataProvider
from app.services.notifications.telegram import send_telegram_message
from app.services.signals.engine import SignalDecision, evaluate_signals
from app.services.ws_manager import WSManager


class MarketRuntime:
    def __init__(self, ws_manager: WSManager) -> None:
        settings = get_settings()
        self.settings = settings
        self.ws_manager = ws_manager
        self.provider = self._build_provider()
        self.aggregator = CandleAggregator(
            candle_seconds=settings.candle_seconds,
            max_candles_per_symbol=settings.max_candles_per_symbol,
        )
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()
        self.last_signal_times: dict[tuple[str, str], datetime] = {}
        self.latest_quotes: dict[str, dict] = {}
        self.recent_signals: deque[dict] = deque(maxlen=200)

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

    def _build_provider(self) -> MarketDataProvider:
        if self.settings.market_data_provider == "kis":
            return KoreaInvestmentAdapter(
                app_key=self.settings.kis_app_key,
                app_secret=self.settings.kis_app_secret,
            )
        return MockMarketDataProvider(
            interval_seconds=self.settings.mock_tick_interval_seconds,
            volatility=self.settings.mock_price_volatility,
        )

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task:
            await self._task

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
            items = self._get_enabled_items()
            if not items:
                await asyncio.sleep(1)
                continue

            symbol_to_name = {item.symbol: item.symbol_name for item in items}
            symbols = list(symbol_to_name.keys())
            ticks = await self.provider.get_ticks(symbols)
            strategy_settings = self._get_settings()
            if strategy_settings is None:
                continue

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
                await self.ws_manager.broadcast({"type": "live", "data": quote_payload})

                closed = self.aggregator.add_tick(tick)
                current_candles = self.aggregator.get_recent_candles(tick.symbol, include_current=True)
                if current_candles:
                    current_candle = current_candles[-1]
                    await self.ws_manager.broadcast(self._candle_event_payload("candle_update", tick.symbol, current_candle))

                if closed is None:
                    continue

                await self.ws_manager.broadcast(self._candle_event_payload("candle_closed", tick.symbol, closed))
                candles = self.aggregator.get_recent_candles(tick.symbol, include_current=False)
                await self._handle_closed_candle(
                    symbol=tick.symbol,
                    symbol_name=symbol_to_name.get(tick.symbol, tick.symbol),
                    strategy_settings=strategy_settings,
                    candles=candles,
                )

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
        market_status = "mock-open" if self.settings.market_data_provider == "mock" else "broker-link"
        return {
            "market_status": market_status,
            "today_signal_count": len(today_signals),
            "strong_signal_count": len([s for s in today_signals if s.signal_strength == "strong"]),
            "strong_symbols": strong_symbols[:5],
            "watchlist_total": len(items),
            "watchlist_enabled": len([item for item in items if item.enabled]),
        }
