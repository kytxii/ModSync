import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.models import User
from app.schemas.modpack import (
    BulkModAddItem,
    BulkModAddResponse,
    ChangelogEntryResponse,
    MissingDependency,
    ModpackCreate,
    ModpackImport,
    ModpackModAddResponse,
    ModpackModCreate,
    ModpackModResponse,
    ModpackResponse,
    ModpackSummary,
    ModpackUpdate,
    ModVersionInfo,
    ModVersionUpdate,
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


@router.get("/share/{code}/changelog", response_model=list[ChangelogEntryResponse])
async def get_shared_modpack_changelog(code: str, db: AsyncSession = Depends(get_db)) -> list[ChangelogEntryResponse]:
    modpack = await modpack_service.get_modpack_by_share_code(db, code)
    if not modpack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modpack not found")
    entries = await modpack_service.get_changelog(db, modpack.id)
    return [ChangelogEntryResponse.model_validate(e) for e in entries]


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


@router.post("/{modpack_id}/mods/bulk", response_model=BulkModAddResponse, status_code=status.HTTP_201_CREATED)
async def bulk_add_mods(
    modpack_id: int,
    data: list[BulkModAddItem],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BulkModAddResponse:
    modpack = await modpack_service.get_modpack(db, modpack_id, user.id)
    if not modpack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modpack not found")
    mods, missing = await modpack_service.bulk_add_with_versions(db, modpack, data, actor_id=user.id)
    return BulkModAddResponse(
        added=[ModpackModResponse.model_validate(m) for m in mods],
        missing_dependencies=[MissingDependency(**d) for d in missing],
    )


@router.post("/{modpack_id}/mods", response_model=ModpackModAddResponse, status_code=status.HTTP_201_CREATED)
async def add_mod(
    modpack_id: int,
    data: ModpackModCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ModpackModAddResponse:
    modpack = await modpack_service.get_modpack(db, modpack_id, user.id)
    if not modpack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modpack not found")
    try:
        mod = await modpack_service.add_mod(db, modpack, data, actor_id=user.id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Mod already in modpack")
    existing_ids = {m.modrinth_project_id for m in modpack.mods} | {data.modrinth_project_id}
    missing = await modpack_service.get_missing_dependencies(data.version_id, existing_ids)
    return ModpackModAddResponse(
        mod=ModpackModResponse.model_validate(mod),
        missing_dependencies=[MissingDependency(**d) for d in missing],
    )


@router.get("/{modpack_id}/changelog", response_model=list[ChangelogEntryResponse])
async def get_modpack_changelog(
    modpack_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ChangelogEntryResponse]:
    modpack = await modpack_service.get_modpack(db, modpack_id, user.id)
    if not modpack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modpack not found")
    entries = await modpack_service.get_changelog(db, modpack_id)
    return [ChangelogEntryResponse.model_validate(e) for e in entries]


@router.get("/{modpack_id}/export")
async def export_modpack(
    modpack_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    result = await modpack_service.build_zip(db, modpack_id, user.id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modpack not found")
    zip_bytes, filename, failed = result
    headers: dict[str, str] = {"Content-Disposition": f'attachment; filename="{filename}"'}
    if failed:
        headers["X-Export-Skipped"] = ",".join(failed)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers=headers,
    )


@router.get("/{modpack_id}/mods/{mod_id}/versions", response_model=list[ModVersionInfo])
async def get_mod_versions(
    modpack_id: int,
    mod_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ModVersionInfo]:
    try:
        found, versions = await modpack_service.get_filtered_mod_versions(db, modpack_id, mod_id, user.id)
    except httpx.HTTPError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Modrinth unavailable")
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mod not found")
    return [ModVersionInfo(**v) for v in versions]


@router.patch("/{modpack_id}/mods/{mod_id}", response_model=ModpackModResponse)
async def update_mod_version(
    modpack_id: int,
    mod_id: int,
    data: ModVersionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ModpackModResponse:
    mod = await modpack_service.update_mod_version(db, modpack_id, mod_id, user.id, data)
    if mod is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mod not found")
    return ModpackModResponse.model_validate(mod)


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
