from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, desc, select
from sqlalchemy.orm import Session

from app.api.deps import db_session
from app.models.signal_log import SignalLog
from app.schemas.signal import SignalBulkDeleteResult, SignalDeleteOneResult, SignalLogRead

router = APIRouter(prefix="/signals", tags=["signals"])


@router.get("", response_model=list[SignalLogRead])
def get_signals(
    symbol: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(db_session),
) -> list[SignalLog]:
    query = select(SignalLog).where(SignalLog.user_id == 1).order_by(desc(SignalLog.created_at)).limit(limit)
    if symbol:
        query = query.where(SignalLog.symbol == symbol)
    return list(db.scalars(query).all())


@router.delete("", response_model=SignalBulkDeleteResult)
def delete_signals(
    symbol: str | None = Query(default=None),
    db: Session = Depends(db_session),
) -> SignalBulkDeleteResult:
    statement = delete(SignalLog).where(SignalLog.user_id == 1)
    scope: str = "all"
    if symbol:
        statement = statement.where(SignalLog.symbol == symbol)
        scope = "symbol"

    result = db.execute(statement)
    db.commit()

    return SignalBulkDeleteResult(
        deletedCount=result.rowcount or 0,
        scope=scope,
        symbol=symbol,
    )


@router.delete("/{signal_id}", response_model=SignalDeleteOneResult)
def delete_signal(signal_id: int, db: Session = Depends(db_session)) -> SignalDeleteOneResult:
    row = db.get(SignalLog, signal_id)
    if row is None or row.user_id != 1:
        raise HTTPException(status_code=404, detail="Signal log not found")

    db.delete(row)
    db.commit()
    return SignalDeleteOneResult(deleted=True, id=signal_id)
