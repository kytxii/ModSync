import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  uploadMods,
  importPrismJson,
  getSide,
  type AnalyzerResponse,
  type ModResult,
} from "../api/analyzer";
import SideBadge from "../components/SideBadge";

type Mode = "upload" | "prism";

const PAGE_SIZE = 10;
const MOD_COLORS = ["bg-emerald-700","bg-blue-700","bg-violet-700","bg-orange-700","bg-pink-700","bg-teal-700"];
function modColor(name: string) { return MOD_COLORS[name.charCodeAt(0) % MOD_COLORS.length]; }

function ResultsTable({ data }: { data: AnalyzerResponse }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.results.length / PAGE_SIZE));
  const pageResults = data.results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="mt-8">
      {/* Summary + pagination toolbar */}
      <div className="mb-3 flex flex-wrap gap-y-3 items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">
            Total <span className="ml-1 font-semibold text-white">{data.total}</span>
          </span>
          <span className="text-sm text-zinc-400">
            Found <span className="ml-1 font-semibold text-emerald-400">{data.found}</span>
          </span>
          <span className="text-sm text-zinc-400">
            Unknown <span className="ml-1 font-semibold text-zinc-500">{data.unknown}</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {totalPages > 1 && (
            <>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-sm text-zinc-500">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.results.length)} of {data.results.length}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white disabled:opacity-40"
              >
                Next →
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[580px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-2.5">Mod</th>
              <th className="px-4 py-2.5">Version</th>
              <th className="px-4 py-2.5">Side</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="w-8 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {pageResults.map((r: ModResult) => {
              const displayName = r.project_name ?? r.filename;
              const side = getSide(r);
              return (
                <tr key={r.sha512 || r.filename} className="bg-zinc-950 transition-colors hover:bg-zinc-900/60">
                  {/* Mod */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {r.icon_url ? (
                        <img src={r.icon_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${modColor(displayName)}`}>
                          {displayName[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{displayName}</p>
                        {r.project_name && (
                          <p className="truncate font-mono text-xs text-zinc-600">{r.filename}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Version */}
                  <td className="px-4 py-2.5 text-xs text-zinc-400">
                    {r.version_number ?? "—"}
                  </td>

                  {/* Side */}
                  <td className="px-4 py-2.5">
                    {r.found ? (
                      <SideBadge side={side === "Client only" ? "client" : side === "Server only" ? "server" : side === "Both" ? "both" : "both"} />
                    ) : (
                      <span className="text-xs text-zinc-700">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-2.5">
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

                  {/* Link */}
                  <td className="px-4 py-2.5">
                    {r.project_id && (
                      <a
                        href={`https://modrinth.com/mod/${r.project_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-500 transition-colors hover:text-emerald-400"
                        title="View on Modrinth"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/>
                          <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
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
  const [mode, setMode] = useState<Mode>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [json, setJson] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutate, data, isPending, error, reset } = useMutation({
    mutationFn: () => {
      if (mode === "upload") return uploadMods(files);
      return importPrismJson(JSON.parse(json));
    },
  });

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".jar"));
    setFiles(prev => [...prev, ...dropped]);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files).filter(f => f.name.endsWith(".jar"));
    setFiles(prev => [...prev, ...selected]);
    e.target.value = "";
  }

  function removeFile(name: string) {
    setFiles(prev => prev.filter(f => f.name !== name));
  }

  function switchMode(m: Mode) {
    setMode(m);
    reset();
    setFiles([]);
    setJson("");
  }

  const canAnalyze = mode === "upload" ? files.length > 0 : json.trim().length > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Mod Analyzer</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Identify your mods and check compatibility via Modrinth.
      </p>

      {/* Mode toggle */}
      <div className="mt-6 inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-1">
        {([{ id: "upload", label: "Upload mod files" }, { id: "prism", label: "Prism Launcher JSON" }] as { id: Mode; label: string }[]).map(({ id, label }) => (
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
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-14 transition-colors ${dragging ? "border-emerald-500 bg-emerald-950/20" : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"}`}
          >
            <input ref={fileInputRef} type="file" accept=".jar" multiple className="hidden" onChange={handleFileInput} />
            <svg className="mb-3 text-zinc-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="text-sm text-zinc-400">
              Drop <span className="font-medium text-white">.jar files</span> here or{" "}
              <span className="text-emerald-400 underline underline-offset-2">browse</span>
            </p>
            <p className="mt-1 text-xs text-zinc-600">Select your entire mods folder contents</p>
          </div>

          {files.length > 0 && (
            <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
              {files.map(f => (
                <div key={f.name} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                  <span className="truncate font-mono text-xs text-zinc-300">{f.name}</span>
                  <button onClick={() => removeFile(f.name)} className="ml-3 shrink-0 text-zinc-600 transition-colors hover:text-red-400">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
            onChange={e => setJson(e.target.value)}
            placeholder="Paste your Prism Launcher export JSON here..."
            rows={12}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 font-mono text-sm text-zinc-300 placeholder-zinc-600 outline-none transition-colors focus:border-emerald-600"
          />
        </div>
      )}

      {/* Analyze button */}
      <button
        onClick={() => mutate()}
        disabled={isPending || !canAnalyze}
        className="mt-4 rounded-md bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_8px_rgba(16,185,129,0.2)] transition-all hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? "Analyzing…" : `Analyze${files.length > 0 ? ` ${files.length} mod${files.length !== 1 ? "s" : ""}` : ""}`}
      </button>

      {error && (
        <p className="mt-3 text-sm text-red-400">
          {error instanceof Error ? error.message : "Something went wrong"}
        </p>
      )}

      {data && <ResultsTable data={data} />}
    </div>
  );
}
