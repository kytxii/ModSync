import time

import httpx

FABRIC_BASE = "https://meta.fabricmc.net/v2"
_HEADERS = {"User-Agent": "modsync/1.0 (github.com/kytxii/modsync)"}
_TTL = 3600  # 1 hour

_cache: dict[str, tuple[float, list[str]]] = {}


def _cached(key: str) -> list[str] | None:
    entry = _cache.get(key)
    if entry and time.time() - entry[0] < _TTL:
        return entry[1]
    return None


def _store(key: str, value: list[str]) -> None:
    _cache[key] = (time.time(), value)


async def get_game_versions() -> list[str]:
    key = "game_versions"
    if cached := _cached(key):
        return cached
    async with httpx.AsyncClient(headers=_HEADERS, timeout=10.0) as client:
        r = await client.get(f"{FABRIC_BASE}/versions/game")
        r.raise_for_status()
        data = r.json()
    versions = [v["version"] for v in data if v.get("stable")]
    _store(key, versions)
    return versions


async def get_loader_versions(game_version: str) -> list[str]:
    key = f"loader_{game_version}"
    if cached := _cached(key):
        return cached
    async with httpx.AsyncClient(headers=_HEADERS, timeout=10.0) as client:
        r = await client.get(f"{FABRIC_BASE}/versions/loader/{game_version}")
        r.raise_for_status()
        data = r.json()
    versions = [v["loader"]["version"] for v in data]
    _store(key, versions)
    return versions
