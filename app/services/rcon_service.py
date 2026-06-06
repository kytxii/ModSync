import asyncio
import re
import struct

TIMEOUT = 3.0
_COLOR = re.compile(r"§[0-9a-fk-orA-FK-OR]")


def _get_prop(properties_text: str, key: str) -> str | None:
    for line in properties_text.split("\n"):
        stripped = line.strip()
        if stripped.startswith(f"{key}="):
            return stripped[len(key) + 1:]
    return None


def _strip_colors(text: str) -> str:
    return _COLOR.sub("", text)


def _pack(req_id: int, type_: int, payload: str) -> bytes:
    encoded = payload.encode("utf-8")
    length = 4 + 4 + len(encoded) + 2
    return struct.pack("<iii", length, req_id, type_) + encoded + b"\x00\x00"


async def _read(reader: asyncio.StreamReader) -> tuple[int, int, str]:
    header = await asyncio.wait_for(reader.readexactly(4), TIMEOUT)
    (length,) = struct.unpack("<i", header)
    body = await asyncio.wait_for(reader.readexactly(length), TIMEOUT)
    req_id, _ = struct.unpack_from("<ii", body, 0)
    payload = body[8 : length - 2].decode("utf-8", errors="replace")
    return req_id, 0, payload


def _parse_params(server) -> tuple[str, int, str]:
    if not server.server_ip:
        raise ValueError("No server IP configured")
    props = server.properties_text or ""
    if _get_prop(props, "enable-rcon") != "true":
        raise ValueError("RCON is not enabled — set enable-rcon=true in server.properties")
    host = server.server_ip.rsplit(":", 1)[0] if ":" in server.server_ip else server.server_ip
    try:
        port = int(_get_prop(props, "rcon.port") or "25575")
    except ValueError:
        port = 25575
    password = _get_prop(props, "rcon.password") or ""
    return host, port, password


async def _connect(host: str, port: int, password: str) -> tuple[asyncio.StreamReader, asyncio.StreamWriter]:
    reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), TIMEOUT)
    writer.write(_pack(1, 3, password))
    await writer.drain()
    req_id, _, _ = await _read(reader)
    if req_id == -1:
        writer.close()
        raise ValueError("RCON authentication failed — check rcon.password")
    return reader, writer


async def test_connection(server) -> dict:
    try:
        host, port, password = _parse_params(server)
    except ValueError as e:
        return {"connected": False, "error": str(e)}
    writer = None
    try:
        _, writer = await _connect(host, port, password)
        return {"connected": True, "error": None}
    except asyncio.TimeoutError:
        return {"connected": False, "error": "Connection timed out"}
    except ConnectionRefusedError:
        return {"connected": False, "error": "Connection refused — server may be offline"}
    except ValueError as e:
        return {"connected": False, "error": str(e)}
    except Exception as e:
        return {"connected": False, "error": str(e)}
    finally:
        if writer:
            writer.close()


async def _run_safe(server, command: str) -> str | None:
    try:
        return await run_command(server, command)
    except Exception:
        return None


async def fetch_state(server) -> dict:
    _parse_params(server)  # raises ValueError if not configured

    tps_raw, mem_raw, time_raw, list_raw = await asyncio.gather(
        _run_safe(server, "spark tps"),
        _run_safe(server, "spark heapinfo"),
        _run_safe(server, "time query daytime"),
        _run_safe(server, "list"),
    )

    # TPS + Spark availability
    spark_available = False
    tps = None
    if tps_raw is not None:
        if "unknown command" not in tps_raw.lower():
            spark_available = True
            clean = tps_raw.replace("*", "")
            nums = re.findall(r"[\d.]+", clean.split(":")[-1] if ":" in clean else clean)
            if nums:
                try:
                    tps = round(float(nums[0]), 2)
                except ValueError:
                    pass

    # Memory
    memory_used_mb = None
    memory_max_mb = None
    if mem_raw is not None and "unknown command" not in mem_raw.lower():
        m = re.search(r"([\d.]+)\s*/\s*([\d.]+)\s*MB", mem_raw, re.IGNORECASE)
        if m:
            memory_used_mb = int(float(m.group(1)))
            memory_max_mb = int(float(m.group(2)))
        else:
            m = re.search(r"([\d.]+)\s*GB\s*/\s*([\d.]+)\s*GB", mem_raw, re.IGNORECASE)
            if m:
                memory_used_mb = int(float(m.group(1)) * 1024)
                memory_max_mb = int(float(m.group(2)) * 1024)

    # Time ticks
    time_ticks = None
    if time_raw is not None:
        nums = re.findall(r"\d+", time_raw)
        if nums:
            try:
                time_ticks = int(nums[-1])
            except ValueError:
                pass

    # Players
    players: list[str] = []
    player_count = 0
    player_max = 20
    if list_raw is not None:
        m = re.search(r"(\d+)\s+of\s+a\s+max\s+of\s+(\d+)", list_raw)
        if m:
            player_count = int(m.group(1))
            player_max = int(m.group(2))
        if ":" in list_raw:
            names_part = list_raw.split(":", 1)[1].strip()
            if names_part:
                players = [n.strip() for n in names_part.split(",") if n.strip()]

    return {
        "spark_available": spark_available,
        "tps": tps,
        "memory_used_mb": memory_used_mb,
        "memory_max_mb": memory_max_mb,
        "time_ticks": time_ticks,
        "players": players,
        "player_count": player_count,
        "player_max": player_max,
    }


async def run_command(server, command: str) -> str:
    host, port, password = _parse_params(server)
    reader, writer = await _connect(host, port, password)
    try:
        writer.write(_pack(2, 2, command))
        await writer.drain()
        _, _, output = await _read(reader)
        return _strip_colors(output)
    finally:
        writer.close()
