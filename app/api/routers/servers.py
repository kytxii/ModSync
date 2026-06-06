from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.models import User
from app.schemas.server import (
    ExportToClientResponse,
    MissingDependency,
    ServerCreate,
    ServerModAddResponse,
    ServerModCreate,
    ServerModResponse,
    ServerResponse,
    ServerStatusResponse,
    ServerSummary,
    ServerUpdate,
    UptimeCheckResponse,
)
from app.services import modpack_service
from app.services import server_service

router = APIRouter(prefix="/servers", tags=["servers"])


@router.post("", response_model=ServerSummary, status_code=status.HTTP_201_CREATED)
async def create_server(
    data: ServerCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ServerSummary:
    server = await server_service.create_server(db, user.id, data)
    return ServerSummary.model_validate(server)


@router.get("", response_model=list[ServerSummary])
async def list_servers(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ServerSummary]:
    servers = await server_service.list_servers(db, user.id)
    return [ServerSummary.model_validate(s) for s in servers]


@router.get("/code/{share_code}", response_model=ServerResponse)
async def get_server_by_code(
    share_code: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ServerResponse:
    server = await server_service.get_server_by_code(db, share_code, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return ServerResponse.model_validate(server)


@router.get("/{server_id}", response_model=ServerResponse)
async def get_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ServerResponse:
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return ServerResponse.model_validate(server)


@router.patch("/{server_id}", response_model=ServerSummary)
async def update_server(
    server_id: int,
    data: ServerUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ServerSummary:
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    server = await server_service.update_server(db, server, data)
    return ServerSummary.model_validate(server)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    await server_service.delete_server(db, server)


@router.post("/{server_id}/mods", response_model=ServerModAddResponse, status_code=status.HTTP_201_CREATED)
async def add_mod(
    server_id: int,
    data: ServerModCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ServerModAddResponse:
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    try:
        mod = await server_service.add_mod(db, server, data)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Mod already in server")
    missing: list[dict] = []
    if data.version_id:
        existing_ids = {m.modrinth_project_id for m in server.mods} | {data.modrinth_project_id}
        missing = await modpack_service.get_missing_dependencies(data.version_id, existing_ids)
    return ServerModAddResponse(
        mod=ServerModResponse.model_validate(mod),
        missing_dependencies=[MissingDependency(**d) for d in missing],
    )


@router.delete("/{server_id}/mods/{mod_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_mod(
    server_id: int,
    mod_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    removed = await server_service.remove_mod(db, server_id, mod_id, user.id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mod not found")


@router.get("/{server_id}/dependencies/missing", response_model=list[MissingDependency])
async def get_missing_deps(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MissingDependency]:
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return await server_service.get_missing_dependencies(server)


@router.post("/{server_id}/dependencies/resolve", response_model=list[ServerModResponse])
async def resolve_missing_deps(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ServerModResponse]:
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    added = await server_service.resolve_missing_dependencies(db, server)
    return [ServerModResponse.model_validate(m) for m in added]


@router.get("/{server_id}/export")
async def export_server(
    server_id: int,
    eula: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    if eula != "true":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="EULA acceptance required")
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    try:
        buf = await server_service.build_server_zip(server)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Set a loader version before generating")
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Fabric API unavailable")
    safe_name = "".join(c if c.isalnum() or c in "-_" else "-" for c in server.name.lower()).strip("-")
    return Response(
        content=buf.read(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.zip"'},
    )


@router.post("/{server_id}/export-to-client", response_model=ExportToClientResponse, status_code=status.HTTP_201_CREATED)
async def export_to_client(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ExportToClientResponse:
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    try:
        modpack = await server_service.export_to_client(db, server, user.id)
    except ValueError as exc:
        msg = str(exc)
        if msg.startswith("already_exists:"):
            share_code = msg.split(":", 1)[1]
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"share_code": share_code},
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No client-compatible mods to export")
    return ExportToClientResponse.model_validate(modpack)


@router.get("/{server_id}/status", response_model=ServerStatusResponse)
async def get_status(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ServerStatusResponse:
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    result = await server_service.get_status(server.server_ip)
    return ServerStatusResponse(**result)


@router.post("/{server_id}/icon", response_model=ServerSummary)
async def upload_icon(
    server_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ServerSummary:
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    data = await file.read()
    try:
        server = await server_service.upload_icon(db, server, file.content_type or "", data)
    except ValueError as exc:
        msg = str(exc)
        if msg == "too_large":
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (max 2 MB)")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image file")
    return ServerSummary.model_validate(server)


@router.delete("/{server_id}/icon", response_model=ServerSummary)
async def delete_icon(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ServerSummary:
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    server = await server_service.delete_icon(db, server)
    return ServerSummary.model_validate(server)


@router.delete("/{server_id}/uptime", status_code=status.HTTP_204_NO_CONTENT)
async def reset_uptime(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    await server_service.reset_uptime_history(db, server_id)


@router.get("/{server_id}/uptime", response_model=list[UptimeCheckResponse])
async def get_uptime(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[UptimeCheckResponse]:
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    checks = await server_service.get_uptime_history(db, server_id)
    return [UptimeCheckResponse.model_validate(c) for c in checks]
