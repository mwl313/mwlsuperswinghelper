from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_runtime
from app.models.signal_log import SignalLog
from app.models.watchlist import WatchlistItem
from app.schemas.dashboard import DashboardSummary, LiveWatchlistItem
from app.workers.runtime import MarketRuntime

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummary)
def get_dashboard_summary(runtime: MarketRuntime = Depends(get_runtime)) -> dict:
    return runtime.get_dashboard_summary()


@router.get("/watchlist/live", response_model=list[LiveWatchlistItem])
def get_watchlist_live(
    runtime: MarketRuntime = Depends(get_runtime),
    db: Session = Depends(db_session),
) -> list[dict]:
    items = list(db.scalars(select(WatchlistItem).order_by(WatchlistItem.symbol)).all())
    latest_by_symbol: dict[str, SignalLog] = {}
    for row in db.scalars(select(SignalLog).order_by(desc(SignalLog.created_at)).limit(500)).all():
        latest_by_symbol.setdefault(row.symbol, row)

    response: list[dict] = []
    for item in items:
        quote = runtime.latest_quotes.get(item.symbol)
        last_signal = latest_by_symbol.get(item.symbol)
        response.append(
            {
                "symbol": item.symbol,
                "symbol_name": item.symbol_name,
                "enabled": item.enabled,
                "price": quote["price"] if quote else None,
                "change_percent": quote["change_percent"] if quote else None,
                "last_signal_type": last_signal.signal_type if last_signal else None,
                "last_signal_strength": last_signal.signal_strength if last_signal else None,
                "last_signal_reason": last_signal.reason_text if last_signal else None,
            }
        )
    return response
