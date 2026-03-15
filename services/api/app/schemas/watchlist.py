from datetime import datetime

from pydantic import BaseModel, Field


class WatchlistItemBase(BaseModel):
    symbol: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    symbol_name: str = Field(min_length=1, max_length=80)


class WatchlistItemCreate(BaseModel):
    symbol: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    symbol_name: str | None = Field(default=None, max_length=80)
    enabled: bool = True


class WatchlistItemUpdate(BaseModel):
    enabled: bool


class WatchlistItemRead(WatchlistItemBase):
    id: int
    enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class WatchlistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class WatchlistRead(BaseModel):
    id: int
    user_id: int
    name: str
    created_at: datetime
    items: list[WatchlistItemRead]

    model_config = {"from_attributes": True}
