from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.models import User
from app.schemas.modpack import (
    ModpackCreate,
    ModpackImport,
    ModpackModCreate,
    ModpackModResponse,
    ModpackResponse,
    ModpackSummary,
    ModpackUpdate,
)
from app.services import modpack_service

router = APIRouter(prefix="/modpacks", tags=["modpacks"])


@router.post("", response_model=ModpackSummary, status_code=status.HTTP_201_CREATED)
async def create_modpack(
    data: ModpackCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ModpackSummary:
    modpack = await modpack_service.create_modpack(db, user.id, data)
    return ModpackSummary.model_validate(modpack)


@router.get("", response_model=list[ModpackSummary])
async def list_modpacks(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ModpackSummary]:
    modpacks = await modpack_service.list_modpacks(db, user.id)
    return [ModpackSummary.model_validate(m) for m in modpacks]


@router.post("/import", response_model=ModpackSummary, status_code=status.HTTP_201_CREATED)
async def import_modpack(
    data: ModpackImport,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ModpackSummary:
    modpack = await modpack_service.import_modpack(db, user.id, data.code, data.name, data.is_synced)
    if not modpack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share code not found")
    return ModpackSummary.model_validate(modpack)


@router.get("/code/{share_code}", response_model=ModpackResponse)
async def get_modpack_by_code(
    share_code: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ModpackResponse:
    modpack = await modpack_service.get_user_modpack_by_share_code(db, share_code, user.id)
    if not modpack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modpack not found")
    mods = await modpack_service.resolve_mods(db, modpack)
    response = ModpackResponse.model_validate(modpack)
    response.mods = [ModpackModResponse.model_validate(m) for m in mods]
    return response


@router.get("/share/{code}", response_model=ModpackResponse)
async def get_shared_modpack(code: str, db: AsyncSession = Depends(get_db)) -> ModpackResponse:
    modpack = await modpack_service.get_modpack_by_share_code(db, code)
    if not modpack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modpack not found")
    mods = await modpack_service.resolve_mods(db, modpack)
    response = ModpackResponse.model_validate(modpack)
    response.mods = [ModpackModResponse.model_validate(m) for m in mods]
    return response


@router.get("/{modpack_id}", response_model=ModpackResponse)
async def get_modpack(
    modpack_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ModpackResponse:
    modpack = await modpack_service.get_modpack(db, modpack_id, user.id)
    if not modpack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modpack not found")
    mods = await modpack_service.resolve_mods(db, modpack)
    response = ModpackResponse.model_validate(modpack)
    response.mods = [ModpackModResponse.model_validate(m) for m in mods]
    return response


@router.patch("/{modpack_id}", response_model=ModpackSummary)
async def update_modpack(
    modpack_id: int,
    data: ModpackUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ModpackSummary:
    modpack = await modpack_service.get_modpack(db, modpack_id, user.id)
    if not modpack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modpack not found")
    modpack = await modpack_service.update_modpack(db, modpack, data)
    return ModpackSummary.model_validate(modpack)


@router.delete("/{modpack_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_modpack(
    modpack_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    modpack = await modpack_service.get_modpack(db, modpack_id, user.id)
    if not modpack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modpack not found")
    await modpack_service.delete_modpack(db, modpack)


@router.post("/{modpack_id}/mods", response_model=ModpackModResponse, status_code=status.HTTP_201_CREATED)
async def add_mod(
    modpack_id: int,
    data: ModpackModCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ModpackModResponse:
    modpack = await modpack_service.get_modpack(db, modpack_id, user.id)
    if not modpack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modpack not found")
    try:
        mod = await modpack_service.add_mod(db, modpack, data)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Mod already in modpack")
    return ModpackModResponse.model_validate(mod)


@router.get("/{modpack_id}/export")
async def export_modpack(
    modpack_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    result = await modpack_service.build_mrpack(db, modpack_id, user.id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modpack not found")
    zip_bytes, filename = result
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{modpack_id}/mods/{mod_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_mod(
    modpack_id: int,
    mod_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    removed = await modpack_service.remove_mod(db, modpack_id, mod_id, user.id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mod not found")
