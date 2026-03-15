from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import db_session
from app.models.strategy_settings import StrategySettings
from app.schemas.settings import StrategySettingsRead, StrategySettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create_settings(db: Session) -> StrategySettings:
    row = db.scalar(select(StrategySettings).where(StrategySettings.user_id == 1))
    if row is None:
        row = StrategySettings(user_id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("", response_model=StrategySettingsRead)
def get_settings(db: Session = Depends(db_session)) -> StrategySettings:
    return _get_or_create_settings(db)


@router.put("", response_model=StrategySettingsRead)
def update_settings(payload: StrategySettingsUpdate, db: Session = Depends(db_session)) -> StrategySettings:
    row = _get_or_create_settings(db)
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row
