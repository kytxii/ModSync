import json

import httpx

from app.schemas.mod import ModSearchHit, ModSearchResponse

MODRINTH_BASE_URL = "https://api.modrinth.com/v2"
_HEADERS = {"User-Agent": "modsync/1.0 (github.com/kytxii/modsync)"}


async def search(
    query: str,
    game_version: str | None = None,
    loader: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> ModSearchResponse:
    facets: list[list[str]] = [["project_type:mod"]]
    if game_version:
        facets.append([f"versions:{game_version}"])
    if loader:
        facets.append([f"categories:{loader}"])

    params: dict[str, str | int] = {
        "query": query,
        "limit": limit,
        "offset": offset,
        "facets": json.dumps(facets),
    }

    async with httpx.AsyncClient(headers=_HEADERS, timeout=10.0) as client:
        response = await client.get(f"{MODRINTH_BASE_URL}/search", params=params)
        response.raise_for_status()
        data = response.json()

    hits = [ModSearchHit.model_validate(hit) for hit in data.get("hits", [])]
    return ModSearchResponse(
        hits=hits,
        total_hits=data.get("total_hits", 0),
        limit=data.get("limit", limit),
        offset=data.get("offset", offset),
    )


async def get_project(project_id: str) -> dict:
    async with httpx.AsyncClient(headers=_HEADERS, timeout=10.0) as client:
        response = await client.get(f"{MODRINTH_BASE_URL}/project/{project_id}")
        response.raise_for_status()
        return response.json()


async def get_project_versions(project_id: str) -> list[dict]:
    async with httpx.AsyncClient(headers=_HEADERS, timeout=10.0) as client:
        response = await client.get(f"{MODRINTH_BASE_URL}/project/{project_id}/version")
        response.raise_for_status()
        return response.json()


async def get_versions_by_hashes(hashes: list[str]) -> dict[str, dict]:
    async with httpx.AsyncClient(headers=_HEADERS, timeout=15.0) as client:
        response = await client.post(
            f"{MODRINTH_BASE_URL}/version_files",
            json={"hashes": hashes, "algorithm": "sha512"},
        )
        response.raise_for_status()
        return response.json()


async def get_projects(project_ids: list[str]) -> list[dict]:
    async with httpx.AsyncClient(headers=_HEADERS, timeout=15.0) as client:
        response = await client.get(
            f"{MODRINTH_BASE_URL}/projects",
            params={"ids": json.dumps(project_ids)},
        )
        response.raise_for_status()
        return response.json()
