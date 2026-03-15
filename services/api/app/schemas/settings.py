from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


SignalStrengthMode = Literal["all", "strong_only"]


class StrategySettingsBase(BaseModel):
    ma_short: int = Field(default=20, ge=5, le=120)
    ma_long: int = Field(default=60, ge=10, le=240)
    bollinger_length: int = Field(default=20, ge=10, le=120)
    bollinger_std: float = Field(default=2.0, ge=1.0, le=4.0)
    volume_multiplier: float = Field(default=1.5, ge=1.0, le=5.0)
    use_rsi: bool = False
    use_breakout: bool = True
    use_bollinger_support: bool = True
    use_trend_filter: bool = True
    use_volume_surge: bool = True
    signal_strength_mode: SignalStrengthMode = "strong_only"
    cooldown_minutes: int = Field(default=10, ge=1, le=120)
    enable_desktop_notifications: bool = True
    enable_telegram_notifications: bool = False


class StrategySettingsRead(StrategySettingsBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StrategySettingsUpdate(StrategySettingsBase):
    pass
