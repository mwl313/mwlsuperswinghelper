import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.watchlist import Watchlist, WatchlistItem
from app.services.symbol_lookup import search_symbols


class SymbolLookupSearchTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_exact_code_match_is_prioritized(self) -> None:
        rows = search_symbols("005930", db=None, limit=10)
        self.assertGreaterEqual(len(rows), 1)
        self.assertEqual(rows[0]["symbol"], "005930")

    def test_partial_name_returns_matches(self) -> None:
        rows = search_symbols("삼성", db=None, limit=20)
        self.assertGreaterEqual(len(rows), 1)
        self.assertTrue(any("삼성" in str(row["symbol_name"]) for row in rows))

    def test_watchlist_symbol_is_searchable(self) -> None:
        with self.SessionLocal() as db:
            watchlist = Watchlist(user_id=1, name="기본")
            db.add(watchlist)
            db.flush()
            db.add(
                WatchlistItem(
                    watchlist_id=watchlist.id,
                    symbol="123456",
                    symbol_name="테스트종목",
                    enabled=True,
                )
            )
            db.commit()

            rows = search_symbols("테스트", db=db, limit=10)
            self.assertTrue(any(row["symbol"] == "123456" for row in rows))


if __name__ == "__main__":
    unittest.main()
