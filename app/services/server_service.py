import asyncio
import base64
import io
import json
import logging
import secrets
import string
import time
import zipfile

import httpx
from PIL import Image
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import ModSide, Modpack, ModpackMod, Server, ServerMod, ServerUptimeCheck
from app.schemas.server import ServerCreate, ServerModCreate, ServerUpdate

_MAX_ICON_BYTES = 2 * 1024 * 1024
_ALLOWED_ICON_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


def _process_icon(data: bytes) -> str:
    try:
        img = Image.open(io.BytesIO(data))
    except Exception as exc:
        raise ValueError("invalid_image") from exc
    img = img.convert("RGBA")
    w, h = img.size
    size = min(w, h)
    img = img.crop(((w - size) // 2, (h - size) // 2, (w + size) // 2, (h + size) // 2))
    img = img.resize((256, 256), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"

_HEADERS = {"User-Agent": "modsync/1.0 (github.com/kytxii/modsync)"}
_STATUS_HEADERS = _HEADERS
_FABRIC_META = "https://meta.fabricmc.net"
_MODRINTH_API = "https://api.modrinth.com/v2"
_CODE_ALPHABET = string.ascii_lowercase + string.digits

logger = logging.getLogger(__name__)


def _generate_code(length: int = 10) -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))


async def _unique_code(db: AsyncSession) -> str:
    while True:
        code = _generate_code()
        result = await db.execute(select(Server).where(Server.share_code == code))
        if result.scalar_one_or_none() is None:
            return code


def _default_properties(name: str) -> str:
    return (
        "#Minecraft server properties\n"
        f"motd={name}\n"
        "max-players=20\n"
        "server-port=25565\n"
        "difficulty=easy\n"
        "gamemode=survival\n"
        "pvp=true\n"
        "white-list=false\n"
        "enforce-whitelist=false\n"
        "view-distance=10\n"
        "simulation-distance=10\n"
        "level-seed=\n"
        "level-name=world\n"
        "level-type=minecraft\\:normal\n"
        "online-mode=true\n"
        "enable-command-block=false\n"
        "enable-rcon=false\n"
        "rcon.port=25575\n"
        "rcon.password=\n"
        "enable-query=false\n"
        "query.port=25565\n"
        "enable-jmx-monitoring=false\n"
        "enable-status=true\n"
        "spawn-protection=16\n"
        "spawn-npcs=true\n"
        "spawn-animals=true\n"
        "spawn-monsters=true\n"
        "allow-nether=true\n"
        "allow-flight=false\n"
        "generate-structures=true\n"
        "generator-settings={}\n"
        "hardcore=false\n"
        "force-gamemode=false\n"
        "max-tick-time=60000\n"
        "max-world-size=29999984\n"
        "network-compression-threshold=256\n"
        "op-permission-level=4\n"
        "function-permission-level=2\n"
        "player-idle-timeout=0\n"
        "rate-limit=0\n"
        "enforce-secure-profile=true\n"
        "prevent-proxy-connections=false\n"
        "use-native-transport=true\n"
        "broadcast-console-to-ops=true\n"
        "broadcast-rcon-to-ops=true\n"
        "hide-online-players=false\n"
        "entity-broadcast-range-percentage=100\n"
        "max-chained-neighbor-updates=1000000\n"
        "sync-chunk-writes=true\n"
        "require-resource-pack=false\n"
        "resource-pack=\n"
        "resource-pack-sha1=\n"
        "resource-pack-prompt=\n"
        "initial-enabled-packs=vanilla\n"
        "initial-disabled-packs=\n"
        "text-filtering-config=\n"
        "server-ip=\n"
    )


async def create_server(db: AsyncSession, user_id: int, data: ServerCreate) -> Server:
    server = Server(
        user_id=user_id,
        name=data.name,
        game_version=data.game_version,
        loader=data.loader,
        loader_version=data.loader_version,
        memory_mb=data.memory_mb,
        server_ip=data.server_ip,
        share_code=await _unique_code(db),
        properties_text=_default_properties(data.name),
    )
    db.add(server)
    await db.commit()
    result = await db.execute(
        select(Server).where(Server.id == server.id).options(selectinload(Server.mods))
    )
    return result.scalar_one()


async def list_servers(db: AsyncSession, user_id: int) -> list[Server]:
    result = await db.execute(
        select(Server)
        .where(Server.user_id == user_id)
        .options(selectinload(Server.mods))
        .order_by(Server.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_server_by_code(db: AsyncSession, code: str, user_id: int) -> Server | None:
    result = await db.execute(
        select(Server)
        .where(Server.share_code == code, Server.user_id == user_id)
        .options(selectinload(Server.mods))
    )
    return result.scalar_one_or_none()


async def get_server(db: AsyncSession, server_id: int, user_id: int) -> Server | None:
    result = await db.execute(
        select(Server)
        .where(Server.id == server_id, Server.user_id == user_id)
        .options(selectinload(Server.mods))
    )
    return result.scalar_one_or_none()


async def update_server(db: AsyncSession, server: Server, data: ServerUpdate) -> Server:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(server, field, value)
    await db.commit()
    result = await db.execute(
        select(Server).where(Server.id == server.id).options(selectinload(Server.mods))
    )
    return result.scalar_one()


async def delete_server(db: AsyncSession, server: Server) -> None:
    await db.delete(server)
    await db.commit()


async def add_mod(db: AsyncSession, server: Server, data: ServerModCreate) -> ServerMod:
    existing = await db.execute(
        select(ServerMod).where(
            ServerMod.server_id == server.id,
            ServerMod.modrinth_project_id == data.modrinth_project_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"Mod {data.modrinth_project_id} already in server")

    mod = ServerMod(
        server_id=server.id,
        modrinth_project_id=data.modrinth_project_id,
        version_id=data.version_id,
        name=data.name,
        side=ModSide(data.side),
        icon_url=data.icon_url,
        filename=data.filename,
        version_number=data.version_number,
        version_type=data.version_type,
        categories=data.categories or [],
    )
    db.add(mod)
    await db.commit()
    await db.refresh(mod)
    return mod


async def remove_mod(db: AsyncSession, server_id: int, mod_id: int, user_id: int) -> bool:
    result = await db.execute(
        select(ServerMod)
        .join(Server)
        .where(ServerMod.id == mod_id, ServerMod.server_id == server_id, Server.user_id == user_id)
    )
    mod = result.scalar_one_or_none()
    if not mod:
        return False
    await db.delete(mod)
    await db.commit()
    return True


async def _get_version_dependencies(client: httpx.AsyncClient, version_id: str) -> list[dict]:
    try:
        r = await client.get(f"{_MODRINTH_API}/version/{version_id}", headers=_HEADERS)
        r.raise_for_status()
        return r.json().get("dependencies", [])
    except Exception:
        return []


async def _get_project_brief(client: httpx.AsyncClient, project_id: str) -> dict | None:
    try:
        r = await client.get(f"{_MODRINTH_API}/project/{project_id}", headers=_HEADERS)
        r.raise_for_status()
        data = r.json()
        return {
            "project_id": project_id,
            "name": data.get("title", project_id),
            "icon_url": data.get("icon_url"),
            "client_side": data.get("client_side", "optional"),
            "server_side": data.get("server_side", "optional"),
            "categories": data.get("categories", []),
        }
    except Exception:
        logger.warning("Could not fetch project info for dep %s", project_id)
        return None


async def get_missing_dependencies(server: Server) -> list[dict]:
    if not server.mods:
        return []

    existing_ids = {mod.modrinth_project_id for mod in server.mods}

    async with httpx.AsyncClient(timeout=30.0) as client:
        dep_lists = await asyncio.gather(
            *[_get_version_dependencies(client, mod.version_id) for mod in server.mods if mod.version_id],
            return_exceptions=True,
        )

        missing_ids: set[str] = set()
        for result in dep_lists:
            if isinstance(result, Exception):
                continue
            for dep in result:
                if dep.get("dependency_type") == "required":
                    pid = dep.get("project_id")
                    if pid and pid not in existing_ids:
                        missing_ids.add(pid)

        if not missing_ids:
            return []

        project_results = await asyncio.gather(
            *[_get_project_brief(client, pid) for pid in missing_ids],
            return_exceptions=True,
        )

    return [p for p in project_results if p and not isinstance(p, Exception)]


async def _get_best_version(client: httpx.AsyncClient, project_id: str, game_version: str, loader: str) -> dict | None:
    try:
        r = await client.get(
            f"{_MODRINTH_API}/project/{project_id}/version",
            headers=_HEADERS,
            params={
                "game_versions": json.dumps([game_version]),
                "loaders": json.dumps([loader]),
            },
        )
        r.raise_for_status()
        versions = r.json()
        if not versions:
            return None
        stable = [v for v in versions if v.get("version_type") == "release"]
        return stable[0] if stable else versions[0]
    except Exception:
        logger.warning("No compatible version found for dep %s", project_id)
        return None


async def resolve_missing_dependencies(db: AsyncSession, server: Server) -> list[ServerMod]:
    missing = await get_missing_dependencies(server)
    if not missing:
        return []

    added: list[ServerMod] = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        for dep in missing:
            pid = dep["project_id"]

            version = await _get_best_version(client, pid, server.game_version, server.loader)
            if not version:
                continue

            files = version.get("files", [])
            if not files:
                continue
            f = next((f for f in files if f.get("primary")), files[0])

            c_side = dep.get("client_side", "optional")
            s_side = dep.get("server_side", "optional")
            if c_side in ("required", "optional") and s_side == "unsupported":
                side = ModSide.client
            elif s_side in ("required", "optional") and c_side == "unsupported":
                side = ModSide.server
            else:
                side = ModSide.both

            existing = await db.execute(
                select(ServerMod).where(
                    ServerMod.server_id == server.id,
                    ServerMod.modrinth_project_id == pid,
                )
            )
            if existing.scalar_one_or_none():
                continue

            mod = ServerMod(
                server_id=server.id,
                modrinth_project_id=pid,
                version_id=version["id"],
                name=dep["name"],
                side=side,
                icon_url=dep.get("icon_url"),
                filename=f["filename"],
                version_number=version.get("version_number"),
                version_type=version.get("version_type"),
                categories=dep.get("categories", []),
            )
            db.add(mod)
            added.append(mod)

    if added:
        await db.commit()
        for mod in added:
            await db.refresh(mod)

    return added


async def _resolve_mod(client: httpx.AsyncClient, version_id: str) -> dict | None:
    """Return {name, filename, url} from Modrinth or None on failure."""
    try:
        r = await client.get(f"{_MODRINTH_API}/version/{version_id}", headers=_HEADERS)
        r.raise_for_status()
        data = r.json()
        files = data.get("files", [])
        if not files:
            return None
        f = next((f for f in files if f.get("primary")), files[0])
        return {"filename": f["filename"], "url": f["url"]}
    except Exception:
        logger.warning("Could not resolve version %s", version_id)
        return None


async def _get_latest_installer_version(client: httpx.AsyncClient) -> str:
    r = await client.get(f"{_FABRIC_META}/v2/versions/installer", headers=_HEADERS)
    r.raise_for_status()
    data = r.json()
    stable = [v for v in data if v.get("stable")]
    return (stable[0] if stable else data[0])["version"]


async def build_server_zip(server: Server) -> io.BytesIO:
    if not server.loader_version:
        raise ValueError("loader_version_required")

    memory_gb = max(1, round((server.memory_mb or 2048) / 1024))

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Fetch Fabric launcher — requires installer version in the path
        try:
            installer_version = await _get_latest_installer_version(client)
            launcher_url = (
                f"{_FABRIC_META}/v2/versions/loader"
                f"/{server.game_version}/{server.loader_version}/{installer_version}/server/jar"
            )
            r = await client.get(launcher_url)
            r.raise_for_status()
            launcher_bytes = r.content
        except httpx.HTTPError as exc:
            raise RuntimeError("fabric_api_error") from exc

        # Resolve mod download info
        mod_entries: list[dict] = []
        for mod in server.mods or []:
            if not mod.version_id:
                continue
            info = await _resolve_mod(client, mod.version_id)
            if info:
                mod_entries.append({"name": mod.name, **info})

    # Build zip in memory
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Fabric launcher
        zf.writestr("fabric-server-launch.jar", launcher_bytes)

        # mods.json
        zf.writestr("mods.json", json.dumps(mod_entries, indent=2))

        # server.properties
        zf.writestr("server.properties", server.properties_text or "")

        # eula.txt
        zf.writestr("eula.txt", "eula=true\n")

        # server-icon.png — Minecraft requires exactly 64×64
        if server.icon_url and server.icon_url.startswith("data:"):
            raw = base64.b64decode(server.icon_url.split(",", 1)[1])
            icon_img = Image.open(io.BytesIO(raw)).convert("RGBA")
            icon_img = icon_img.resize((64, 64), Image.LANCZOS)
            icon_buf = io.BytesIO()
            icon_img.save(icon_buf, format="PNG")
            zf.writestr("server-icon.png", icon_buf.getvalue())

        # setup_mods.sh (Unix line endings, executable)
        sh_lines = ["#!/bin/bash", "mkdir -p mods", 'echo "Downloading mods..."']
        for e in mod_entries:
            sh_lines.append(
                f'[ ! -f "mods/{e["filename"]}" ]'
                f' && curl -L -o "mods/{e["filename"]}" "{e["url"]}"'
            )
        sh_lines.append('echo "Done. Run ./start.sh to launch."')
        _write_executable(zf, "setup_mods.sh", "\n".join(sh_lines) + "\n")

        # setup_mods.bat (Windows line endings)
        bat_lines = ["@echo off", "if not exist mods mkdir mods", "echo Downloading mods..."]
        for e in mod_entries:
            bat_lines.append(
                f'if not exist "mods\\{e["filename"]}"'
                f' curl -L -o "mods\\{e["filename"]}" "{e["url"]}"'
            )
        bat_lines += ["echo Done. Run start.bat to launch.", "pause"]
        zf.writestr("setup_mods.bat", "\r\n".join(bat_lines) + "\r\n")

        # start.sh (executable)
        _write_executable(
            zf,
            "start.sh",
            f"#!/bin/bash\njava -Xmx{memory_gb}G -Xms1G -jar fabric-server-launch.jar nogui\n",
        )

        # start.bat
        zf.writestr(
            "start.bat",
            f"@echo off\r\njava -Xmx{memory_gb}G -Xms1G -jar fabric-server-launch.jar nogui\r\npause\r\n",
        )

    buf.seek(0)
    return buf


def _write_executable(zf: zipfile.ZipFile, name: str, content: str) -> None:
    info = zipfile.ZipInfo(name)
    info.external_attr = 0o755 << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    zf.writestr(info, content)


async def export_to_client(db: AsyncSession, server: Server, user_id: int) -> Modpack:
    # Check if a client modpack already exists for this server
    existing_result = await db.execute(
        select(Modpack).where(Modpack.source_server_id == server.id)
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        raise ValueError(f"already_exists:{existing.share_code}")

    # Filter client-compatible mods
    client_mods = [m for m in (server.mods or []) if m.side in (ModSide.client, ModSide.both)]
    if not client_mods:
        raise ValueError("no_client_mods")

    # Generate unique share code for the new modpack
    alphabet = string.ascii_lowercase + string.digits
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(8))
        clash = await db.execute(select(Modpack).where(Modpack.share_code == code))
        if clash.scalar_one_or_none() is None:
            break

    modpack = Modpack(
        user_id=user_id,
        name=f"{server.name} — Client",
        description=f"Created from {server.name}",
        game_version=server.game_version,
        loader=server.loader,
        share_code=code,
        source_server_id=server.id,
    )
    db.add(modpack)
    await db.flush()

    for mod in client_mods:
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
            categories=mod.categories,
        ))

    await db.commit()
    result = await db.execute(
        select(Modpack).where(Modpack.id == modpack.id).options(selectinload(Modpack.mods))
    )
    return result.scalar_one()


async def upload_icon(db: AsyncSession, server: Server, content_type: str, data: bytes) -> Server:
    if content_type not in _ALLOWED_ICON_TYPES:
        raise ValueError("invalid_type")
    if len(data) > _MAX_ICON_BYTES:
        raise ValueError("too_large")
    server.icon_url = _process_icon(data)
    await db.commit()
    result = await db.execute(
        select(Server).where(Server.id == server.id).options(selectinload(Server.mods))
    )
    return result.scalar_one()


async def delete_icon(db: AsyncSession, server: Server) -> Server:
    server.icon_url = None
    await db.commit()
    result = await db.execute(
        select(Server).where(Server.id == server.id).options(selectinload(Server.mods))
    )
    return result.scalar_one()


async def get_status(server_ip: str | None) -> dict:
    if not server_ip:
        return {"online": False}
    try:
        t0 = time.monotonic()
        async with httpx.AsyncClient(headers=_STATUS_HEADERS, timeout=5.0) as client:
            r = await client.get(f"https://api.mcsrvstat.us/2/{server_ip}")
            r.raise_for_status()
            data = r.json()
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        online = data.get("online", False)
        players = data.get("players")
        motd_raw = data.get("motd")
        return {
            "online": online,
            "response_ms": elapsed_ms if online else None,
            "players": {
                "online": players.get("online", 0),
                "max": players.get("max", 0),
                "list": players.get("list", []),
            } if players else None,
            "version": data.get("version"),
            "motd": motd_raw.get("clean", [""])[0] if motd_raw else None,
        }
    except Exception:
        return {"online": False}


async def reset_uptime_history(db: AsyncSession, server_id: int) -> None:
    await db.execute(
        delete(ServerUptimeCheck).where(ServerUptimeCheck.server_id == server_id)
    )
    await db.commit()


async def get_uptime_history(db: AsyncSession, server_id: int, limit: int = 45) -> list[ServerUptimeCheck]:
    result = await db.execute(
        select(ServerUptimeCheck)
        .where(ServerUptimeCheck.server_id == server_id)
        .order_by(ServerUptimeCheck.checked_at.desc())
        .limit(limit)
    )
    checks = list(result.scalars().all())
    checks.reverse()
    return checks


async def _record_uptime_check(db: AsyncSession, server: Server) -> None:
    t0 = time.monotonic()
    result = await get_status(server.server_ip)
    elapsed_ms = int((time.monotonic() - t0) * 1000)
    online = result.get("online", False)

    db.add(ServerUptimeCheck(
        server_id=server.id,
        online=online,
        response_ms=elapsed_ms if online else None,
    ))
    await db.flush()

    cutoff_result = await db.execute(
        select(ServerUptimeCheck.checked_at)
        .where(ServerUptimeCheck.server_id == server.id)
        .order_by(ServerUptimeCheck.checked_at.desc())
        .offset(89)
        .limit(1)
    )
    cutoff = cutoff_result.scalar_one_or_none()
    if cutoff:
        await db.execute(
            delete(ServerUptimeCheck).where(
                ServerUptimeCheck.server_id == server.id,
                ServerUptimeCheck.checked_at < cutoff,
            )
        )

    await db.commit()


async def run_uptime_checks(db: AsyncSession) -> None:
    result = await db.execute(
        select(Server).where(Server.server_ip.is_not(None))
    )
    servers = list(result.scalars().all())
    for server in servers:
        try:
            await _record_uptime_check(db, server)
        except Exception:
            logger.exception("Uptime check failed for server %s", server.id)
