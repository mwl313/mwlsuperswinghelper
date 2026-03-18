from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.candle_history import CandleHistory
from app.models.signal_log import SignalLog
from app.schemas.chart import (
    ChartCandle,
    ChartMarker,
    ChartOverlayPoint,
    ChartOverlays,
    ChartResponse,
    ChartTimeframe,
)
from app.services.candles import Candle
from app.services.indicators import bollinger, rsi, sma
from app.workers.runtime import MarketRuntime

_SIGNAL_TITLE_MAP = {
    "buy_candidate": "매수 후보",
    "breakout": "돌파 감시",
    "sell_warning": "매도 경고",
}
_BASE_TIMEFRAME = "1m"
_TIMEFRAME_TO_MINUTES: dict[ChartTimeframe, int] = {
    "1m": 1,
    "5m": 5,
    "15m": 15,
    "1h": 60,
}


def _overlay_points_from_sma(candles: list[Candle], period: int) -> list[ChartOverlayPoint]:
    closes = [row.close for row in candles]
    points: list[ChartOverlayPoint] = []
    for index, candle in enumerate(candles):
        value = sma(closes[: index + 1], period)
        if value is None:
            continue
        points.append(ChartOverlayPoint(timestamp=candle.timestamp, value=round(value, 4)))
    return points


def _overlay_points_from_rsi(candles: list[Candle], period: int = 14) -> list[ChartOverlayPoint]:
    closes = [row.close for row in candles]
    points: list[ChartOverlayPoint] = []
    for index, candle in enumerate(candles):
        value = rsi(closes[: index + 1], period)
        if value is None:
            continue
        points.append(ChartOverlayPoint(timestamp=candle.timestamp, value=round(value, 4)))
    return points


def _bollinger_overlay_points(
    candles: list[Candle], length: int, std_factor: float
) -> tuple[list[ChartOverlayPoint], list[ChartOverlayPoint], list[ChartOverlayPoint]]:
    closes = [row.close for row in candles]
    upper_points: list[ChartOverlayPoint] = []
    mid_points: list[ChartOverlayPoint] = []
    lower_points: list[ChartOverlayPoint] = []
    for index, candle in enumerate(candles):
        value = bollinger(closes[: index + 1], length, std_factor)
        if value is None:
            continue
        mid, upper, lower = value
        upper_points.append(ChartOverlayPoint(timestamp=candle.timestamp, value=round(upper, 4)))
        mid_points.append(ChartOverlayPoint(timestamp=candle.timestamp, value=round(mid, 4)))
        lower_points.append(ChartOverlayPoint(timestamp=candle.timestamp, value=round(lower, 4)))
    return upper_points, mid_points, lower_points


def build_chart_overlays(candles: list[Candle]) -> ChartOverlays:
    ma20 = _overlay_points_from_sma(candles, period=20)
    ma60 = _overlay_points_from_sma(candles, period=60)
    bb_upper, bb_mid, bb_lower = _bollinger_overlay_points(candles, length=20, std_factor=2.0)
    rsi14 = _overlay_points_from_rsi(candles, period=14)
    return ChartOverlays(
        ma20=ma20,
        ma60=ma60,
        bollinger_upper=bb_upper,
        bollinger_mid=bb_mid,
        bollinger_lower=bb_lower,
        rsi14=rsi14,
    )


def to_chart_markers(signal_rows: list[SignalLog]) -> list[ChartMarker]:
    rows = sorted(signal_rows, key=lambda row: row.created_at)
    markers: list[ChartMarker] = []
    for row in rows:
        markers.append(
            ChartMarker(
                timestamp=row.created_at,
                type=row.signal_type,
                strength=row.signal_strength,
                title=_SIGNAL_TITLE_MAP.get(row.signal_type, row.signal_type),
                description=row.reason_text,
            )
        )
    return markers


def _normalize_ts(ts: datetime) -> datetime:
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(timezone.utc)


def _dedupe_sort_candles(candles: list[Candle]) -> list[Candle]:
    indexed: dict[datetime, Candle] = {}
    for candle in candles:
        normalized = _normalize_ts(candle.timestamp)
        indexed[normalized] = Candle(
            symbol=candle.symbol,
            timestamp=normalized,
            open=candle.open,
            high=candle.high,
            low=candle.low,
            close=candle.close,
            volume=candle.volume,
        )
    return sorted(indexed.values(), key=lambda row: row.timestamp)


def _load_persisted_closed_candles(
    symbol: str,
    limit: int,
    db: Session,
    before: datetime | None = None,
) -> list[Candle]:
    upper_bound = datetime.now(timezone.utc) + timedelta(minutes=2)
    before_utc = _normalize_ts(before) if before else None
    query = (
        select(CandleHistory)
        .where(
            CandleHistory.symbol == symbol,
            CandleHistory.timeframe == _BASE_TIMEFRAME,
            CandleHistory.timestamp <= upper_bound if before_utc is None else CandleHistory.timestamp < before_utc,
        )
        .order_by(desc(CandleHistory.timestamp))
        .limit(limit)
    )
    rows = list(db.scalars(query).all())
    rows.reverse()
    return [
        Candle(
            symbol=row.symbol,
            timestamp=_normalize_ts(row.timestamp),
            open=row.open,
            high=row.high,
            low=row.low,
            close=row.close,
            volume=row.volume,
        )
        for row in rows
    ]


def _bucket_start(ts: datetime, timeframe: ChartTimeframe) -> datetime:
    normalized = _normalize_ts(ts)
    bucket_seconds = _TIMEFRAME_TO_MINUTES[timeframe] * 60
    epoch = int(normalized.timestamp())
    bucket = epoch - (epoch % bucket_seconds)
    return datetime.fromtimestamp(bucket, tz=timezone.utc)


def _aggregate_candles(candles: list[Candle], timeframe: ChartTimeframe) -> list[Candle]:
    if timeframe == "1m":
        return _dedupe_sort_candles(candles)

    if not candles:
        return []

    ordered = _dedupe_sort_candles(candles)
    grouped: dict[datetime, Candle] = {}

    for row in ordered:
        bucket_ts = _bucket_start(row.timestamp, timeframe)
        current = grouped.get(bucket_ts)
        if current is None:
            grouped[bucket_ts] = Candle(
                symbol=row.symbol,
                timestamp=bucket_ts,
                open=row.open,
                high=row.high,
                low=row.low,
                close=row.close,
                volume=row.volume,
            )
            continue

        current.high = max(current.high, row.high)
        current.low = min(current.low, row.low)
        current.close = row.close
        current.volume += row.volume

    return sorted(grouped.values(), key=lambda item: item.timestamp)


def get_chart_response(
    symbol: str,
    limit: int,
    timeframe: ChartTimeframe,
    runtime: MarketRuntime,
    db: Session,
    before: datetime | None = None,
) -> ChartResponse:
    fetch_limit = limit * _TIMEFRAME_TO_MINUTES[timeframe] + _TIMEFRAME_TO_MINUTES[timeframe]
    persisted = _load_persisted_closed_candles(symbol=symbol, limit=fetch_limit, db=db, before=before)
    current = runtime.aggregator.get_current_candle(symbol=symbol)

    merged_candles_1m = persisted.copy()
    if current is not None and before is None:
        merged_candles_1m.append(current)

    merged_candles = _aggregate_candles(merged_candles_1m, timeframe=timeframe)
    if len(merged_candles) > limit:
        merged_candles = merged_candles[-limit:]

    candle_rows = [
        ChartCandle(
            timestamp=row.timestamp,
            open=row.open,
            high=row.high,
            low=row.low,
            close=row.close,
            volume=row.volume,
        )
        for row in merged_candles
    ]

    candle_start_ts: datetime | None = merged_candles[0].timestamp if merged_candles else None
    candle_end_ts: datetime | None = merged_candles[-1].timestamp if merged_candles else None
    signal_query = select(SignalLog).where(SignalLog.symbol == symbol, SignalLog.user_id == 1)
    if candle_start_ts is not None:
        signal_query = signal_query.where(SignalLog.created_at >= candle_start_ts)
    if candle_end_ts is not None:
        signal_query = signal_query.where(SignalLog.created_at <= candle_end_ts)
    signal_query = signal_query.order_by(desc(SignalLog.created_at)).limit(max(200, limit * 3))
    signal_rows = list(db.scalars(signal_query).all())

    return ChartResponse(
        symbol=symbol,
        timeframe=timeframe,
        candles=candle_rows,
        overlays=build_chart_overlays(merged_candles),
        markers=to_chart_markers(signal_rows),
    )
