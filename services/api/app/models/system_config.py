from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SystemConfig(Base):
    __tablename__ = "system_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    provider_mode: Mapped[str] = mapped_column(String(12), nullable=False, default="mock")
    kis_app_key: Mapped[str | None] = mapped_column(String(200), nullable=True)
    kis_app_secret: Mapped[str | None] = mapped_column(String(200), nullable=True)
    kis_base_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

