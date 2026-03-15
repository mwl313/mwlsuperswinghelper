from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(slots=True)
class Tick:
    symbol: str
    price: float
    volume: float
    timestamp: datetime


class MarketDataProvider(Protocol):
    async def get_ticks(self, symbols: list[str]) -> list[Tick]:
        ...
