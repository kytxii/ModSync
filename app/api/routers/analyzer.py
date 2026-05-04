from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.schemas.analyzer import (
    AnalyzerResponse,
    CreateModpackFromAnalysis,
    CreateModpackResponse,
    ModlistMod,
    PrismImportRequest,
)
from app.schemas.modpack import ModpackCreate, ModpackModCreate
from app.services import analyzer_service, modpack_service

router = APIRouter(prefix="/analyzer", tags=["analyzer"])

_MAX_FILE_SIZE = 200 * 1024 * 1024  # 200 MB


@router.post("/upload", response_model=AnalyzerResponse)
async def upload_mods(
    files: list[UploadFile] = File(...),
    user=Depends(get_current_user),
) -> AnalyzerResponse:
    if not files:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No files provided")

    errors: list[str] = []
    for f in files:
        # Strip folder path from webkitdirectory uploads (e.g. "mods/sodium.jar" → "sodium.jar")
        name = (f.filename or "").split("/")[-1].split("\\")[-1] or "(unnamed)"
        if not name.endswith(".jar"):
            errors.append(f"{name} (not a .jar)")
        elif f.size is not None and f.size > _MAX_FILE_SIZE:
            errors.append(f"{name} (exceeds 200 MB limit, got {f.size / 1024 / 1024:.1f} MB)")

    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid files: {', '.join(errors)}",
        )

    return await analyzer_service.analyze_files(files)


@router.post("/import-json", response_model=AnalyzerResponse)
async def import_prism_json(
    request: PrismImportRequest,
    user=Depends(get_current_user),
) -> AnalyzerResponse:
    if not request.mods:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No mods in JSON")
    return await analyzer_service.analyze_prism_json(request.mods)


@router.post("/import-modlist", response_model=AnalyzerResponse)
async def import_modlist(
    mods: list[ModlistMod],
    user=Depends(get_current_user),
) -> AnalyzerResponse:
    if not mods:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No mods in JSON")
    invalid = [m.name or f"entry #{i + 1}" for i, m in enumerate(mods) if not m.filename or not m.url or not m.version]
    if invalid:
        preview = ", ".join(invalid[:5])
        suffix = f" +{len(invalid) - 5} more" if len(invalid) > 5 else ""
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Missing required fields (name, url, version): {preview}{suffix}",
        )
    return await analyzer_service.analyze_modlist(mods)


@router.post("/create-modpack", response_model=CreateModpackResponse)
async def create_modpack_from_analysis(
    request: CreateModpackFromAnalysis,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CreateModpackResponse:
    if not request.mods:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No mods provided")
    modpack = await modpack_service.create_modpack(
        db, user.id, ModpackCreate(name=request.name, game_version=request.game_version, loader=request.loader)
    )
    await modpack_service.bulk_add_mods(
        db, modpack,
        [ModpackModCreate(
            modrinth_project_id=m.modrinth_project_id,
            version_id=m.version_id,
            name=m.name,
            side=m.side,
            icon_url=m.icon_url,
            version_number=m.version_number,
            filename=m.filename,
            categories=m.categories,
        ) for m in request.mods]
    )
    return CreateModpackResponse(id=modpack.id, share_code=modpack.share_code)
