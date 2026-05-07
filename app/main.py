from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.routers import analyzer, auth, modpacks, mods
from app.core.config import settings

app = FastAPI(title="ModSync API", version="0.1.0")

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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
