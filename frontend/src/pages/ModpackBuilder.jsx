import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import {
  getModpackByCode,
  addMod,
  addModsBulk,
  removeMod,
  exportModpack,
  updateModpack,
  deleteModpack,
  getModpackChangelog,
  getSharedModpackChangelog,
  getModVersions,
  updateModVersion,
} from "../api/modpacks";

import { searchMods, getLatestVersion, getCategories } from "../api/mods";
import SideBadge from "../components/SideBadge";
import SortIcon from "../components/SortIcon";
import AddModsPanel from "../components/AddModsPanel";
import ModTable from "../components/ModTable";
import { useModToasts, ModToastsPortal } from "../components/ModToasts";

const LOADERS = ["fabric", "forge", "quilt", "neoforge"];
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

const MOD_COLORS = [
  "bg-emerald-700",
  "bg-blue-700",
  "bg-violet-700",
  "bg-orange-700",
  "bg-pink-700",
  "bg-teal-700",
];

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function modColor(name) {
  return MOD_COLORS[name.charCodeAt(0) % MOD_COLORS.length];
}
function fmtDownloads(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}
function deriveSide(hit) {
  if (hit.server_side === "unsupported") return "client";
  if (hit.client_side === "unsupported") return "server";
  return "both";
}

function VersionTypeBadge({ type }) {
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

function Chevron({ open }) {
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

function VersionToast({ toast, onDismiss }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    let raf1, raf2;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);
  const active = entered && !toast.fading;
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ${active ? "max-h-40 mb-2.5" : "max-h-0 mb-0 delay-300"}`}
    >
      <div
        className={`w-80 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 shadow-xl transition-all duration-300 ${active ? "opacity-100 translate-x-0" : "opacity-0 translate-x-3"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {toast.icon_url ? (
              <img
                src={toast.icon_url}
                alt=""
                className="h-5 w-5 shrink-0 rounded object-cover"
              />
            ) : (
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white ${modColor(toast.name)}`}
              >
                {toast.name[0].toUpperCase()}
              </div>
            )}
            <span className="truncate text-sm font-medium text-white">
              {toast.name}
            </span>
            <span className="shrink-0 text-xs text-zinc-500">updated</span>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 text-zinc-600 transition-colors hover:text-zinc-400"
            aria-label="Dismiss"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 2l8 8M10 2l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Version change block */}
        <div className="mt-2.5 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 text-xs">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-2.5 py-1.5">
            <span className="shrink-0 rounded bg-red-950 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-400">
              old
            </span>
            <span className="truncate font-mono text-red-300/70 line-through decoration-red-500/30">
              {toast.old_filename}
            </span>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <span className="shrink-0 rounded bg-emerald-950 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-400">
              new
            </span>
            <span className="truncate font-mono font-semibold text-emerald-300">
              {toast.new_filename}
            </span>
          </div>
        </div>

        {/* Download link */}
        <a
          href={toast.download_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-400 transition-colors hover:text-emerald-300"
        >
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download new file
        </a>
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

function defaultIconColor(name) {
  return ICON_PALETTE[name.charCodeAt(0) % ICON_PALETTE.length];
}

function ModpackIconWidget({ modpack, onSave }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("color");
  const [letterInput, setLetterInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleOpen() {
    setLetterInput(modpack.icon_letter ?? modpack.name[0].toUpperCase());
    setImageUrl(modpack.icon_url ?? "");
    setOpen(true);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result;
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
            {["color", "image"].map((t) => (
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

function VersionPickerPopover({
  mod,
  modpackId,
  cacheKey,
  readOnly,
  addVersionToast,
}) {
  const [open, setOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [patchError, setPatchError] = useState(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const queryClient = useQueryClient();

  const isTemp = String(mod.id).startsWith("temp-");

  function openPopover() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimate = 320;
    const left = Math.min(rect.left, window.innerWidth - 320 - 8);
    const top = window.innerHeight - rect.bottom >= estimate + 8
      ? rect.bottom + 4
      : Math.max(8, rect.top - estimate - 4);
    setPopoverPos({ top, left });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      )
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelectedVersion(null);
      setPatchError(null);
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !popoverRef.current || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const actualHeight = popoverRef.current.offsetHeight;
    setPopoverPos((prev) => {
      if (prev.top < rect.top) {
        return { ...prev, top: Math.max(8, rect.top - actualHeight - 4) };
      }
      return prev;
    });
  }, [open]);

  const {
    data: versions,
    isLoading: versionsLoading,
    isError: versionsError,
  } = useQuery({
    queryKey: ["mod-versions", modpackId, mod.id],
    queryFn: () => getModVersions(modpackId, mod.id),
    enabled: open && !isTemp,
    staleTime: Infinity,
  });

  const { mutate: doUpdate, isPending: updating } = useMutation({
    mutationFn: (ver) =>
      updateModVersion(modpackId, mod.id, {
        version_id: ver.version_id,
        version_number: ver.version_number,
        filename: ver.filename,
      }),
    onSuccess: (_data, ver) => {
      addVersionToast({
        name: mod.name,
        icon_url: mod.icon_url ?? null,
        old_filename: mod.filename ?? mod.version_number ?? "current file",
        new_filename: ver.filename,
        download_url: ver.download_url,
      });
      queryClient.invalidateQueries({ queryKey: ["modpack", cacheKey] });
      queryClient.invalidateQueries({ queryKey: ["modpack-changelog", modpackId] });
      setOpen(false);
    },
    onError: (err) => {
      setPatchError(err?.response?.data?.detail ?? "Update failed");
    },
  });

  const isCurrent = (ver) => ver.version_id === mod.version_id;
  const isAlreadyOnSelected = selectedVersion && isCurrent(selectedVersion);
  const oldFile = mod.filename ?? mod.version_number ?? "current file";
  const hint =
    selectedVersion && !isAlreadyOnSelected
      ? `Replace ${oldFile} → ${selectedVersion.filename}`
      : null;

  const clickable = !readOnly && !isTemp;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          if (!clickable) return;
          open ? setOpen(false) : openPopover();
        }}
        className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-left transition-colors ${
          clickable ? "cursor-pointer hover:bg-zinc-800" : "cursor-default"
        }`}
      >
        <span className="text-xs text-zinc-400">
          {mod.version_number ?? "—"}
        </span>
        <VersionTypeBadge type={mod.version_type ?? null} />
        {clickable && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            className="shrink-0 text-zinc-600"
          >
            <path
              d="M2 4l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: popoverPos.top,
              left: popoverPos.left,
              zIndex: 9999,
            }}
            className="w-80 rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-zinc-800 px-3 py-2.5">
              <p className="text-xs font-medium text-zinc-300">
                Change version — {mod.name}
              </p>
            </div>

            <div className="max-h-52 overflow-y-auto">
              {versionsLoading && (
                <div className="space-y-2 p-3">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="h-8 animate-pulse rounded bg-zinc-800"
                    />
                  ))}
                </div>
              )}
              {versionsError && (
                <p className="px-3 py-4 text-center text-xs text-red-400">
                  Could not load versions from Modrinth
                </p>
              )}
              {!versionsLoading && !versionsError && versions?.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-zinc-500">
                  No versions available
                </p>
              )}
              {versions?.map((ver) => {
                const current = isCurrent(ver);
                const sel = selectedVersion?.version_id === ver.version_id;
                return (
                  <button
                    key={ver.version_id}
                    onClick={() => setSelectedVersion(ver)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors ${sel ? "bg-zinc-800" : "hover:bg-zinc-900"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${current ? "bg-emerald-400" : "bg-transparent"}`}
                      />
                      <span
                        className={`text-xs ${current ? "font-medium text-zinc-200" : "text-zinc-400"}`}
                      >
                        {ver.version_number}
                      </span>
                      {ver.version_type !== "release" && (
                        <span
                          className={`rounded border px-1 py-0.5 text-[10px] font-medium ${
                            ver.version_type === "beta"
                              ? "border-yellow-800 bg-yellow-950 text-yellow-400"
                              : "border-red-900 bg-red-950 text-red-400"
                          }`}
                        >
                          {ver.version_type}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-600">
                      {new Date(ver.date_published).toLocaleDateString()}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedVersion && (
              <div className="space-y-2 border-t border-zinc-800 p-3">
                {hint && (
                  <p className="truncate font-mono text-[10px] text-zinc-500">
                    {hint}
                  </p>
                )}
                {patchError && (
                  <p className="text-xs text-red-400">{patchError}</p>
                )}
                <div className="flex gap-2">
                  <a
                    href={selectedVersion.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded border border-zinc-700 py-1.5 text-center text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => doUpdate(selectedVersion)}
                    disabled={!!isAlreadyOnSelected || updating}
                    className="flex-1 rounded bg-emerald-700 py-1.5 text-center text-xs text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {updating ? "Updating…" : "Update modpack"}
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function pairChangelog(entries) {
  const byProject = new Map();
  entries.forEach((entry, idx) => {
    const key = entry.modrinth_project_id;
    if (!byProject.has(key)) byProject.set(key, []);
    byProject.get(key).push({ entry, idx });
  });

  const stories = [];

  for (const projectEntries of byProject.values()) {
    // Sort ascending by idx so [0] = most recent (entries are newest-first)
    const sorted = [...projectEntries].sort((a, b) => a.idx - b.idx);
    const mostRecent = sorted[0];
    const adds = sorted.filter((e) => e.entry.action === "added");
    const removes = sorted.filter((e) => e.entry.action === "removed");

    if (mostRecent.entry.action === "added") {
      const latestAdd = adds[0].entry;
      if (removes.length > 0) {
        const latestRemove = removes[0].entry;
        if (latestAdd.version_number !== latestRemove.version_number) {
          // Real version change — show as Updated
          stories.push({ anchorIdx: sorted[0].idx, item: { type: "pair", added: latestAdd, removed: latestRemove } });
        } else {
          // Same-version round-trip (e.g. fix-mods no-op) — show original add only
          const originalAdd = adds[adds.length - 1];
          stories.push({ anchorIdx: originalAdd.idx, item: { type: "single", entry: originalAdd.entry } });
        }
      } else {
        stories.push({ anchorIdx: sorted[0].idx, item: { type: "single", entry: latestAdd } });
      }
    } else {
      // Most recent action is "removed" — mod is currently out of the pack
      stories.push({ anchorIdx: sorted[0].idx, item: { type: "single", entry: mostRecent.entry } });
    }
  }

  stories.sort((a, b) => a.anchorIdx - b.anchorIdx);
  return stories.map((s) => s.item);
}

function ChangelogRow({ entry }) {
  const added = entry.action === "added";
  const date = new Date(entry.created_at);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {entry.mod_icon_url ? (
        <img
          src={entry.mod_icon_url}
          alt=""
          className="h-8 w-8 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ${modColor(entry.mod_name)}`}
        >
          {entry.mod_name[0].toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-200">{entry.mod_name}</p>
        <div className="mt-0.5 space-y-0.5">
          {entry.version_number && (
            <p className="truncate font-mono text-xs text-zinc-500">
              {entry.version_number}
            </p>
          )}
          <p className="text-xs text-zinc-600">{dateStr}</p>
        </div>
      </div>
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
          added
            ? "bg-emerald-950 text-emerald-400 border border-emerald-900/60"
            : "bg-red-950 text-red-400 border border-red-900/60"
        }`}
      >
        {added ? "Added" : "Removed"}
      </span>
    </div>
  );
}

function ChangelogUpdateRow({ added, removed }) {
  const dateStr = new Date(added.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {added.mod_icon_url ? (
        <img src={added.mod_icon_url} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
      ) : (
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ${modColor(added.mod_name)}`}>
          {added.mod_name[0].toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-200">{added.mod_name}</p>
        <div className="mt-0.5 space-y-0.5">
          {added.version_number && (
            <p className="truncate font-mono text-xs text-emerald-400">{added.version_number}</p>
          )}
          {removed.version_number && (
            <p className="truncate font-mono text-xs text-red-400/70 line-through decoration-red-500/30">
              {removed.version_number}
            </p>
          )}
          <p className="text-xs text-zinc-600">{dateStr}</p>
        </div>
      </div>
      <span className="shrink-0 rounded border border-blue-900/60 bg-blue-950 px-1.5 py-0.5 text-xs font-medium text-blue-400">
        Updated
      </span>
    </div>
  );
}

export default function ModpackBuilder() {
  const { code } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showAddMods, setShowAddMods] = useState(false);
  const [missingDeps, setMissingDeps] = useState([]);
  const [depsShowing, setDepsShowing] = useState(false);
  const { toasts, add: addToasts } = useModToasts();
  const [versionToasts, setVersionToasts] = useState([]);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncCode, setSyncCode] = useState("");
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [needsRelink, setNeedsRelink] = useState(false);
  const lastCompatibleVersion = useRef(null);
  const lastCompatibleLoader = useRef(null);
  const [showFailedMods, setShowFailedMods] = useState(false);
  const [fixStatus, setFixStatus] = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogFilter, setChangelogFilter] = useState("all");
  const [changelogPage, setChangelogPage] = useState(1);
  const changelogScrollRef = useRef(null);
  const changelogSentinelRef = useRef(null);
  const leftColumnRef = useRef(null);
  const [tableHeight, setTableHeight] = useState(0);
  const [descriptionValue, setDescriptionValue] = useState("");
  const settingsRef = useRef(null);


  function addVersionToast({
    name,
    icon_url,
    old_filename,
    new_filename,
    download_url,
  }) {
    const item = {
      id: crypto.randomUUID(),
      name,
      icon_url: icon_url ?? null,
      old_filename,
      new_filename,
      download_url,
      fading: false,
    };
    setVersionToasts((prev) => [...prev, item]);
  }

  function dismissVersionToast(id) {
    setVersionToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, fading: true } : t)),
    );
    setTimeout(
      () => setVersionToasts((prev) => prev.filter((t) => t.id !== id)),
      350,
    );
  }

  const hasDeps = missingDeps.length > 0;
  useEffect(() => {
    if (!hasDeps) return;
    let raf1 = requestAnimationFrame(() => {
      let raf2 = requestAnimationFrame(() => setDepsShowing(true));
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, [hasDeps]);

  function dismissDeps() {
    setDepsShowing(false);
    setTimeout(() => setMissingDeps([]), 300);
  }

  useEffect(() => {
    function handleClick(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
        setDeleteConfirming(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (settingsOpen && modpack) setDescriptionValue(modpack.description ?? "");
  }, [settingsOpen]);

  const {
    data: modpack,
    isPlaceholderData,
    isPending,
  } = useQuery({
    queryKey: ["modpack", code],
    queryFn: () => getModpackByCode(code),
    placeholderData: () => {
      const list = queryClient.getQueryData(["modpacks"]);
      const summary = list?.find((m) => m.share_code === code);
      return summary ? { ...summary, mods: [] } : undefined;
    },
  });

  const { data: changelog = [] } = useQuery({
    queryKey: ["modpack-changelog", modpack?.id],
    queryFn: () => getModpackChangelog(modpack.id),
    enabled: showChangelog && !!modpack && !modpack.source_share_code,
  });

  const { data: sourceChangelog = [] } = useQuery({
    queryKey: ["source-changelog", modpack?.source_share_code],
    queryFn: () => getSharedModpackChangelog(modpack.source_share_code),
    enabled: !!modpack?.source_share_code,
  });

  useEffect(() => {
    if (modpack && lastCompatibleVersion.current === null) {
      lastCompatibleVersion.current = modpack.game_version;
      lastCompatibleLoader.current = modpack.loader;
    }
  }, [modpack]);

  const seenIds = new Set();
  const dedupedChangelog = changelog.filter((e) => {
    if (seenIds.has(e.id)) return false;
    seenIds.add(e.id);
    return true;
  });
  const allPaired = pairChangelog(dedupedChangelog);
  const filteredPaired =
    changelogFilter === "all"
      ? allPaired
      : changelogFilter === "updated"
      ? allPaired.filter((item) => item.type === "pair")
      : allPaired.filter((item) => item.type === "single" && item.entry.action === changelogFilter);
  const visiblePaired = filteredPaired.slice(0, changelogPage * 20);
  const hasMoreChangelog = visiblePaired.length < filteredPaired.length;

  useEffect(() => {
    if (!hasMoreChangelog || !changelogSentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setChangelogPage((p) => p + 1);
      },
      { root: changelogScrollRef.current, threshold: 0 },
    );
    observer.observe(changelogSentinelRef.current);
    return () => observer.disconnect();
  }, [hasMoreChangelog, changelogPage]);

  useEffect(() => {
    if (!leftColumnRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const h = Math.round(entry.contentRect.height);
      setTableHeight((prev) => (prev === h ? prev : h));
    });
    observer.observe(leftColumnRef.current);
    return () => observer.disconnect();
  }, []);

  const { mutate: saveModpack } = useMutation({
    mutationFn: (input) => updateModpack(modpack.id, input),
    onMutate: (input) => {
      queryClient.setQueryData(["modpack", code], (old) => ({
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
    mutationFn: () => deleteModpack(modpack.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modpacks"] });
      navigate("/modpacks");
    },
  });

  const { mutate: doFixMods, isPending: fixing } = useMutation({
    mutationFn: async () => {
      const mods = modpack.mods;
      const results = await Promise.allSettled(
        mods.map(async (mod) => {
          const ver = await getLatestVersion(
            mod.modrinth_project_id,
            modpack.game_version,
            modpack.loader,
          );
          await removeMod(modpack.id, mod.id);
          await addMod(modpack.id, {
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
        .map((m) => ({
          id: m.id,
          name: m.name,
          modrinth_project_id: m.modrinth_project_id,
          icon_url: m.icon_url,
        }));
      return { total: mods.length, failed: failedMods.length, failedMods };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["modpack", code] });
      queryClient.invalidateQueries({ queryKey: ["modpack-changelog", modpack.id] });
      setFixStatus({ done: true, ...result });
      lastCompatibleVersion.current = modpack.game_version;
      lastCompatibleLoader.current = modpack.loader;
    },
  });

  const { mutate: removeFailedMod } = useMutation({
    mutationFn: (modId) => removeMod(modpack.id, modId),
    onSuccess: (_, modId) => {
      queryClient.invalidateQueries({ queryKey: ["modpack", code] });
      queryClient.invalidateQueries({ queryKey: ["modpack-changelog", modpack.id] });
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

  const { mutate: addAllDeps, isPending: addingDeps } = useMutation({
    mutationFn: async (deps) => {
      const result = await addModsBulk(
        modpack.id,
        deps.map((dep) => ({
          modrinth_project_id: dep.project_id,
          name: dep.name,
          side: "both",
          icon_url: dep.icon_url ?? null,
          categories: dep.categories ?? [],
        })),
      );
      return result.missing_dependencies;
    },
    onMutate: (deps) => {
      const previousData = queryClient.getQueryData(["modpack", code]);
      queryClient.setQueryData(["modpack", code], (old) => {
        if (!old) return old;
        const tempMods = deps.map((dep) => ({
          id: `temp-${dep.project_id}`,
          modrinth_project_id: dep.project_id,
          version_id: "",
          name: dep.name,
          side: "both",
          icon_url: dep.icon_url ?? null,
          version_number: null,
          version_type: null,
          filename: null,
          categories: dep.categories ?? [],
        }));
        return { ...old, mods: [...old.mods, ...tempMods] };
      });
      dismissDeps();
      addToasts(
        deps.map((d) => ({ name: d.name, icon_url: d.icon_url ?? null })),
      );
      return { previousData };
    },
    onSuccess: (newMissing) => {
      queryClient.invalidateQueries({ queryKey: ["modpack", code] });
      setMissingDeps(newMissing);
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousData)
        queryClient.setQueryData(["modpack", code], ctx.previousData);
    },
  });

  const [exportSkipped, setExportSkipped] = useState([]);

  const { mutate: doExport, isPending: exporting } = useMutation({
    mutationFn: () => exportModpack(modpack.id),
    onSuccess: ({ blob, skipped }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${modpack.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      if (skipped) {
        const names = skipped.split(",").map((s) => s.trim()).filter(Boolean);
        if (names.length) setExportSkipped(names);
      }
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
  const failedProjectIds = fixStatus?.failedMods.length
    ? new Set(fixStatus.failedMods.map((m) => m.modrinth_project_id))
    : undefined;

  function handleCopy() {
    navigator.clipboard.writeText(modpack.share_code);
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Modpack icon */}
          <ModpackIconWidget modpack={modpack} onSave={saveModpack} />

          {/* Name + meta */}
          <div className="pt-0.5">
            <div className="flex items-center gap-2">
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
                  className="text-2xl font-bold leading-none cursor-text hover:text-zinc-300 transition-colors"
                  onClick={() => {
                    setNameValue(modpack.name);
                    setNameEditing(true);
                  }}
                  title="Click to rename"
                >
                  {modpack.name}
                </h1>
              )}
              <div className="relative mt-1" ref={settingsRef}>
                <button
                  onClick={() => setSettingsOpen((v) => !v)}
                  className={`rounded p-1 transition-colors ${
                    settingsOpen
                      ? "text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-300"
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
                  <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/50">
                    <div className="border-b border-zinc-800 px-4 py-3">
                      <p className="text-sm font-semibold text-white">
                        Settings
                      </p>
                    </div>

                    {/* Version & Loader */}
                    <div className="space-y-3 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Version &amp; Loader
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-xs text-zinc-500">
                          Version
                        </span>
                        <select
                          value={modpack.game_version}
                          onChange={(e) => {
                            const newVersion = e.target.value;
                            saveModpack({ game_version: newVersion });
                            setFixStatus(null);
                            if (modpack.mods.length > 0) {
                              const alreadyCompatible =
                                newVersion === lastCompatibleVersion.current &&
                                modpack.loader === lastCompatibleLoader.current;
                              setNeedsRelink(!alreadyCompatible);
                            }
                          }}
                          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-600"
                        >
                          {MC_VERSIONS.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-xs text-zinc-500">
                          Loader
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {LOADERS.map((l) => (
                            <button
                              key={l}
                              onClick={() => {
                                saveModpack({ loader: l });
                                setFixStatus(null);
                                if (modpack.mods.length > 0) {
                                  const alreadyCompatible =
                                    modpack.game_version ===
                                      lastCompatibleVersion.current &&
                                    l === lastCompatibleLoader.current;
                                  setNeedsRelink(!alreadyCompatible);
                                }
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
                    <div className="space-y-2 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Description
                      </p>
                      <div className="relative">
                        <textarea
                          value={descriptionValue}
                          onChange={(e) =>
                            setDescriptionValue(e.target.value.slice(0, 150))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                          }}
                          onBlur={() => {
                            const trimmed = descriptionValue.trim();
                            const current = modpack.description ?? "";
                            if (trimmed !== current)
                              saveModpack({ description: trimmed || null });
                          }}
                          placeholder="Add a description…"
                          rows={3}
                          className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-600"
                        />
                        <span className="absolute bottom-2 right-2 text-xs text-zinc-600">
                          {descriptionValue.length}/150
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-zinc-800" />
                    <div className="p-4">
                      <button
                        onClick={() => {
                          setShowChangelog((v) => !v);
                          setSettingsOpen(false);
                        }}
                        className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                      >
                        {showChangelog ? "Hide changelog" : "Changelog"}
                      </button>
                    </div>

                    <div className="border-t border-zinc-800" />

                    {/* Danger zone */}
                    <div className="p-4">
                      {deleteConfirming ? (
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-zinc-400">
                            Delete this modpack?
                          </p>
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
            {modpack.description && (
              <p className="mt-1.5 max-w-lg text-sm text-zinc-400">
                {modpack.source_server_share_code &&
                modpack.description.startsWith("Created from ") ? (
                  <>
                    Created from{" "}
                    <button
                      onClick={() =>
                        navigate(`/servers/${modpack.source_server_share_code}`)
                      }
                      className="text-zinc-300 underline decoration-zinc-600 underline-offset-2 transition-colors hover:text-white hover:decoration-zinc-400"
                    >
                      {modpack.description.slice("Created from ".length)}
                    </button>
                  </>
                ) : (
                  modpack.description
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!modpack.source_share_code && (
            <button
              onClick={() => setShowAddMods((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-[0_0_8px_rgba(16,185,129,0.2)] transition-all active:scale-95 ${
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
                  width="20"
                  height="20"
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
          <button
            onClick={() => doExport()}
            disabled={exporting || modpack.mods.length === 0}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white active:scale-95 disabled:opacity-40"
          >
            {exporting ? `Exporting ${modpack.mods.length} mod${modpack.mods.length !== 1 ? "s" : ""}…` : "Export"}
          </button>
        </div>
      </div>

      {/* Panel —" slides down, collapses up */}
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
              gameVersion={modpack.game_version}
              loader={modpack.loader}
              existingIds={existingIds}
              onClose={() => setShowAddMods(false)}
              onAdd={async (toAdd) => {
                const result = await addModsBulk(
                  modpack.id,
                  toAdd.map((hit) => ({
                    modrinth_project_id: hit.project_id,
                    name: hit.title,
                    side: deriveSide(hit),
                    icon_url: hit.icon_url ?? null,
                    categories: hit.categories ?? [],
                  })),
                );
                return { missing: result.missing_dependencies };
              }}
              onBeforeAdd={(toAdd, qc) => {
                const previousData = qc.getQueryData(["modpack", code]);
                qc.setQueryData(["modpack", code], (old) => {
                  if (!old) return old;
                  const tempMods = toAdd.map((hit) => ({
                    id: `temp-${hit.project_id}`,
                    modrinth_project_id: hit.project_id,
                    version_id: "",
                    name: hit.title,
                    side: deriveSide(hit),
                    icon_url: hit.icon_url ?? null,
                    version_number: null,
                    version_type: null,
                    filename: null,
                    categories: hit.categories ?? [],
                  }));
                  return { ...old, mods: [...old.mods, ...tempMods] };
                });
                addToasts(toAdd.map((h) => ({ name: h.title, icon_url: h.icon_url ?? null })));
                return { previousData };
              }}
              onAddSuccess={({ missing }, qc) => {
                qc.invalidateQueries({ queryKey: ["modpack", code] });
                qc.invalidateQueries({ queryKey: ["modpack-changelog", modpack.id] });
                setMissingDeps(missing);
              }}
              onAddError={(_err, _vars, ctx, qc) => {
                if (ctx?.previousData) qc.setQueryData(["modpack", code], ctx.previousData);
              }}
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
            onClick={() => {
              setNeedsRelink(false);
              setFixStatus(null);
              setShowFailedMods(false);
            }}
            className="shrink-0 text-amber-700 transition-colors hover:text-amber-400"
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

      {/* Failed mods panel */}
      {showFailedMods &&
        fixStatus?.failedMods &&
        fixStatus.failedMods.length > 0 && (
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

      {/* Missing dependency banner */}
      {missingDeps.length > 0 && (
        <div
          className={`overflow-hidden transition-all duration-300 ${depsShowing ? "max-h-24 opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="mt-2 mb-3 flex items-center gap-3 rounded-lg border border-amber-900/30 bg-amber-950/15 px-4 py-2.5">
            <p className="flex-1 text-xs text-amber-300">
              Missing required{" "}
              {missingDeps.length === 1 ? "dependency" : "dependencies"}:{" "}
              <span className="font-medium">
                {missingDeps.map((d) => d.name).join(", ")}
              </span>
            </p>
            <button
              onClick={() => addAllDeps(missingDeps)}
              disabled={addingDeps}
              className="shrink-0 rounded-md border border-amber-800/50 bg-amber-950/60 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-900/50 active:scale-95 disabled:opacity-40"
            >
              {addingDeps
                ? "Adding…"
                : `Add ${missingDeps.length} ${missingDeps.length === 1 ? "dependency" : "dependencies"}`}
            </button>
            <button
              onClick={dismissDeps}
              className="shrink-0 text-amber-700 transition-colors hover:text-amber-400"
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
        </div>
      )}

      {/* Table + Changelog side by side */}
      <div className={`flex items-start gap-4 ${showAddMods ? "mt-4" : ""}`}>
        <div ref={leftColumnRef} className="min-w-0 flex-1" style={{ isolation: 'isolate' }}>
          <ModTable
            mods={modpack.mods}
            readOnly={!!modpack.source_share_code}
            loading={isPlaceholderData}
            cacheKey={code}
            failedProjectIds={failedProjectIds}
            onRemoveMods={(ids) =>
              Promise.all([...ids].map((id) => removeMod(modpack.id, id))).then(() => {
                queryClient.invalidateQueries({ queryKey: ["modpack", code] });
                queryClient.invalidateQueries({ queryKey: ["modpack-changelog", modpack.id] });
              })
            }
            renderVersionCell={(mod) => (
              <VersionPickerPopover
                mod={mod}
                modpackId={modpack.id}
                cacheKey={code}
                readOnly={!!modpack.source_share_code}
                addVersionToast={addVersionToast}
              />
            )}
          />

          {/* Source changelog —" synced modpacks only, below the table */}
          {modpack.source_share_code && (
            <div className="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              <div className="border-b border-zinc-800 px-4 py-3">
                <p className="text-sm font-semibold text-white">
                  Source changelog
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Changes made to the original pack
                </p>
              </div>
              {sourceChangelog.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-600">
                  No changes recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-zinc-800/60">
                  {sourceChangelog.map((entry) => (
                    <ChangelogRow key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Changelog panel — owner only, slides in from right */}
        {!modpack.source_share_code && (
          <div
            style={{
              width: showChangelog ? 288 : 0,
              flexShrink: 0,
              overflow: "hidden",
              transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <div
              style={{
                width: 288,
                transform: showChangelog ? "translateX(0)" : "translateX(100%)",
                transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <div
                className="flex flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900"
                style={{ height: tableHeight || undefined }}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
                  <p className="text-sm font-semibold text-white">Changelog</p>
                  <div className="flex items-center gap-2">
                    {/* Filter — cycles All → + → − → Updated */}
                    {(() => {
                      const FILTERS = [
                        { val: "all",     label: "All",     cls: "border-zinc-700 bg-zinc-800 text-zinc-300" },
                        { val: "added",   label: "Added",   cls: "border-emerald-900/60 bg-emerald-950 text-emerald-400" },
                        { val: "removed", label: "Removed", cls: "border-red-900/60 bg-red-950 text-red-400" },
                        { val: "updated", label: "Updated", cls: "border-blue-900/60 bg-blue-950 text-blue-400" },
                      ];
                      const idx = FILTERS.findIndex((f) => f.val === changelogFilter);
                      const current = FILTERS[idx];
                      const next = FILTERS[(idx + 1) % FILTERS.length];
                      return (
                        <button
                          onClick={() => { setChangelogFilter(next.val); setChangelogPage(1); }}
                          className={`w-16 rounded border py-1 text-center text-[11px] font-medium transition-colors ${current.cls}`}
                        >
                          {current.label}
                        </button>
                      );
                    })()}
                    {/* Close */}
                    <button
                      onClick={() => setShowChangelog(false)}
                      className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M12 4L4 12M4 4l8 8"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Scrollable list */}
                <div
                  ref={changelogScrollRef}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-zinc-800/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {filteredPaired.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-zinc-600">
                      No changes recorded yet.
                    </p>
                  ) : (
                    <>
                      {visiblePaired.map((item) =>
                        item.type === "pair" ? (
                          <ChangelogUpdateRow
                            key={`${item.added.id}-${item.removed.id}`}
                            added={item.added}
                            removed={item.removed}
                          />
                        ) : (
                          <ChangelogRow key={item.entry.id} entry={item.entry} />
                        )
                      )}
                      {hasMoreChangelog && (
                        <div
                          ref={changelogSentinelRef}
                          className="py-3 text-center text-xs text-zinc-700"
                        >
                          Loading…
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {exportSkipped.length > 0 && (
        <div className="fixed bottom-6 left-6 z-50 w-72 rounded-lg border border-amber-800/60 bg-amber-950/90 px-4 py-3 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-amber-300">
              {exportSkipped.length} mod{exportSkipped.length !== 1 ? "s" : ""} couldn't be downloaded
            </p>
            <button
              onClick={() => setExportSkipped([])}
              className="shrink-0 text-amber-600 transition-colors hover:text-amber-400"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {exportSkipped.map((name) => (
              <li key={name} className="truncate text-xs text-amber-400/80">{name}</li>
            ))}
          </ul>
        </div>
      )}
      {versionToasts.length > 0 && (
        <div className="pointer-events-auto fixed right-6 top-6 z-50 flex flex-col items-end">
          {versionToasts.map((t) => (
            <VersionToast
              key={t.id}
              toast={t}
              onDismiss={() => dismissVersionToast(t.id)}
            />
          ))}
        </div>
      )}
      <ModToastsPortal toasts={toasts} />
    </div>
  );
}
