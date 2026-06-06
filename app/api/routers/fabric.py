import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.models.models import User
from app.services import fabric_service

router = APIRouter(prefix="/fabric", tags=["fabric"])


@router.get("/game-versions", response_model=list[str])
async def get_game_versions(
    user: User = Depends(get_current_user),
) -> list[str]:
    try:
        return await fabric_service.get_game_versions()
    except httpx.HTTPError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Fabric API unavailable")


@router.get("/loader-versions/{game_version}", response_model=list[str])
async def get_loader_versions(
    game_version: str,
    user: User = Depends(get_current_user),
) -> list[str]:
    try:
        return await fabric_service.get_loader_versions(game_version)
    except httpx.HTTPError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Fabric API unavailable")
