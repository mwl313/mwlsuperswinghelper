import asyncio
from datetime import datetime, timezone

from app.services.market_data.base import MarketDataProvider, Tick


class KoreaInvestmentAdapter(MarketDataProvider):
    """
    Placeholder adapter for future real broker integration.

    Replace `get_ticks` with:
    - websocket auth
    - realtime trade/volume subscription
    - symbol routing and reconnection logic
    """

    def __init__(self, app_key: str | None, app_secret: str | None) -> None:
        self.app_key = app_key
        self.app_secret = app_secret

    async def get_ticks(self, symbols: list[str]) -> list[Tick]:
        # Stub for MVP: keep app runnable without real API keys.
        await asyncio.sleep(1.0)
        now = datetime.now(timezone.utc)
        return [Tick(symbol=symbol, price=0.0, volume=0.0, timestamp=now) for symbol in symbols]
