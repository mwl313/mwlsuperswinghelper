from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import db_session
from app.schemas.symbol import SymbolResolveResponse, SymbolSearchItem
from app.services.symbol_lookup import resolve_symbol_name, search_symbols

router = APIRouter(prefix="/symbols", tags=["symbols"])


@router.get("/resolve", response_model=SymbolResolveResponse)
def resolve_symbol(
    symbol: str = Query(..., min_length=6, max_length=6, pattern=r"^\d{6}$"),
    db: Session = Depends(db_session),
) -> SymbolResolveResponse:
    symbol_name, source = resolve_symbol_name(symbol, db=db)
    return SymbolResolveResponse(
        symbol=symbol,
        symbol_name=symbol_name,
        found=symbol_name is not None,
        source=source,
    )


@router.get("/search", response_model=list[SymbolSearchItem])
def search_symbol(
    q: str = Query(..., min_length=1, max_length=40),
    limit: int = Query(default=10, ge=1, le=20),
    db: Session = Depends(db_session),
) -> list[dict[str, str | None]]:
    return search_symbols(query=q, db=db, limit=limit)
