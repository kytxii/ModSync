import json

import httpx

from app.schemas.mod import ModSearchHit, ModSearchResponse

MODRINTH_BASE_URL = "https://api.modrinth.com/v2"
_HEADERS = {"User-Agent": "modsync/1.0 (github.com/kytxii/modsync)"}


async def get_categories() -> list[dict]:
    async with httpx.AsyncClient(headers=_HEADERS, timeout=10.0) as client:
        response = await client.get(f"{MODRINTH_BASE_URL}/tag/category")
        response.raise_for_status()
        data = response.json()
    return [c for c in data if c.get("project_type") == "mod"]


async def search(
    query: str,
    game_version: str | None = None,
    loader: str | None = None,
    category: str | None = None,
    side: str | None = None,
    index: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> ModSearchResponse:
    facets: list[list[str]] = [["project_type:mod"]]
    if game_version:
        facets.append([f"versions:{game_version}"])
    if loader:
        facets.append([f"categories:{loader}"])
    if category:
        facets.append([f"categories:{category}"])
    if side == "client":
        facets.append(["server_side:unsupported"])
    elif side == "server":
        facets.append(["client_side:unsupported"])
    elif side == "both":
        facets.append(["client_side:required"])
        facets.append(["server_side:required"])

    params: dict[str, str | int] = {
        "query": query,
        "limit": limit,
        "offset": offset,
        "facets": json.dumps(facets),
    }
    if index:
        params["index"] = index

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


async def get_version(version_id: str) -> dict:
    async with httpx.AsyncClient(headers=_HEADERS, timeout=10.0) as client:
        response = await client.get(f"{MODRINTH_BASE_URL}/version/{version_id}")
        response.raise_for_status()
        return response.json()


async def get_project_versions(project_id: str) -> list[dict]:
    async with httpx.AsyncClient(headers=_HEADERS, timeout=10.0) as client:
        response = await client.get(f"{MODRINTH_BASE_URL}/project/{project_id}/version")
        response.raise_for_status()
        return response.json()


async def get_project_versions_filtered(project_id: str, game_version: str, loader: str) -> list[dict]:
    params = {
        "game_versions": json.dumps([game_version]),
        "loaders": json.dumps([loader]),
    }
    async with httpx.AsyncClient(headers=_HEADERS, timeout=10.0) as client:
        response = await client.get(f"{MODRINTH_BASE_URL}/project/{project_id}/version", params=params)
        response.raise_for_status()
        return response.json()


async def get_latest_version(project_id: str, game_version: str, loader: str) -> dict | None:
    params = {
        "game_versions": json.dumps([game_version]),
        "loaders": json.dumps([loader]),
    }
    async with httpx.AsyncClient(headers=_HEADERS, timeout=10.0) as client:
        response = await client.get(f"{MODRINTH_BASE_URL}/project/{project_id}/version", params=params)
        response.raise_for_status()
        versions = response.json()
    return versions[0] if versions else None


async def get_latest_versions_batch(
    queries: list[tuple[str, str, str]],
    concurrency: int = 10,
) -> list[dict | None]:
    import asyncio
    sem = asyncio.Semaphore(concurrency)

    async def _one(client: httpx.AsyncClient, project_id: str, game_version: str, loader: str) -> dict | None:
        async with sem:
            try:
                params = {
                    "game_versions": json.dumps([game_version]),
                    "loaders": json.dumps([loader]),
                }
                r = await client.get(f"{MODRINTH_BASE_URL}/project/{project_id}/version", params=params)
                r.raise_for_status()
                versions = r.json()
                return versions[0] if versions else None
            except Exception:
                return None

    async with httpx.AsyncClient(headers=_HEADERS, timeout=15.0) as client:
        return list(await asyncio.gather(*[_one(client, *q) for q in queries]))


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
