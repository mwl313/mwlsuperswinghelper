from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(slots=True)
class Tick:
    symbol: str
    price: float
    volume: float
    timestamp: datetime


@dataclass(slots=True)
class MarketCandle:
    symbol: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class MarketDataProvider(Protocol):
    async def get_ticks(self, symbols: list[str]) -> list[Tick]:
        ...

    async def get_recent_candles(self, symbol: str, limit: int, before: datetime | None = None) -> list[MarketCandle]:
        ...
