import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.services.market_data.base import MarketCandle, MarketDataProvider, Tick

KST = timezone(timedelta(hours=9))
logger = logging.getLogger(__name__)


def _pick(payload: dict[str, Any], keys: list[str]) -> Any:
    for key in keys:
        value = payload.get(key)
        if value not in (None, ""):
            return value
    return None


def _to_float(value: Any, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return default


def _parse_kst_datetime(
    date_raw: str | None,
    time_raw: str | None,
    fallback: datetime,
) -> datetime:
    date_text = (date_raw or "").strip()
    time_text = (time_raw or "").strip()

    if not date_text:
        date_text = fallback.astimezone(KST).strftime("%Y%m%d")
    if len(time_text) == 4:
        time_text = f"{time_text}00"
    if len(time_text) != 6:
        return fallback.astimezone(KST).astimezone(timezone.utc)

    try:
        dt = datetime.strptime(f"{date_text}{time_text}", "%Y%m%d%H%M%S").replace(tzinfo=KST)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return fallback.astimezone(KST).astimezone(timezone.utc)


class KoreaInvestmentAdapter(MarketDataProvider):
    def __init__(
        self,
        app_key: str | None,
        app_secret: str | None,
        base_url: str,
        poll_interval_seconds: float,
        request_timeout_seconds: float,
        market_div_code: str,
        quote_tr_id: str,
        intraday_tr_id: str,
    ) -> None:
        self.app_key = app_key or ""
        self.app_secret = app_secret or ""
        self.base_url = base_url.rstrip("/")
        self.poll_interval_seconds = poll_interval_seconds
        self.request_timeout_seconds = request_timeout_seconds
        self.market_div_code = market_div_code
        self.quote_tr_id = quote_tr_id
        self.intraday_tr_id = intraday_tr_id

        self._access_token: str | None = None
        self._access_token_expires_at: datetime = datetime.now(timezone.utc)
        self._last_cumulative_volume: dict[str, float] = {}

    def _configured(self) -> bool:
        return bool(self.app_key and self.app_secret)

    async def _request_json(
        self,
        method: str,
        path: str,
        *,
        headers: dict[str, str] | None = None,
        params: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        timeout = httpx.Timeout(self.request_timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.request(method, url, headers=headers, params=params, json=json_body)
            response.raise_for_status()
            payload = response.json()
            if isinstance(payload, dict):
                return payload
            return {}

    async def _ensure_access_token(self) -> str | None:
        if not self._configured():
            return None

        now = datetime.now(timezone.utc)
        if self._access_token and now + timedelta(seconds=30) < self._access_token_expires_at:
            return self._access_token

        payload = await self._request_json(
            "POST",
            "/oauth2/tokenP",
            headers={"content-type": "application/json"},
            json_body={
                "grant_type": "client_credentials",
                "appkey": self.app_key,
                "appsecret": self.app_secret,
            },
        )

        token = payload.get("access_token")
        if not token:
            logger.error("KIS token response missing access_token")
            return None

        expires_raw = payload.get("access_token_token_expired")
        expires_at = now + timedelta(hours=6)
        if isinstance(expires_raw, str) and expires_raw.strip():
            try:
                expires_at = datetime.strptime(expires_raw.strip(), "%Y-%m-%d %H:%M:%S").replace(tzinfo=KST).astimezone(timezone.utc)
            except ValueError:
                logger.warning("KIS token expiry parse failed: %s", expires_raw)

        self._access_token = token
        self._access_token_expires_at = expires_at
        return token

    async def _auth_headers(self, tr_id: str) -> dict[str, str] | None:
        token = await self._ensure_access_token()
        if not token:
            return None
        return {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {token}",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
            "tr_id": tr_id,
            "custtype": "P",
        }

    async def _fetch_quote_tick(self, symbol: str) -> Tick | None:
        headers = await self._auth_headers(self.quote_tr_id)
        if headers is None:
            return None

        payload = await self._request_json(
            "GET",
            "/uapi/domestic-stock/v1/quotations/inquire-price",
            headers=headers,
            params={
                "fid_cond_mrkt_div_code": self.market_div_code,
                "fid_input_iscd": symbol,
            },
        )

        output = payload.get("output")
        if not isinstance(output, dict):
            return None

        price = _to_float(_pick(output, ["stck_prpr", "stck_clpr", "last"]))
        if price <= 0:
            return None

        cumulative_volume = _to_float(_pick(output, ["acml_vol", "accumulated_volume"]))
        prev_cumulative = self._last_cumulative_volume.get(symbol)
        if prev_cumulative is None:
            delta_volume = 0.0
        else:
            delta_volume = max(cumulative_volume - prev_cumulative, 0.0)
        self._last_cumulative_volume[symbol] = cumulative_volume

        now_utc = datetime.now(timezone.utc)
        quote_ts = _parse_kst_datetime(
            date_raw=str(_pick(output, ["stck_bsop_date", "bsop_date"]) or ""),
            time_raw=str(_pick(output, ["stck_cntg_hour", "trade_time"]) or ""),
            fallback=now_utc,
        )

        return Tick(symbol=symbol, price=price, volume=delta_volume, timestamp=quote_ts)

    async def get_ticks(self, symbols: list[str]) -> list[Tick]:
        if not symbols:
            await asyncio.sleep(self.poll_interval_seconds)
            return []

        await asyncio.sleep(self.poll_interval_seconds)
        if not self._configured():
            logger.warning("KIS provider selected but APP key/secret are missing")
            return []

        ticks: list[Tick] = []
        for symbol in symbols:
            try:
                tick = await self._fetch_quote_tick(symbol)
            except Exception as exc:
                logger.warning("KIS quote fetch failed for %s: %s", symbol, exc)
                continue
            if tick is None:
                continue
            ticks.append(tick)
        return ticks

    async def get_recent_candles(self, symbol: str, limit: int, before: datetime | None = None) -> list[MarketCandle]:
        if limit <= 0 or not self._configured():
            return []

        headers = await self._auth_headers(self.intraday_tr_id)
        if headers is None:
            return []

        before_utc = None
        before_kst = None
        if before is not None:
            before_utc = before if before.tzinfo else before.replace(tzinfo=timezone.utc)
            before_utc = before_utc.astimezone(timezone.utc)
            before_kst = before_utc.astimezone(KST)

        try:
            payload = await self._request_json(
                "GET",
                "/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice",
                headers=headers,
                params={
                    "fid_etc_cls_code": "",
                    "fid_cond_mrkt_div_code": self.market_div_code,
                    "fid_input_iscd": symbol,
                    "fid_input_hour_1": before_kst.strftime("%H%M%S") if before_kst else "",
                    "fid_pw_data_incu_yn": "Y",
                },
            )
        except Exception as exc:
            logger.warning("KIS intraday candle fetch failed for %s: %s", symbol, exc)
            return []

        rows = payload.get("output2")
        if not isinstance(rows, list):
            return []

        candles: list[MarketCandle] = []
        now_utc = datetime.now(timezone.utc)
        for row in rows:
            if not isinstance(row, dict):
                continue

            timestamp = _parse_kst_datetime(
                date_raw=str(_pick(row, ["stck_bsop_date", "bsop_date", "date"]) or ""),
                time_raw=str(_pick(row, ["stck_cntg_hour", "hour", "time"]) or ""),
                fallback=now_utc,
            )
            open_price = _to_float(_pick(row, ["stck_oprc", "open", "oprc"]))
            high_price = _to_float(_pick(row, ["stck_hgpr", "high", "hgpr"]))
            low_price = _to_float(_pick(row, ["stck_lwpr", "low", "lwpr"]))
            close_price = _to_float(_pick(row, ["stck_prpr", "close", "prpr"]))
            volume = _to_float(_pick(row, ["cntg_vol", "acml_vol", "volume"]))

            if close_price <= 0:
                continue
            if open_price <= 0:
                open_price = close_price
            if high_price <= 0:
                high_price = max(open_price, close_price)
            if low_price <= 0:
                low_price = min(open_price, close_price)

            candles.append(
                MarketCandle(
                    symbol=symbol,
                    timestamp=timestamp,
                    open=open_price,
                    high=high_price,
                    low=low_price,
                    close=close_price,
                    volume=volume,
                )
            )

        if before_utc is not None:
            candles = [row for row in candles if row.timestamp < before_utc]

        # API rows are commonly descending; normalize to ascending and dedupe by timestamp.
        indexed: dict[datetime, MarketCandle] = {}
        for candle in candles:
            indexed[candle.timestamp] = candle
        ordered = sorted(indexed.values(), key=lambda row: row.timestamp)
        if len(ordered) > limit:
            ordered = ordered[-limit:]
        return ordered
