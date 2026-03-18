from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_runtime
from app.schemas.system import (
    KisCredentialsSavePayload,
    KisCredentialsSaveRead,
    ProviderConnectionTestRead,
    ProviderModeUpdate,
    ProviderStatusRead,
)
from app.workers.runtime import MarketRuntime

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/provider-status", response_model=ProviderStatusRead)
def get_provider_status(runtime: MarketRuntime = Depends(get_runtime)) -> dict:
    return runtime.get_provider_status()


@router.post("/kis-credentials", response_model=KisCredentialsSaveRead)
async def save_kis_credentials(
    payload: KisCredentialsSavePayload,
    runtime: MarketRuntime = Depends(get_runtime),
) -> dict:
    try:
        status = await runtime.save_kis_credentials(
            app_key=payload.app_key,
            app_secret=payload.app_secret,
            base_url=payload.base_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "ok": True,
        "kisConfigured": status["kisConfigured"],
        "hasAppKey": status["hasAppKey"],
        "hasAppSecret": status["hasAppSecret"],
        "baseUrlSet": bool(runtime.kis_base_url),
        "updatedAt": datetime.now(timezone.utc),
    }


@router.patch("/provider-mode", response_model=ProviderStatusRead)
async def update_provider_mode(
    payload: ProviderModeUpdate,
    runtime: MarketRuntime = Depends(get_runtime),
) -> dict:
    try:
        return await runtime.switch_provider_mode(payload.mode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/provider-test", response_model=ProviderConnectionTestRead)
async def test_provider_connection(runtime: MarketRuntime = Depends(get_runtime)) -> dict:
    return await runtime.test_kis_connection()
