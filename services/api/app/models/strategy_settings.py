from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StrategySettings(Base):
    __tablename__ = "strategy_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True, default=1)

    ma_short: Mapped[int] = mapped_column(Integer, default=20)
    ma_long: Mapped[int] = mapped_column(Integer, default=60)
    bollinger_length: Mapped[int] = mapped_column(Integer, default=20)
    bollinger_std: Mapped[float] = mapped_column(Float, default=2.0)
    volume_multiplier: Mapped[float] = mapped_column(Float, default=1.5)
    use_rsi: Mapped[bool] = mapped_column(Boolean, default=False)
    use_breakout: Mapped[bool] = mapped_column(Boolean, default=True)
    use_bollinger_support: Mapped[bool] = mapped_column(Boolean, default=True)
    use_trend_filter: Mapped[bool] = mapped_column(Boolean, default=True)
    use_volume_surge: Mapped[bool] = mapped_column(Boolean, default=True)
    signal_strength_mode: Mapped[str] = mapped_column(String(20), default="strong_only")
    cooldown_minutes: Mapped[int] = mapped_column(Integer, default=10)
    enable_desktop_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    enable_telegram_notifications: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
