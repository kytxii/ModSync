import asyncio
import io
import json
import secrets
import string
import zipfile

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import Modpack, ModpackMod, ModSide
from app.schemas.modpack import ModpackCreate, ModpackModCreate, ModpackUpdate
from app.services import modrinth_service

_SIDE_ENV: dict[ModSide, dict[str, str]] = {
    ModSide.client: {"client": "required", "server": "unsupported"},
    ModSide.server: {"client": "unsupported", "server": "required"},
    ModSide.both: {"client": "required", "server": "required"},
}

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
    await db.refresh(modpack)
    return modpack


async def list_modpacks(db: AsyncSession, user_id: int) -> list[Modpack]:
    result = await db.execute(
        select(Modpack)
        .where(Modpack.user_id == user_id)
        .options(selectinload(Modpack.mods))
        .order_by(Modpack.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_modpack(db: AsyncSession, modpack_id: int, user_id: int) -> Modpack | None:
    result = await db.execute(
        select(Modpack)
        .where(Modpack.id == modpack_id, Modpack.user_id == user_id)
        .options(selectinload(Modpack.mods))
    )
    return result.scalar_one_or_none()


async def get_modpack_by_share_code(db: AsyncSession, code: str) -> Modpack | None:
    result = await db.execute(
        select(Modpack)
        .where(Modpack.share_code == code)
        .options(selectinload(Modpack.mods))
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
    await db.commit()
    await db.refresh(modpack)
    return modpack


async def delete_modpack(db: AsyncSession, modpack: Modpack) -> None:
    await db.delete(modpack)
    await db.commit()


async def add_mod(db: AsyncSession, modpack: Modpack, data: ModpackModCreate) -> ModpackMod:
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


async def remove_mod(db: AsyncSession, modpack_id: int, mod_id: int, user_id: int) -> bool:
    result = await db.execute(
        select(ModpackMod)
        .join(Modpack)
        .where(ModpackMod.id == mod_id, ModpackMod.modpack_id == modpack_id, Modpack.user_id == user_id)
    )
    mod = result.scalar_one_or_none()
    if not mod:
        return False
    await db.delete(mod)
    await db.commit()
    return True


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
    await db.refresh(modpack)
    return modpack


async def get_user_modpack_by_share_code(db: AsyncSession, code: str, user_id: int) -> Modpack | None:
    result = await db.execute(
        select(Modpack)
        .where(Modpack.share_code == code, Modpack.user_id == user_id)
        .options(selectinload(Modpack.mods))
    )
    return result.scalar_one_or_none()


async def resolve_mods(db: AsyncSession, modpack: Modpack) -> list[ModpackMod]:
    if not modpack.source_share_code:
        return list(modpack.mods)
    source = await get_modpack_by_share_code(db, modpack.source_share_code)
    return list(source.mods) if source else []


async def build_mrpack(db: AsyncSession, modpack_id: int, user_id: int) -> tuple[bytes, str] | None:
    modpack = await get_modpack(db, modpack_id, user_id)
    if not modpack:
        return None

    mods = await resolve_mods(db, modpack)
    versions = await asyncio.gather(
        *[modrinth_service.get_version(mod.version_id) for mod in mods],
        return_exceptions=True,
    )

    files = []
    for mod, version in zip(mods, versions):
        if isinstance(version, Exception):
            continue
        mod_files = version.get("files", [])
        if not mod_files:
            continue
        primary = next((f for f in mod_files if f.get("primary")), mod_files[0])
        files.append({
            "path": f"mods/{primary['filename']}",
            "hashes": primary["hashes"],
            "env": _SIDE_ENV[mod.side],
            "downloads": [primary["url"]],
            "fileSize": primary["size"],
        })

    index = {
        "formatVersion": 1,
        "game": "minecraft",
        "versionId": "1.0.0",
        "name": modpack.name,
        "files": files,
        "dependencies": {"minecraft": modpack.game_version},
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("modrinth.index.json", json.dumps(index, indent=2))

    safe_name = "".join(c if c.isalnum() or c in "-_" else "-" for c in modpack.name.lower())
    return buf.getvalue(), f"{safe_name}.zip"
