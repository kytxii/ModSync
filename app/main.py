import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.routers import analyzer, auth, fabric, management, modpacks, mods, servers
from app.core.config import settings
from app.core.database import async_session_maker
from app.services import server_service

logger = logging.getLogger(__name__)


async def _uptime_loop(lock: asyncio.Lock) -> None:
    while True:
        await asyncio.sleep(300)
        if lock.locked():
            logger.warning("Uptime check still running, skipping cycle")
            continue
        async with lock:
            try:
                async with async_session_maker() as db:
                    await server_service.run_uptime_checks(db)
            except Exception:
                logger.exception("Uptime scheduler error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    lock = asyncio.Lock()
    task = asyncio.create_task(_uptime_loop(lock))
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Beacon API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Export-Skipped"],
)
app.add_middleware(SessionMiddleware, secret_key=settings.secret_key)

app.include_router(mods.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(analyzer.router, prefix="/api")
app.include_router(modpacks.router, prefix="/api")
app.include_router(fabric.router, prefix="/api")
app.include_router(servers.router, prefix="/api")
app.include_router(management.router, prefix="/api")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
