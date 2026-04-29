import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getModpackByCode,
  addMod,
  removeMod,
  exportMrpack,
  updateModpack,
  deleteModpack,
  type Modpack,
  type ModpackMod,
  type ModpackSummary,
  type UpdateModpackInput,
} from "../api/modpacks";

import {
  searchMods,
  getLatestVersion,
  getCategories,
  type ModSearchHit,
} from "../api/mods";
import SideBadge from "../components/SideBadge";

const PAGE_SIZE = 10;

const LOADERS = ['fabric', 'forge', 'quilt', 'neoforge'] as const;
const MC_VERSIONS = [
  '1.21.4', '1.21.3', '1.21.1', '1.21',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.20',
  '1.19.4', '1.19.2', '1.19',
  '1.18.2', '1.18',
  '1.17.1', '1.16.5',
];

const HIDDEN_CATEGORIES = new Set([
  "fabric",
  "forge",
  "quilt",
  "neoforge",
  "modloader",
  "rift",
  "liteloader",
  "bukkit",
  "spigot",
  "paper",
  "purpur",
  "folia",
  "cursed",
]);
const MOD_COLORS = [
  "bg-emerald-700",
  "bg-blue-700",
  "bg-violet-700",
  "bg-orange-700",
  "bg-pink-700",
  "bg-teal-700",
];

// Most meaningful/specific categories first — determines grid table grouping and badge order
const CATEGORY_PRIORITY = [
  "library",
  "game-mechanics",
  "magic",
  "adventure",
  "technology",
  "decoration",
  "food",
  "worldgen",
  "mobs",
  "equipment",
  "transportation",
  "social",
  "economy",
  "minigame",
  "storage",
  "management",
  "utility",
  "optimization",
  "datapack",
  "misc",
];

function categoryRank(c: string): number {
  const i = CATEGORY_PRIORITY.indexOf(c);
  return i === -1 ? 999 : i;
}

function modColor(name: string) {
  return MOD_COLORS[name.charCodeAt(0) % MOD_COLORS.length];
}
function fmtDownloads(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}
function deriveSide(hit: ModSearchHit): string {
  if (hit.server_side === "unsupported") return "client";
  if (hit.client_side === "unsupported") return "server";
  return "both";
}
function displayCategories(categories: string[]): string[] {
  return categories
    .filter((c) => !HIDDEN_CATEGORIES.has(c))
    .sort((a, b) => categoryRank(a) - categoryRank(b))
    .slice(0, 2);
}

function VersionTypeBadge({ type }: { type: string | null }) {
  if (!type || type === "release") return null;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
        type === "beta"
          ? "bg-yellow-950 text-yellow-400 border border-yellow-800"
          : "bg-red-950 text-red-400 border border-red-900"
      }`}
    >
      {type}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M2 4l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AddModsPanel({
  open,
  modpackId,
  gameVersion,
  loader,
  existingIds,
  cacheKey,
  onClose,
}: {
  open: boolean;
  modpackId: number;
  gameVersion: string;
  loader: string;
  existingIds: Set<string>;
  cacheKey: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [activeSide, setActiveSide] = useState<
    "client" | "server" | "both" | null
  >(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [sortIndex, setSortIndex] = useState<"relevance" | "downloads">(
    "relevance",
  );

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const { data: categoriesData } = useQuery({
    queryKey: ["mod-categories"],
    queryFn: getCategories,
    staleTime: Infinity,
  });

  const categories = categoriesData ?? [];

  const { data, isFetching } = useQuery({
    queryKey: [
      "mod-search",
      debouncedQuery,
      gameVersion,
      loader,
      activeCategory,
      activeSide,
      sortIndex,
    ],
    queryFn: () =>
      searchMods({
        query: debouncedQuery,
        game_version: gameVersion,
        loader,
        category: activeCategory ?? undefined,
        side: activeSide ?? undefined,
        index: sortIndex,
        limit: PAGE_SIZE,
      }),
    enabled:
      debouncedQuery.length >= 2 ||
      activeCategory !== null ||
      activeSide !== null,
  });

  const hits = data?.hits ?? [];

  function toggle(projectId: string) {
    if (existingIds.has(projectId)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });
  }

  const { mutate: addSelected, isPending: adding } = useMutation({
    mutationFn: async () => {
      const toAdd = hits.filter((h) => selected.has(h.project_id));
      await Promise.all(
        toAdd.map(async (hit) => {
          const ver = await getLatestVersion(
            hit.project_id,
            gameVersion,
            loader,
          );
          return addMod(modpackId, {
            modrinth_project_id: hit.project_id,
            version_id: ver.version_id,
            name: hit.title,
            side: deriveSide(hit),
            icon_url: hit.icon_url,
            version_number: ver.version_number,
            version_type: ver.version_type,
            filename: ver.filename,
            categories: hit.categories,
          });
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modpack", cacheKey] });
      setSelected(new Set());
    },
  });

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
      {/* Search bar */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-4">
        <svg
          className="shrink-0 text-zinc-300"
          width="17"
          height="17"
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
          className="flex-1 bg-transparent text-base text-white placeholder-zinc-500 outline-none"
        />
        {isFetching && (
          <span className="shrink-0 animate-pulse text-xs text-zinc-400">
            Searching…
          </span>
        )}
        {/* Sort toggle */}
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-zinc-700 text-xs">
          {(["relevance", "downloads"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSortIndex(opt)}
              className={`px-3 py-1.5 capitalize transition-colors ${
                sortIndex === opt
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <button
            onClick={() => addSelected()}
            disabled={adding}
            className="shrink-0 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_8px_rgba(16,185,129,0.2)] transition-all hover:bg-emerald-400 active:scale-95 disabled:opacity-40"
          >
            {adding
              ? "Adding…"
              : `Add ${selected.size} mod${selected.size !== 1 ? "s" : ""}`}
          </button>
        )}
        <button
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M12 4L4 12M4 4l8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-start border-b border-zinc-800">
        <div className="flex-1 bg-zinc-900">
          <button
            onClick={() => setCategoriesOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-2.5 transition-colors hover:bg-zinc-800"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Categories
              </span>
              {activeCategory && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs capitalize text-emerald-400 ring-1 ring-emerald-500/40">
                  {activeCategory}
                </span>
              )}
            </div>
            <Chevron open={categoriesOpen} />
          </button>
          {categoriesOpen && categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-zinc-800 bg-zinc-950 px-4 py-3">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() =>
                    setActiveCategory((prev) =>
                      prev === cat.name ? null : cat.name,
                    )
                  }
                  className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${
                    activeCategory === cat.name
                      ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                      : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px self-stretch bg-zinc-800" />
        <div className="w-52 bg-zinc-900">
          <button
            onClick={() => setSideOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-2.5 transition-colors hover:bg-zinc-800"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Side
              </span>
              {activeSide && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs capitalize text-emerald-400 ring-1 ring-emerald-500/40">
                  {activeSide}
                </span>
              )}
            </div>
            <Chevron open={sideOpen} />
          </button>
          {sideOpen && (
            <div className="flex flex-wrap gap-1.5 border-t border-zinc-800 bg-zinc-950 px-4 py-3">
              {(["client", "server", "both"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    setActiveSide((prev) => (prev === s ? null : s))
                  }
                  className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${
                    activeSide === s
                      ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                      : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-h-[55vh] overflow-y-auto divide-y divide-zinc-800">
        {debouncedQuery.length < 2 && !activeCategory && !activeSide && (
          <div className="flex flex-col items-center gap-3 py-12 text-zinc-500">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p className="text-sm">Type to search Modrinth</p>
          </div>
        )}
        {(debouncedQuery.length >= 2 || activeCategory || activeSide) &&
          !isFetching &&
          hits.length === 0 && (
            <p className="py-16 text-center text-sm text-zinc-500">
              No results
            </p>
          )}
        {hits.map((hit) => {
          const already = existingIds.has(hit.project_id);
          const isSelected = selected.has(hit.project_id);
          const cats = displayCategories(hit.categories);
          return (
            <div
              key={hit.project_id}
              onClick={() => toggle(hit.project_id)}
              className={`relative flex items-center gap-4 px-4 py-3.5 transition-colors ${
                already
                  ? "cursor-default opacity-30"
                  : isSelected
                    ? "cursor-pointer bg-emerald-950/40"
                    : "cursor-pointer hover:bg-zinc-900"
              }`}
            >
              {isSelected && (
                <div className="absolute inset-y-0 left-0 w-0.5 bg-emerald-500" />
              )}

              {/* Checkbox */}
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                  already
                    ? "border-zinc-600 bg-zinc-700"
                    : isSelected
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-zinc-600"
                }`}
              >
                {(already || isSelected) && (
                  <svg width="9" height="7" viewBox="0 0 8 6" fill="none">
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

              {/* Icon */}
              {hit.icon_url ? (
                <img
                  src={hit.icon_url}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/5"
                />
              ) : (
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white ${modColor(hit.title)}`}
                >
                  {hit.title[0].toUpperCase()}
                </div>
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-white">
                    {hit.title}
                  </p>
                  <SideBadge side={deriveSide(hit)} />
                </div>
                <p className="mt-0.5 truncate text-xs text-zinc-400 leading-relaxed">
                  {hit.description}
                </p>
                {cats.length > 0 && (
                  <div className="mt-1.5 flex gap-1">
                    {cats.map((c) => (
                      <span
                        key={c}
                        className="rounded bg-zinc-700 px-1.5 py-0.5 text-xs capitalize text-zinc-200"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Downloads */}
              <div className="shrink-0 text-right">
                <span className="text-sm font-semibold text-zinc-200">
                  {fmtDownloads(hit.downloads)}
                </span>
                <p className="text-xs text-zinc-500">downloads</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

function defaultIconColor(name: string): string {
  return ICON_PALETTE[name.charCodeAt(0) % ICON_PALETTE.length];
}

function ModpackIconWidget({
  modpack,
  onSave,
}: {
  modpack: Modpack;
  onSave: (input: UpdateModpackInput) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"color" | "image">("color");
  const [letterInput, setLetterInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleOpen() {
    setLetterInput(modpack.icon_letter ?? modpack.name[0].toUpperCase());
    setImageUrl(modpack.icon_url ?? "");
    setOpen(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      onSave({ icon_url: base64, icon_color: null, icon_letter: null });
      setOpen(false);
    };
    reader.readAsDataURL(file);
  }

  const color = modpack.icon_color ?? defaultIconColor(modpack.name);
  const letter = modpack.icon_letter ?? modpack.name[0]?.toUpperCase() ?? "?";

  return (
    <div className="relative shrink-0" ref={ref}>
      {/* Icon display */}
      <button
        onClick={handleOpen}
        className="group relative h-16 w-16 overflow-hidden rounded-2xl transition-all hover:ring-2 hover:ring-white/20"
        title="Click to change icon"
      >
        {modpack.icon_url ? (
          <img
            src={modpack.icon_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-2xl font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {letter}
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
      </button>

      {/* Editor popover */}
      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/50">
          {/* Tabs */}
          <div className="flex border-b border-zinc-800">
            {(["color", "image"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                  tab === t
                    ? "text-white border-b-2 border-emerald-400 -mb-px"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "color" && (
            <div className="p-3 space-y-3">
              {/* Color swatches */}
              <div className="grid grid-cols-8 gap-1.5">
                {ICON_PALETTE.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => onSave({ icon_color: hex, icon_url: null })}
                    className="h-6 w-6 rounded-md transition-transform hover:scale-110 active:scale-95"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  >
                    {(modpack.icon_color === hex ||
                      (!modpack.icon_color &&
                        hex === defaultIconColor(modpack.name))) && (
                      <svg
                        width="10"
                        height="8"
                        viewBox="0 0 10 8"
                        className="mx-auto"
                        fill="none"
                      >
                        <path
                          d="M1 4l3 3 5-6"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
              {/* Letter */}
              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  Letter
                </label>
                <div className="flex gap-2">
                  <input
                    value={letterInput}
                    onChange={(e) =>
                      setLetterInput(e.target.value.slice(-1).toUpperCase())
                    }
                    maxLength={1}
                    className="w-12 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-center text-sm font-bold text-white outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => {
                      onSave({ icon_letter: letterInput || null });
                      setOpen(false);
                    }}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "image" && (
            <div className="p-3 space-y-2">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 py-4 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors">
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
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              <div className="flex gap-2">
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Or paste URL…"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => {
                    onSave({ icon_url: imageUrl || null });
                    setOpen(false);
                  }}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                >
                  Set
                </button>
              </div>
              {modpack.icon_url && (
                <button
                  onClick={() => {
                    onSave({ icon_url: null });
                    setOpen(false);
                  }}
                  className="w-full rounded-lg py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove image
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type ViewMode = "list" | "grid";

function groupByCategory(mods: ModpackMod[]): [string, ModpackMod[]][] {
  const map = new Map<string, ModpackMod[]>();
  const seen = new Set<string>();
  for (const mod of mods) {
    if (seen.has(mod.modrinth_project_id)) continue;
    seen.add(mod.modrinth_project_id);
    const key = displayCategories(mod.categories ?? [])[0] ?? "Uncategorized";
    const bucket = map.get(key) ?? [];
    bucket.push(mod);
    map.set(key, bucket);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function IconList() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <line x1="2" y1="4" x2="13" y2="4" />
      <line x1="2" y1="7.5" x2="13" y2="7.5" />
      <line x1="2" y1="11" x2="13" y2="11" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="8.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="8.5" width="5" height="5" rx="1" />
      <rect x="8.5" y="8.5" width="5" height="5" rx="1" />
    </svg>
  );
}

function FailedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-red-900/60 bg-red-950/40 px-1.5 py-0.5 text-xs font-medium text-red-400">
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </span>
  );
}

function ModTable({
  modpackId,
  mods,
  readOnly,
  loading,
  cacheKey,
  failedProjectIds,
}: {
  modpackId: number;
  mods: ModpackMod[];
  readOnly: boolean;
  loading: boolean;
  cacheKey: string;
  failedProjectIds?: Set<string>;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const totalPages = Math.max(1, Math.ceil(mods.length / PAGE_SIZE));
  const pageMods = mods.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const { mutate: bulkRemove, isPending: removing } = useMutation({
    mutationFn: () =>
      Promise.all([...selectedIds].map((id) => removeMod(modpackId, id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modpack", cacheKey] });
      setSelectedIds(new Set());
      setEditMode(false);
    },
  });

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exitEdit() {
    setEditMode(false);
    setSelectedIds(new Set());
  }

  function switchView(mode: ViewMode) {
    if (mode === "grid") exitEdit();
    setViewMode(mode);
  }

  const colSpan = editMode ? 7 : 6;

  return (
    <div>
      {/* Table toolbar */}
      <div className="mb-3 flex items-center justify-between gap-3">
        {/* Prev / Next */}
        <div className="flex items-center gap-2">
          {viewMode === "list" && totalPages > 1 && (
            <>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white disabled:opacity-40"
              >
                Next →
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Page range */}
          {viewMode === "list" && totalPages > 1 && (
            <span className="text-sm text-zinc-500">
              {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, mods.length)} of {mods.length}
            </span>
          )}
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-md border border-zinc-700">
            {(
              [
                ["list", <IconList />],
                ["grid", <IconGrid />],
              ] as [ViewMode, React.ReactNode][]
            ).map(([mode, icon]) => (
              <button
                key={mode}
                onClick={() => switchView(mode)}
                className={`px-3 py-2 transition-colors ${
                  viewMode === mode
                    ? "bg-zinc-700 text-white"
                    : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Edit controls (list only) */}
          {!readOnly && viewMode === "list" && (
            <>
              {editMode ? (
                <>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => bulkRemove()}
                      disabled={removing}
                      className="rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-400 transition-all hover:bg-red-900/50 active:scale-95 disabled:opacity-40"
                    >
                      {removing
                        ? "Removing…"
                        : `Remove ${selectedIds.size} mod${selectedIds.size !== 1 ? "s" : ""}`}
                    </button>
                  )}
                  <button
                    onClick={exitEdit}
                    className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-400 transition-all hover:bg-zinc-700 hover:text-white active:scale-95"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditMode(true)}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-400 transition-all hover:bg-zinc-700 hover:text-white active:scale-95"
                >
                  Edit
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Grid view */}
      {viewMode === "grid" && (
        <div>
          {loading && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-xl bg-zinc-800"
                />
              ))}
            </div>
          )}
          {!loading && mods.length === 0 && (
            <div className="rounded-xl border border-zinc-800 px-4 py-12 text-center text-sm text-zinc-600">
              No mods yet — click Add mods to get started.
            </div>
          )}
          {!loading && mods.length > 0 && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {groupByCategory(mods).map(([category, catMods]) => (
                <div
                  key={category}
                  className="overflow-hidden rounded-xl border border-zinc-800"
                >
                  <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 capitalize">
                      {category}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {catMods.length}
                    </span>
                  </div>
                  <table className="w-full table-fixed text-sm">
                    <colgroup>
                      <col className="w-full" />
                      <col className="w-16" />
                      <col className="w-8" />
                    </colgroup>
                    <tbody className="divide-y divide-zinc-800/50">
                      {catMods.map((mod) => (
                        <tr
                          key={mod.id}
                          className="bg-zinc-950 transition-colors hover:bg-zinc-900/60"
                        >
                          <td className="px-3 py-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                              {mod.icon_url ? (
                                <img
                                  src={mod.icon_url}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded-md object-cover"
                                />
                              ) : (
                                <div
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ${modColor(mod.name)}`}
                                >
                                  {mod.name[0].toUpperCase()}
                                </div>
                              )}
                              <p className="truncate text-xs font-medium text-white">
                                {mod.name}
                              </p>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {failedProjectIds?.has(mod.modrinth_project_id) ? (
                              <FailedBadge />
                            ) : (
                              <SideBadge side={mod.side} />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <a
                              href={`https://modrinth.com/mod/${mod.modrinth_project_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-600 transition-colors hover:text-emerald-400"
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
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {editMode && <th className="w-8 px-4 py-2" />}
                  <th className="px-4 py-2">Mod</th>
                  <th className="px-4 py-2">Version</th>
                  <th className="px-4 py-2">Categories</th>
                  <th className="px-4 py-2">Filename</th>
                  <th className="px-4 py-2 text-right">Side</th>
                  <th className="w-8 px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loading &&
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="bg-zinc-950">
                      <td className="px-4 py-3" colSpan={colSpan}>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 animate-pulse rounded-lg bg-zinc-800" />
                          <div className="space-y-1.5">
                            <div className="h-3.5 w-32 animate-pulse rounded bg-zinc-800" />
                            <div className="h-3 w-48 animate-pulse rounded bg-zinc-800" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                {!loading && mods.length === 0 && (
                  <tr>
                    <td
                      colSpan={colSpan}
                      className="px-4 py-12 text-center text-sm text-zinc-600"
                    >
                      No mods yet — click Add mods to get started.
                    </td>
                  </tr>
                )}
                {!loading &&
                  pageMods.map((mod) => {
                    const cats = displayCategories(mod.categories ?? []);
                    const isSelected = selectedIds.has(mod.id);
                    return (
                      <tr
                        key={mod.id}
                        onClick={
                          editMode ? () => toggleSelect(mod.id) : undefined
                        }
                        className={`bg-zinc-950 transition-colors hover:bg-zinc-900/60 ${editMode ? "cursor-pointer" : ""} ${isSelected ? "bg-zinc-900/80" : ""}`}
                      >
                        {editMode && (
                          <td className="px-4 py-2">
                            <div
                              className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                                isSelected
                                  ? "border-red-500 bg-red-500"
                                  : "border-zinc-600"
                              }`}
                            >
                              {isSelected && (
                                <svg
                                  width="8"
                                  height="6"
                                  viewBox="0 0 8 6"
                                  fill="none"
                                >
                                  <path
                                    d="M1 3l2 2 4-4"
                                    stroke="white"
                                    strokeWidth="1.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                          </td>
                        )}

                        <td className="px-4 py-2">
                          <div className="flex items-center gap-3">
                            {mod.icon_url ? (
                              <img
                                src={mod.icon_url}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded-md object-cover"
                              />
                            ) : (
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ${modColor(mod.name)}`}
                              >
                                {mod.name[0].toUpperCase()}
                              </div>
                            )}
                            <p className="truncate font-medium text-white">
                              {mod.name}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-zinc-400">
                              {mod.version_number ?? "—"}
                            </span>
                            <VersionTypeBadge type={mod.version_type ?? null} />
                          </div>
                        </td>

                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {cats.length > 0 ? (
                              cats.map((cat) => (
                                <span
                                  key={cat}
                                  className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs capitalize text-zinc-400"
                                >
                                  {cat}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-zinc-700">—</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-2">
                          <span className="font-mono text-xs text-zinc-500">
                            {mod.filename ?? "—"}
                          </span>
                        </td>

                        <td className="px-4 py-2 text-right">
                          {failedProjectIds?.has(mod.modrinth_project_id) ? (
                            <FailedBadge />
                          ) : (
                            <SideBadge side={mod.side} />
                          )}
                        </td>

                        <td className="px-4 py-2">
                          <a
                            href={`https://modrinth.com/mod/${mod.modrinth_project_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-zinc-500 transition-colors hover:text-emerald-400"
                            title="View on Modrinth"
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
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModpackBuilder() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showAddMods, setShowAddMods] = useState(false);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncCode, setSyncCode] = useState("");
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [needsRelink, setNeedsRelink] = useState(false);
  const [showFailedMods, setShowFailedMods] = useState(false);
  const [fixStatus, setFixStatus] = useState<{
    done: boolean;
    total: number;
    failed: number;
    failedMods: Array<{ id: number; name: string; modrinth_project_id: string; icon_url: string | null }>;
  } | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
        setDeleteConfirming(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const {
    data: modpack,
    isPlaceholderData,
    isPending,
  } = useQuery({
    queryKey: ["modpack", code],
    queryFn: () => getModpackByCode(code!),
    placeholderData: () => {
      const list = queryClient.getQueryData<ModpackSummary[]>(["modpacks"]);
      const summary = list?.find((m) => m.share_code === code);
      return summary ? ({ ...summary, mods: [] } as Modpack) : undefined;
    },
  });

  const { mutate: saveModpack } = useMutation({
    mutationFn: (input: UpdateModpackInput) =>
      updateModpack(modpack!.id, input),
    onMutate: (input) => {
      queryClient.setQueryData(["modpack", code], (old: Modpack) => ({
        ...old,
        ...input,
      }));
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ["modpacks"] });
      if ("source_share_code" in input) {
        queryClient.invalidateQueries({ queryKey: ["modpack", code] });
      }
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["modpack", code] });
    },
  });

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: () => deleteModpack(modpack!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modpacks"] });
      navigate("/modpacks");
    },
  });

  const { mutate: doFixMods, isPending: fixing } = useMutation({
    mutationFn: async () => {
      const mods = modpack!.mods;
      const results = await Promise.allSettled(
        mods.map(async (mod) => {
          const ver = await getLatestVersion(
            mod.modrinth_project_id,
            modpack!.game_version,
            modpack!.loader,
          );
          await removeMod(modpack!.id, mod.id);
          await addMod(modpack!.id, {
            modrinth_project_id: mod.modrinth_project_id,
            version_id: ver.version_id,
            name: mod.name,
            side: mod.side,
            icon_url: mod.icon_url,
            version_number: ver.version_number,
            version_type: ver.version_type,
            filename: ver.filename,
            categories: mod.categories,
          });
        }),
      );
      const failedMods = mods
        .filter((_, i) => results[i].status === "rejected")
        .map((m) => ({ id: m.id, name: m.name, modrinth_project_id: m.modrinth_project_id, icon_url: m.icon_url }));
      return { total: mods.length, failed: failedMods.length, failedMods };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["modpack", code] });
      setFixStatus({ done: true, ...result });
    },
  });

  const { mutate: removeFailedMod } = useMutation({
    mutationFn: (modId: number) => removeMod(modpack!.id, modId),
    onSuccess: (_, modId) => {
      queryClient.invalidateQueries({ queryKey: ["modpack", code] });
      setFixStatus((prev) =>
        prev
          ? {
              ...prev,
              failed: prev.failed - 1,
              failedMods: prev.failedMods.filter((m) => m.id !== modId),
            }
          : null,
      );
    },
  });

  const { mutate: doExport, isPending: exporting } = useMutation({
    mutationFn: () => exportMrpack(modpack!.id),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${modpack!.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-zinc-800" />
        <div className="h-64 animate-pulse rounded-xl bg-zinc-800" />
      </div>
    );
  }

  if (!modpack) return null;

  const existingIds = new Set(modpack.mods.map((m) => m.modrinth_project_id));
  const failedProjectIds: Set<string> | undefined = fixStatus?.failedMods.length
    ? new Set(fixStatus.failedMods.map((m) => m.modrinth_project_id))
    : undefined;

  function handleCopy() {
    navigator.clipboard.writeText(modpack!.share_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Back navigation */}
      <button
        onClick={() => navigate("/modpacks")}
        className="mb-5 flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-white"
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
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Modpacks
      </button>

      {/* Header */}
      <div
        className={`${modpack.source_share_code ? "mb-4" : "mb-6"} flex flex-wrap items-start justify-between gap-4`}
      >
        <div className="flex items-start gap-4">
          {/* Modpack icon */}
          <ModpackIconWidget modpack={modpack} onSave={saveModpack} />

          {/* Name + meta */}
          <div className="pt-0.5">
            {nameEditing ? (
              <input
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={() => {
                  const trimmed = nameValue.trim();
                  setNameEditing(false);
                  if (trimmed && trimmed !== modpack.name)
                    saveModpack({ name: trimmed });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setNameEditing(false);
                    setNameValue(modpack.name);
                  }
                }}
                className="bg-transparent text-2xl font-bold text-white outline-none border-b border-zinc-600 focus:border-emerald-500 transition-colors w-full"
              />
            ) : (
              <h1
                className="text-2xl font-bold cursor-text hover:text-zinc-300 transition-colors"
                onClick={() => {
                  setNameValue(modpack.name);
                  setNameEditing(true);
                }}
                title="Click to rename"
              >
                {modpack.name}
              </h1>
            )}
            <p className="mt-1 flex items-center gap-1 text-sm">
              <button
                onClick={() => setSettingsOpen(true)}
                className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
              >
                {modpack.game_version}
              </button>
              <span className="text-zinc-700">·</span>
              <button
                onClick={() => setSettingsOpen(true)}
                className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs font-medium capitalize text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
              >
                {modpack.loader}
              </button>
              <span className="mx-0.5 text-zinc-600">·</span>
              <span className="text-emerald-400">
                {modpack.mods.length} mod{modpack.mods.length !== 1 ? "s" : ""}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!modpack.source_share_code && (
            <button
              onClick={() => setShowAddMods((v) => !v)}
              className={`rounded-md px-4 py-2 text-sm font-semibold text-white shadow-[0_0_8px_rgba(16,185,129,0.2)] transition-all active:scale-95 ${
                showAddMods
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-emerald-500 hover:bg-emerald-400"
              }`}
            >
              {showAddMods ? "Close search" : "Add mods"}
            </button>
          )}
          <div className="flex items-center overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900">
            <span className="px-4 py-2 font-mono text-sm text-zinc-400 select-all">
              {modpack.share_code}
            </span>
            <button
              onClick={handleCopy}
              className={`border-l border-zinc-700 px-4 py-2 text-sm transition-all hover:bg-zinc-700 active:scale-95 ${
                copied
                  ? "bg-emerald-900 text-emerald-400"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              {copied ? "Copied!" : "Copy code"}
            </button>
          </div>
          <button
            onClick={() => doExport()}
            disabled={exporting || modpack.mods.length === 0}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white active:scale-95 disabled:opacity-40"
          >
            {exporting ? "Exporting…" : "Export .zip"}
          </button>

          {/* Settings */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className={`rounded-lg border border-zinc-700 px-3 py-2 transition-all hover:bg-zinc-700 hover:text-white active:scale-95 ${
                settingsOpen
                  ? "bg-zinc-700 text-white"
                  : "bg-zinc-800 text-zinc-400"
              }`}
              title="Modpack settings"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {settingsOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/50">
                <div className="border-b border-zinc-800 px-4 py-3">
                  <p className="text-sm font-semibold text-white">Settings</p>
                </div>

                {/* Version & Loader */}
                <div className="space-y-3 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Version &amp; Loader
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-xs text-zinc-500">Version</span>
                    <select
                      value={modpack.game_version}
                      onChange={(e) => {
                        saveModpack({ game_version: e.target.value });
                        setFixStatus(null);
                        if (modpack.mods.length > 0) setNeedsRelink(true);
                      }}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-600"
                    >
                      {MC_VERSIONS.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-xs text-zinc-500">Loader</span>
                    <div className="flex flex-wrap gap-1.5">
                      {LOADERS.map((l) => (
                        <button
                          key={l}
                          onClick={() => {
                            saveModpack({ loader: l });
                            setFixStatus(null);
                            if (modpack.mods.length > 0) setNeedsRelink(true);
                          }}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-all ${
                            modpack.loader === l
                              ? "bg-emerald-500 text-white"
                              : "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                <div className="border-t border-zinc-800" />

                {/* Sync */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">Sync</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {modpack.source_share_code
                          ? `Mirroring ${modpack.source_share_code}`
                          : "Mirror a shared modpack's latest mods"}
                      </p>
                    </div>
                    <div
                      onClick={() => {
                        if (modpack.source_share_code) {
                          saveModpack({ source_share_code: null });
                        }
                      }}
                      className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                        modpack.source_share_code
                          ? "cursor-pointer bg-emerald-500"
                          : "cursor-default bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                          modpack.source_share_code
                            ? "translate-x-4"
                            : "translate-x-0.5"
                        }`}
                      />
                    </div>
                  </div>

                  {modpack.source_share_code ? (
                    <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-800/40 px-3 py-2">
                      <p className="text-xs text-zinc-500">Source</p>
                      <p className="mt-0.5 font-mono text-sm text-zinc-300">
                        {modpack.source_share_code}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <input
                        value={syncCode}
                        onChange={(e) => setSyncCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && syncCode.trim()) {
                            saveModpack({ source_share_code: syncCode.trim() });
                            setSyncCode("");
                          }
                        }}
                        placeholder="Enter share code…"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-600"
                      />
                    </div>
                  )}
                </div>

                <div className="border-t border-zinc-800" />

                {/* Danger zone */}
                <div className="p-4">
                  {deleteConfirming ? (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-zinc-400">Delete this modpack?</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => doDelete()}
                          disabled={deleting}
                          className="rounded-md bg-red-950/60 px-3 py-1.5 text-xs font-semibold text-red-400 ring-1 ring-red-900 transition-all hover:bg-red-900/60 active:scale-95 disabled:opacity-40"
                        >
                          {deleting ? "Deleting…" : "Yes, delete"}
                        </button>
                        <button
                          onClick={() => setDeleteConfirming(false)}
                          className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirming(true)}
                      className="w-full rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-500 transition-colors hover:border-red-900/50 hover:bg-red-950/20 hover:text-red-400"
                    >
                      Delete modpack
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync banner */}
      {modpack.source_share_code && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-blue-900/50 bg-blue-950/20 px-4 py-2.5">
          <svg
            className="shrink-0 text-blue-400"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          <p className="text-xs text-blue-300">
            Synced from{" "}
            <span className="font-mono">{modpack.source_share_code}</span> —
            mods always reflect the latest version
          </p>
        </div>
      )}

      {/* Panel — slides down, collapses up */}
      <div
        className="grid transition-all duration-300 ease-out"
        style={{
          gridTemplateRows: showAddMods ? "1fr" : "0fr",
          opacity: showAddMods ? 1 : 0,
        }}
        aria-hidden={!showAddMods}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-1">
            <AddModsPanel
              open={showAddMods}
              modpackId={modpack.id}
              gameVersion={modpack.game_version}
              loader={modpack.loader}
              existingIds={existingIds}
              cacheKey={code!}
              onClose={() => setShowAddMods(false)}
            />
          </div>
        </div>
      </div>

      {/* Relink banner */}
      {needsRelink && modpack.mods.length > 0 && !modpack.source_share_code && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-2.5">
          <svg
            className="shrink-0 text-amber-400"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="flex-1 text-xs text-amber-300">
            {fixStatus?.done
              ? `Updated — ${fixStatus.total - fixStatus.failed} mod${fixStatus.total - fixStatus.failed !== 1 ? "s" : ""} re-linked${fixStatus.failed > 0 ? `, ${fixStatus.failed} not found for this version` : ""}`
              : `${modpack.mods.length} mod${modpack.mods.length !== 1 ? "s" : ""} may be incompatible with ${modpack.game_version} ${modpack.loader}`}
          </p>
          {fixStatus?.done && fixStatus.failed > 0 && (
            <button
              onClick={() => setShowFailedMods((v) => !v)}
              className="shrink-0 rounded-md border border-amber-800/50 bg-amber-950/60 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-900/50 active:scale-95"
            >
              {showFailedMods ? "Hide" : "View"}
            </button>
          )}
          {!fixStatus?.done && (
            <button
              onClick={() => doFixMods()}
              disabled={fixing}
              className="shrink-0 rounded-md border border-amber-800/50 bg-amber-950/60 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-900/50 active:scale-95 disabled:opacity-40"
            >
              {fixing ? "Updating…" : "Update mods"}
            </button>
          )}
          <button
            onClick={() => { setNeedsRelink(false); setFixStatus(null); setShowFailedMods(false); }}
            className="shrink-0 text-amber-700 transition-colors hover:text-amber-400"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Failed mods panel */}
      {showFailedMods && fixStatus?.failedMods && fixStatus.failedMods.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-xl border border-red-900/40">
          <div className="border-b border-red-900/30 bg-red-950/20 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
              Not found — {modpack.game_version} · {modpack.loader}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-red-900/20 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                <th className="px-4 py-2">Mod</th>
                <th className="px-4 py-2 text-right">Side</th>
                <th className="w-8 px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20">
              {fixStatus.failedMods.map((mod) => (
                <tr key={mod.id} className="bg-zinc-950">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {mod.icon_url ? (
                        <img
                          src={mod.icon_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-md object-cover opacity-40"
                        />
                      ) : (
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white opacity-40 ${modColor(mod.name)}`}
                        >
                          {mod.name[0].toUpperCase()}
                        </div>
                      )}
                      <p className="font-medium text-zinc-500">{mod.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 rounded border border-red-900/60 bg-red-950/40 px-1.5 py-0.5 text-xs font-medium text-red-400">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      Not found
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <a
                        href={`https://modrinth.com/mod/${mod.modrinth_project_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-600 transition-colors hover:text-emerald-400"
                        title="View on Modrinth"
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
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                      <button
                        onClick={() => removeFailedMod(mod.id)}
                        className="text-zinc-600 transition-colors hover:text-red-400"
                        title="Remove mod"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Table — always visible */}
      <div className={showAddMods ? "mt-4" : ""}>
        <ModTable
          modpackId={modpack.id}
          mods={modpack.mods}
          readOnly={!!modpack.source_share_code}
          loading={isPlaceholderData}
          cacheKey={code!}
          failedProjectIds={failedProjectIds}
        />
      </div>
    </div>
  );
}
