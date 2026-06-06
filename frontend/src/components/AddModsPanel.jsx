import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { searchMods, getCategories } from "../api/mods";
import SideBadge from "./SideBadge";
import { WaveLoader } from "./ModToasts";

const PAGE_SIZE = 10;

const HIDDEN_CATEGORIES = new Set([
  "fabric","forge","quilt","neoforge","modloader","rift",
  "liteloader","bukkit","spigot","paper","purpur","folia","cursed",
]);

const CATEGORY_PRIORITY = [
  "library","optimization","game-mechanics","magic","worldgen","technology",
  "equipment","decoration","food","mobs","utility","transportation","social",
  "economy","minigame","storage","management","adventure","datapack","misc",
];

const MOD_COLORS = [
  "bg-emerald-700","bg-blue-700","bg-violet-700",
  "bg-orange-700","bg-pink-700","bg-teal-700",
];

function categoryRank(c) {
  const i = CATEGORY_PRIORITY.indexOf(c);
  return i === -1 ? 999 : i;
}

function displayCategories(categories) {
  return (categories ?? [])
    .filter((c) => !HIDDEN_CATEGORIES.has(c))
    .sort((a, b) => categoryRank(a) - categoryRank(b))
    .slice(0, 2);
}

function modColor(name) {
  return MOD_COLORS[name.charCodeAt(0) % MOD_COLORS.length];
}

function fmtDownloads(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function deriveSide(hit) {
  if (hit.server_side === "unsupported") return "client";
  if (hit.client_side === "unsupported") return "server";
  return "both";
}

function Chevron({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
      className={`transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Props:
 *   open                – controls visibility / input focus
 *   gameVersion         – filters search results
 *   loader              – filters search results
 *   existingIds         – Set<modrinth_project_id> already in the pack (greyed out)
 *   onClose             – called when panel should close
 *   onAdd(hits)         – async; called with selected hits; must return mutation result
 *   onBeforeAdd(hits, queryClient) – optional; synchronous; return context for rollback
 *   onAddSuccess(data, queryClient) – optional; post-add actions (invalidations, etc.)
 *   onAddError(err, hits, ctx, queryClient) – optional; rollback handler
 *   defaultSide – initial value for the Side filter (e.g. "both" for servers)
 */
export default function AddModsPanel({
  open,
  gameVersion,
  loader,
  existingIds,
  onClose,
  onAdd,
  onBeforeAdd,
  onAddSuccess,
  onAddError,
  defaultSide = null,
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const sentinelRef = useRef(null);
  const scrollRef = useRef(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [activeCategory, setActiveCategory] = useState(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [activeSide, setActiveSide] = useState(defaultSide);
  const [sideOpen, setSideOpen] = useState(false);
  const [sortIndex, setSortIndex] = useState("relevance");

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const { data: categoriesData } = useQuery({
    queryKey: ["mod-categories"],
    queryFn: getCategories,
    staleTime: Infinity,
  });

  const categories = categoriesData ?? [];
  const enabled = debouncedQuery.length >= 2 || activeCategory !== null || activeSide !== null;

  const { data, isFetching, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["mod-search", debouncedQuery, gameVersion, loader, activeCategory, activeSide, sortIndex],
    queryFn: ({ pageParam = 0 }) =>
      searchMods({
        query: debouncedQuery,
        game_version: gameVersion,
        loader,
        category: activeCategory ?? undefined,
        side: activeSide ?? undefined,
        index: sortIndex,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.hits.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
    enabled,
  });

  const hits = data?.pages.flatMap((p) => p.hits) ?? [];

  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchNextPage(); },
      { root: scrollRef.current, threshold: 0 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  function toggle(projectId) {
    if (existingIds.has(projectId)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });
  }

  const { mutate: addSelected, isPending: adding } = useMutation({
    mutationFn: (toAdd) => onAdd(toAdd),
    onMutate: (toAdd) => {
      setSelected(new Set());
      return onBeforeAdd?.(toAdd, queryClient);
    },
    onSuccess: (data) => onAddSuccess?.(data, queryClient),
    onError: (err, toAdd, ctx) => onAddError?.(err, toAdd, ctx, queryClient),
  });

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
        {/* Search bar */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-4">
          <svg className="shrink-0 text-zinc-300" width="17" height="17" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Modrinth…"
            className="flex-1 bg-transparent text-base text-white placeholder-zinc-500 outline-none"
          />
          {isFetching && !isFetchingNextPage && (
            <span className="shrink-0 animate-pulse text-xs text-zinc-400">Searching…</span>
          )}
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-zinc-700 text-xs">
            {["relevance", "downloads"].map((opt) => (
              <button key={opt} onClick={() => setSortIndex(opt)}
                className={`px-3 py-1.5 capitalize transition-colors ${sortIndex === opt ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"}`}>
                {opt}
              </button>
            ))}
          </div>
          {selected.size > 0 && (
            <button
              onClick={() => addSelected(hits.filter((h) => selected.has(h.project_id)))}
              disabled={adding}
              className="shrink-0 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_8px_rgba(16,185,129,0.2)] transition-all hover:bg-emerald-400 active:scale-95 disabled:opacity-40"
            >
              {adding ? <WaveLoader color="white" /> : `Add ${selected.size} mod${selected.size !== 1 ? "s" : ""}`}
            </button>
          )}
          <button onClick={onClose}
            className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-start border-b border-zinc-800">
          <div className="flex-1 bg-zinc-900">
            <button onClick={() => setCategoriesOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-2.5 transition-colors hover:bg-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Categories</span>
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
                  <button key={cat.name}
                    onClick={() => setActiveCategory((prev) => prev === cat.name ? null : cat.name)}
                    className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${activeCategory === cat.name ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white"}`}>
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-px self-stretch bg-zinc-800" />
          <div className="w-52 bg-zinc-900">
            <button onClick={() => setSideOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-2.5 transition-colors hover:bg-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Side</span>
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
                {["client", "server", "both"].map((s) => (
                  <button key={s}
                    onClick={() => setActiveSide((prev) => prev === s ? null : s)}
                    className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${activeSide === s ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white"}`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div ref={scrollRef} className="scrollbar-dark max-h-[55vh] overflow-y-auto divide-y divide-zinc-800 overscroll-contain">
          {debouncedQuery.length < 2 && !activeCategory && !activeSide && (
            <div className="flex flex-col items-center gap-3 py-12 text-zinc-500">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <p className="text-sm">Type to search Modrinth</p>
            </div>
          )}
          {enabled && !isFetching && hits.length === 0 && (
            <p className="py-16 text-center text-sm text-zinc-500">No results</p>
          )}
          {hits.map((hit) => {
            const already = existingIds.has(hit.project_id);
            const isSelected = selected.has(hit.project_id);
            const cats = displayCategories(hit.categories ?? []);
            const side = deriveSide(hit);
            return (
              <div key={hit.project_id} onClick={() => toggle(hit.project_id)}
                className={`relative flex items-center gap-4 px-4 py-3.5 transition-colors ${already ? "cursor-default opacity-30" : isSelected ? "cursor-pointer bg-emerald-950/40" : "cursor-pointer hover:bg-zinc-900"}`}>
                {isSelected && <div className="absolute inset-y-0 left-0 w-0.5 bg-emerald-500" />}
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${already ? "border-zinc-600 bg-zinc-700" : isSelected ? "border-emerald-500 bg-emerald-500" : "border-zinc-600"}`}>
                  {(already || isSelected) && (
                    <svg width="9" height="7" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                {hit.icon_url ? (
                  <img src={hit.icon_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/5" />
                ) : (
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white ${modColor(hit.title)}`}>
                    {hit.title[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-white">{hit.title}</p>
                    <SideBadge side={side} />
                  </div>
                  <p className="mt-0.5 truncate text-xs leading-relaxed text-zinc-400">{hit.description}</p>
                  {cats.length > 0 && (
                    <div className="mt-1.5 flex gap-1">
                      {cats.map((c) => (
                        <span key={c} className="rounded bg-zinc-700 px-1.5 py-0.5 text-xs capitalize text-zinc-200">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-sm font-semibold text-zinc-200">{fmtDownloads(hit.downloads)}</span>
                  <p className="text-xs text-zinc-500">downloads</p>
                </div>
              </div>
            );
          })}
          {isFetchingNextPage && [...Array(3)].map((_, i) => (
            <div key={`skel-${i}`} className="flex items-center gap-4 px-4 py-3.5">
              <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-zinc-800" />
              <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-zinc-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 animate-pulse rounded bg-zinc-800" />
                <div className="h-3 w-52 animate-pulse rounded bg-zinc-800" />
              </div>
            </div>
          ))}
          {!isFetchingNextPage && hasNextPage && <div ref={sentinelRef} className="h-px" />}
        </div>
      </div>
    </>
  );
}
