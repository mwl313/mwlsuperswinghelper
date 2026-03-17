import unittest
from datetime import datetime, timedelta, timezone

from app.services.market_data.mock_provider import MockMarketDataProvider


class MockTimeAlignmentTests(unittest.IsolatedAsyncioTestCase):
    async def test_align_virtual_time_moves_forward(self) -> None:
        provider = MockMarketDataProvider(interval_seconds=0.0)
        base = datetime.now(timezone.utc).replace(second=0, microsecond=0) + timedelta(hours=2)
        provider.align_virtual_time(base)

        ticks = await provider.get_ticks(["005930"])
        self.assertEqual(len(ticks), 1)
        self.assertEqual(ticks[0].timestamp, base + timedelta(minutes=1))

    async def test_align_virtual_time_does_not_move_backward(self) -> None:
        provider = MockMarketDataProvider(interval_seconds=0.0)
        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        ahead = now + timedelta(hours=4)
        behind = now + timedelta(hours=1)
        provider.align_virtual_time(ahead)
        provider.align_virtual_time(behind)

        ticks = await provider.get_ticks(["005930"])
        self.assertEqual(ticks[0].timestamp, ahead + timedelta(minutes=1))


if __name__ == "__main__":
    unittest.main()
