import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getServerByCode,
  updateServer,
  addServerMod,
  removeServerMod,
  getServerStatus,
  exportServerPack,
  exportToClient,
  deleteServer,
  resetServerUptime,
  uploadServerIcon,
  deleteServerIcon,
  getSparkDownload,
} from "../api/servers";
import { getFabricGameVersions, getFabricLoaderVersions } from "../api/fabric";
import { useModToasts, ModToastsPortal, WaveLoader } from "../components/ModToasts";
import { useMissingDeps, DepsBanner, DepsModal } from "../components/MissingDeps";
import { getLatestVersion } from "../api/mods";
import SideBadge from "../components/SideBadge";
import AddModsPanel, {
  deriveSide as deriveModSide,
} from "../components/AddModsPanel";
import UptimeBar from "../components/UptimeBar";
import ModTable from "../components/ModTable";
import EulaModal from "../components/EulaModal";

// ─── constants ───────────────────────────────────────────────────────────────

const ICON_PALETTE = [
  "#059669",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#7c3aed",
  "#9333ea",
  "#ec4899",
  "#f43f5e",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#64748b",
];

function serverIconColor(name) {
  return ICON_PALETTE[name.charCodeAt(0) % ICON_PALETTE.length];
}

const MC_VERSIONS = [
  "1.21.4",
  "1.21.3",
  "1.21.1",
  "1.21",
  "1.20.6",
  "1.20.4",
  "1.20.2",
  "1.20.1",
  "1.20",
  "1.19.4",
  "1.19.2",
  "1.19",
  "1.18.2",
  "1.18",
  "1.17.1",
  "1.16.5",
];

const DEFAULT_PROPERTIES = (name) =>
  [
    "#Minecraft server properties",
    "enable-jmx-monitoring=false",
    "rcon.port=25575",
    "level-seed=",
    "gamemode=survival",
    "enable-command-block=false",
    "enable-query=false",
    "generator-settings={}",
    "enforce-secure-profile=true",
    "level-name=world",
    `motd=${name}`,
    "query.port=25565",
    "pvp=true",
    "generate-structures=true",
    "max-chained-neighbor-updates=1000000",
    "difficulty=easy",
    "network-compression-threshold=256",
    "max-tick-time=60000",
    "require-resource-pack=false",
    "use-native-transport=true",
    "max-players=20",
    "online-mode=true",
    "enable-status=true",
    "allow-flight=false",
    "initial-disabled-packs=",
    "broadcast-rcon-to-ops=true",
    "view-distance=10",
    "server-ip=",
    "resource-pack-prompt=",
    "allow-nether=true",
    "server-port=25565",
    "enable-rcon=false",
    "sync-chunk-writes=true",
    "op-permission-level=4",
    "prevent-proxy-connections=false",
    "hide-online-players=false",
    "resource-pack=",
    "entity-broadcast-range-percentage=100",
    "simulation-distance=10",
    "rcon.password=",
    "player-idle-timeout=0",
    "force-gamemode=false",
    "rate-limit=0",
    "hardcore=false",
    "white-list=false",
    "broadcast-console-to-ops=true",
    "spawn-npcs=true",
    "spawn-animals=true",
    "function-permission-level=2",
    "initial-enabled-packs=vanilla",
    "level-type=minecraft\\:normal",
    "text-filtering-config=",
    "spawn-monsters=true",
    "enforce-whitelist=false",
    "spawn-protection=16",
    "resource-pack-sha1=",
    "max-world-size=29999984",
  ].join("\n") + "\n";

// ─── properties_text helpers ─────────────────────────────────────────────────

function getProp(text, key) {
  const line = (text || "").split("\n").find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : "";
}

function setProp(text, key, value) {
  const lines = (text || "").split("\n");
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  const newLine = `${key}=${value}`;
  if (idx >= 0) {
    lines[idx] = newLine;
    return lines.join("\n");
  }
  return text ? `${text.trimEnd()}\n${newLine}\n` : `${newLine}\n`;
}

function deriveSide(hit) {
  if (hit.server_side === "unsupported") return "client";
  if (hit.client_side === "unsupported") return "server";
  return "both";
}

// ─── CopyIp ──────────────────────────────────────────────────────────────────

function CopyIp({ ip }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(ip);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      className="group flex items-center gap-1.5 font-mono text-xs text-zinc-600 transition-colors hover:text-zinc-300"
    >
      {ip}
      <span
        className={`transition-colors ${copied ? "text-emerald-400" : "text-zinc-700 group-hover:text-zinc-400"}`}
      >
        {copied ? (
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 8l4 4 8-8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </span>
    </button>
  );
}

// ─── Toggle ──────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${value ? "bg-emerald-500" : "bg-zinc-700"}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}

// ─── ServerAddModsPanel ───────────────────────────────────────────────────────

function ServerAddModsPanel({
  open,
  serverId,
  gameVersion,
  loader,
  existingIds,
  onClose,
  onAdded,
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [showClientOnly, setShowClientOnly] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const enabled = debouncedQuery.length >= 2;
  const { data, isFetching } = useQuery({
    queryKey: ["server-mod-search", debouncedQuery, gameVersion, loader],
    queryFn: () =>
      searchMods({
        query: debouncedQuery,
        game_version: gameVersion,
        loader,
        limit: 20,
      }),
    enabled,
  });

  const allHits = data?.hits ?? [];
  const hits = showClientOnly
    ? allHits
    : allHits.filter((h) => deriveSide(h) !== "client");

  function toggle(projectId) {
    if (existingIds.has(projectId)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });
  }

  const { mutate: addMods, isPending: adding } = useMutation({
    mutationFn: async (toAdd) => {
      for (const hit of toAdd) {
        await addServerMod(serverId, {
          modrinth_project_id: hit.project_id,
          version_id: "",
          name: hit.title,
          side: deriveSide(hit),
          icon_url: hit.icon_url ?? null,
          categories: hit.categories ?? [],
        });
      }
    },
    onSuccess: () => {
      setSelected(new Set());
      onAdded();
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
      {/* Search bar */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <svg
          className="shrink-0 text-zinc-500"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Modrinth…"
          className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
        />
        {isFetching && (
          <span className="shrink-0 animate-pulse text-xs text-zinc-500">
            Searching…
          </span>
        )}
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-zinc-500">Client mods</span>
          <Toggle value={showClientOnly} onChange={setShowClientOnly} />
        </div>
        {selected.size > 0 && (
          <button
            onClick={() =>
              addMods(allHits.filter((h) => selected.has(h.project_id)))
            }
            disabled={adding}
            className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-emerald-400 disabled:opacity-40"
          >
            {adding ? "Adding…" : `Add ${selected.size}`}
          </button>
        )}
        <button
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M12 4L4 12M4 4l8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Results */}
      <div className="scrollbar-dark max-h-72 overflow-y-auto divide-y divide-zinc-800">
        {!enabled && (
          <p className="py-8 text-center text-sm text-zinc-600">
            Type to search Modrinth
          </p>
        )}
        {enabled && !isFetching && hits.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500">No results</p>
        )}
        {hits.map((hit) => {
          const already = existingIds.has(hit.project_id);
          const isSelected = selected.has(hit.project_id);
          const side = deriveSide(hit);
          return (
            <div
              key={hit.project_id}
              onClick={() => toggle(hit.project_id)}
              className={`relative flex items-center gap-3 px-4 py-3 transition-colors ${already ? "cursor-default opacity-30" : isSelected ? "cursor-pointer bg-emerald-950/40" : "cursor-pointer hover:bg-zinc-900"}`}
            >
              {isSelected && (
                <div className="absolute inset-y-0 left-0 w-0.5 bg-emerald-500" />
              )}
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${already ? "border-zinc-600 bg-zinc-700" : isSelected ? "border-emerald-500 bg-emerald-500" : "border-zinc-600"}`}
              >
                {(already || isSelected) && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path
                      d="M1 3l2 2 4-4"
                      stroke="white"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              {hit.icon_url ? (
                <img
                  src={hit.icon_url}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-sm font-bold text-white">
                  {hit.title[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-white">
                    {hit.title}
                  </p>
                  <SideBadge side={side} />
                  {side === "client" && (
                    <span className="shrink-0 rounded border border-amber-800/60 bg-amber-950/40 px-1 py-0.5 text-[10px] font-medium text-amber-400">
                      Won't load server-side
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-zinc-500">
                  {hit.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DashboardTab ─────────────────────────────────────────────────────────────

function DashboardTab({ server, onSwitchTab }) {
  const {
    data: status,
    isLoading: statusLoading,
    isFetching: statusFetching,
    refetch,
  } = useQuery({
    queryKey: ["server-status", server.id],
    queryFn: () => getServerStatus(server.id),
    staleTime: 60_000,
    enabled: !!server.server_ip,
  });

  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);

  useEffect(() => () => clearInterval(cooldownRef.current), []);

  async function handleRefresh() {
    if (cooldown > 0 || statusFetching) return;
    await refetch();
    setCooldown(5);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  return (
    <div className="space-y-4">
      {/* ── Status + Uptime ── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Status</p>
          {server.server_ip && !statusLoading && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-600">
                {server.server_ip}
              </span>
              <button
                onClick={handleRefresh}
                disabled={cooldown > 0 || statusFetching}
                title={
                  cooldown > 0 ? `Cooldown ${cooldown}s` : "Refresh status"
                }
                className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 transition-colors hover:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {statusFetching ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-spin"
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                ) : cooldown > 0 ? (
                  <span className="text-[10px] font-semibold tabular-nums text-zinc-500">
                    {cooldown}
                  </span>
                ) : (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 16h5v5" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>

        {!server.server_ip ? (
          <div className="mb-5 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
            <p className="text-sm text-zinc-500">No IP configured.</p>
            <p className="mt-0.5 text-xs text-zinc-700">
              Add a server IP in the header to track live status.
            </p>
          </div>
        ) : statusLoading ? (
          <div className="mb-5 space-y-2">
            <div className="h-6 w-28 animate-pulse rounded bg-zinc-800" />
            <div className="h-4 w-44 animate-pulse rounded bg-zinc-800" />
          </div>
        ) : (
          <div className="mb-5">
            <div className="flex items-center gap-3">
              <span
                className={`h-3 w-3 shrink-0 rounded-full ${
                  status?.online
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]"
                    : "bg-red-500"
                }`}
              />
              <span
                className={`text-sm font-semibold ${status?.online ? "text-emerald-400" : "text-red-400"}`}
              >
                {status?.online ? "Online" : "Offline"}
              </span>
              {status?.online && status?.players && (
                <span className="text-sm text-zinc-400">
                  · {status.players.online} / {status.players.max} players
                </span>
              )}
            </div>
            {status?.version && (
              <p className="mt-1.5 text-xs text-zinc-600">
                Version {status.version}
              </p>
            )}
            {status?.online && status?.players?.list?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {status.players.list.map((name) => (
                  <span
                    key={name}
                    className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-zinc-800 pt-4">
          <p className="mb-3 text-base font-semibold text-zinc-400">Uptime</p>
          <UptimeBar serverId={server.id} />
        </div>
      </div>

      {/* ── Mods summary ── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">
            Mods{" "}
            <span className="ml-1 text-zinc-500">
              ({server.mods?.length ?? 0})
            </span>
          </p>
          <button
            onClick={() => onSwitchTab("mods")}
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Manage →
          </button>
        </div>
        {!server.mods?.length ? (
          <p className="text-sm text-zinc-700">No mods added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {server.mods.slice(0, 12).map((mod) => (
              <div
                key={mod.id}
                title={mod.name}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5"
              >
                {mod.icon_url ? (
                  <img
                    src={mod.icon_url}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-700 text-[9px] font-bold text-white">
                    {mod.name[0].toUpperCase()}
                  </div>
                )}
                <span className="max-w-[6rem] truncate text-xs text-zinc-300">
                  {mod.name}
                </span>
                <SideBadge side={mod.side} />
              </div>
            ))}
            {server.mods.length > 12 && (
              <button
                onClick={() => onSwitchTab("mods")}
                className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                +{server.mods.length - 12} more
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ConfigurationTab (UI form + raw toggle) ──────────────────────────────────

function ConfigurationTab({ server, onSave }) {
  const [rawMode, setRawMode] = useState(false);
  if (rawMode)
    return (
      <RawPropertiesView
        server={server}
        onSave={onSave}
        onShowUi={() => setRawMode(false)}
      />
    );
  return (
    <ConfigFormView
      server={server}
      onSave={onSave}
      onShowRaw={() => setRawMode(true)}
    />
  );
}

function ConfigFormView({ server, onSave, onShowRaw }) {
  const text = server.properties_text || DEFAULT_PROPERTIES(server.name);
  const [memInput, setMemInput] = useState(String(server.memory_mb ?? 2048));

  useEffect(() => {
    setMemInput(String(server.memory_mb ?? 2048));
  }, [server.memory_mb]);

  const { data: gameVersions } = useQuery({
    queryKey: ["fabric-game-versions"],
    queryFn: getFabricGameVersions,
    staleTime: 3_600_000,
  });

  const { data: loaderVersions } = useQuery({
    queryKey: ["fabric-loader-versions", server.game_version],
    queryFn: () => getFabricLoaderVersions(server.game_version),
    staleTime: 3_600_000,
    enabled: !!server.game_version,
  });

  const versions = gameVersions ?? MC_VERSIONS;

  function patchProp(key, value) {
    onSave({ properties_text: setProp(text, key, value) });
  }

  function commitMem(raw) {
    let val = parseInt(raw, 10);
    if (isNaN(val) || val < 512) val = 512;
    if (val > 16384) val = 16384;
    val = Math.round(val / 512) * 512;
    setMemInput(String(val));
    onSave({ memory_mb: val });
  }

  function formatMem(mb) {
    if (mb >= 1024 && mb % 1024 === 0) return `${mb / 1024} GB`;
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
  }

  const memMb = server.memory_mb ?? 2048;

  const levelTypeOptions = [
    { value: "minecraft\\:normal", label: "Normal" },
    { value: "minecraft\\:flat", label: "Superflat" },
    { value: "minecraft\\:large_biomes", label: "Large Biomes" },
    { value: "minecraft\\:amplified", label: "Amplified" },
    { value: "minecraft\\:single_biome_surface", label: "Single Biome" },
  ];

  return (
    <div className="grid gap-5 pb-6 lg:grid-cols-5">
      {/* ── Left column: fields ── */}
      <div className="space-y-5 lg:col-span-3">
        {/* Loader */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Loader</p>
            <button
              onClick={onShowRaw}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Raw
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="w-32 shrink-0 text-sm text-zinc-400">
                MC Version
              </label>
              <select
                value={server.game_version}
                onChange={(e) => onSave({ game_version: e.target.value })}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-600"
              >
                {versions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="w-32 shrink-0 text-sm text-zinc-400">
                Fabric Loader
              </label>
              <select
                value={server.loader_version ?? ""}
                onChange={(e) =>
                  onSave({ loader_version: e.target.value || null })
                }
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-600"
              >
                <option value="">
                  {loaderVersions?.length === 0
                    ? "No versions available"
                    : "Select loader version…"}
                </option>
                {(loaderVersions ?? []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="w-32 shrink-0 text-sm text-zinc-400">
                Memory
              </label>
              <div className="flex flex-1 items-center gap-3">
                <input
                  type="range"
                  min={512}
                  max={16384}
                  step={512}
                  value={memMb}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMemInput(String(val));
                    onSave({ memory_mb: val });
                  }}
                  className="flex-1 accent-emerald-500"
                />
                <input
                  type="text"
                  value={memInput}
                  onChange={(e) => setMemInput(e.target.value)}
                  onBlur={() => commitMem(memInput)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="w-20 shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-right text-sm text-white outline-none focus:border-emerald-600"
                />
                <span className="w-12 shrink-0 text-xs text-zinc-500">
                  {formatMem(memMb)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Server */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-4 text-sm font-semibold text-white">Server</p>
          <div className="space-y-4">
            {[
              { label: "MOTD", key: "motd", type: "text" },
              { label: "Max Players", key: "max-players", type: "number" },
              { label: "Port", key: "server-port", type: "number" },
              {
                label: "Spawn Protection",
                key: "spawn-protection",
                type: "number",
              },
              {
                label: "Op Permission Level",
                key: "op-permission-level",
                type: "number",
              },
              {
                label: "Function Permission",
                key: "function-permission-level",
                type: "number",
              },
              {
                label: "Player Idle Timeout",
                key: "player-idle-timeout",
                type: "number",
              },
              { label: "Rate Limit", key: "rate-limit", type: "number" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} className="flex items-center gap-4">
                <label className="w-32 shrink-0 text-sm text-zinc-400">
                  {label}
                </label>
                <input
                  type={type}
                  defaultValue={getProp(text, key)}
                  placeholder={placeholder}
                  onBlur={(e) => patchProp(key, e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-600"
                />
              </div>
            ))}
            <div className="flex items-center gap-4">
              <label className="w-32 shrink-0 text-sm text-zinc-400">
                Server IP
              </label>
              <input
                type="text"
                defaultValue={getProp(text, "server-ip")}
                placeholder="Blank = all interfaces"
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  onSave({
                    properties_text: setProp(text, "server-ip", val),
                    server_ip: val || null,
                  });
                }}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* World */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-4 text-sm font-semibold text-white">World</p>
          <div className="space-y-4">
            {[
              { label: "Level Name", key: "level-name", type: "text" },
              {
                label: "Seed",
                key: "level-seed",
                type: "text",
                placeholder: "Random if blank",
              },
              { label: "View Distance", key: "view-distance", type: "number" },
              {
                label: "Sim Distance",
                key: "simulation-distance",
                type: "number",
              },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} className="flex items-center gap-4">
                <label className="w-32 shrink-0 text-sm text-zinc-400">
                  {label}
                </label>
                <input
                  type={type}
                  defaultValue={getProp(text, key)}
                  placeholder={placeholder}
                  onBlur={(e) => patchProp(key, e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-600"
                />
              </div>
            ))}
            <div className="flex items-center gap-4">
              <label className="w-32 shrink-0 text-sm text-zinc-400">
                Level Type
              </label>
              <select
                value={getProp(text, "level-type")}
                onChange={(e) => patchProp("level-type", e.target.value)}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-600"
              >
                {levelTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {[
              {
                label: "Difficulty",
                key: "difficulty",
                options: ["peaceful", "easy", "normal", "hard"],
              },
              {
                label: "Gamemode",
                key: "gamemode",
                options: ["survival", "creative", "adventure", "spectator"],
              },
            ].map(({ label, key, options }) => (
              <div key={key} className="flex items-center gap-4">
                <label className="w-32 shrink-0 text-sm text-zinc-400">
                  {label}
                </label>
                <select
                  value={getProp(text, key)}
                  onChange={(e) => patchProp(key, e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-600"
                >
                  {options.map((o) => (
                    <option key={o} value={o} className="capitalize">
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Performance */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-4 text-sm font-semibold text-white">Performance</p>
          <div className="space-y-4">
            {[
              { label: "Max Tick Time", key: "max-tick-time", type: "number" },
              {
                label: "Network Compression",
                key: "network-compression-threshold",
                type: "number",
              },
              {
                label: "Entity Broadcast %",
                key: "entity-broadcast-range-percentage",
                type: "number",
              },
              {
                label: "Max World Size",
                key: "max-world-size",
                type: "number",
              },
              {
                label: "Max Chain Updates",
                key: "max-chained-neighbor-updates",
                type: "number",
              },
            ].map(({ label, key, type }) => (
              <div key={key} className="flex items-center gap-4">
                <label className="w-32 shrink-0 text-sm text-zinc-400">
                  {label}
                </label>
                <input
                  type={type}
                  defaultValue={getProp(text, key)}
                  onBlur={(e) => patchProp(key, e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-600"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Resource Pack */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-4 text-sm font-semibold text-white">Resource Pack</p>
          <div className="space-y-4">
            {[
              {
                label: "URL",
                key: "resource-pack",
                type: "text",
                placeholder: "https://…",
              },
              {
                label: "SHA-1",
                key: "resource-pack-sha1",
                type: "text",
                placeholder: "Hash for verification",
              },
              {
                label: "Prompt",
                key: "resource-pack-prompt",
                type: "text",
                placeholder: "Shown to players",
              },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} className="flex items-center gap-4">
                <label className="w-32 shrink-0 text-sm text-zinc-400">
                  {label}
                </label>
                <input
                  type={type}
                  defaultValue={getProp(text, key)}
                  placeholder={placeholder}
                  onBlur={(e) => patchProp(key, e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-600"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right column: toggles + RCON ── */}
      <div className="flex flex-col gap-5 lg:col-span-2">
        {/* Toggle cards — fill the space above RCON/Data Packs */}
        <div className="flex flex-1 flex-col gap-5">
          {/* Gameplay */}
          <div className="flex-[1] rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="mb-4 text-sm font-semibold text-white">Gameplay</p>
            <div className="space-y-6">
              {[
                { label: "PvP", key: "pvp" },
                { label: "Hardcore", key: "hardcore" },
                { label: "Allow Flight", key: "allow-flight" },
                { label: "Allow Nether", key: "allow-nether" },
                { label: "Generate Structures", key: "generate-structures" },
                { label: "Command Blocks", key: "enable-command-block" },
                { label: "Force Gamemode", key: "force-gamemode" },
                { label: "Spawn NPCs", key: "spawn-npcs" },
                { label: "Spawn Animals", key: "spawn-animals" },
                { label: "Spawn Monsters", key: "spawn-monsters" },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between">
                  <label className="text-sm text-zinc-400">{label}</label>
                  <Toggle
                    value={getProp(text, key) === "true"}
                    onChange={(v) => patchProp(key, v ? "true" : "false")}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Access */}
          <div className="flex-[1] rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="mb-4 text-sm font-semibold text-white">Access</p>
            <div className="space-y-6">
              {[
                { label: "Online Mode", key: "online-mode" },
                { label: "Whitelist", key: "white-list" },
                { label: "Enforce Whitelist", key: "enforce-whitelist" },
                {
                  label: "Enforce Secure Profile",
                  key: "enforce-secure-profile",
                },
                { label: "Enable Status", key: "enable-status" },
                { label: "Hide Online Players", key: "hide-online-players" },
                {
                  label: "Prevent Proxy Connections",
                  key: "prevent-proxy-connections",
                },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between">
                  <label className="text-sm text-zinc-400">{label}</label>
                  <Toggle
                    value={getProp(text, key) === "true"}
                    onChange={(v) => patchProp(key, v ? "true" : "false")}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Server Flags */}
          <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="mb-4 text-sm font-semibold text-white">
              Server Flags
            </p>
            <div className="space-y-6">
              {[
                { label: "Sync Chunk Writes", key: "sync-chunk-writes" },
                { label: "Native Transport", key: "use-native-transport" },
                {
                  label: "Broadcast RCON to Ops",
                  key: "broadcast-rcon-to-ops",
                },
                {
                  label: "Broadcast Console to Ops",
                  key: "broadcast-console-to-ops",
                },
                {
                  label: "Require Resource Pack",
                  key: "require-resource-pack",
                },
                { label: "JMX Monitoring", key: "enable-jmx-monitoring" },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between">
                  <label className="text-sm text-zinc-400">{label}</label>
                  <Toggle
                    value={getProp(text, key) === "true"}
                    onChange={(v) => patchProp(key, v ? "true" : "false")}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* end toggle group */}

        {/* RCON / Query */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-4 text-sm font-semibold text-white">RCON / Query</p>
          <div className="space-y-4">
            {[
              { label: "Enable RCON", key: "enable-rcon", type: "toggle" },
              { label: "RCON Port", key: "rcon.port", type: "number" },
              {
                label: "RCON Password",
                key: "rcon.password",
                type: "password",
              },
              { label: "Enable Query", key: "enable-query", type: "toggle" },
              { label: "Query Port", key: "query.port", type: "number" },
            ].map(({ label, key, type }) => (
              <div key={key} className="flex items-center gap-3">
                <label className="w-28 shrink-0 text-sm text-zinc-400">
                  {label}
                </label>
                {type === "toggle" ? (
                  <Toggle
                    value={getProp(text, key) === "true"}
                    onChange={(v) => patchProp(key, v ? "true" : "false")}
                  />
                ) : (
                  <input
                    type={type}
                    defaultValue={getProp(text, key)}
                    onBlur={(e) => patchProp(key, e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-600"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Data Packs */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-4 text-sm font-semibold text-white">Data Packs</p>
          <div className="space-y-4">
            {[
              { label: "Enabled Packs", key: "initial-enabled-packs" },
              { label: "Disabled Packs", key: "initial-disabled-packs" },
              { label: "Generator Settings", key: "generator-settings" },
              { label: "Text Filtering", key: "text-filtering-config" },
            ].map(({ label, key }) => (
              <div key={key} className="flex items-center gap-3">
                <label className="w-28 shrink-0 text-sm text-zinc-400">
                  {label}
                </label>
                <input
                  type="text"
                  defaultValue={getProp(text, key)}
                  onBlur={(e) => patchProp(key, e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-600"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ModsTab ─────────────────────────────────────────────────────────────────

function ModsTab({
  server,
  cacheKey,
  onToast,
  onModsAdded,
  showAdd,
  setShowAdd,
}) {
  const queryClient = useQueryClient();
  const pendingCount = useRef(0);
  const pendingMods = useRef([]);
  const mods = server?.mods ?? [];
  const existingIds = new Set(mods.map((m) => m.modrinth_project_id));

  return (
    <div>
      <div
        className="grid transition-all duration-300 ease-out"
        style={{
          gridTemplateRows: showAdd ? "1fr" : "0fr",
          opacity: showAdd ? 1 : 0,
        }}
        aria-hidden={!showAdd}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-1">
            <AddModsPanel
              open={showAdd}
              gameVersion={server.game_version}
              loader={server.loader}
              existingIds={existingIds}
              onClose={() => setShowAdd(false)}
              defaultSide="both"
              onAdd={async (toAdd) => {
                const allMissing = new Map();
                const beingAdded = new Set(toAdd.map((h) => h.project_id));
                const existingIds = new Set(server.mods?.map((m) => m.modrinth_project_id) ?? []);
                for (const hit of toAdd) {
                  let ver = null;
                  try {
                    ver = await getLatestVersion(hit.project_id, server.game_version, server.loader);
                  } catch {
                    // no matching version — add without version info
                  }
                  const result = await addServerMod(server.id, {
                    modrinth_project_id: hit.project_id,
                    version_id: ver?.version_id ?? "",
                    name: hit.title,
                    side: deriveModSide(hit),
                    icon_url: hit.icon_url ?? null,
                    categories: hit.categories ?? [],
                    version_number: ver?.version_number ?? null,
                    version_type: ver?.version_type ?? null,
                    filename: ver?.filename ?? null,
                  });
                  for (const dep of result?.missing_dependencies ?? []) {
                    if (!existingIds.has(dep.project_id) && !beingAdded.has(dep.project_id)) {
                      allMissing.set(dep.project_id, dep);
                    }
                  }
                }
                return [...allMissing.values()];
              }}
              onBeforeAdd={(toAdd, qc) => {
                pendingCount.current = toAdd.length;
                pendingMods.current = toAdd;
                onModsAdded?.(toAdd);
                const previousData = qc.getQueryData(["server", cacheKey]);
                qc.setQueryData(["server", cacheKey], (old) => {
                  if (!old) return old;
                  const tempMods = toAdd.map((hit) => ({
                    id: `temp-${hit.project_id}`,
                    server_id: server.id,
                    modrinth_project_id: hit.project_id,
                    version_id: "",
                    name: hit.title,
                    side: deriveModSide(hit),
                    icon_url: hit.icon_url ?? null,
                    filename: null,
                    version_number: null,
                    categories: hit.categories ?? [],
                  }));
                  return { ...old, mods: [...(old.mods ?? []), ...tempMods] };
                });
                return { previousData };
              }}
              onAddSuccess={(newMissing, qc) => {
                if (Array.isArray(newMissing) && newMissing.length > 0) {
                  qc.setQueryData(["missing-deps", server.id], (old = []) => {
                    const map = new Map(old.map((d) => [d.project_id, d]));
                    newMissing.forEach((d) => map.set(d.project_id, d));
                    return [...map.values()];
                  });
                }
                qc.invalidateQueries({ queryKey: ["server", cacheKey] });
                pendingCount.current = 0;
                pendingMods.current = [];
                setShowAdd(false);
              }}
              onAddError={(_err, _toAdd, ctx, qc) => {
                if (ctx?.previousData)
                  qc.setQueryData(["server", cacheKey], ctx.previousData);
                onToast?.({ message: "Failed to add mods. Try again." });
              }}
            />
          </div>
        </div>
      </div>

      <ModTable
        mods={mods}
        loading={false}
        readOnly={false}
        cacheKey={cacheKey}
        onRemoveMods={(ids) =>
          Promise.all(
            [...ids].map((id) => removeServerMod(server.id, id)),
          ).then(() =>
            queryClient.invalidateQueries({ queryKey: ["server", cacheKey] }),
          )
        }
        renderVersionCell={(mod) => (
          <span className="text-xs text-zinc-400">
            {mod.version_number ?? "—"}
          </span>
        )}

      />
    </div>
  );
}

// ─── RawPropertiesView ───────────────────────────────────────────────────────

function RawPropertiesView({ server, onSave, onShowUi }) {
  const [value, setValue] = useState(
    server.properties_text || DEFAULT_PROPERTIES(server.name),
  );
  const [saved, setSaved] = useState(false);
  const valueRef = useRef(value);
  const dirtyRef = useRef(false);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    setValue(server.properties_text || DEFAULT_PROPERTIES(server.name));
  }, [server.properties_text, server.name]);
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        onSaveRef.current({ properties_text: valueRef.current });
      }
    };
  }, []);

  function handleSave() {
    onSave({ properties_text: value });
    dirtyRef.current = false;
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <p className="text-sm font-semibold text-white">server.properties</p>
          <button
            onClick={onShowUi}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-950/60"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Show UI
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            dirtyRef.current = true;
          }}
          spellCheck={false}
          className="scrollbar-dark w-full bg-transparent p-4 font-mono text-xs text-zinc-300 outline-none"
          style={{ minHeight: "36rem", resize: "vertical" }}
        />
        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-4">
          <p className="text-xs text-zinc-600">
            Auto-saves when you leave this tab or switch to UI mode.
          </p>
          <button
            onClick={handleSave}
            className="shrink-0 rounded-lg bg-zinc-700 px-4 py-1.5 text-sm text-white transition-colors hover:bg-zinc-600"
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, action, onDismiss, variant = "default" }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const isConflict = variant === "conflict";

  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-xl border bg-zinc-900 px-4 py-3 shadow-2xl ${isConflict ? "animate-shake border-amber-700" : "border-emerald-800"}`}
    >
      <span className="text-sm text-zinc-200">{message}</span>
      {action && (
        <button
          onClick={action.onClick}
          className={`shrink-0 text-sm font-semibold ${isConflict ? "text-amber-400 hover:text-amber-300" : "text-emerald-400 hover:text-emerald-300"}`}
        >
          {action.label} →
        </button>
      )}
      <button
        onClick={onDismiss}
        className="shrink-0 text-zinc-500 hover:text-zinc-300"
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <path
            d="M12 4L4 12M4 4l8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

// ─── GenerateTab ─────────────────────────────────────────────────────────────

function GenerateTab({
  server,
  onGenerate,
  generating,
  onExportToClient,
  exportingClient,
}) {
  function downloadModsJson() {
    const manifest = {
      server: server.name,
      game_version: server.game_version,
      loader: server.loader,
      mods: (server.mods ?? []).map((m) => ({
        name: m.name,
        modrinth_project_id: m.modrinth_project_id,
        version_id: m.version_id,
        version_number: m.version_number,
        filename: m.filename,
        side: m.side,
      })),
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${server.name.toLowerCase().replace(/[^a-z0-9-_]/g, "-")}-mods.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const actions = [
    {
      id: "server-pack",
      title: "Server Pack",
      description:
        "Full server zip — Fabric installer, startup scripts, and a mods setup script that fetches each mod from Modrinth on first run.",
      buttonLabel: "Generate zip",
      disabled: false,
      warn: !server.loader_version
        ? "Set a Fabric loader version in Configuration first."
        : null,
      onClick: onGenerate,
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
    },
    {
      id: "mods-json",
      title: "Mods Manifest",
      description:
        "Download a mods.json file listing every mod on this server — project IDs, versions, filenames, and side compatibility.",
      buttonLabel: "Download JSON",
      disabled: (server.mods?.length ?? 0) === 0,
      warn: null,
      onClick: downloadModsJson,
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      id: "client-modpack",
      title: "Client Modpack",
      description:
        "Create a modpack from this server's client-compatible mods so players can install them with one click.",
      buttonLabel: exportingClient ? "Creating…" : "Create modpack",
      disabled: exportingClient || (server.mods?.length ?? 0) === 0,
      warn: null,
      onClick: onExportToClient,
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {actions.map((action) => (
        <div
          key={action.id}
          className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-5"
        >
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
            {action.icon}
          </div>
          <p className="mb-1 text-sm font-semibold text-white">
            {action.title}
          </p>
          <p className="mb-4 flex-1 text-xs leading-relaxed text-zinc-500">
            {action.description}
          </p>
          {action.warn && (
            <p className="mb-2 text-xs text-amber-400">{action.warn}</p>
          )}
          <button
            onClick={action.onClick}
            disabled={action.disabled || !!action.warn}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {action.buttonLabel}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── ManagementTab ───────────────────────────────────────────────────────────

function ManagementTab({ server, onSwitchTab }) {
  const disabled = !server.management_enabled;
  const queryClient = useQueryClient();
  const { data: sparkInfo } = useQuery({
    queryKey: ["spark-download", server.id],
    queryFn: () => getSparkDownload(server.id),
    staleTime: 3_600_000,
    enabled: !disabled,
  });
  const [downloadingSpark, setDownloadingSpark] = useState(false);
  const [downloadCooldown, setDownloadCooldown] = useState(0);
  const [addingSpark, setAddingSpark] = useState(false);
  const [sparkError, setSparkError] = useState(null);

  const sparkAdded = sparkInfo
    ? (server.mods ?? []).some(
        (m) => m.modrinth_project_id === sparkInfo.project_id,
      )
    : false;
  const [sparkDismissed, setSparkDismissed] = useState(
    () => localStorage.getItem("spark-notice-dismissed") === "1",
  );

  function dismissSpark() {
    localStorage.setItem("spark-notice-dismissed", "1");
    setSparkDismissed(true);
  }
  function showSpark() {
    localStorage.removeItem("spark-notice-dismissed");
    setSparkDismissed(false);
  }

  function handleSparkDownload() {
    if (!sparkInfo?.url || downloadCooldown > 0) return;
    window.open(sparkInfo.url, "_blank");
    setDownloadCooldown(5);
    const interval = setInterval(() => {
      setDownloadCooldown((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function handleAddSpark() {
    setAddingSpark(true);
    setSparkError(null);
    try {
      const info = sparkInfo ?? (await getSparkDownload(server.id));
      await addServerMod(server.id, {
        modrinth_project_id: info.project_id,
        version_id: info.version_id,
        name: info.project_name,
        side: "server",
        icon_url: info.project_icon ?? null,
        filename: info.filename,
        version_number: info.version_number,
        version_type: info.version_type,
        categories: [],
      });
      queryClient.invalidateQueries({
        queryKey: ["server", server.share_code],
      });
    } catch {
      setSparkError("Failed to add Spark — it may already be in your mod list");
    } finally {
      setAddingSpark(false);
    }
  }

  return (
    <div className="relative">
      {sparkDismissed && !disabled && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={showSpark}
            title="Show dependencies"
            className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 text-[10px] font-semibold text-zinc-600 transition-colors hover:border-zinc-500 hover:text-zinc-400"
          >
            i
          </button>
        </div>
      )}
      {/* placeholder content always rendered so the overlay has something to grey out */}
      <div
        className={`space-y-4 transition-all duration-300 ${disabled ? "pointer-events-none select-none opacity-20 blur-[2px]" : ""}`}
      >
        {!sparkDismissed && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3">
            <svg
              className="shrink-0 text-amber-500"
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M8 2L14.5 13H1.5L8 2Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M8 6v3M8 11v.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-400">
                Spark mod recommended
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">
                TPS and memory stats require{" "}
                <a
                  href="https://modrinth.com/mod/spark"
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Spark
                </a>{" "}
                to be installed on your server. Player list and server time work
                without it.
              </p>
              {sparkError && (
                <p className="mt-1 text-xs text-red-400">{sparkError}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={handleAddSpark}
                disabled={addingSpark || sparkAdded}
                className="flex items-center gap-1.5 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-900/40 disabled:opacity-50"
              >
                {sparkAdded ? (
                  "Added ✓"
                ) : addingSpark ? (
                  "Adding…"
                ) : (
                  <>
                    <svg
                      className="shrink-0"
                      width="11"
                      height="11"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M8 3v10M3 8h10"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                      />
                    </svg>
                    Add to mods
                  </>
                )}
              </button>
              <button
                onClick={handleSparkDownload}
                disabled={!sparkInfo || downloadCooldown > 0}
                className="relative flex items-center gap-1.5 overflow-hidden rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-900/40"
              >
                {downloadCooldown > 0 && (
                  <span className="animate-drain pointer-events-none absolute inset-y-0 left-0 bg-amber-400/15" />
                )}
                <svg
                  className="shrink-0"
                  width="11"
                  height="11"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M8 2v8M4 7l4 4 4-4M2 13h12"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {sparkInfo ? sparkInfo.version_number : "…"}
              </button>
            </div>
            <button
              onClick={dismissSpark}
              className="shrink-0 text-zinc-600 transition-colors hover:text-zinc-400"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path
                  d="M12 4L4 12M4 4l8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-1 text-sm font-semibold text-white">
            RCON Connection
          </p>
          <p className="text-xs text-zinc-500">
            Test the RCON connection and run commands on your live server.
          </p>
          <div className="mt-4 h-8 w-32 rounded-lg bg-zinc-800" />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-1 text-sm font-semibold text-white">Server State</p>
          <p className="text-xs text-zinc-500">
            Live TPS, memory usage, player list, and server time.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-zinc-800" />
            ))}
          </div>
        </div>
      </div>

      {disabled && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl"
          style={{
            background:
              "repeating-linear-gradient(-45deg, transparent, transparent 12px, rgba(255,255,255,0.025) 12px, rgba(255,255,255,0.025) 13px)",
          }}
        >
          <p className="text-sm font-medium text-zinc-300">
            Live Server Management is disabled
          </p>
          <p className="text-xs text-zinc-500">
            Enable it in the{" "}
            <button
              onClick={() => onSwitchTab("settings")}
              className="text-zinc-300 hover:text-white transition-colors"
            >
              Settings
            </button>{" "}
            tab to use this feature.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── SettingsTab ─────────────────────────────────────────────────────────────

function SettingsTab({
  server,
  onDeleted,
  onSave,
  pendingTab,
  onPendingResolved,
}) {
  const queryClient = useQueryClient();
  const [confirmInput, setConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [resettingUptime, setResettingUptime] = useState(false);
  const [confirmResetUptime, setConfirmResetUptime] = useState(false);
  const [managementEnabled, setManagementEnabled] = useState(
    server.management_enabled ?? false,
  );
  const [savedAt, setSavedAt] = useState(null);
  const [exiting, setExiting] = useState(false);

  const dirty = managementEnabled !== (server.management_enabled ?? false);
  const ready = confirmInput === server.name && !deleting;

  useEffect(() => {
    if (pendingTab && !dirty) onPendingResolved(pendingTab);
  }, [pendingTab]);

  function exitThen(fn, delay = 300) {
    setExiting(true);
    setTimeout(() => {
      setExiting(false);
      fn();
    }, delay);
  }

  function handleSave() {
    onSave({ management_enabled: managementEnabled });
    const time = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    setSavedAt(time);
    setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        setSavedAt(null);
        setExiting(false);
      }, 300);
    }, 4000);
  }

  function handleDiscard() {
    setManagementEnabled(server.management_enabled ?? false);
    if (pendingTab) exitThen(() => onPendingResolved(pendingTab));
  }

  function handleSaveAndSwitch() {
    handleSave();
    if (pendingTab) {
      setTimeout(() => exitThen(() => onPendingResolved(pendingTab)), 1000);
    }
  }

  async function handleDelete() {
    if (!ready) return;
    setDeleting(true);
    try {
      await deleteServer(server.id);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }

  async function handleResetUptime() {
    setResettingUptime(true);
    try {
      await resetServerUptime(server.id);
      queryClient.invalidateQueries({ queryKey: ["server-uptime", server.id] });
      setConfirmResetUptime(false);
    } finally {
      setResettingUptime(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Live management */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">
              Live Server Management
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Enables the Management tab for RCON commands and live server
              controls. Disabled by default — only turn on if your server
              exposes RCON.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={managementEnabled}
            onClick={() => setManagementEnabled((v) => !v)}
            className={`relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none ${
              managementEnabled ? "bg-emerald-500" : "bg-zinc-700"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                managementEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Uptime */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="mb-1 text-sm font-semibold text-white">Uptime History</p>
        <p className="mb-4 text-xs text-zinc-500">
          Clears all recorded uptime checks for this server. New checks will
          resume on the next scheduler tick.
        </p>
        {confirmResetUptime ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">Are you sure?</span>
            <button
              onClick={handleResetUptime}
              disabled={resettingUptime}
              className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-900/50 disabled:opacity-40"
            >
              {resettingUptime ? "Resetting…" : "Yes, reset"}
            </button>
            <button
              onClick={() => setConfirmResetUptime(false)}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmResetUptime(true)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
          >
            Reset uptime history
          </button>
        )}
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-900/50 bg-zinc-900 p-5">
        <p className="mb-1 text-sm font-semibold text-red-400">Danger Zone</p>
        <p className="mb-5 text-xs text-zinc-500">
          These actions are permanent and cannot be undone.
        </p>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">
                Delete this server
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Permanently deletes this server and all its mods. The server
                itself is not affected.
              </p>
            </div>
          </div>
          <p className="mb-2 text-xs text-zinc-500">
            Type <span className="font-mono text-zinc-300">{server.name}</span>{" "}
            to confirm
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && ready) handleDelete();
              }}
              placeholder={server.name}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-700"
            />
            <button
              onClick={handleDelete}
              disabled={!ready}
              className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-red-950/40"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>

      {createPortal(
        <div
          className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
            !exiting && (dirty || savedAt || (pendingTab && dirty))
              ? "translate-y-0 opacity-100"
              : "translate-y-3 opacity-0 pointer-events-none"
          }`}
        >
          <div
            className={`rounded-xl border bg-zinc-900 px-4 py-3 transition-all duration-300 ${pendingTab && dirty ? "w-80 animate-shake border-amber-700" : "w-56 border-zinc-700"}`}
          >
            <div className="flex flex-col gap-2">
              <span className="text-sm text-zinc-400 transition-all duration-300">
                {savedAt ? `Saved at ${savedAt}` : "Unsaved changes"}
              </span>
              <button
                onClick={
                  !savedAt
                    ? pendingTab
                      ? handleSaveAndSwitch
                      : handleSave
                    : undefined
                }
                className={`relative min-w-[4.5rem] rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-300 ${
                  savedAt
                    ? "cursor-default bg-emerald-600"
                    : "bg-emerald-500 hover:bg-emerald-400 active:scale-95"
                }`}
              >
                <span
                  className={`flex items-center justify-center transition-opacity duration-200 ${savedAt ? "opacity-0" : "opacity-100"}`}
                >
                  Save
                </span>
                <span
                  className={`absolute inset-0 flex items-center justify-center gap-1.5 transition-opacity duration-200 ${savedAt ? "opacity-100" : "opacity-0"}`}
                >
                  Saved
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 16 16"
                    fill="none"
                    className={`transition-all duration-300 ${savedAt ? "translate-x-0 opacity-100" : "translate-x-1 opacity-0"}`}
                    style={{ transitionDelay: savedAt ? "150ms" : "0ms" }}
                  >
                    <path
                      d="M2.5 8.5l3.5 3.5 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
            </div>
            <div
              className={`grid transition-all duration-300 ${pendingTab && dirty ? "mt-3 grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <div className="border-t border-zinc-800 pt-3">
                  <button
                    onClick={handleDiscard}
                    className="w-full rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
                  >
                    Discard changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── ServerBuilder ────────────────────────────────────────────────────────────

export default function ServerBuilder() {
  const { code } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [pendingTab, setPendingTab] = useState(null);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [showAddIp, setShowAddIp] = useState(false);
  const [ipValue, setIpValue] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showEula, setShowEula] = useState(false);
  const [showClientPrompt, setShowClientPrompt] = useState(false);
  const [exportingClient, setExportingClient] = useState(false);
  const exportingClientRef = useRef(false);
  const [toast, setToast] = useState(null);
  const { toasts: modToasts, add: addModToasts } = useModToasts();
  const [showAddMods, setShowAddMods] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconInputRef = useRef(null);

  async function handleIconUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIcon(true);
    try {
      const updated = await uploadServerIcon(server?.id, file);
      queryClient.setQueryData(["server", code], (old) =>
        old ? { ...old, ...updated } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["servers"] });
    } catch {
      // silent — bad file type or too large
    } finally {
      setUploadingIcon(false);
      e.target.value = "";
    }
  }

  async function handleIconDelete(e) {
    e.stopPropagation();
    const updated = await deleteServerIcon(server?.id);
    queryClient.setQueryData(["server", code], (old) =>
      old ? { ...old, ...updated } : old,
    );
    queryClient.invalidateQueries({ queryKey: ["servers"] });
  }


  const {
    data: server,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["server", code],
    queryFn: () => getServerByCode(code),
  });

  const deps = useMissingDeps({ serverId: server?.id, cacheKey: code, onToasts: addModToasts });

  const { mutate: save } = useMutation({
    mutationFn: (input) => updateServer(server?.id, input),
    onMutate: (input) => {
      queryClient.setQueryData(["server", code], (old) =>
        old ? { ...old, ...input } : old,
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["server", code] }),
    onError: () =>
      queryClient.invalidateQueries({ queryKey: ["server", code] }),
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-zinc-800" />
        <div className="h-96 animate-pulse rounded-xl bg-zinc-800" />
      </div>
    );
  }

  if (isError || !server) {
    return (
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => navigate("/servers")}
          className="mb-6 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Servers
        </button>
        <p className="text-sm text-zinc-500">Server not found.</p>
      </div>
    );
  }

  function handlePreflightCheck() {
    deps.preflight(() => setShowEula(true));
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const response = await exportServerPack(server.id);
      const url = URL.createObjectURL(
        new Blob([response.data], { type: "application/zip" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `${server.name.toLowerCase().replace(/[^a-z0-9-_]/g, "-")}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowEula(false);
      setShowClientPrompt(true);
    } catch (e) {
      const detail =
        e?.response?.data?.detail ?? "Generation failed. Try again.";
      setToast({ message: detail });
      setShowEula(false);
    } finally {
      setGenerating(false);
    }
  }

  async function handleExportToClient() {
    if (exportingClientRef.current) return;
    exportingClientRef.current = true;
    setExportingClient(true);
    try {
      const result = await exportToClient(server.id);
      setShowClientPrompt(false);
      setToast({
        message: "Client modpack created",
        action: {
          label: "Open modpack",
          onClick: () => navigate(`/modpacks/${result.share_code}`),
        },
      });
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      setShowClientPrompt(false);
      if (status === 409 && detail?.share_code) {
        setToast({
          message: "Client modpack already exists",
          variant: "conflict",
          action: {
            label: "Open modpack",
            onClick: () => navigate(`/modpacks/${detail.share_code}`),
          },
        });
      } else {
        setToast({
          message:
            typeof detail === "string" ? detail : "Export to client failed.",
        });
      }
    } finally {
      exportingClientRef.current = false;
      setExportingClient(false);
    }
  }

  function submitName() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== server.name) save({ name: trimmed });
    setNameEditing(false);
  }

  function submitIp() {
    const trimmed = ipValue.trim();
    if (!trimmed) {
      setShowAddIp(false);
      setIpValue("");
      return;
    }

    const colonIdx = trimmed.lastIndexOf(":");
    let ipPart = trimmed;
    let portPart = null;
    if (colonIdx > 0) {
      const maybePort = trimmed.slice(colonIdx + 1);
      if (/^\d+$/.test(maybePort)) {
        ipPart = trimmed.slice(0, colonIdx);
        portPart = maybePort;
      }
    }

    if (!portPart && /^\d{1,3}(\.\d{1,3}){3}$/.test(ipPart)) portPart = "25565";

    const finalIp = portPart ? `${ipPart}:${portPart}` : ipPart;

    let props = server.properties_text || DEFAULT_PROPERTIES(server.name);
    props = setProp(props, "server-ip", ipPart);
    if (portPart) props = setProp(props, "server-port", portPart);

    save({ server_ip: finalIp, properties_text: props });
    setShowAddIp(false);
    setIpValue("");
  }

  const TABS = [
    { id: "dashboard", label: "Dashboard" },
    { id: "config", label: "Configuration" },
    { id: "mods", label: `Mods (${server.mods?.length ?? 0})`, badge: deps.missingDeps.length },
    { id: "generate", label: "Generate" },
    { id: "management", label: "Management" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* Back */}
      <button
        onClick={() => {
          queryClient.invalidateQueries({ queryKey: ["servers"] });
          navigate("/servers");
        }}
        className="mb-2 flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-white"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Servers
      </button>

      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-4">
        {/* Left: icon + name */}
        {/* Left: icon + name + IP */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="group relative shrink-0">
            <input
              ref={iconInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleIconUpload}
            />
            <button
              onClick={() => iconInputRef.current?.click()}
              disabled={uploadingIcon}
              className="group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl"
            >
              {uploadingIcon ? (
                <div
                  className="flex h-full w-full items-center justify-center rounded-xl"
                  style={{ backgroundColor: serverIconColor(server.name) }}
                >
                  <svg
                    className="animate-spin text-white"
                    style={{ animationDirection: "reverse" }}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </div>
              ) : server.icon_url ? (
                <img
                  src={server.icon_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-lg font-bold text-white"
                  style={{ backgroundColor: serverIconColor(server.name) }}
                >
                  {server.name[0]?.toUpperCase() ?? "S"}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            </button>
            {server.icon_url && !uploadingIcon && (
              <button
                onClick={handleIconDelete}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-zinc-300 opacity-0 transition-opacity hover:bg-zinc-600 hover:text-white group-hover:opacity-100"
                title="Remove icon"
              >
                <svg width="7" height="7" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M12 4L4 12M4 4l8 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
          <div className="min-w-0">
            {nameEditing ? (
              <input
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={submitName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitName();
                  if (e.key === "Escape") setNameEditing(false);
                }}
                className="border-b border-zinc-600 bg-transparent pb-0.5 text-xl font-bold text-white outline-none focus:border-emerald-500"
              />
            ) : (
              <button
                onClick={() => {
                  setNameValue(server.name);
                  setNameEditing(true);
                }}
                className="truncate border-b border-transparent pb-0.5 text-xl font-bold text-white hover:text-zinc-300"
              >
                {server.name}
              </button>
            )}
            <div className="mt-0.5">
              {server.server_ip ? (
                <CopyIp ip={server.server_ip} />
              ) : showAddIp ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={ipValue}
                    onChange={(e) => setIpValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitIp();
                      if (e.key === "Escape") setShowAddIp(false);
                    }}
                    placeholder="play.yourserver.com"
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-white outline-none focus:border-emerald-600"
                  />
                  <button
                    onClick={submitIp}
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowAddIp(false)}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddIp(true)}
                  className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
                >
                  + Add IP
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: add mods (mods tab only) + version/loader */}
        <div className="flex shrink-0 items-center gap-3">
          {activeTab === "mods" && (
            <button
              onClick={() => setShowAddMods((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold text-white shadow-[0_0_8px_rgba(16,185,129,0.2)] transition-all active:scale-95 ${
                showAddMods
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-emerald-500 hover:bg-emerald-400"
              }`}
            >
              {showAddMods ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M12 4L4 12M4 4l8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              )}
              {showAddMods ? "Close" : "Add mods"}
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
              {server.game_version}
            </span>
            <span className="rounded bg-zinc-800 px-2 py-1 text-xs capitalize text-zinc-400">
              {server.loader}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-3 flex items-stretch gap-1 border-b border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (activeTab === "settings" && tab.id !== "settings") {
                setPendingTab(tab.id);
              } else {
                setActiveTab(tab.id);
                setShowAddMods(false);
              }
            }}
            className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white leading-none">
                {tab.badge}
              </span>
            )}
            {activeTab === tab.id && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-400" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "dashboard" && (
        <DashboardTab server={server} onSwitchTab={setActiveTab} />
      )}
      {activeTab === "config" && (
        <ConfigurationTab server={server} onSave={save} />
      )}
      {activeTab === "mods" && (
        <>
          <DepsBanner deps={deps} />
          <ModsTab
            server={server}
            cacheKey={code}
            onToast={setToast}
            onModsAdded={addModToasts}
            showAdd={showAddMods}
            setShowAdd={setShowAddMods}
          />
        </>
      )}
      {activeTab === "generate" && (
        <GenerateTab
          server={server}
          onGenerate={handlePreflightCheck}
          generating={generating}
          onExportToClient={handleExportToClient}
          exportingClient={exportingClient}
        />
      )}
      {activeTab === "management" && (
        <ManagementTab server={server} onSwitchTab={setActiveTab} />
      )}
      {activeTab === "settings" && (
        <SettingsTab
          server={server}
          onSave={save}
          pendingTab={pendingTab}
          onPendingResolved={(tab) => {
            setPendingTab(null);
            setActiveTab(tab);
            setShowAddMods(false);
          }}
          onDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ["servers"] });
            navigate("/servers");
          }}
        />
      )}

      {/* Post-download client modpack prompt */}
      {showClientPrompt && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowClientPrompt(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl pointer-events-auto">
              <h2 className="mb-1 text-base font-bold text-white">
                Server pack downloaded
              </h2>
              <p className="mb-4 text-sm text-zinc-400">
                Extract the zip and follow these steps to get your server
                running.
              </p>

              <ol className="mb-5 space-y-3">
                {[
                  {
                    label: "Extract the zip",
                    detail: "Unzip everything into a new folder.",
                  },
                  {
                    label: "Run setup_mods.bat",
                    detail:
                      "Downloads all mods from Modrinth into the mods/ folder. Only needed once.",
                    mono: true,
                  },
                  {
                    label: "Run start.bat",
                    detail: "Launches the Fabric server. Requires Java.",
                    mono: true,
                  },
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-400">
                      {i + 1}
                    </span>
                    <div>
                      <p
                        className={`text-sm font-medium text-white ${step.mono ? "font-mono" : ""}`}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-zinc-500">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mb-4 border-t border-zinc-800" />

              <p className="mb-3 text-sm font-medium text-white">
                Create a client modpack?
              </p>
              <p className="mb-4 text-xs text-zinc-500">
                Generates a ModSync modpack from this server's client-compatible
                mods so players can install them with one click.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleExportToClient}
                  disabled={exportingClient}
                  className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 active:scale-95 disabled:opacity-40"
                >
                  {exportingClient ? "Creating…" : "Create modpack"}
                </button>
                <button
                  onClick={() => setShowClientPrompt(false)}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <DepsModal deps={deps} onAdded={() => setShowEula(true)} onSkip={() => setShowEula(true)} />

      <EulaModal
        open={showEula}
        onClose={() => setShowEula(false)}
        onConfirm={handleGenerate}
        loading={generating}
      />

      {toast &&
        createPortal(
          <Toast
            message={toast.message}
            action={toast.action}
            variant={toast.variant}
            onDismiss={() => setToast(null)}
          />,
          document.body,
        )}
      <ModToastsPortal toasts={modToasts} />
    </div>
  );
}
