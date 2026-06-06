from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class ServerModCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    modrinth_project_id: str
    version_id: str
    name: str
    side: str
    icon_url: str | None = None
    filename: str | None = None
    version_number: str | None = None
    version_type: str | None = None
    categories: list[str] = []


class ServerModResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    modrinth_project_id: str
    version_id: str
    name: str
    side: str
    icon_url: str | None = None
    filename: str | None = None
    version_number: str | None = None
    version_type: str | None = None
    categories: list[str] = []

    @field_validator("categories", mode="before")
    @classmethod
    def coerce_categories(cls, v: object) -> list[str]:
        return v if v is not None else []


class ServerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    game_version: str
    loader: str = "fabric"
    loader_version: str | None = None
    memory_mb: int = 4096
    server_ip: str | None = None


class ServerUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    game_version: str | None = None
    loader: str | None = None
    loader_version: str | None = None
    memory_mb: int | None = None
    server_ip: str | None = None
    properties_text: str | None = None
    description: str | None = None
    management_enabled: bool | None = None


class ServerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    share_code: str
    name: str
    game_version: str
    loader: str
    loader_version: str | None = None
    memory_mb: int
    server_ip: str | None = None
    description: str | None = None
    icon_url: str | None = None
    mod_count: int
    max_players: int = 20
    management_enabled: bool = False
    created_at: datetime
    updated_at: datetime


class ServerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    share_code: str
    name: str
    game_version: str
    loader: str
    loader_version: str | None = None
    memory_mb: int
    server_ip: str | None = None
    description: str | None = None
    icon_url: str | None = None
    properties_text: str | None = None
    management_enabled: bool = False
    mod_count: int
    mods: list[ServerModResponse] = []
    created_at: datetime
    updated_at: datetime


class ServerStatusResponse(BaseModel):
    online: bool
    players: dict | None = None
    version: str | None = None
    motd: str | None = None
    response_ms: int | None = None


class UptimeCheckResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    checked_at: datetime
    online: bool
    response_ms: int | None = None


class MissingDependency(BaseModel):
    project_id: str
    name: str
    icon_url: str | None = None


class ServerModAddResponse(BaseModel):
    mod: "ServerModResponse"
    missing_dependencies: list[MissingDependency] = []


class ExportToClientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    game_version: str
    loader: str
    share_code: str
    source_server_id: int | None = None
    mod_count: int
