import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.models import Server, User
from app.schemas.management import ManagementStateResponse
from app.services import modrinth_service, rcon_service, server_service

router = APIRouter(prefix="/servers", tags=["management"])


class RconCommandInput(BaseModel):
    command: str


class RconTestResponse(BaseModel):
    connected: bool
    error: str | None = None


class RconCommandResponse(BaseModel):
    output: str


async def _get_server_owned(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Server:
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return server


async def _get_managed_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Server:
    server = await server_service.get_server(db, server_id, user.id)
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    if not server.management_enabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Live management is not enabled for this server")
    return server


@router.get("/{server_id}/management/state", response_model=ManagementStateResponse)
async def get_management_state(
    server: Server = Depends(_get_managed_server),
) -> ManagementStateResponse:
    try:
        state = await rcon_service.fetch_state(server)
        return ManagementStateResponse(**state)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.get("/{server_id}/management/spark-download")
async def get_spark_download(
    server: Server = Depends(_get_server_owned),
) -> dict:
    version, project = await asyncio.gather(
        modrinth_service.get_latest_version("spark", server.game_version, server.loader),
        modrinth_service.get_project("spark"),
    )
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No Spark release found for {server.loader} {server.game_version}")
    primary = next((f for f in version["files"] if f.get("primary")), version["files"][0] if version["files"] else None)
    if not primary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No download file in Spark release")
    return {
        "url": primary["url"],
        "filename": primary["filename"],
        "version_number": version["version_number"],
        "version_id": version["id"],
        "project_id": version["project_id"],
        "version_type": version.get("version_type", "release"),
        "project_name": project.get("title", "Spark"),
        "project_icon": project.get("icon_url"),
    }


@router.post("/{server_id}/rcon/test", response_model=RconTestResponse)
async def test_rcon(
    server: Server = Depends(_get_managed_server),
) -> RconTestResponse:
    result = await rcon_service.test_connection(server)
    return RconTestResponse(**result)


@router.post("/{server_id}/rcon/command", response_model=RconCommandResponse)
async def run_rcon_command(
    data: RconCommandInput,
    server: Server = Depends(_get_managed_server),
) -> RconCommandResponse:
    try:
        output = await rcon_service.run_command(server, data.command)
        return RconCommandResponse(output=output)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except asyncio.TimeoutError:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="RCON connection timed out")
    except ConnectionRefusedError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Connection refused — server may be offline")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
