import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listModpacks, createModpack, deleteModpack, getSharedModpack, importModpack, type Modpack, type ModpackSummary } from '../api/modpacks'

const ICON_PALETTE = [
  '#059669','#10b981','#14b8a6','#06b6d4',
  '#3b82f6','#6366f1','#7c3aed','#9333ea',
  '#ec4899','#f43f5e','#ef4444','#f97316',
  '#f59e0b','#84cc16','#22c55e','#64748b',
]

function defaultIconColor(name: string): string {
  return ICON_PALETTE[name.charCodeAt(0) % ICON_PALETTE.length]
}

const LOADERS = ['fabric', 'forge', 'quilt', 'neoforge']

const MC_VERSIONS = [
  '1.21.4', '1.21.3', '1.21.1', '1.21',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.20',
  '1.19.4', '1.19.2', '1.19',
  '1.18.2', '1.18',
  '1.17.1',
  '1.16.5',
]

function ModpackAvatar({ name, icon_color, icon_letter, icon_url }: {
  name: string
  icon_color?: string | null
  icon_letter?: string | null
  icon_url?: string | null
}) {
  const color = icon_color ?? defaultIconColor(name)
  const letter = icon_letter ?? name.trim()[0]?.toUpperCase() ?? '?'
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
      {icon_url ? (
        <img src={icon_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-base font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {letter}
        </div>
      )}
    </div>
  )
}

function CreatePanel({ open, onClose, onCreated }: {
  open: boolean
  onClose: () => void
  onCreated: (id: number) => void
}) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [gameVersion, setGameVersion] = useState('1.21.1')
  const [loader, setLoader] = useState('fabric')

  useEffect(() => {
    if (open) {
      setName('')
      setGameVersion('1.21.1')
      setLoader('fabric')
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => createModpack({ name: name.trim(), game_version: gameVersion, loader }),
    onSuccess: (modpack) => {
      queryClient.invalidateQueries({ queryKey: ['modpacks'] })
      onClose()
      onCreated(modpack.id)
    },
  })

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
      {/* Name bar */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-4">
        <svg
          className="shrink-0 text-zinc-500"
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && mutate()}
          placeholder="Modpack name…"
          className="flex-1 bg-transparent text-base text-white placeholder-zinc-500 outline-none"
        />
        <button
          onClick={() => mutate()}
          disabled={isPending || !name.trim()}
          className="shrink-0 rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white shadow-[0_0_8px_rgba(16,185,129,0.2)] transition-all hover:bg-emerald-400 active:scale-95 disabled:opacity-40"
        >
          {isPending ? 'Creating…' : 'Create'}
        </button>
        <button
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Version + Loader */}
      <div className="divide-y divide-zinc-800/50">
        <div className="flex items-center gap-4 px-4 py-3">
          <span className="w-20 shrink-0 text-xs text-zinc-500">Version</span>
          <select
            value={gameVersion}
            onChange={(e) => setGameVersion(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-600"
          >
            {MC_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-4 px-4 py-3">
          <span className="w-20 shrink-0 text-xs text-zinc-500">Loader</span>
          <div className="flex flex-wrap gap-2">
            {LOADERS.map((l) => (
              <button
                key={l}
                onClick={() => setLoader(l)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-all ${
                  loader === l
                    ? 'bg-emerald-500 text-white'
                    : 'border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="px-4 pb-3 text-xs text-red-400">Something went wrong.</p>}
    </div>
  )
}

function ImportPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [isSync, setIsSync] = useState(false)
  const [preview, setPreview] = useState<Modpack | null>(null)
  const [lookupError, setLookupError] = useState(false)
  const [looking, setLooking] = useState(false)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleLookup() {
    const trimmed = code.trim()
    if (!trimmed) return
    setLooking(true)
    setLookupError(false)
    setPreview(null)
    try {
      const result = await getSharedModpack(trimmed)
      setPreview(result)
      setName(result.name)
    } catch {
      setLookupError(true)
    } finally {
      setLooking(false)
    }
  }

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => importModpack(code.trim(), name.trim(), isSync),
    onSuccess: (modpack) => {
      queryClient.invalidateQueries({ queryKey: ['modpacks'] })
      navigate(`/modpacks/${modpack.share_code}`)
    },
  })

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
      {/* Search bar */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-4">
        <svg
          className="shrink-0 text-zinc-500"
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => { setCode(e.target.value); setPreview(null); setLookupError(false) }}
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          placeholder="Paste a share code…"
          className="flex-1 bg-transparent font-mono text-base text-white placeholder-zinc-500 outline-none"
        />
        {looking && (
          <span className="shrink-0 animate-pulse text-xs text-zinc-400">Looking…</span>
        )}
        <button
          onClick={handleLookup}
          disabled={looking || !code.trim()}
          className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-1.5 text-sm text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white active:scale-95 disabled:opacity-40"
        >
          Look up
        </button>
        {preview && (
          <button
            onClick={() => mutate()}
            disabled={isPending || !name.trim()}
            className="shrink-0 rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white shadow-[0_0_8px_rgba(16,185,129,0.2)] transition-all hover:bg-emerald-400 active:scale-95 disabled:opacity-40"
          >
            {isPending ? 'Importing…' : 'Import'}
          </button>
        )}
        <button
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Error */}
      {lookupError && (
        <p className="px-4 py-3 text-sm text-red-400">
          Share code not found. Double-check and try again.
        </p>
      )}

      {/* Preview */}
      {preview && (
        <div className="divide-y divide-zinc-800/50">
          {/* Modpack info row */}
          <div className="flex items-center gap-4 px-4 py-3.5">
            <ModpackAvatar name={preview.name} icon_color={preview.icon_color} icon_letter={preview.icon_letter} icon_url={preview.icon_url} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{preview.name}</p>
              <p className="mt-0.5 text-xs capitalize text-zinc-500">
                {preview.game_version} · {preview.loader} · {preview.mods.length} mod{preview.mods.length !== 1 ? 's' : ''}
                {preview.mods.length > 0 && (
                  <span className="ml-1.5 text-zinc-700">
                    — {preview.mods.slice(0, 3).map(m => m.name).join(', ')}
                    {preview.mods.length > 3 && ` +${preview.mods.length - 3} more`}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Name + sync */}
          <div className="space-y-3 px-4 py-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Save as</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && name.trim() && mutate()}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-600"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800/40 px-3 py-2.5">
              <div
                onClick={() => setIsSync(v => !v)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${isSync ? 'bg-emerald-500' : 'bg-zinc-600'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${isSync ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <div>
                <p className="text-sm text-white">Keep in sync</p>
                <p className="text-xs text-zinc-500">Always shows the latest version of the original</p>
              </div>
            </label>
          </div>
        </div>
      )}

      {error && <p className="px-4 pb-3 text-xs text-red-400">Something went wrong.</p>}
    </div>
  )
}

function ModpackCard({ modpack, onDelete, isNew = false }: {
  modpack: ModpackSummary
  onDelete: () => void
  isNew?: boolean
}) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)

  function handleConfirmDelete() {
    setConfirming(false)
    setRemoving(true)
    setTimeout(onDelete, 180)
  }

  return (
    <div
      onClick={() => !confirming && navigate(`/modpacks/${modpack.share_code}`)}
      className={`group relative cursor-pointer overflow-hidden rounded-xl border bg-zinc-900 p-5 transition-all duration-700 ${
        removing
          ? 'pointer-events-none scale-95 opacity-0'
          : isNew
          ? 'border-emerald-600/50 shadow-[0_0_20px_rgba(16,185,129,0.12)]'
          : 'border-zinc-800 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <ModpackAvatar name={modpack.name} icon_color={modpack.icon_color} icon_letter={modpack.icon_letter} icon_url={modpack.icon_url} />
          <div>
            <h3 className="font-semibold text-white">{modpack.name}</h3>
            <p className="mt-0.5 text-xs capitalize text-zinc-500">
              {modpack.game_version} · {modpack.loader} ·{' '}
              <span className="text-emerald-400">{modpack.mod_count} mod{modpack.mod_count !== 1 ? 's' : ''}</span>
            </p>
          </div>
        </div>

        {confirming ? (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-zinc-400">Delete?</span>
            <button
              onClick={handleConfirmDelete}
              className="rounded px-2 py-0.5 text-xs font-semibold text-red-400 ring-1 ring-red-900 transition-colors hover:bg-red-950/60 hover:text-red-300"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-zinc-500 transition-colors hover:text-zinc-200"
              title="Cancel"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirming(true) }}
            className="rounded-md p-1 text-zinc-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-zinc-800 hover:text-red-400"
            title="Delete modpack"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/>
              <path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-600">{modpack.share_code}</span>
          {modpack.source_share_code && (
            <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-blue-950 text-blue-400 border border-blue-800">Synced</span>
          )}
          {isNew && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">New</span>
          )}
        </div>
        <span className="text-xs text-zinc-500 transition-colors group-hover:text-white">Open →</span>
      </div>
    </div>
  )
}

export default function Modpacks() {
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [newModpackId, setNewModpackId] = useState<number | null>(null)
  const queryClient = useQueryClient()

  function handleCreated(id: number) {
    setNewModpackId(id)
    setTimeout(() => setNewModpackId(null), 4000)
  }

  const { data: modpacks = [], isLoading } = useQuery({
    queryKey: ['modpacks'],
    queryFn: listModpacks,
  })

  const { mutate: del } = useMutation({
    mutationFn: deleteModpack,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['modpacks'] })
      const prev = queryClient.getQueryData<ModpackSummary[]>(['modpacks'])
      queryClient.setQueryData<ModpackSummary[]>(['modpacks'], (old) =>
        old?.filter((m) => m.id !== id) ?? []
      )
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['modpacks'], ctx.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['modpacks'] }),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-zinc-800" />
          <div className="h-9 w-28 animate-pulse rounded-md bg-zinc-800" />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-zinc-800" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Modpacks</h1>
          <p className="mt-1 text-sm text-zinc-400">Build and share your mod collections.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowImport((v) => !v); setShowCreate(false) }}
            className={`rounded-md px-4 py-2 text-sm font-semibold text-white shadow-[0_0_8px_rgba(16,185,129,0.2)] transition-all active:scale-95 ${
              showImport
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-emerald-500 hover:bg-emerald-400'
            }`}
          >
            {showImport ? 'Close' : 'Import'}
          </button>
          <button
            onClick={() => { setShowCreate((v) => !v); setShowImport(false) }}
            className={`rounded-md px-4 py-2 text-sm font-semibold text-white shadow-[0_0_8px_rgba(16,185,129,0.2)] transition-all active:scale-95 ${
              showCreate
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-emerald-500 hover:bg-emerald-400'
            }`}
          >
            {showCreate ? 'Close' : 'New modpack'}
          </button>
        </div>
      </div>

      {/* Slide-down create panel */}
      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: showCreate ? '1fr' : '0fr', opacity: showCreate ? 1 : 0 }}
        aria-hidden={!showCreate}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-4 pb-1">
            <CreatePanel open={showCreate} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
          </div>
        </div>
      </div>

      {/* Slide-down import panel */}
      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: showImport ? '1fr' : '0fr', opacity: showImport ? 1 : 0 }}
        aria-hidden={!showImport}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-4 pb-1">
            <ImportPanel open={showImport} onClose={() => setShowImport(false)} />
          </div>
        </div>
      </div>

      {modpacks.length === 0 ? (
        <div className={`${showCreate || showImport ? 'mt-6' : 'mt-20'} flex flex-col items-center text-center transition-all duration-300`}>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-zinc-500">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              <line x1="12" y1="12" x2="12" y2="16"/>
              <line x1="10" y1="14" x2="14" y2="14"/>
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">No modpacks yet</h2>
          <p className="mt-2 max-w-xs text-sm text-zinc-400">
            Build a collection of mods and share it with one link.
          </p>
          <button
            onClick={() => { setShowCreate(true); setShowImport(false) }}
            className="mt-6 rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition-all duration-150 hover:bg-emerald-400 active:scale-95"
          >
            Create your first modpack
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modpacks.map((m) => (
            <ModpackCard key={m.id} modpack={m} onDelete={() => del(m.id)} isNew={m.id === newModpackId} />
          ))}
        </div>
      )}

    </div>
  )
}
