import unittest
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.models.candle_history import CandleHistory
from app.services.candles import Candle
from app.services.chart_data import get_chart_response


class _FakeAggregator:
    def __init__(self, current: Candle | None) -> None:
        self._current = current

    def get_current_candle(self, symbol: str) -> Candle | None:
        if self._current is None:
            return None
        return self._current if self._current.symbol == symbol else None


class _FakeRuntime:
    def __init__(self, current: Candle | None) -> None:
        self.aggregator = _FakeAggregator(current=current)


class ChartHistoryPersistenceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)

    def tearDown(self) -> None:
        self.engine.dispose()

    def _insert_closed_rows(self, db: Session, base: datetime, count: int) -> None:
        for index in range(count):
            ts = base + timedelta(minutes=index)
            price = 100 + index
            db.add(
                CandleHistory(
                    symbol="005930",
                    timeframe="1m",
                    timestamp=ts,
                    open=price,
                    high=price + 1,
                    low=price - 1,
                    close=price + 0.2,
                    volume=1000 + index * 10,
                )
            )
        db.commit()

    def test_chart_response_merges_persisted_and_current_candle(self) -> None:
        base = datetime(2026, 3, 16, 0, 0, tzinfo=timezone.utc)
        with self.SessionLocal() as db:
            self._insert_closed_rows(db, base, 3)
            current = Candle(
                symbol="005930",
                timestamp=base + timedelta(minutes=3),
                open=103.0,
                high=104.0,
                low=102.5,
                close=103.7,
                volume=1550.0,
            )
            runtime = _FakeRuntime(current=current)
            response = get_chart_response(symbol="005930", limit=10, timeframe="1m", runtime=runtime, db=db)

        self.assertEqual(len(response.candles), 4)
        self.assertEqual(response.candles[-1].timestamp, current.timestamp)
        self.assertAlmostEqual(response.candles[-1].close, 103.7)

    def test_current_candle_overrides_same_timestamp(self) -> None:
        base = datetime(2026, 3, 16, 0, 0, tzinfo=timezone.utc)
        with self.SessionLocal() as db:
            self._insert_closed_rows(db, base, 3)
            duplicate_ts = base + timedelta(minutes=2)
            current = Candle(
                symbol="005930",
                timestamp=duplicate_ts,
                open=111.0,
                high=112.0,
                low=110.0,
                close=111.5,
                volume=3333.0,
            )
            runtime = _FakeRuntime(current=current)
            response = get_chart_response(symbol="005930", limit=10, timeframe="1m", runtime=runtime, db=db)

        self.assertEqual(len(response.candles), 3)
        self.assertEqual(response.candles[-1].timestamp, duplicate_ts)
        self.assertAlmostEqual(response.candles[-1].close, 111.5)

    def test_chart_response_aggregates_5m_from_1m_source(self) -> None:
        base = datetime(2026, 3, 16, 0, 0, tzinfo=timezone.utc)
        with self.SessionLocal() as db:
            for index in range(10):
                ts = base + timedelta(minutes=index)
                db.add(
                    CandleHistory(
                        symbol="005930",
                        timeframe="1m",
                        timestamp=ts,
                        open=100 + index,
                        high=101 + index,
                        low=99 + index,
                        close=100.5 + index,
                        volume=1000 + index,
                    )
                )
            db.commit()
            runtime = _FakeRuntime(current=None)
            response = get_chart_response(symbol="005930", limit=10, timeframe="5m", runtime=runtime, db=db)

        self.assertEqual(response.timeframe, "5m")
        self.assertEqual(len(response.candles), 2)

        first = response.candles[0]
        self.assertEqual(first.timestamp, base)
        self.assertAlmostEqual(first.open, 100.0)
        self.assertAlmostEqual(first.high, 105.0)
        self.assertAlmostEqual(first.low, 99.0)
        self.assertAlmostEqual(first.close, 104.5)
        self.assertAlmostEqual(first.volume, 1000 + 1001 + 1002 + 1003 + 1004)

    def test_chart_response_before_returns_older_slice(self) -> None:
        base = datetime(2026, 3, 16, 0, 0, tzinfo=timezone.utc)
        with self.SessionLocal() as db:
            self._insert_closed_rows(db, base, 20)
            runtime = _FakeRuntime(current=None)
            response = get_chart_response(
                symbol="005930",
                limit=5,
                timeframe="1m",
                runtime=runtime,
                db=db,
                before=base + timedelta(minutes=10),
            )

        self.assertEqual(len(response.candles), 5)
        self.assertEqual(response.candles[0].timestamp, base + timedelta(minutes=5))
        self.assertEqual(response.candles[-1].timestamp, base + timedelta(minutes=9))


if __name__ == "__main__":
    unittest.main()
