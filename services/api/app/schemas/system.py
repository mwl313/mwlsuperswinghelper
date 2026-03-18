from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ProviderMode = Literal["mock", "kis"]


class ProviderStatusRead(BaseModel):
    mode: ProviderMode
    kisConfigured: bool
    runtimeHealthy: bool
    lastError: str | None
    lastUpdateAt: datetime | None
    supportsSwitching: bool
    lastSwitchAt: datetime | None
    hasAppKey: bool
    hasAppSecret: bool


class ProviderModeUpdate(BaseModel):
    mode: ProviderMode


class KisCredentialsSavePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    app_key: str = Field(alias="appKey", min_length=1)
    app_secret: str = Field(alias="appSecret", min_length=1)
    base_url: str | None = Field(default=None, alias="baseUrl")


class KisCredentialsSaveRead(BaseModel):
    ok: bool
    kisConfigured: bool
    hasAppKey: bool
    hasAppSecret: bool
    baseUrlSet: bool
    updatedAt: datetime


class ProviderConnectionTestRead(BaseModel):
    ok: bool
    mode: ProviderMode
    message: str
    testedAt: datetime

