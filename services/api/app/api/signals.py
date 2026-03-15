from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import db_session
from app.models.signal_log import SignalLog
from app.schemas.signal import SignalLogRead

router = APIRouter(prefix="/signals", tags=["signals"])


@router.get("", response_model=list[SignalLogRead])
def get_signals(
    symbol: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(db_session),
) -> list[SignalLog]:
    query = select(SignalLog).order_by(desc(SignalLog.created_at)).limit(limit)
    if symbol:
        query = query.where(SignalLog.symbol == symbol)
    return list(db.scalars(query).all())
