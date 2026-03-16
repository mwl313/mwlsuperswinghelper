from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chart, dashboard, settings, signals, symbols, watchlists, ws
from app.core.config import get_settings
from app.db.seed import init_db
from app.services.ws_manager import WSManager
from app.workers.runtime import MarketRuntime

settings_obj = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ws_manager = WSManager()
    runtime = MarketRuntime(ws_manager=ws_manager)
    app.state.ws_manager = ws_manager
    app.state.runtime = runtime
    await runtime.start()
    try:
        yield
    finally:
        await runtime.stop()


app = FastAPI(title=settings_obj.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(watchlists.router, prefix=settings_obj.api_prefix)
app.include_router(settings.router, prefix=settings_obj.api_prefix)
app.include_router(signals.router, prefix=settings_obj.api_prefix)
app.include_router(chart.router, prefix=settings_obj.api_prefix)
app.include_router(symbols.router, prefix=settings_obj.api_prefix)
app.include_router(dashboard.router, prefix=settings_obj.api_prefix)
app.include_router(ws.router)


@app.get("/")
def root() -> dict:
    return {
        "name": settings_obj.app_name,
        "message": "초보 부업 스윙 투자자용 코스피 시그널 알림기 API",
        "warning": "자동매매가 아닌 참고용 조건 충족 알림 서비스입니다.",
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
