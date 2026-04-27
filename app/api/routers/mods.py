from fastapi import APIRouter

from app.schemas.mod import ModSearchRequest, ModSearchResponse
from app.services import modrinth_service

router = APIRouter(prefix="/mods", tags=["mods"])


@router.post("/search", response_model=ModSearchResponse)
async def search_mods(request: ModSearchRequest) -> ModSearchResponse:
    return await modrinth_service.search(
        query=request.query,
        game_version=request.game_version,
        loader=request.loader,
        limit=request.limit,
        offset=request.offset,
    )
