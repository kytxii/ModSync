from fastapi import APIRouter, HTTPException, Query

from app.schemas.mod import ModSearchRequest, ModSearchResponse
from app.services import modrinth_service

router = APIRouter(prefix="/mods", tags=["mods"])


@router.get("/categories")
async def list_categories() -> list[dict]:
    return await modrinth_service.get_categories()


@router.post("/search", response_model=ModSearchResponse)
async def search_mods(request: ModSearchRequest) -> ModSearchResponse:
    return await modrinth_service.search(
        query=request.query,
        game_version=request.game_version,
        loader=request.loader,
        category=request.category,
        side=request.side,
        index=request.index,
        limit=request.limit,
        offset=request.offset,
    )


@router.get("/{project_id}/latest-version")
async def get_latest_version(
    project_id: str,
    game_version: str = Query(...),
    loader: str = Query(...),
) -> dict:
    version = await modrinth_service.get_latest_version(project_id, game_version, loader)
    if not version:
        raise HTTPException(status_code=404, detail="No compatible version found")
    files = version.get("files", [])
    primary = next((f for f in files if f.get("primary")), files[0] if files else None)
    return {
        "version_id": version["id"],
        "version_number": version["version_number"],
        "version_type": version.get("version_type"),
        "filename": primary["filename"] if primary else None,
    }
