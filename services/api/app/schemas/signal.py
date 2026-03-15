from datetime import datetime
from typing import Literal

from pydantic import BaseModel


SignalType = Literal["buy_candidate", "breakout", "sell_warning"]
SignalStrength = Literal["weak", "medium", "strong"]


class SignalLogRead(BaseModel):
    id: int
    symbol: str
    symbol_name: str
    signal_type: SignalType
    signal_strength: SignalStrength
    price: float
    volume: float
    reason_text: str
    raw_payload_json: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class LiveSignalEvent(BaseModel):
    symbol: str
    symbol_name: str
    signal_type: SignalType
    signal_strength: SignalStrength
    price: float
    volume: float
    reason_text: str
    created_at: datetime
