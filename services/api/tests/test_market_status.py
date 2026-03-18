import unittest
from datetime import datetime, timezone

from app.workers.runtime import MarketRuntime


class MarketStatusTests(unittest.TestCase):
    def test_regular_market_is_open_on_weekday_session(self) -> None:
        # 2026-03-18 01:00:00 UTC == 2026-03-18 10:00:00 KST (Wednesday)
        now_utc = datetime(2026, 3, 18, 1, 0, tzinfo=timezone.utc)
        self.assertTrue(MarketRuntime._regular_market_is_open(now_utc))

    def test_regular_market_is_closed_outside_session(self) -> None:
        # 2026-03-18 08:00:00 UTC == 2026-03-18 17:00:00 KST
        now_utc = datetime(2026, 3, 18, 8, 0, tzinfo=timezone.utc)
        self.assertFalse(MarketRuntime._regular_market_is_open(now_utc))

    def test_regular_market_is_closed_on_weekend(self) -> None:
        # 2026-03-21 01:00:00 UTC == Saturday 10:00:00 KST
        now_utc = datetime(2026, 3, 21, 1, 0, tzinfo=timezone.utc)
        self.assertFalse(MarketRuntime._regular_market_is_open(now_utc))


if __name__ == "__main__":
    unittest.main()
