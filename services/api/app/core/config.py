from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_DB_PATH = Path(__file__).resolve().parents[4] / "app.db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "services/api/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "KOSPI Swing Signal API"
    api_prefix: str = "/api"
    database_url: str = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"

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
    kis_base_url: str = "https://openapi.koreainvestment.com:9443"
    kis_poll_interval_seconds: float = Field(default=1.0, ge=0.5)
    kis_request_timeout_seconds: float = Field(default=10.0, ge=2.0)
    kis_history_seed_limit: int = Field(default=240, ge=60, le=1000)
    kis_market_div_code: str = "J"
    kis_quote_tr_id: str = "FHKST01010100"
    kis_intraday_tr_id: str = "FHKST03010200"
    kis_history_backfill_chunks: int = Field(default=3, ge=1, le=20)
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
