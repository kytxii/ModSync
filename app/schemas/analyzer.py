from pydantic import BaseModel, ConfigDict


class ModResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    filename: str
    sha512: str
    found: bool
    project_id: str | None
    project_name: str | None
    icon_url: str | None
    version_id: str | None = None
    version_number: str | None
    game_versions: list[str]
    loaders: list[str]
    categories: list[str]
    client_side: str | None
    server_side: str | None
    update_available: bool = False
    latest_version: str | None = None


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

    filename: str | None = None
    name: str
    url: str | None = None
    version: str | None = None


class AnalyzerModInput(BaseModel):
    modrinth_project_id: str
    version_id: str
    name: str
    side: str
    icon_url: str | None = None
    version_number: str | None = None
    filename: str | None = None
    categories: list[str] = []


class CreateModpackFromAnalysis(BaseModel):
    name: str
    game_version: str
    loader: str
    mods: list[AnalyzerModInput]


class CreateModpackResponse(BaseModel):
    id: int
    share_code: str
