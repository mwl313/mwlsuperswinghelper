from pydantic import BaseModel


class DashboardSummary(BaseModel):
    market_status: str
    today_signal_count: int
    strong_signal_count: int
    strong_symbols: list[str]
    watchlist_total: int
    watchlist_enabled: int


class LiveWatchlistItem(BaseModel):
    symbol: str
    symbol_name: str
    enabled: bool
    price: float | None
    change_percent: float | None
    last_signal_type: str | None
    last_signal_strength: str | None
    last_signal_reason: str | None
