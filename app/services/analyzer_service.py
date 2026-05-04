import asyncio
import hashlib
import logging
import re

import httpx
from fastapi import UploadFile

from app.schemas.analyzer import AnalyzerResponse, ModlistMod, ModResult, PrismMod
from app.services import modrinth_service

logger = logging.getLogger(__name__)


def _extract_project_id(url: str) -> str | None:
    match = re.search(r"modrinth\.com/mod/([^/?#]+)", url)
    return match.group(1) if match else None


def _extract_curseforge_slug(url: str) -> str | None:
    match = re.search(r"curseforge\.com/minecraft/mc-mods/([^/?#]+)", url)
    return match.group(1) if match else None


_CF_LOADER_SUFFIXES = ("-fabric", "-forge", "-neoforge", "-quilt", "-all")


async def _resolve_curseforge_mod(slug: str) -> dict | None:
    candidates = [slug]
    for suffix in _CF_LOADER_SUFFIXES:
        if slug.endswith(suffix):
            candidates.append(slug[: -len(suffix)])
    for candidate in candidates:
        try:
            return await modrinth_service.get_project(candidate)
        except (httpx.HTTPError, httpx.TimeoutException):
            continue
    return None


_MC_VERSION_RE = re.compile(r"(?<![.\d])(\d+\.\d+(?:\.\d+)?)(?![.\d])")
_LOADER_KEYWORDS = ("neoforge", "fabric", "forge", "quilt")


def _infer_loader(mods: list[ModlistMod]) -> str | None:
    counts: dict[str, int] = dict.fromkeys(_LOADER_KEYWORDS, 0)
    total_with_keyword = 0

    for mod in mods:
        haystack = f"{mod.version or ''} {mod.filename or ''}".lower()
        matched: set[str] = set()
        for keyword in _LOADER_KEYWORDS:
            if keyword in haystack:
                matched.add(keyword)
        if "neoforge" in matched:
            matched.discard("forge")
        if matched:
            total_with_keyword += 1
            for keyword in matched:
                counts[keyword] += 1

    if total_with_keyword == 0:
        return None
    for loader in _LOADER_KEYWORDS:
        if counts[loader] / total_with_keyword >= 0.6:
            return loader
    return None


def _detect_installed_game_version(version_str: str | None, available: list[str]) -> str | None:
    """Extract the specific MC version embedded in a mod version string.

    Returns None if no match is found — callers must not fall back to a guess.
    """
    if not version_str or not available:
        return None
    available_set = set(available)
    for match in _MC_VERSION_RE.finditer(version_str):
        candidate = match.group(1)
        if candidate in available_set:
            return candidate
    return None


def _make_unknown(name: str) -> ModResult:
    return ModResult(
        filename=name, sha512="", found=False, project_id=None,
        project_name=None, icon_url=None, version_number=None, game_versions=[],
        loaders=[], categories=[], client_side=None, server_side=None,
    )


async def _add_upgrade_info(results: list[ModResult], default_loader: str | None = None) -> list[ModResult]:
    upgradeable: list[tuple[ModResult, str, str]] = []

    for r in results:
        if not r.found or not r.project_id or not r.game_versions:
            continue
        if r.version_id and r.loaders:
            upgradeable.append((r, r.game_versions[0], r.loaders[0]))
        elif not r.version_id and default_loader:
            game_version = _detect_installed_game_version(r.version_number, r.game_versions)
            if game_version is None:
                continue
            loader = r.loaders[0] if (len(r.loaders) == 1 and r.loaders[0] == default_loader) else default_loader
            upgradeable.append((r, game_version, loader))

    if not upgradeable:
        return results

    queries = [(r.project_id, gv, loader) for r, gv, loader in upgradeable]
    try:
        latest_list = await modrinth_service.get_latest_versions_batch(queries)
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.error("Modrinth version batch fetch failed, skipping upgrade info: %s", exc)
        return results

    upgrade_map: dict[str, str] = {}
    resolved_version_id_map: dict[str, str] = {}

    for (r, _, _), latest in zip(upgradeable, latest_list):
        if not latest or not isinstance(latest, dict):
            continue
        if r.version_id:
            if latest.get("id") != r.version_id:
                upgrade_map[r.project_id] = latest.get("version_number", "")
        else:
            resolved_version_id_map[r.project_id] = latest["id"]
            if latest.get("version_number") != r.version_number:
                upgrade_map[r.project_id] = latest.get("version_number", "")

    updated: list[ModResult] = []
    for r in results:
        changes: dict = {}
        if r.project_id in upgrade_map:
            changes["update_available"] = True
            changes["latest_version"] = upgrade_map[r.project_id]
        if not r.version_id and r.project_id in resolved_version_id_map:
            changes["version_id"] = resolved_version_id_map[r.project_id]
        updated.append(r.model_copy(update=changes) if changes else r)
    return updated


def _summary(results: list[ModResult]) -> AnalyzerResponse:
    found = sum(1 for r in results if r.found)
    return AnalyzerResponse(total=len(results), found=found, unknown=len(results) - found, results=results)


async def _lookup_hashes(hash_to_filename: dict[str, str]) -> AnalyzerResponse:
    if not hash_to_filename:
        return AnalyzerResponse(total=0, found=0, unknown=0, results=[])

    try:
        version_map = await modrinth_service.get_versions_by_hashes(list(hash_to_filename.keys()))
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.error("Modrinth hash lookup failed, returning all mods as unknown: %s", exc)
        return _summary([
            ModResult(
                filename=name, sha512=sha512, found=False, project_id=None,
                project_name=None, icon_url=None, version_number=None, game_versions=[],
                loaders=[], categories=[], client_side=None, server_side=None,
            )
            for sha512, name in hash_to_filename.items()
        ])

    project_ids = list({v["project_id"] for v in version_map.values()})
    projects: dict[str, dict] = {}
    if project_ids:
        try:
            project_list = await modrinth_service.get_projects(project_ids)
            projects = {p["id"]: p for p in project_list}
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            logger.error("Modrinth project fetch failed, returning partial results without metadata: %s", exc)

    results: list[ModResult] = []
    for sha512, filename in hash_to_filename.items():
        version = version_map.get(sha512)
        if version:
            project = projects.get(version["project_id"], {})
            results.append(ModResult(
                filename=filename, sha512=sha512, found=True,
                project_id=version["project_id"],
                project_name=project.get("title"),
                icon_url=project.get("icon_url"),
                version_id=version.get("id"),
                version_number=version.get("version_number"),
                game_versions=version.get("game_versions", []),
                loaders=version.get("loaders", []),
                categories=project.get("categories", []),
                client_side=project.get("client_side"),
                server_side=project.get("server_side"),
            ))
        else:
            results.append(ModResult(
                filename=filename, sha512=sha512, found=False, project_id=None,
                project_name=None, icon_url=None, version_number=None, game_versions=[],
                loaders=[], categories=[], client_side=None, server_side=None,
            ))

    results = await _add_upgrade_info(results)
    return _summary(results)


async def _hash_file(file: UploadFile) -> tuple[str, str] | None:
    name = (file.filename or "").split("/")[-1].split("\\")[-1]
    if not name.endswith(".jar"):
        return None
    content = await file.read()
    loop = asyncio.get_running_loop()
    sha512 = await loop.run_in_executor(None, lambda: hashlib.sha512(content).hexdigest())
    return sha512, name


async def analyze_files(files: list[UploadFile]) -> AnalyzerResponse:
    pairs = await asyncio.gather(*[_hash_file(f) for f in files])
    hash_to_filename = {sha512: name for sha512, name in pairs if sha512 is not None}
    return await _lookup_hashes(hash_to_filename)


async def analyze_prism_json(mods: list[PrismMod]) -> AnalyzerResponse:
    hash_to_filename = {mod.sha512: mod.filename for mod in mods if mod.sha512}
    return await _lookup_hashes(hash_to_filename)


def _project_to_result(mod: ModlistMod, project: dict) -> ModResult:
    return ModResult(
        filename=mod.filename or mod.name, sha512="", found=True,
        project_id=project["id"],
        project_name=project.get("title"),
        icon_url=project.get("icon_url"),
        version_number=mod.version,
        game_versions=project.get("game_versions", []),
        loaders=project.get("loaders", []),
        categories=project.get("categories", []),
        client_side=project.get("client_side"),
        server_side=project.get("server_side"),
    )


async def analyze_modlist(mods: list[ModlistMod]) -> AnalyzerResponse:
    inferred_loader = _infer_loader(mods)

    modrinth_mods: dict[str, ModlistMod] = {}
    cf_mods: list[tuple[str, ModlistMod]] = []
    skipped: list[ModResult] = []

    for mod in mods:
        project_id = _extract_project_id(mod.url or "")
        if project_id:
            modrinth_mods[project_id] = mod
        else:
            cf_slug = _extract_curseforge_slug(mod.url or "")
            if cf_slug:
                cf_mods.append((cf_slug, mod))
            else:
                skipped.append(_make_unknown(mod.name))

    results: list[ModResult] = list(skipped)

    if modrinth_mods:
        try:
            project_list = await modrinth_service.get_projects(list(modrinth_mods.keys()))
            project_map = {p["id"]: p for p in project_list}
            slug_map = {p["slug"]: p for p in project_list}
            for slug, mod in modrinth_mods.items():
                project = project_map.get(slug) or slug_map.get(slug)
                results.append(_project_to_result(mod, project) if project else _make_unknown(mod.name))
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            logger.error("Modrinth project fetch failed for modlist: %s", exc)
            results.extend(_make_unknown(mod.name) for mod in modrinth_mods.values())

    if cf_mods:
        resolved = await asyncio.gather(*[_resolve_curseforge_mod(slug) for slug, _ in cf_mods])
        for (_, mod), project in zip(cf_mods, resolved):
            results.append(_project_to_result(mod, project) if project else _make_unknown(mod.name))

    results = await _add_upgrade_info(results, inferred_loader)
    return _summary(results)
