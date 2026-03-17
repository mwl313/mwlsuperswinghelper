from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone

from app.services.market_data.base import Tick


@dataclass(slots=True)
class Candle:
    symbol: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class CandleAggregator:
    def __init__(self, candle_seconds: int = 60, max_candles_per_symbol: int = 240) -> None:
        self.candle_seconds = candle_seconds
        self.max_candles_per_symbol = max_candles_per_symbol
        self._current: dict[str, Candle] = {}
        self._history: dict[str, deque[Candle]] = {}

    def _bucket_start(self, ts: datetime) -> datetime:
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        epoch = int(ts.timestamp())
        bucket = epoch - (epoch % self.candle_seconds)
        return datetime.fromtimestamp(bucket, tz=timezone.utc)

    def add_tick(self, tick: Tick) -> Candle | None:
        bucket_ts = self._bucket_start(tick.timestamp)
        current = self._current.get(tick.symbol)
        if current is None:
            self._current[tick.symbol] = Candle(
                symbol=tick.symbol,
                timestamp=bucket_ts,
                open=tick.price,
                high=tick.price,
                low=tick.price,
                close=tick.price,
                volume=tick.volume,
            )
            return None

        if current.timestamp == bucket_ts:
            current.high = max(current.high, tick.price)
            current.low = min(current.low, tick.price)
            current.close = tick.price
            current.volume += tick.volume
            return None

        history = self._history.setdefault(tick.symbol, deque(maxlen=self.max_candles_per_symbol))
        history.append(current)
        self._current[tick.symbol] = Candle(
            symbol=tick.symbol,
            timestamp=bucket_ts,
            open=tick.price,
            high=tick.price,
            low=tick.price,
            close=tick.price,
            volume=tick.volume,
        )
        return current

    def get_recent_candles(self, symbol: str, include_current: bool = True) -> list[Candle]:
        candles = list(self._history.get(symbol, []))
        if include_current and symbol in self._current:
            candles.append(self._current[symbol])
        return candles

    def get_current_candle(self, symbol: str) -> Candle | None:
        return self._current.get(symbol)

    def seed_closed_candles(self, symbol: str, candles: list[Candle]) -> None:
        indexed: dict[datetime, Candle] = {}
        for candle in candles:
            indexed[candle.timestamp] = Candle(
                symbol=symbol,
                timestamp=candle.timestamp,
                open=candle.open,
                high=candle.high,
                low=candle.low,
                close=candle.close,
                volume=candle.volume,
            )

        ordered = sorted(indexed.values(), key=lambda row: row.timestamp)
        history = deque(maxlen=self.max_candles_per_symbol)
        for candle in ordered[-self.max_candles_per_symbol :]:
            history.append(candle)
        self._history[symbol] = history
        self._current.pop(symbol, None)
