import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMissingDeps, resolveMissingDeps } from "../api/servers";
import { WaveLoader } from "./ModToasts";

function LoadingDots() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % 3), 500);
    return () => clearInterval(t);
  }, []);
  return <span className="inline-block w-4 text-left">{[".", "..", "..."][frame]}</span>;
}

export function useMissingDeps({ serverId, cacheKey, onToasts }) {
  const queryClient = useQueryClient();
  const [addingDeps, setAddingDeps] = useState(false);
  const [depsShowing, setDepsShowing] = useState(false);
  const [depsDismissed, setDepsDismissed] = useState(false);
  const [showDepModal, setShowDepModal] = useState(false);

  const { data: missingDeps = [] } = useQuery({
    queryKey: ["missing-deps", serverId],
    queryFn: () => getMissingDeps(serverId),
    enabled: !!serverId,
    staleTime: 0,
  });

  useEffect(() => {
    if (missingDeps.length === 0) {
      setDepsShowing(false);
      setDepsDismissed(false);
      return;
    }
    if (depsDismissed) return;
    let r1 = requestAnimationFrame(() => {
      let r2 = requestAnimationFrame(() => setDepsShowing(true));
      return () => cancelAnimationFrame(r2);
    });
    return () => cancelAnimationFrame(r1);
  }, [missingDeps.length, depsDismissed]);

  function dismissBanner() {
    setDepsShowing(false);
    setTimeout(() => setDepsDismissed(true), 300);
  }

  async function addDeps(onAdded) {
    onToasts?.(missingDeps);

    // Optimistic: push temp entries into the server cache immediately
    const snapshot = queryClient.getQueryData(["server", cacheKey]);
    queryClient.setQueryData(["server", cacheKey], (old) => {
      if (!old) return old;
      const existingIds = new Set(old.mods?.map((m) => m.modrinth_project_id) ?? []);
      const tempMods = missingDeps
        .filter((dep) => !existingIds.has(dep.project_id))
        .map((dep) => ({
          id: `temp-${dep.project_id}`,
          server_id: serverId,
          modrinth_project_id: dep.project_id,
          version_id: "",
          name: dep.name,
          side: "both",
          icon_url: dep.icon_url ?? null,
          filename: null,
          version_number: null,
          categories: [],
        }));
      return { ...old, mods: [...(old.mods ?? []), ...tempMods] };
    });

    setAddingDeps(true);
    try {
      await resolveMissingDeps(serverId);
      queryClient.invalidateQueries({ queryKey: ["server", cacheKey] });
      await queryClient.refetchQueries({ queryKey: ["missing-deps", serverId], exact: true });
      onAdded?.();
    } catch {
      if (snapshot) queryClient.setQueryData(["server", cacheKey], snapshot);
    } finally {
      setAddingDeps(false);
      setShowDepModal(false);
    }
  }

  function preflight(onNone) {
    if (missingDeps.length > 0) {
      setShowDepModal(true);
    } else {
      onNone?.();
    }
  }

  return {
    missingDeps,
    addingDeps,
    depsShowing,
    depsDismissed,
    showDepModal,
    setShowDepModal,
    dismissBanner,
    addDeps,
    preflight,
  };
}

export function DepsBanner({ deps }) {
  const { missingDeps, addingDeps, depsShowing, depsDismissed, dismissBanner, addDeps } = deps;
  if (!missingDeps.length || depsDismissed) return null;
  return (
    <div className={`overflow-hidden transition-all duration-300 ${depsShowing ? "max-h-24 opacity-100" : "max-h-0 opacity-0"}`}>
      <div className="mb-3 flex items-center gap-3 rounded-lg border border-amber-900/30 bg-amber-950/15 px-4 py-2.5">
        {addingDeps ? (
          <p className="flex-1 text-xs text-amber-300">
            Fetching versions<LoadingDots />
          </p>
        ) : (
          <p className="flex-1 text-xs text-amber-300">
            Missing required {missingDeps.length === 1 ? "dependency" : "dependencies"}:{" "}
            <span className="font-medium">{missingDeps.map((d) => d.name).join(", ")}</span>
          </p>
        )}
        <button
          onClick={() => addDeps()}
          disabled={addingDeps}
          className="shrink-0 rounded-md border border-amber-800/50 bg-amber-950/60 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-900/50 active:scale-95 disabled:opacity-40"
        >
          {addingDeps
            ? "Adding…"
            : `Add ${missingDeps.length} ${missingDeps.length === 1 ? "dependency" : "dependencies"}`}
        </button>
        {!addingDeps && (
          <button onClick={dismissBanner} className="shrink-0 text-amber-700 transition-colors hover:text-amber-400">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export function DepsModal({ deps, onAdded, onSkip }) {
  const { missingDeps, addingDeps, showDepModal, setShowDepModal, addDeps } = deps;

  function handleSkip() {
    setShowDepModal(false);
    onSkip?.();
  }

  if (!showDepModal) return null;
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => !addingDeps && handleSkip()}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl pointer-events-auto">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-xs font-bold text-red-400">
              {missingDeps.length}
            </span>
            <h2 className="text-base font-bold text-white">Missing dependencies</h2>
          </div>
          <p className="mb-4 text-sm text-zinc-400">
            These mods are required by your current mods but aren't in your list yet.
          </p>
          <div className="mb-5 max-h-48 space-y-1.5 overflow-y-auto">
            {missingDeps.map((dep) => (
              <div key={dep.project_id} className="flex items-center gap-3 rounded-lg bg-zinc-800/60 px-3 py-2">
                {dep.icon_url ? (
                  <img src={dep.icon_url} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="h-7 w-7 shrink-0 rounded-md bg-zinc-700" />
                )}
                <span className="text-sm text-white">{dep.name}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => addDeps(onAdded)}
              disabled={addingDeps}
              className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {addingDeps
                ? <WaveLoader color="white" />
                : `Add ${missingDeps.length} mod${missingDeps.length !== 1 ? "s" : ""}`}
            </button>
            <button
              onClick={handleSkip}
              disabled={addingDeps}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-40"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
