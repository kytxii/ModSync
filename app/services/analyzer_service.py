import hashlib
import re

from fastapi import UploadFile

from app.schemas.analyzer import AnalyzerResponse, ModlistMod, ModResult, PrismMod
from app.services import modrinth_service


def _extract_project_id(url: str) -> str | None:
    match = re.search(r"modrinth\.com/mod/([^/?#]+)", url)
    return match.group(1) if match else None


def _make_unknown(name: str) -> ModResult:
    return ModResult(
        filename=name, sha512="", found=False, project_id=None,
        project_name=None, icon_url=None, version_number=None, game_versions=[],
        loaders=[], categories=[], client_side=None, server_side=None,
    )


def _summary(results: list[ModResult]) -> AnalyzerResponse:
    found = sum(1 for r in results if r.found)
    return AnalyzerResponse(total=len(results), found=found, unknown=len(results) - found, results=results)


async def _lookup_hashes(hash_to_filename: dict[str, str]) -> AnalyzerResponse:
    if not hash_to_filename:
        return AnalyzerResponse(total=0, found=0, unknown=0, results=[])

    version_map = await modrinth_service.get_versions_by_hashes(list(hash_to_filename.keys()))

    project_ids = list({v["project_id"] for v in version_map.values()})
    projects: dict[str, dict] = {}
    if project_ids:
        project_list = await modrinth_service.get_projects(project_ids)
        projects = {p["id"]: p for p in project_list}

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

    return _summary(results)


async def analyze_files(files: list[UploadFile]) -> AnalyzerResponse:
    hash_to_filename: dict[str, str] = {}
    for file in files:
        if not file.filename or not file.filename.endswith(".jar"):
            continue
        content = await file.read()
        sha512 = hashlib.sha512(content).hexdigest()
        hash_to_filename[sha512] = file.filename
    return await _lookup_hashes(hash_to_filename)


async def analyze_prism_json(mods: list[PrismMod]) -> AnalyzerResponse:
    hash_to_filename = {mod.sha512: mod.filename for mod in mods if mod.sha512}
    return await _lookup_hashes(hash_to_filename)


async def analyze_modlist(mods: list[ModlistMod]) -> AnalyzerResponse:
    slug_to_mod: dict[str, ModlistMod] = {}
    skipped: list[ModResult] = []

    for mod in mods:
        project_id = _extract_project_id(mod.url or "")
        if project_id:
            slug_to_mod[project_id] = mod
        else:
            skipped.append(_make_unknown(mod.name))

    if not slug_to_mod:
        return _summary(skipped)

    projects = await modrinth_service.get_projects(list(slug_to_mod.keys()))
    project_map = {p["id"]: p for p in projects}
    slug_map = {p["slug"]: p for p in projects}

    results: list[ModResult] = []
    for slug, mod in slug_to_mod.items():
        project = project_map.get(slug) or slug_map.get(slug)
        if not project:
            results.append(_make_unknown(mod.name))
            continue
        results.append(ModResult(
            filename=mod.name, sha512="", found=True,
            project_id=project["id"],
            project_name=project.get("title"),
            icon_url=project.get("icon_url"),
            version_number=mod.version,
            game_versions=project.get("game_versions", []),
            loaders=project.get("loaders", []),
            categories=project.get("categories", []),
            client_side=project.get("client_side"),
            server_side=project.get("server_side"),
        ))

    return _summary(results + skipped)
