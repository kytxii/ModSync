import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { uploadMods, importModlist, getSide, type AnalyzerResponse, type ModResult } from '../api/analyzer'

type Mode = 'upload' | 'prism'

const PAGE_SIZE = 20

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / PAGE_SIZE)
  if (pages <= 1) return <span className="text-xs text-zinc-600">{total} total</span>
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(page - 1)} disabled={page === 0}
        className="text-xs text-zinc-500 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30">←</button>
      <span className="text-xs text-zinc-500">{page + 1} / {pages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page >= pages - 1}
        className="text-xs text-zinc-500 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30">→</button>
    </div>
  )
}

function ResultsPanels({ data }: { data: AnalyzerResponse }) {
  const [foundPage, setFoundPage] = useState(0)
  const [unknownPage, setUnknownPage] = useState(0)

  const found = data.results.filter((r) => r.found)
  const unknown = data.results.filter((r) => !r.found)
  const foundSlice = found.slice(foundPage * PAGE_SIZE, (foundPage + 1) * PAGE_SIZE)
  const unknownSlice = unknown.slice(unknownPage * PAGE_SIZE, (unknownPage + 1) * PAGE_SIZE)

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Found */}
      <div className="col-span-2 flex flex-col">
        <div className="mb-2 flex flex-shrink-0 items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-500">Found ({found.length})</p>
          <Pagination page={foundPage} total={found.length} onChange={setFoundPage} />
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-800 pb-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-1.5">Mod</th>
                <th className="px-4 py-2.5">Version</th>
                <th className="px-4 py-2.5">Loader</th>
                <th className="px-4 py-1.5">Side</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {foundSlice.map((r: ModResult) => (
                <tr key={r.sha512 || r.filename} className="bg-zinc-950 transition-colors hover:bg-zinc-900/60">
                  <td className="px-4 py-1 font-medium text-white">{r.project_name ?? r.filename}</td>
                  <td className="px-4 py-1 text-zinc-400">{r.version_number ?? '—'}</td>
                  <td className="px-4 py-2 capitalize text-zinc-400">{r.loaders.join(', ') || '—'}</td>
                  <td className="px-4 py-1 text-zinc-400">{getSide(r)}</td>
                </tr>
              ))}
              {found.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-600">No mods identified</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unknown */}
      <div className="flex flex-col">
        <div className="mb-2 flex flex-shrink-0 items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Unknown ({unknown.length})</p>
          <Pagination page={unknownPage} total={unknown.length} onChange={setUnknownPage} />
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-800 pb-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-1.5">Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {unknownSlice.map((r: ModResult) => (
                <tr key={r.filename} className="bg-zinc-950">
                  <td className="px-4 py-1 text-zinc-500">{r.filename}</td>
                </tr>
              ))}
              {unknown.length === 0 && (
                <tr><td className="px-4 py-8 text-center text-sm text-zinc-600">All mods identified</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function Analyzer() {
  const [mode, setMode] = useState<Mode>('upload')
  const [files, setFiles] = useState<File[]>([])
  const [json, setJson] = useState('')
  const [dragging, setDragging] = useState(false)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (folderInputRef.current) folderInputRef.current.setAttribute('webkitdirectory', '')
  }, [])

  const { mutate, data, isPending, error, reset } = useMutation({
    mutationFn: () =>
      mode === 'upload' ? uploadMods(files) : importModlist(JSON.parse(json)),
  })

  function addFiles(incoming: FileList | File[]) {
    const jars = Array.from(incoming).filter((f) => f.name.endsWith('.jar'))
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      return [...prev, ...jars.filter((f) => !existing.has(f.name))]
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  function switchMode(m: Mode) {
    setMode(m)
    reset()
    setFiles([])
    setJson('')
  }

  const canAnalyze = mode === 'upload' ? files.length > 0 : json.trim().length > 0

  return (
    <div className="flex flex-col">

      {/* ── Input section (always visible, compact) ── */}
      <div className="flex-shrink-0">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-xl font-bold">Mod Analyzer</h1>
            <p className="mt-0.5 text-xs text-zinc-500">Identify mods and check compatibility via Modrinth.</p>
          </div>

          {/* Stats inline when results exist */}
          {data && (
            <div className="flex items-center gap-5 text-sm text-zinc-400">
              <span>Total <span className="ml-1 font-semibold text-white">{data.total}</span></span>
              <span>Found <span className="ml-1 font-semibold text-emerald-400">{data.found}</span></span>
              <span>Unknown <span className="ml-1 font-semibold text-zinc-500">{data.unknown}</span></span>
            </div>
          )}
        </div>

        {/* Mode toggle + Analyze button on same row */}
        <div className="mt-3 flex items-center justify-between">
          <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-1">
            {([
              { id: 'upload' as Mode, label: 'Upload files' },
              { id: 'prism' as Mode, label: 'Prism Launcher JSON' },
            ]).map(({ id, label }) => (
              <button key={id} onClick={() => switchMode(id)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-150 ${
                  mode === id ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-white'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => mutate()}
            disabled={isPending || !canAnalyze}
            className="rounded-md bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition-all duration-150 hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>

        {/* Upload drop zone */}
        {mode === 'upload' && (
          <div className="mt-3">
            <input ref={folderInputRef} type="file" multiple className="hidden"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => folderInputRef.current?.click()}
              className={`flex h-16 cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed px-5 transition-colors duration-200 ${
                dragging ? 'border-emerald-500 bg-emerald-950/20' : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-zinc-500">
                <path d="M3 7a2 2 0 0 1 2-2h3.5L10 7h9a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <path d="M12 12v4m0-4-1.5 1.5M12 12l1.5 1.5"/>
              </svg>
              {files.length === 0 ? (
                <p className="text-sm text-zinc-400">
                  Drop your mods folder or <span className="text-emerald-400 underline underline-offset-2">click to browse</span>
                </p>
              ) : (
                <p className="text-sm text-white">
                  <span className="font-semibold text-emerald-400">{files.length}</span> .jar files selected
                </p>
              )}
              {files.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFiles([]) }}
                  className="ml-auto text-xs text-zinc-600 transition-colors hover:text-red-400"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Prism JSON textarea */}
        {mode === 'prism' && (
          <div className="mt-3">
            <textarea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder={'[\n  { "name": "Sodium", "url": "https://modrinth.com/mod/AANobbMI", "version": "0.5.13+mc1.20.1" }\n]'}
              rows={3}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-mono text-sm text-zinc-300 placeholder-zinc-700 outline-none transition-colors focus:border-emerald-600"
            />
          </div>
        )}

        {error && (
          <p className="mt-2 text-sm text-red-400">
            {error instanceof Error ? error.message : 'Something went wrong'}
          </p>
        )}
      </div>

      {/* ── Results panels (fill remaining height) ── */}
      {data && (
        <div className="mt-4">
          <ResultsPanels data={data} />
        </div>
      )}
    </div>
  )
}
