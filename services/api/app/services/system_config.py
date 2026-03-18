from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.system_config import SystemConfig

ProviderMode = Literal["mock", "kis"]


@dataclass(slots=True)
class RuntimeProviderConfig:
    mode: ProviderMode
    kis_app_key: str | None
    kis_app_secret: str | None
    kis_base_url: str


def normalize_provider_mode(value: str | None) -> ProviderMode:
    return "kis" if value == "kis" else "mock"


def _sanitize_optional(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


def get_or_create_system_config(db: Session, settings: Settings) -> SystemConfig:
    row = db.get(SystemConfig, 1)
    if row is None:
        row = SystemConfig(
            id=1,
            provider_mode=normalize_provider_mode(settings.market_data_provider),
            kis_app_key=_sanitize_optional(settings.kis_app_key),
            kis_app_secret=_sanitize_optional(settings.kis_app_secret),
            kis_base_url=_sanitize_optional(settings.kis_base_url) or settings.kis_base_url,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    updated = False
    if not row.kis_base_url:
        row.kis_base_url = settings.kis_base_url
        updated = True
    if updated:
        row.updated_at = datetime.now(timezone.utc)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def load_runtime_provider_config(db: Session, settings: Settings) -> RuntimeProviderConfig:
    row = get_or_create_system_config(db, settings)
    return RuntimeProviderConfig(
        mode=normalize_provider_mode(row.provider_mode),
        kis_app_key=_sanitize_optional(row.kis_app_key) or _sanitize_optional(settings.kis_app_key),
        kis_app_secret=_sanitize_optional(row.kis_app_secret) or _sanitize_optional(settings.kis_app_secret),
        kis_base_url=_sanitize_optional(row.kis_base_url) or settings.kis_base_url,
    )


def save_kis_credentials(
    db: Session,
    settings: Settings,
    app_key: str,
    app_secret: str,
    base_url: str | None,
) -> SystemConfig:
    row = get_or_create_system_config(db, settings)
    row.kis_app_key = app_key.strip()
    row.kis_app_secret = app_secret.strip()
    if base_url is not None:
        row.kis_base_url = base_url.strip()
    row.updated_at = datetime.now(timezone.utc)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_provider_mode(db: Session, settings: Settings, mode: ProviderMode) -> SystemConfig:
    row = get_or_create_system_config(db, settings)
    row.provider_mode = normalize_provider_mode(mode)
    row.updated_at = datetime.now(timezone.utc)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def build_safe_credential_status(db: Session, settings: Settings) -> dict:
    config = load_runtime_provider_config(db, settings)
    return {
        "kisConfigured": bool(config.kis_app_key and config.kis_app_secret),
        "hasAppKey": bool(config.kis_app_key),
        "hasAppSecret": bool(config.kis_app_secret),
        "baseUrlSet": bool(config.kis_base_url),
    }

