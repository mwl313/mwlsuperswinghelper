from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "KOSPI Swing Signal API"
    api_prefix: str = "/api"
    database_url: str = "sqlite:///./app.db"

    market_data_provider: str = "mock"  # mock | kis
    default_symbols: str = "005930,000660,035420,051910,068270"
    mock_tick_interval_seconds: float = Field(default=1.0, ge=0.2)
    mock_price_volatility: float = Field(default=0.012, gt=0)
    candle_seconds: int = Field(default=60, ge=10)
    max_candles_per_symbol: int = Field(default=240, ge=80)
    volume_lookback: int = Field(default=20, ge=5)
    support_resistance_lookback: int = Field(default=20, ge=5)
    websocket_ping_seconds: int = Field(default=15, ge=5)

    kis_app_key: str | None = None
    kis_app_secret: str | None = None
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
