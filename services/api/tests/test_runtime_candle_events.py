import unittest
from datetime import datetime, timezone

from app.services.candles import Candle
from app.workers.runtime import MarketRuntime


class RuntimeCandleEventTests(unittest.TestCase):
    def test_candle_event_payload_shape(self) -> None:
        candle = Candle(
            symbol="005930",
            timestamp=datetime(2026, 3, 16, 1, 30, tzinfo=timezone.utc),
            open=100.0,
            high=101.0,
            low=99.5,
            close=100.3,
            volume=1234.0,
        )

        payload = MarketRuntime._candle_event_payload("candle_update", "005930", candle)

        self.assertEqual(payload["type"], "candle_update")
        self.assertEqual(payload["symbol"], "005930")
        self.assertEqual(payload["timeframe"], "1m")
        self.assertIn("candle", payload)
        self.assertEqual(payload["candle"]["close"], 100.3)


if __name__ == "__main__":
    unittest.main()
