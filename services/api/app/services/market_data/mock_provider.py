import asyncio
import random
from datetime import datetime, timedelta, timezone

from app.services.market_data.base import MarketCandle, MarketDataProvider, Tick


class MockMarketDataProvider(MarketDataProvider):
    """
    Local development provider:
    - sleeps by real seconds
    - advances market timestamp by 1 minute each cycle
    """

    def __init__(self, interval_seconds: float = 1.0, volatility: float = 0.012) -> None:
        self.interval_seconds = interval_seconds
        self.volatility = volatility
        self._price_state: dict[str, float] = {}
        self._rand = random.Random(42)
        self._virtual_market_time = datetime.now(timezone.utc).replace(second=0, microsecond=0)

    async def get_ticks(self, symbols: list[str]) -> list[Tick]:
        if not symbols:
            await asyncio.sleep(self.interval_seconds)
            return []

        await asyncio.sleep(self.interval_seconds)
        self._virtual_market_time += timedelta(minutes=1)

        ticks: list[Tick] = []
        for symbol in symbols:
            last_price = self._price_state.get(symbol, self._rand.uniform(30000, 180000))
            drift = self._rand.uniform(-self.volatility, self.volatility)
            if self._rand.random() < 0.08:
                drift *= 2.8

            price = max(1000.0, round(last_price * (1 + drift), 2))
            volume = float(self._rand.randint(200, 3500))
            if self._rand.random() < 0.18:
                volume *= self._rand.randint(2, 5)

            self._price_state[symbol] = price
            ticks.append(Tick(symbol=symbol, price=price, volume=volume, timestamp=self._virtual_market_time))

        return ticks

    async def get_recent_candles(self, symbol: str, limit: int) -> list[MarketCandle]:
        # Mock mode keeps startup simple; runtime builds candles from streamed ticks.
        return []
