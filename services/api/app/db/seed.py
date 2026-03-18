from sqlalchemy import select

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.strategy_settings import StrategySettings
from app.models.watchlist import Watchlist, WatchlistItem

DEFAULT_ITEMS = [
    ("005930", "삼성전자"),
    ("000660", "SK하이닉스"),
    ("035420", "NAVER"),
    ("051910", "LG화학"),
    ("068270", "셀트리온"),
]


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        created_default_watchlist = False
        watchlist = db.scalar(select(Watchlist).where(Watchlist.user_id == 1, Watchlist.name == "기본 워치리스트"))
        if watchlist is None:
            watchlist = Watchlist(user_id=1, name="기본 워치리스트")
            db.add(watchlist)
            db.flush()
            created_default_watchlist = True

        # 기본 종목은 "최초 설치/최초 생성" 시에만 넣고,
        # 이후에는 사용자가 삭제/수정한 상태를 그대로 유지한다.
        if created_default_watchlist:
            for symbol, symbol_name in DEFAULT_ITEMS:
                db.add(
                    WatchlistItem(
                        watchlist_id=watchlist.id,
                        symbol=symbol,
                        symbol_name=symbol_name,
                        enabled=True,
                    )
                )

        settings = db.scalar(select(StrategySettings).where(StrategySettings.user_id == 1))
        if settings is None:
            db.add(
                StrategySettings(
                    user_id=1,
                    ma_short=20,
                    ma_long=60,
                    bollinger_length=20,
                    bollinger_std=2.0,
                    volume_multiplier=1.5,
                    use_rsi=False,
                    use_breakout=True,
                    use_bollinger_support=True,
                    use_trend_filter=True,
                    use_volume_surge=True,
                    signal_strength_mode="strong_only",
                    cooldown_minutes=10,
                    enable_desktop_notifications=True,
                    enable_telegram_notifications=False,
                )
            )

        db.commit()
