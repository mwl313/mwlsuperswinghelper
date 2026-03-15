from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.workers.runtime import MarketRuntime


def get_runtime(request: Request) -> MarketRuntime:
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is None:
        raise HTTPException(status_code=503, detail="Market runtime is not initialized")
    return runtime


def db_session(db: Session = Depends(get_db)) -> Session:
    return db
