import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  uploadMods,
  importModlist,
  getSide,
  createModpackFromAnalysis,
} from "../api/analyzer";
import SideBadge from "../components/SideBadge";
import { useAnalyzer } from "../context/AnalyzerContext";

const SYMBOLS = ["·","✢","✣","✤","✥","✦","✧","✩","✦","✥","✤","✣","✢","·"];
const PHRASES = [
  "Hashing your jars…",
  "Asking Modrinth nicely…",
  "Counting the mods…",
  "Cross-referencing the modverse…",
  "Consulting the mod oracle…",
  "Bribing the Modrinth API…",
  "Decoding jar manifests…",
  "Checking for sneaky updates…",
  "Dusting off your mod list…",
  "Negotiating with the cloud…",
  "Running the vibe check…",
  "Poking the backend with a stick…",
  "Waking up the hash function…",
  "Almost there, probably…",
];

const PAGE_SIZE = 10;
const MOD_COLORS = [
  "bg-emerald-700",
  "bg-blue-700",
  "bg-violet-700",
  "bg-orange-700",
  "bg-pink-700",
  "bg-teal-700",
];
function modColor(name) {
  return MOD_COLORS[name.charCodeAt(0) % MOD_COLORS.length];
}

const SORT_KEYS = {
  mod: (r) => (r.project_name ?? r.filename).toLowerCase(),
  version: (r) => r.version_number ?? "",
  side: (r) => getSide(r),
  status: (r) => (r.found ? 0 : 1),
};

function SortIcon({ active, dir }) {
  if (!active) return <span className="ml-1 text-zinc-700">↕</span>;
  return (
    <span className="ml-1 text-emerald-400">{dir === "asc" ? "↑" : "↓"}</span>
  );
}

function ResultsTable({ data }) {
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
    setPage(1);
  }

  const sorted = sortCol
    ? [...data.results].sort((a, b) => {
        const va = SORT_KEYS[sortCol](a);
        const vb = SORT_KEYS[sortCol](b);
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : data.results;

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageResults = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const thClass =
    "px-4 py-2 cursor-pointer select-none transition-colors hover:text-zinc-300";

  return (
    <div className="mt-6">
      {/* Summary + pagination toolbar */}
      <div className="mb-2 flex flex-wrap gap-y-2 items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">
            Total{" "}
            <span className="ml-1 font-semibold text-white">{data.total}</span>
          </span>
          <span className="text-sm text-zinc-400">
            Found{" "}
            <span className="ml-1 font-semibold text-emerald-400">
              {data.found}
            </span>
          </span>
          <span className="text-sm text-zinc-400">
            Unknown{" "}
            <span className="ml-1 font-semibold text-zinc-500">
              {data.unknown}
            </span>
          </span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center justify-center leading-none rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-30"
            >
              ←
            </button>
            <span className="px-1 text-xs text-zinc-500">
              {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
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
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[580px] text-sm">
            <colgroup>
              <col className="w-[45%]" />
              <col className="w-[25%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                <th className={thClass} onClick={() => handleSort("mod")}>
                  Mod <SortIcon active={sortCol === "mod"} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => handleSort("version")}>
                  Version{" "}
                  <SortIcon active={sortCol === "version"} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => handleSort("side")}>
                  Side <SortIcon active={sortCol === "side"} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => handleSort("status")}>
                  Status{" "}
                  <SortIcon active={sortCol === "status"} dir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {pageResults.map((r) => {
                const displayName = r.project_name ?? r.filename;
                const side = getSide(r);
                return (
                  <tr
                    key={r.sha512 || r.filename}
                    className="bg-zinc-950 transition-colors hover:bg-zinc-900/60"
                  >
                    {/* Mod */}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        {r.icon_url ? (
                          <img
                            src={r.icon_url}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ${modColor(displayName)}`}
                          >
                            {displayName[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate font-medium text-white">
                              {displayName}
                            </p>
                            {r.project_id && (
                              <a
                                href={`https://modrinth.com/mod/${r.project_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-zinc-600 transition-colors hover:text-emerald-400"
                                title="View on Modrinth"
                                onClick={(e) => e.stopPropagation()}
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
                            )}
                          </div>
                          {r.project_name && (
                            <p className="truncate font-mono text-xs text-zinc-600">
                              {r.filename}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Version */}
                    <td className="px-4 py-1.5">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`text-xs ${r.update_available ? "text-zinc-600 line-through" : "text-zinc-400"}`}
                        >
                          {r.version_number ?? "—"}
                        </span>
                        {r.update_available && r.latest_version && (
                          <span className="inline-flex items-center gap-1 text-xs text-orange-400">
                            <svg
                              width="8"
                              height="8"
                              viewBox="0 0 10 10"
                              fill="currentColor"
                            >
                              <polygon points="5,0 10,10 0,10" />
                            </svg>
                            {r.latest_version}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Side */}
                    <td className="px-4 py-1.5">
                      {r.found ? (
                        <SideBadge
                          side={
                            side === "Client only"
                              ? "client"
                              : side === "Server only"
                                ? "server"
                                : "both"
                          }
                        />
                      ) : (
                        <span className="text-xs text-zinc-700">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-1.5">
                      {r.found ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Found
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                          Unknown
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Analyzer() {
  const {
    results,
    setResults,
    uploadedCount,
    setUploadedCount,
    inputCollapsed,
    setInputCollapsed,
  } = useAnalyzer();
  const [mode, setMode] = useState("upload");
  const [files, setFiles] = useState([]);
  const [json, setJson] = useState("");
  const [dragging, setDragging] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState({
    name: "",
    game_version: "",
    loader: "",
  });
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const analyzeButtonRef = useRef(null);
  const [buttonWidth, setButtonWidth] = useState(null);
  const navigate = useNavigate();

  function collapse(val) {
    setInputCollapsed(val);
  }

  const { mutate, isPending, error, reset } = useMutation({
    mutationFn: () => {
      if (mode === "upload") return uploadMods(files);
      let parsed;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error("Invalid JSON — could not parse.");
      }
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array of mod objects.");
      const invalid = parsed
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => !m.filename || !m.name || !m.url || !m.version)
        .map(({ m, i }) => m.name || `entry #${i + 1}`);
      if (invalid.length) {
        const preview = invalid.slice(0, 3).join(", ");
        throw new Error(
          `Missing required fields (filename, name, url, version): ${preview}${invalid.length > 3 ? ` +${invalid.length - 3} more` : ""}`
        );
      }
      return importModlist(parsed);
    },
    onSuccess: (data) => {
      setResults(data);
      setUploadedCount(data.total);
      collapse(true);
    },
    onSettled: () => setButtonWidth(null),
  });

  const {
    mutate: saveModpack,
    isPending: isSaving,
    error: saveError,
  } = useMutation({
    mutationFn: () => {
      const foundMods = results.results
        .filter((r) => r.found && r.project_id && r.version_id)
        .map((r) => ({
          modrinth_project_id: r.project_id,
          version_id: r.version_id,
          name: r.project_name ?? r.filename,
          side:
            getSide(r) === "Client only"
              ? "client"
              : getSide(r) === "Server only"
                ? "server"
                : "both",
          icon_url: r.icon_url ?? null,
          version_number: r.version_number ?? null,
          filename: r.filename ?? null,
          categories: r.categories ?? [],
        }));
      return createModpackFromAnalysis({ ...saveForm, mods: foundMods });
    },
    onSuccess: (res) => {
      setShowSaveModal(false);
      navigate(`/modpacks/${res.share_code}`);
    },
  });

  function openSaveModal() {
    const freq = {};
    results.results
      .filter((r) => r.found)
      .forEach((r) => {
        (r.game_versions ?? []).forEach((v) => {
          freq[v] = (freq[v] || 0) + 1;
        });
      });
    const mostCommon =
      Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    setSaveForm((f) => ({ ...f, game_version: mostCommon }));
    setShowSaveModal(true);
  }

  useEffect(() => {
    localStorage.removeItem("analyzer_results");
    localStorage.removeItem("analyzer_count");
    localStorage.removeItem("analyzer_collapsed");
  }, []);

  const [dots, setDots] = useState(".");
  const [symbolIdx, setSymbolIdx] = useState(0);
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    if (!isPending) {
      setDots(".");
      return;
    }
    setPhraseIdx(Math.floor(Math.random() * PHRASES.length));
    const dotsInt = setInterval(
      () => setDots((d) => (d.length >= 3 ? "." : d + ".")),
      400,
    );
    const symInt = setInterval(
      () => setSymbolIdx((i) => (i + 1) % SYMBOLS.length),
      100,
    );
    return () => {
      clearInterval(dotsInt);
      clearInterval(symInt);
    };
  }, [isPending]);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.endsWith(".jar"),
    );
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...dropped.filter((f) => !existing.has(f.name))];
    });
  }

  function handleFileInput(e) {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files).filter((f) =>
      f.name.endsWith(".jar"),
    );
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...selected.filter((f) => !existing.has(f.name))];
    });
    e.target.value = "";
  }

  function removeFile(name) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  function switchMode(m) {
    setMode(m);
    reset();
    setResults(null);
    setUploadedCount(0);
    setFiles([]);
    setJson("");
    collapse(false);
  }

  const canAnalyze =
    mode === "upload" ? files.length > 0 : json.trim().length > 0;

  const data = results;

  const summaryLabel =
    mode === "upload" ? (
      <>
        <span className="font-medium text-white">
          {uploadedCount || files.length}
        </span>{" "}
        mod{(uploadedCount || files.length) !== 1 ? "s" : ""} uploaded
      </>
    ) : (
      "Prism JSON imported"
    );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Mod Analyzer</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Identify your mods and check compatibility.
      </p>

      {/* Collapsed bar — slides in when inputCollapsed + data */}
      <div
        className="grid transition-all duration-300 ease-out"
        style={{
          gridTemplateRows: inputCollapsed && !!data ? "1fr" : "0fr",
          opacity: inputCollapsed && !!data ? 1 : 0,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-6 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <span className="text-sm text-zinc-400">{summaryLabel}</span>
            <button
              onClick={() => collapse(false)}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
            >
              Edit upload
            </button>
          </div>
        </div>
      </div>

      {/* Expanded input section — slides out when inputCollapsed */}
      <div
        className="grid transition-all duration-300 ease-out"
        style={{
          gridTemplateRows: !inputCollapsed ? "1fr" : "0fr",
          opacity: !inputCollapsed ? 1 : 0,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div>
            {/* Hide bar — only shown when results exist */}
            {data && (
              <div className="mt-6 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <span className="text-sm text-zinc-400">{summaryLabel}</span>
                <button
                  onClick={() => collapse(true)}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                >
                  Hide
                </button>
              </div>
            )}

            {/* Mode toggle */}
            <div
              className={`${data ? "mt-3" : "mt-6"} inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-1`}
            >
              {[
                { id: "upload", label: "Upload mod files" },
                { id: "prism", label: "Prism Launcher JSON" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => switchMode(id)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${mode === id ? "bg-zinc-700 text-white shadow" : "text-zinc-400 hover:text-white"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Upload mode */}
            {mode === "upload" && (
              <div className="mt-4">
                <div className="flex overflow-hidden rounded-xl border-2 border-dashed border-zinc-700">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jar"
                    multiple
                    className="hidden"
                    onChange={handleFileInput}
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileInput}
                    webkitdirectory=""
                  />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging("files");
                    }}
                    onDragLeave={() => setDragging(null)}
                    onDrop={(e) => {
                      setDragging(null);
                      handleDrop(e);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 p-10 transition-colors ${dragging === "files" ? "bg-emerald-950/20" : "bg-zinc-900 hover:bg-zinc-800/60"}`}
                  >
                    <svg
                      className="text-zinc-500"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p className="text-sm font-medium text-zinc-300">
                      Select files
                    </p>
                    <p className="text-xs text-zinc-600">
                      or drop .jar files here
                    </p>
                  </div>

                  <div className="w-px bg-zinc-700" />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging("folder");
                    }}
                    onDragLeave={() => setDragging(null)}
                    onDrop={(e) => {
                      setDragging(null);
                      handleDrop(e);
                    }}
                    onClick={() => folderInputRef.current?.click()}
                    className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 p-10 transition-colors ${dragging === "folder" ? "bg-emerald-950/20" : "bg-zinc-900 hover:bg-zinc-800/60"}`}
                  >
                    <svg
                      className="text-zinc-500"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <p className="text-sm font-medium text-zinc-300">
                      Select folder
                    </p>
                    <p className="text-xs text-zinc-600">
                      picks all .jar files inside
                    </p>
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="scrollbar-dark mt-3 max-h-48 space-y-1.5 overflow-y-auto">
                    {files.map((f) => (
                      <div
                        key={f.name}
                        className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"
                      >
                        <span className="truncate font-mono text-xs text-zinc-300">
                          {f.name}
                        </span>
                        <button
                          onClick={() => removeFile(f.name)}
                          className="ml-3 shrink-0 text-zinc-600 transition-colors hover:text-red-400"
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
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* JSON mode */}
            {mode === "prism" && (
              <div className="mt-4">
                <textarea
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  placeholder="Paste your mod list JSON here..."
                  rows={12}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 font-mono text-sm text-zinc-300 placeholder-zinc-600 outline-none transition-colors focus:border-emerald-600"
                />
                <div className="mt-3 rounded-lg border border-dashed border-zinc-700 bg-zinc-950 px-3 py-2.5 select-none pointer-events-none">
                  <p className="mb-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Expected format</p>
                  <pre className="text-xs text-zinc-600 overflow-x-auto">{`[
  {
    "filename": "sodium-0.5.13+mc1.20.1.jar",
    "name": "Sodium",
    "url": "https://modrinth.com/mod/AANobbMI",
    "version": "0.5.13+mc1.20.1"
  },
  ...
]`}</pre>
                  <p className="mt-1.5 text-xs text-zinc-700">All four fields are required for every entry.</p>
                </div>
              </div>
            )}

            {/* Analyze button */}
            <button
              ref={analyzeButtonRef}
              onClick={() => {
                setButtonWidth(analyzeButtonRef.current?.offsetWidth ?? null);
                mutate();
              }}
              disabled={isPending || !canAnalyze}
              style={buttonWidth ? { minWidth: buttonWidth } : undefined}
              className="mt-4 rounded-md bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_8px_rgba(16,185,129,0.2)] transition-all hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending
                ? <span className="inline-flex items-center">Analyzing<span className="inline-block w-4 text-left">{dots}</span></span>
                : `Analyze${files.length > 0 ? ` ${files.length} mod${files.length !== 1 ? "s" : ""}` : ""}`}
            </button>

            {error && (
              <p className="mt-3 text-sm text-red-400">
                {error?.response?.data?.detail ??
                  error?.message ??
                  "Something went wrong"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      <div
        className="grid transition-all duration-300 ease-out"
        style={{
          gridTemplateRows: isPending ? "1fr" : "0fr",
          opacity: isPending ? 1 : 0,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-8 flex items-center gap-3">
            <span className="w-4 shrink-0 text-center font-mono text-sm leading-none text-emerald-400">
              {SYMBOLS[symbolIdx]}
            </span>
            <span className="text-sm text-zinc-500">{PHRASES[phraseIdx]}</span>
          </div>
        </div>
      </div>

      {/* Results — slides in when data arrives */}
      <div
        className="grid transition-all duration-300 ease-out"
        style={{
          gridTemplateRows: data ? "1fr" : "0fr",
          opacity: data ? 1 : 0,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          {data && (
            <>
              <ResultsTable data={data} />
              {data.found > 0 && (
                <div className="mt-4 flex items-center gap-4">
                  <button
                    onClick={openSaveModal}
                    className="rounded-md bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_8px_rgba(16,185,129,0.2)] transition-all hover:bg-emerald-400 active:scale-95"
                  >
                    Save as modpack
                  </button>
                  <p className="text-xs text-zinc-600">
                    To manage or update mods, use{" "}
                    <a
                      href="/modpacks"
                      className="text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-300"
                    >
                      Modpacks
                    </a>
                    .
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Save as modpack modal */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-white">
              Save as modpack
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {data?.found} mod{data?.found !== 1 ? "s" : ""} will be added.
              Unknown mods are excluded.
            </p>

            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Name
                </label>
                <input
                  type="text"
                  value={saveForm.name}
                  onChange={(e) =>
                    setSaveForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="My Modpack"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Game version
                </label>
                <select
                  value={saveForm.game_version}
                  onChange={(e) =>
                    setSaveForm((f) => ({ ...f, game_version: e.target.value }))
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-emerald-600"
                >
                  <option value="" disabled>
                    Select version
                  </option>
                  {[
                    ...new Set(
                      data?.results
                        .filter((r) => r.found)
                        .flatMap((r) => r.game_versions ?? []),
                    ),
                  ]
                    .sort((a, b) => {
                      const av = a.split(".").map(Number);
                      const bv = b.split(".").map(Number);
                      for (let i = 0; i < Math.max(av.length, bv.length); i++) {
                        const d = (bv[i] || 0) - (av[i] || 0);
                        if (d !== 0) return d;
                      }
                      return 0;
                    })
                    .map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Loader
                </label>
                <select
                  value={saveForm.loader}
                  onChange={(e) =>
                    setSaveForm((f) => ({ ...f, loader: e.target.value }))
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-emerald-600"
                >
                  <option value="" disabled>
                    Select loader
                  </option>
                  <option value="fabric">Fabric</option>
                  <option value="forge">Forge</option>
                  <option value="neoforge">NeoForge</option>
                  <option value="quilt">Quilt</option>
                </select>
              </div>
            </div>

            {saveError && (
              <p className="mt-3 text-xs text-red-400">
                {saveError?.response?.data?.detail ?? saveError.message}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => saveModpack()}
                disabled={
                  isSaving ||
                  !saveForm.name.trim() ||
                  !saveForm.game_version.trim() ||
                  !saveForm.loader
                }
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving ? "Creating…" : "Create modpack"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
