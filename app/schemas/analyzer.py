from pydantic import BaseModel, ConfigDict


class ModResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    filename: str
    sha512: str
    found: bool
    project_id: str | None
    project_name: str | None
    version_number: str | None
    game_versions: list[str]
    loaders: list[str]
    client_side: str | None
    server_side: str | None


class AnalyzerResponse(BaseModel):
    total: int
    found: int
    unknown: int
    results: list[ModResult]


class PrismMod(BaseModel):
    model_config = ConfigDict(extra="ignore")

    filename: str
    sha512: str


class PrismImportRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    minecraft_version: str | None = None
    mod_loader: str | None = None
    mods: list[PrismMod]


class ModlistMod(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    url: str | None = None
    version: str | None = None
