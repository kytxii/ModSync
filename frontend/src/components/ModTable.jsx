import React, { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import SortIcon from "./SortIcon";
import SideBadge from "./SideBadge";
import { WaveLoader } from "./ModToasts";

function isLoadingMod(mod) {
  return String(mod.id).startsWith("temp-");
}

const PAGE_SIZE = 10;

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

const CATEGORY_PRIORITY = [
  "library",
  "optimization",
  "game-mechanics",
  "magic",
  "worldgen",
  "technology",
  "equipment",
  "decoration",
  "food",
  "mobs",
  "utility",
  "transportation",
  "social",
  "economy",
  "minigame",
  "storage",
  "management",
  "adventure",
  "datapack",
  "misc",
];

function categoryRank(c) {
  const i = CATEGORY_PRIORITY.indexOf(c);
  return i === -1 ? 999 : i;
}

function modColor(name) {
  return MOD_COLORS[name.charCodeAt(0) % MOD_COLORS.length];
}

function displayCategories(categories) {
  return categories
    .filter((c) => !HIDDEN_CATEGORIES.has(c))
    .sort((a, b) => categoryRank(a) - categoryRank(b))
    .slice(0, 2);
}

function groupByCategory(mods) {
  const map = new Map();
  const seen = new Set();
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

/**
 * Props:
 *   mods              — array of mod objects
 *   loading           — show loading skeleton
 *   readOnly          — hide edit/remove controls
 *   cacheKey          — any value; sort/page reset when it changes
 *   failedProjectIds  — optional Set<string> of modrinth_project_ids to mark failed
 *   onRemoveMods      — (ids: Set<id>) => Promise — caller handles API + cache invalidation
 *   renderVersionCell — (mod) => ReactNode — renders the Version column cell
 */
export default function ModTable({
  mods,
  readOnly,
  loading,
  cacheKey,
  failedProjectIds,
  onRemoveMods,
  renderVersionCell,
}) {
  const [page, setPage] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [viewMode, setViewMode] = useState("list");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    setSortCol(null);
    setSortDir("asc");
    setPage(1);
  }, [cacheKey]);

  const MOD_SORT_KEYS = {
    name:       (m) => m.name.toLowerCase(),
    version:    (m) => m.version_number ?? "￿",
    side:       (m) => ({ client: 0, server: 1, both: 2 }[m.side] ?? 3),
    categories: (m) => displayCategories(m.categories ?? [])[0] ?? "￿",
  };

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
    setPage(1);
  }

  const sortedMods = sortCol
    ? [...mods].sort((a, b) => {
        const va = MOD_SORT_KEYS[sortCol](a);
        const vb = MOD_SORT_KEYS[sortCol](b);
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : mods;

  const totalPages = Math.max(1, Math.ceil(mods.length / PAGE_SIZE));
  const pageMods = sortedMods.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const { mutate: bulkRemove, isPending: removing } = useMutation({
    mutationFn: () => onRemoveMods(selectedIds),
    onSuccess: () => {
      setSelectedIds(new Set());
      setEditMode(false);
    },
  });

  function toggleSelect(id) {
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

  function switchView(mode) {
    if (mode === "grid") exitEdit();
    setViewMode(mode);
  }

  const colSpan = 7;

  return (
    <div>
      {/* Table toolbar */}
      <div className="mb-3 flex items-center justify-between gap-3">
        {/* Left: edit controls (list only) */}
        <div className="flex items-center gap-2">
          {!readOnly &&
            viewMode === "list" &&
            (editMode ? (
              <>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => bulkRemove()}
                    disabled={removing}
                    className="inline-flex items-center justify-center leading-none rounded border border-red-900 bg-red-950/40 px-2 py-1 text-xs font-medium text-red-400 transition-all hover:bg-red-900/50 active:scale-95 disabled:opacity-40"
                  >
                    {removing
                      ? "Removing…"
                      : `Remove ${selectedIds.size} mod${selectedIds.size !== 1 ? "s" : ""}`}
                  </button>
                )}
                <button
                  onClick={exitEdit}
                  title="Cancel"
                  className="inline-flex items-center justify-center leading-none rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
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
              </>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                title="Edit mods"
                className="inline-flex items-center justify-center leading-none rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
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
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            ))}
        </div>

        {/* Right: pagination + view toggle */}
        <div className="flex items-center gap-3">
          {viewMode === "list" && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center justify-center leading-none rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-30"
              >
                ←
              </button>
              <span className="px-1 text-xs text-zinc-500">
                {(page - 1) * PAGE_SIZE + 1}—
                {Math.min(page * PAGE_SIZE, mods.length)} of {mods.length}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center justify-center leading-none rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-30"
              >
                →
              </button>
            </div>
          )}
          <div className="flex overflow-hidden rounded border border-zinc-700">
            {[
              ["list", <IconList />],
              ["grid", <IconGrid />],
            ].map(([mode, icon]) => (
              <button
                key={mode}
                onClick={() => switchView(mode)}
                className={`inline-flex items-center justify-center px-2 py-1 transition-colors ${
                  viewMode === mode
                    ? "bg-zinc-700 text-white"
                    : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Views — carousel: list left slot, grid right slot */}
      {/* pb-px: prevents bottom border clipping at overflow boundary */}
      <div className="overflow-hidden pb-px">
        <div
          style={{
            display: "flex",
            width: "200%",
            transform:
              viewMode === "list" ? "translateX(0)" : "translateX(-50%)",
            transition: "transform 250ms ease",
          }}
        >
          {/* List view — left slot; pr-px: prevents right border clipping */}
          <div style={{ width: "50%", paddingRight: "1px" }}>
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      <th className="p-0">
                        <div
                          style={{
                            overflow: "hidden",
                            maxWidth: editMode ? "3rem" : "0",
                            transition: "max-width 250ms cubic-bezier(0.4,0,0.2,1)",
                          }}
                        >
                          <div className="w-12 py-2" />
                        </div>
                      </th>
                      <th className="cursor-pointer select-none px-4 py-2 hover:text-zinc-300" onClick={() => handleSort("name")}>
                        Mod <SortIcon active={sortCol === "name"} dir={sortDir} />
                      </th>
                      <th className="cursor-pointer select-none px-4 py-2 hover:text-zinc-300" onClick={() => handleSort("version")}>
                        Version <SortIcon active={sortCol === "version"} dir={sortDir} />
                      </th>
                      <th className="min-w-[180px] cursor-pointer select-none px-4 py-2 hover:text-zinc-300" onClick={() => handleSort("categories")}>
                        Categories <SortIcon active={sortCol === "categories"} dir={sortDir} />
                      </th>
                      <th className="px-4 py-2">Filename</th>
                      <th className="w-16 cursor-pointer select-none whitespace-nowrap px-4 py-2 text-right hover:text-zinc-300" onClick={() => handleSort("side")}>
                        Side <SortIcon active={sortCol === "side"} dir={sortDir} />
                      </th>
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
                            <td className="p-0">
                              <div
                                style={{
                                  overflow: "hidden",
                                  maxWidth: editMode ? "3rem" : "0",
                                  transition: "max-width 250ms cubic-bezier(0.4,0,0.2,1)",
                                }}
                              >
                                <div className="px-4 py-2">
                                  <div
                                    className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${isSelected ? "border-red-500 bg-red-500" : "border-zinc-600"}`}
                                  >
                                    {isSelected && (
                                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
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
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-1.5">
                              <div className="flex items-center gap-3">
                                {mod.icon_url ? (
                                  <img
                                    src={mod.icon_url}
                                    alt=""
                                    className="h-7 w-7 shrink-0 rounded-md object-cover"
                                  />
                                ) : (
                                  <div
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ${modColor(mod.name)}`}
                                  >
                                    {mod.name[0].toUpperCase()}
                                  </div>
                                )}
                                <p className="truncate font-medium text-white">
                                  {mod.name}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-1.5">
                              {isLoadingMod(mod)
                                ? <WaveLoader color="#71717A" />
                                : renderVersionCell(mod)}
                            </td>
                            <td className="px-4 py-1.5">
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
                            <td className="px-4 py-1.5">
                              <span className="font-mono text-xs text-zinc-500">
                                {isLoadingMod(mod) ? <WaveLoader color="#71717A" /> : (mod.filename ?? "—")}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right">
                              {failedProjectIds?.has(mod.modrinth_project_id) ? (
                                <FailedBadge />
                              ) : (
                                <SideBadge side={mod.side} />
                              )}
                            </td>
                            <td className="px-4 py-1.5">
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
          </div>

          {/* Grid view — right slot; content only mounts when active so it doesn't inflate container height */}
          <div style={{ width: "50%" }}>
            {viewMode === "grid" && <div>
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
                              <td className="px-3 py-1.5">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  {mod.icon_url ? (
                                    <img
                                      src={mod.icon_url}
                                      alt=""
                                      className="h-7 w-7 shrink-0 rounded-md object-cover"
                                    />
                                  ) : (
                                    <div
                                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ${modColor(mod.name)}`}
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
                              <td className="px-3 py-1.5">
                                <a
                                  href={`https://modrinth.com/mod/${mod.modrinth_project_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-zinc-600 transition-colors hover:text-emerald-400"
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}
