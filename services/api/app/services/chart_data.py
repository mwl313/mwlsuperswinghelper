from datetime import datetime, timezone

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
)
from app.services.candles import Candle
from app.services.indicators import bollinger, rsi, sma
from app.workers.runtime import MarketRuntime

_SIGNAL_TITLE_MAP = {
    "buy_candidate": "매수 후보",
    "breakout": "돌파 감시",
    "sell_warning": "매도 경고",
}
_TIMEFRAME = "1m"


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


def _load_persisted_closed_candles(symbol: str, limit: int, db: Session) -> list[Candle]:
    query = (
        select(CandleHistory)
        .where(CandleHistory.symbol == symbol, CandleHistory.timeframe == _TIMEFRAME)
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


def get_chart_response(
    symbol: str,
    limit: int,
    runtime: MarketRuntime,
    db: Session,
) -> ChartResponse:
    persisted = _load_persisted_closed_candles(symbol=symbol, limit=limit, db=db)
    current = runtime.aggregator.get_current_candle(symbol=symbol)

    merged_candles = persisted.copy()
    if current is not None:
        merged_candles.append(current)
    merged_candles = _dedupe_sort_candles(merged_candles)
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
    signal_query = select(SignalLog).where(SignalLog.symbol == symbol)
    if candle_start_ts is not None:
        signal_query = signal_query.where(SignalLog.created_at >= candle_start_ts)
    signal_query = signal_query.order_by(desc(SignalLog.created_at)).limit(limit)
    signal_rows = list(db.scalars(signal_query).all())

    return ChartResponse(
        symbol=symbol,
        timeframe=_TIMEFRAME,
        candles=candle_rows,
        overlays=build_chart_overlays(merged_candles),
        markers=to_chart_markers(signal_rows),
    )
