import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import get_settings
from app.services.ws_manager import WSManager

router = APIRouter(tags=["ws"])
settings = get_settings()


@router.websocket("/ws/live-signals")
async def ws_live_signals(websocket: WebSocket) -> None:
    manager: WSManager = websocket.app.state.ws_manager
    await manager.connect(websocket)
    try:
        while True:
            await asyncio.sleep(settings.websocket_ping_seconds)
            await websocket.send_json({"type": "ping", "ts": datetime.now(timezone.utc).isoformat()})
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)
