from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.signal import SignalStrength, SignalType


class ChartCandle(BaseModel):
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class ChartOverlayPoint(BaseModel):
    timestamp: datetime
    value: float


class ChartOverlays(BaseModel):
    ma20: list[ChartOverlayPoint]
    ma60: list[ChartOverlayPoint]
    bollinger_upper: list[ChartOverlayPoint]
    bollinger_mid: list[ChartOverlayPoint]
    bollinger_lower: list[ChartOverlayPoint]
    rsi14: list[ChartOverlayPoint]


class ChartMarker(BaseModel):
    timestamp: datetime
    type: SignalType
    strength: SignalStrength
    title: str
    description: str


class ChartResponse(BaseModel):
    symbol: str
    timeframe: Literal["1m"] = "1m"
    candles: list[ChartCandle]
    overlays: ChartOverlays
    markers: list[ChartMarker]
