import unittest
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.signals import delete_signal, delete_signals, get_signals
from app.db.base import Base
from app.models.signal_log import SignalLog


class SignalDeleteApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)

    def tearDown(self) -> None:
        self.engine.dispose()

    def _seed(self) -> None:
        with self.SessionLocal() as db:
            db.add_all(
                [
                    SignalLog(
                        user_id=1,
                        symbol="005930",
                        symbol_name="삼성전자",
                        signal_type="buy_candidate",
                        signal_strength="medium",
                        price=70000,
                        volume=1000,
                        reason_text="test-1",
                        raw_payload_json={},
                        created_at=datetime.now(timezone.utc),
                    ),
                    SignalLog(
                        user_id=1,
                        symbol="005930",
                        symbol_name="삼성전자",
                        signal_type="breakout",
                        signal_strength="strong",
                        price=70100,
                        volume=1200,
                        reason_text="test-2",
                        raw_payload_json={},
                        created_at=datetime.now(timezone.utc),
                    ),
                    SignalLog(
                        user_id=1,
                        symbol="000660",
                        symbol_name="SK하이닉스",
                        signal_type="sell_warning",
                        signal_strength="weak",
                        price=120000,
                        volume=900,
                        reason_text="test-3",
                        raw_payload_json={},
                        created_at=datetime.now(timezone.utc),
                    ),
                ]
            )
            db.commit()

    def test_delete_signals_by_symbol(self) -> None:
        self._seed()
        with self.SessionLocal() as db:
            result = delete_signals(symbol="005930", db=db)
            self.assertEqual(result.scope, "symbol")
            self.assertEqual(result.deletedCount, 2)

            rows = get_signals(symbol=None, limit=100, db=db)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0].symbol, "000660")

    def test_delete_signal_one(self) -> None:
        self._seed()
        with self.SessionLocal() as db:
            rows = get_signals(symbol=None, limit=100, db=db)
            target_id = rows[0].id

            result = delete_signal(signal_id=target_id, db=db)
            self.assertTrue(result.deleted)
            self.assertEqual(result.id, target_id)

            remains = get_signals(symbol=None, limit=100, db=db)
            self.assertEqual(len(remains), 2)

    def test_delete_all_signals(self) -> None:
        self._seed()
        with self.SessionLocal() as db:
            result = delete_signals(symbol=None, db=db)
            self.assertEqual(result.scope, "all")
            self.assertEqual(result.deletedCount, 3)

            rows = get_signals(symbol=None, limit=100, db=db)
            self.assertEqual(len(rows), 0)


if __name__ == "__main__":
    unittest.main()
