from pydantic import BaseModel, Field


class SymbolResolveResponse(BaseModel):
    symbol: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    symbol_name: str | None = None
    found: bool
    source: str
