import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.candles import Candle
from app.services.chart_data import build_chart_overlays, to_chart_markers


class ChartDataServiceTests(unittest.TestCase):
    def _build_candles(self, count: int) -> list[Candle]:
        start = datetime(2026, 3, 16, 0, 0, tzinfo=timezone.utc)
        candles: list[Candle] = []
        for index in range(count):
            price = 100.0 + index
            candles.append(
                Candle(
                    symbol="005930",
                    timestamp=start + timedelta(minutes=index),
                    open=price,
                    high=price + 0.8,
                    low=price - 0.7,
                    close=price + 0.2,
                    volume=1000 + index * 10,
                )
            )
        return candles

    def test_build_chart_overlays_returns_expected_lengths(self) -> None:
        candles = self._build_candles(80)
        overlays = build_chart_overlays(candles)

        self.assertEqual(len(overlays.ma20), 61)
        self.assertEqual(len(overlays.ma60), 21)
        self.assertEqual(len(overlays.bollinger_upper), 61)
        self.assertEqual(len(overlays.bollinger_mid), 61)
        self.assertEqual(len(overlays.bollinger_lower), 61)
        self.assertEqual(len(overlays.rsi14), 66)

    def test_to_chart_markers_sorts_rows_and_maps_titles(self) -> None:
        now = datetime(2026, 3, 16, 9, 0, tzinfo=timezone.utc)
        rows = [
            SimpleNamespace(
                created_at=now + timedelta(minutes=2),
                signal_type="sell_warning",
                signal_strength="strong",
                reason_text="중앙선 하향 이탈",
            ),
            SimpleNamespace(
                created_at=now,
                signal_type="buy_candidate",
                signal_strength="medium",
                reason_text="중앙선 지지 + 거래량 증가",
            ),
        ]

        markers = to_chart_markers(rows)

        self.assertEqual(markers[0].type, "buy_candidate")
        self.assertEqual(markers[0].title, "매수 후보")
        self.assertEqual(markers[1].type, "sell_warning")
        self.assertEqual(markers[1].title, "매도 경고")


if __name__ == "__main__":
    unittest.main()
