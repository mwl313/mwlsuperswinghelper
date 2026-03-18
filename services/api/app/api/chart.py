from datetime import datetime

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_runtime
from app.schemas.chart import ChartResponse, ChartTimeframe
from app.services.chart_data import get_chart_response
from app.workers.runtime import MarketRuntime

router = APIRouter(prefix="/chart", tags=["chart"])


@router.get("/{symbol}", response_model=ChartResponse)
def get_chart_data(
    symbol: str = Path(..., pattern=r"^\d{6}$"),
    limit: int = Query(default=240, ge=60, le=1000),
    timeframe: ChartTimeframe = Query(default="1m"),
    before: datetime | None = Query(default=None),
    runtime: MarketRuntime = Depends(get_runtime),
    db: Session = Depends(db_session),
) -> ChartResponse:
    return get_chart_response(symbol=symbol, limit=limit, timeframe=timeframe, runtime=runtime, db=db, before=before)
