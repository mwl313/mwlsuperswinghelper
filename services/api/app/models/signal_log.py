from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SignalLog(Base):
    __tablename__ = "signal_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1, index=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    symbol_name: Mapped[str] = mapped_column(String(80), nullable=False)
    signal_type: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    signal_strength: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    volume: Mapped[float] = mapped_column(Float, nullable=False)
    reason_text: Mapped[str] = mapped_column(String(500), nullable=False)
    raw_payload_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
