import asyncio
import io
import secrets
import string
import zipfile

import httpx

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import ChangelogAction, Modpack, ModpackChangelog, ModpackMod, ModSide
from app.schemas.modpack import ModpackCreate, ModpackModCreate, ModpackUpdate
from app.services import modrinth_service

_ALPHABET = string.ascii_letters + string.digits


def _generate_share_code(length: int = 8) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))


async def _unique_share_code(db: AsyncSession) -> str:
    while True:
        code = _generate_share_code()
        result = await db.execute(select(Modpack).where(Modpack.share_code == code))
        if result.scalar_one_or_none() is None:
            return code


async def create_modpack(db: AsyncSession, user_id: int, data: ModpackCreate) -> Modpack:
    modpack = Modpack(
        user_id=user_id,
        name=data.name,
        game_version=data.game_version,
        loader=data.loader,
        share_code=await _unique_share_code(db),
    )
    db.add(modpack)
    await db.commit()
    result = await db.execute(
        select(Modpack).where(Modpack.id == modpack.id).options(selectinload(Modpack.mods), selectinload(Modpack.source_server))
    )
    return result.scalar_one()


async def list_modpacks(db: AsyncSession, user_id: int) -> list[Modpack]:
    result = await db.execute(
        select(Modpack)
        .where(Modpack.user_id == user_id)
        .options(selectinload(Modpack.mods), selectinload(Modpack.source_server))
        .order_by(Modpack.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_modpack(db: AsyncSession, modpack_id: int, user_id: int) -> Modpack | None:
    result = await db.execute(
        select(Modpack)
        .where(Modpack.id == modpack_id, Modpack.user_id == user_id)
        .options(selectinload(Modpack.mods), selectinload(Modpack.source_server))
    )
    return result.scalar_one_or_none()


async def get_modpack_by_share_code(db: AsyncSession, code: str) -> Modpack | None:
    result = await db.execute(
        select(Modpack)
        .where(Modpack.share_code == code)
        .options(selectinload(Modpack.mods), selectinload(Modpack.source_server))
    )
    return result.scalar_one_or_none()


async def update_modpack(db: AsyncSession, modpack: Modpack, data: ModpackUpdate) -> Modpack:
    if data.name is not None:
        modpack.name = data.name
    if data.game_version is not None:
        modpack.game_version = data.game_version
    if data.loader is not None:
        modpack.loader = data.loader
    if data.icon_color is not None:
        modpack.icon_color = data.icon_color
    if data.icon_letter is not None:
        modpack.icon_letter = data.icon_letter
    if data.icon_url is not None:
        modpack.icon_url = data.icon_url
    # Use model_fields_set so null is treated as "clear" rather than "omitted"
    if "source_share_code" in data.model_fields_set:
        modpack.source_share_code = data.source_share_code
    if "description" in data.model_fields_set:
        modpack.description = data.description
    await db.commit()
    result = await db.execute(
        select(Modpack).where(Modpack.id == modpack.id).options(selectinload(Modpack.mods), selectinload(Modpack.source_server))
    )
    return result.scalar_one()


async def get_missing_dependencies(
    version_id: str, existing_project_ids: set[str]
) -> list[dict]:
    try:
        version = await modrinth_service.get_version(version_id)
        required_ids = [
            d["project_id"]
            for d in version.get("dependencies", [])
            if d.get("dependency_type") == "required"
            and d.get("project_id")
            and d["project_id"] not in existing_project_ids
        ]
        if not required_ids:
            return []
        projects = await modrinth_service.get_projects(required_ids)
        return [
            {
                "project_id": p["id"],
                "name": p["title"],
                "icon_url": p.get("icon_url"),
                "categories": p.get("categories", []),
            }
            for p in projects
        ]
    except Exception:
        return []


async def bulk_add_with_versions(
    db: AsyncSession,
    modpack: Modpack,
    items: list,
    actor_id: int | None = None,
) -> tuple[list[ModpackMod], list[dict]]:
    queries = [(item.modrinth_project_id, modpack.game_version, modpack.loader) for item in items]
    versions = await modrinth_service.get_latest_versions_batch(queries)

    existing_ids = {m.modrinth_project_id for m in modpack.mods}
    to_add: list[tuple] = []
    for item, ver in zip(items, versions):
        if ver is None or item.modrinth_project_id in existing_ids:
            continue
        existing_ids.add(item.modrinth_project_id)
        to_add.append((item, ver))

    if not to_add:
        return [], []

    mods: list[ModpackMod] = []
    for item, ver in to_add:
        files = ver.get("files", [])
        filename = next((f["filename"] for f in files if f.get("primary")), files[0]["filename"] if files else None)
        mod = ModpackMod(
            modpack_id=modpack.id,
            modrinth_project_id=item.modrinth_project_id,
            version_id=ver["id"],
            name=item.name,
            side=ModSide(item.side),
            icon_url=item.icon_url,
            version_number=ver.get("version_number"),
            version_type=ver.get("version_type"),
            filename=filename,
            categories=item.categories or [],
        )
        db.add(mod)
        if actor_id is not None:
            db.add(ModpackChangelog(
                modpack_id=modpack.id,
                actor_id=actor_id,
                action=ChangelogAction.added,
                mod_name=item.name,
                mod_icon_url=item.icon_url,
                modrinth_project_id=item.modrinth_project_id,
                version_number=ver.get("version_number"),
            ))
        mods.append(mod)

    await db.commit()
    for mod in mods:
        await db.refresh(mod)

    all_ids = {m.modrinth_project_id for m in modpack.mods} | {item.modrinth_project_id for item, _ in to_add}
    dep_results = await asyncio.gather(
        *[get_missing_dependencies(ver["id"], all_ids) for _, ver in to_add]
    )

    seen: set[str] = set()
    missing: list[dict] = []
    for deps in dep_results:
        for dep in deps:
            if dep["project_id"] not in seen:
                seen.add(dep["project_id"])
                missing.append(dep)

    return mods, missing


async def delete_modpack(db: AsyncSession, modpack: Modpack) -> None:
    await db.delete(modpack)
    await db.commit()


async def add_mod(db: AsyncSession, modpack: Modpack, data: ModpackModCreate, actor_id: int | None = None) -> ModpackMod:
    existing = await db.execute(
        select(ModpackMod).where(
            ModpackMod.modpack_id == modpack.id,
            ModpackMod.modrinth_project_id == data.modrinth_project_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"Mod {data.modrinth_project_id} already in modpack")

    mod = ModpackMod(
        modpack_id=modpack.id,
        modrinth_project_id=data.modrinth_project_id,
        version_id=data.version_id,
        name=data.name,
        side=ModSide(data.side),
        icon_url=data.icon_url,
        version_number=data.version_number,
        version_type=data.version_type,
        filename=data.filename,
        categories=data.categories or [],
    )
    db.add(mod)
    if actor_id is not None:
        db.add(ModpackChangelog(
            modpack_id=modpack.id,
            actor_id=actor_id,
            action=ChangelogAction.added,
            mod_name=data.name,
            mod_icon_url=data.icon_url,
            modrinth_project_id=data.modrinth_project_id,
            version_number=data.version_number,
        ))
    await db.commit()
    await db.refresh(mod)
    return mod


async def bulk_add_mods(db: AsyncSession, modpack: Modpack, mods: list[ModpackModCreate]) -> None:
    for data in mods:
        db.add(ModpackMod(
            modpack_id=modpack.id,
            modrinth_project_id=data.modrinth_project_id,
            version_id=data.version_id,
            name=data.name,
            side=ModSide(data.side),
            icon_url=data.icon_url,
            version_number=data.version_number,
            version_type=data.version_type,
            filename=data.filename,
            categories=data.categories or [],
        ))
    await db.commit()


async def get_filtered_mod_versions(
    db: AsyncSession, modpack_id: int, mod_id: int, user_id: int
) -> tuple[bool, list[dict]] | tuple[None, None]:
    modpack = await get_modpack(db, modpack_id, user_id)
    if modpack is None:
        return None, None

    result = await db.execute(
        select(ModpackMod).where(
            ModpackMod.id == mod_id,
            ModpackMod.modpack_id == modpack_id,
        )
    )
    mod = result.scalar_one_or_none()
    if mod is None:
        return None, None

    versions = await modrinth_service.get_project_versions_filtered(
        mod.modrinth_project_id, modpack.game_version, modpack.loader
    )

    items: list[dict] = []
    for v in versions:
        files = v.get("files", [])
        primary = next((f for f in files if f.get("primary")), files[0] if files else None)
        if not primary:
            continue
        items.append({
            "version_id": v["id"],
            "version_number": v.get("version_number", ""),
            "version_type": v.get("version_type", "release"),
            "filename": primary["filename"],
            "download_url": primary["url"],
            "date_published": v.get("date_published", ""),
        })

    return True, items


async def update_mod_version(
    db: AsyncSession, modpack_id: int, mod_id: int, user_id: int, data
) -> ModpackMod | None:
    result = await db.execute(
        select(ModpackMod)
        .join(Modpack)
        .where(
            ModpackMod.id == mod_id,
            ModpackMod.modpack_id == modpack_id,
            Modpack.user_id == user_id,
        )
    )
    mod = result.scalar_one_or_none()
    if mod is None:
        return None

    old_version_number = mod.version_number

    mod.version_id = data.version_id
    mod.version_number = data.version_number
    mod.filename = data.filename

    if old_version_number != data.version_number:
        db.add(ModpackChangelog(
            modpack_id=modpack_id,
            actor_id=user_id,
            action=ChangelogAction.removed,
            mod_name=mod.name,
            mod_icon_url=mod.icon_url,
            modrinth_project_id=mod.modrinth_project_id,
            version_number=old_version_number,
        ))
        db.add(ModpackChangelog(
            modpack_id=modpack_id,
            actor_id=user_id,
            action=ChangelogAction.added,
            mod_name=mod.name,
            mod_icon_url=mod.icon_url,
            modrinth_project_id=mod.modrinth_project_id,
            version_number=data.version_number,
        ))

    await db.commit()
    await db.refresh(mod)
    return mod


async def remove_mod(db: AsyncSession, modpack_id: int, mod_id: int, user_id: int) -> bool:
    result = await db.execute(
        select(ModpackMod)
        .join(Modpack)
        .where(ModpackMod.id == mod_id, ModpackMod.modpack_id == modpack_id, Modpack.user_id == user_id)
    )
    mod = result.scalar_one_or_none()
    if not mod:
        return False
    db.add(ModpackChangelog(
        modpack_id=modpack_id,
        actor_id=user_id,
        action=ChangelogAction.removed,
        mod_name=mod.name,
        mod_icon_url=mod.icon_url,
        modrinth_project_id=mod.modrinth_project_id,
        version_number=mod.version_number,
    ))
    await db.delete(mod)
    await db.commit()
    return True


async def get_changelog(db: AsyncSession, modpack_id: int) -> list[ModpackChangelog]:
    result = await db.execute(
        select(ModpackChangelog)
        .where(ModpackChangelog.modpack_id == modpack_id)
        .order_by(ModpackChangelog.created_at.desc())
    )
    return list(result.scalars().all())


async def import_modpack(db: AsyncSession, user_id: int, code: str, name: str, is_synced: bool = False) -> Modpack | None:
    source = await get_modpack_by_share_code(db, code)
    if not source:
        return None

    modpack = Modpack(
        user_id=user_id,
        name=name,
        game_version=source.game_version,
        loader=source.loader,
        share_code=await _unique_share_code(db),
        source_share_code=code if is_synced else None,
    )
    db.add(modpack)
    await db.flush()

    if not is_synced:
        for mod in source.mods:
            db.add(ModpackMod(
                modpack_id=modpack.id,
                modrinth_project_id=mod.modrinth_project_id,
                version_id=mod.version_id,
                name=mod.name,
                side=mod.side,
                icon_url=mod.icon_url,
                version_number=mod.version_number,
                version_type=mod.version_type,
                filename=mod.filename,
                categories=mod.categories or [],
            ))

    await db.commit()
    result = await db.execute(
        select(Modpack)
        .where(Modpack.id == modpack.id)
        .options(selectinload(Modpack.mods), selectinload(Modpack.source_server))
    )
    return result.scalar_one()


async def get_user_modpack_by_share_code(db: AsyncSession, code: str, user_id: int) -> Modpack | None:
    result = await db.execute(
        select(Modpack)
        .where(Modpack.share_code == code, Modpack.user_id == user_id)
        .options(selectinload(Modpack.mods), selectinload(Modpack.source_server))
    )
    return result.scalar_one_or_none()


async def resolve_mods(db: AsyncSession, modpack: Modpack) -> list[ModpackMod]:
    if not modpack.source_share_code:
        return list(modpack.mods)
    source = await get_modpack_by_share_code(db, modpack.source_share_code)
    return list(source.mods) if source else []


async def build_zip(db: AsyncSession, modpack_id: int, user_id: int) -> tuple[bytes, str, list[str]] | None:
    modpack = await get_modpack(db, modpack_id, user_id)
    if not modpack:
        return None

    mods = await resolve_mods(db, modpack)
    sem = asyncio.Semaphore(5)
    failed: list[str] = []
    _headers = {"User-Agent": "modsync/1.0 (github.com/kytxii/modsync)"}

    async def fetch_mod(client: httpx.AsyncClient, mod: ModpackMod) -> tuple[str, bytes] | None:
        async with sem:
            try:
                version = await modrinth_service.get_version(mod.version_id)
                mod_files = version.get("files", [])
                if not mod_files:
                    failed.append(mod.name)
                    return None
                primary = next((f for f in mod_files if f.get("primary")), mod_files[0])
                filename = mod.filename or primary["filename"]
                r = await client.get(primary["url"])
                r.raise_for_status()
                return filename, r.content
            except Exception:
                failed.append(mod.name)
                return None

    async with httpx.AsyncClient(headers=_headers, timeout=30.0) as client:
        results = await asyncio.gather(*[fetch_mod(client, mod) for mod in mods])

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for result in results:
            if result is not None:
                filename, content = result
                zf.writestr(f"mods/{filename}", content)

    safe_name = "".join(c if c.isalnum() or c in "-_" else "-" for c in modpack.name.lower())
    return buf.getvalue(), f"{safe_name}.zip", failed
