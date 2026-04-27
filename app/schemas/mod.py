from pydantic import BaseModel, ConfigDict


class ModSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str
    game_version: str | None = None
    loader: str | None = None
    limit: int = 20
    offset: int = 0


class ModSearchHit(BaseModel):
    model_config = ConfigDict(extra="ignore")

    project_id: str
    slug: str
    title: str
    description: str
    icon_url: str | None = None
    downloads: int
    client_side: str
    server_side: str
    latest_version: str | None = None
    game_versions: list[str]
    loaders: list[str]
    categories: list[str]


class ModSearchResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    hits: list[ModSearchHit]
    total_hits: int
    limit: int
    offset: int
