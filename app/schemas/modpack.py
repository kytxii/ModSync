from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class ModpackModCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    modrinth_project_id: str
    version_id: str
    name: str
    side: str
    icon_url: str | None = None
    version_number: str | None = None
    version_type: str | None = None
    filename: str | None = None
    categories: list[str] = []


class ModpackModResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    modrinth_project_id: str
    version_id: str
    name: str
    side: str
    icon_url: str | None = None
    version_number: str | None = None
    version_type: str | None = None
    filename: str | None = None
    categories: list[str] = []

    @field_validator("categories", mode="before")
    @classmethod
    def coerce_categories(cls, v: object) -> list[str]:
        return v if v is not None else []


class ModpackCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    game_version: str
    loader: str


class ModpackUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    game_version: str | None = None
    loader: str | None = None
    icon_color: str | None = None
    icon_letter: str | None = None
    icon_url: str | None = None
    source_share_code: str | None = None


class ModpackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    game_version: str
    loader: str
    share_code: str
    source_share_code: str | None = None
    icon_color: str | None = None
    icon_letter: str | None = None
    icon_url: str | None = None
    created_at: datetime
    updated_at: datetime
    mods: list[ModpackModResponse] = []


class ModpackSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    game_version: str
    loader: str
    share_code: str
    source_share_code: str | None = None
    icon_color: str | None = None
    icon_letter: str | None = None
    icon_url: str | None = None
    mod_count: int = 0
    created_at: datetime
    updated_at: datetime


class ModpackImport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    name: str
    is_synced: bool = False
