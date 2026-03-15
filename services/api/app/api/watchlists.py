from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import db_session
from app.models.watchlist import Watchlist, WatchlistItem
from app.schemas.watchlist import (
    WatchlistCreate,
    WatchlistItemCreate,
    WatchlistItemRead,
    WatchlistItemUpdate,
    WatchlistRead,
)
from app.services.symbol_lookup import resolve_symbol_name

router = APIRouter(prefix="/watchlists", tags=["watchlists"])


@router.get("", response_model=list[WatchlistRead])
def get_watchlists(db: Session = Depends(db_session)) -> list[Watchlist]:
    return list(db.scalars(select(Watchlist).where(Watchlist.user_id == 1)).all())


@router.post("", response_model=WatchlistRead)
def create_watchlist(payload: WatchlistCreate, db: Session = Depends(db_session)) -> Watchlist:
    row = Watchlist(user_id=1, name=payload.name)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/{watchlist_id}/items", response_model=WatchlistItemRead)
def add_watchlist_item(
    watchlist_id: int,
    payload: WatchlistItemCreate,
    db: Session = Depends(db_session),
) -> WatchlistItem:
    watchlist = db.get(Watchlist, watchlist_id)
    if watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    exists = db.scalar(
        select(WatchlistItem).where(
            WatchlistItem.watchlist_id == watchlist_id,
            WatchlistItem.symbol == payload.symbol,
        )
    )
    if exists:
        raise HTTPException(status_code=409, detail="Symbol already exists in watchlist")

    symbol_name = payload.symbol_name.strip() if payload.symbol_name else None
    if not symbol_name:
        symbol_name, _ = resolve_symbol_name(payload.symbol, db=db)

    if not symbol_name:
        raise HTTPException(status_code=422, detail="종목코드에 해당하는 종목명을 찾지 못했습니다.")

    row = WatchlistItem(
        watchlist_id=watchlist_id,
        symbol=payload.symbol,
        symbol_name=symbol_name,
        enabled=payload.enabled,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/items/{item_id}", response_model=WatchlistItemRead)
def update_watchlist_item(item_id: int, payload: WatchlistItemUpdate, db: Session = Depends(db_session)) -> WatchlistItem:
    row = db.get(WatchlistItem, item_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    row.enabled = payload.enabled
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{watchlist_id}/items/{item_id}")
def delete_watchlist_item(watchlist_id: int, item_id: int, db: Session = Depends(db_session)) -> dict:
    row = db.get(WatchlistItem, item_id)
    if row is None or row.watchlist_id != watchlist_id:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
