import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listServers, getServerStatus, createServer } from '../api/servers'
import { getFabricGameVersions } from '../api/fabric'

const ICON_PALETTE = [
  '#059669','#10b981','#14b8a6','#06b6d4',
  '#3b82f6','#6366f1','#7c3aed','#9333ea',
  '#ec4899','#f43f5e','#ef4444','#f97316',
  '#f59e0b','#84cc16','#22c55e','#64748b',
]

const MC_VERSIONS = [
  '1.21.4','1.21.3','1.21.1','1.21','1.20.6',
  '1.20.4','1.20.2','1.20.1','1.20','1.19.4',
  '1.19.2','1.19','1.18.2','1.18','1.17.1','1.16.5',
]

function serverIconColor(name) {
  return ICON_PALETTE[name.charCodeAt(0) % ICON_PALETTE.length]
}

function modCountLabel(count) {
  if (count < 10) return `${count}`
  return `${Math.floor(count / 10) * 10}+`
}

function StatusBadge({ serverId, maxPlayers }) {
  const { data } = useQuery({
    queryKey: ['server-status', serverId],
    queryFn: () => getServerStatus(serverId),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })

  const online = data?.online ?? null
  const displayOnline = online ? (data.players?.online ?? 0) : 0
  const pct = maxPlayers > 0 ? (displayOnline / maxPlayers) * 100 : 0

  return (
    <div className="flex shrink-0 flex-col items-end justify-between">
      <span className={`inline-flex items-center gap-1.5 text-xs ${online === null ? 'text-zinc-600' : online ? 'text-emerald-400' : 'text-red-400'}`}>
        {online !== null && <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-500'}`} />}
        {online === null ? 'Checking…' : online ? 'Online' : 'Offline'}
        {data?.response_ms != null && <span className="text-zinc-600">{data.response_ms}ms</span>}
      </span>
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-zinc-500">{displayOnline} / {maxPlayers}</span>
        <div className="h-1 w-20 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${online ? 'bg-emerald-500' : 'bg-zinc-600'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function ServerIcon({ server }) {
  const [imgError, setImgError] = useState(false)
  const color = serverIconColor(server.name)
  if (server.icon_url && !imgError) {
    return (
      <img
        src={server.icon_url}
        alt=""
        className="h-16 w-16 shrink-0 rounded-lg object-cover"
        onError={() => setImgError(true)}
      />
    )
  }
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg text-2xl font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {server.name[0]?.toUpperCase() ?? 'S'}
    </div>
  )
}

function ServerCard({ server, isNew = false }) {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(!isNew)
  const [glowing, setGlowing] = useState(isNew)

  useEffect(() => {
    if (!isNew) return
    const raf = requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => setGlowing(false), 2000)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [isNew])

  return (
    <div
      onClick={() => navigate(`/servers/${server.share_code}`)}
      className={`cursor-pointer rounded-xl border bg-zinc-900 p-5 transition-all duration-500 ease-out ${
        visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.85] -translate-y-2'
      } ${
        glowing
          ? 'border-emerald-700/60 shadow-[0_0_12px_rgba(16,185,129,0.08)]'
          : 'border-zinc-800 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-stretch justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ServerIcon server={server} />
          <div className="flex min-w-0 flex-col">
            <h3 className="truncate font-semibold text-white">{server.name}</h3>
            {server.description && (
              <p className="mt-0.5 truncate text-xs text-zinc-500">{server.description}</p>
            )}
            {server.server_ip && (
              <p className="mt-2 truncate font-mono text-xs text-zinc-600">{server.server_ip}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{server.game_version}</span>
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs capitalize text-zinc-400">{server.loader}</span>
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-emerald-400">{modCountLabel(server.mod_count)} mods</span>
            </div>
          </div>
        </div>
        {server.server_ip ? (
          <StatusBadge serverId={server.id} maxPlayers={server.max_players} />
        ) : (
          <span className="shrink-0 text-xs text-zinc-700">Not deployed</span>
        )}
      </div>
    </div>
  )
}

function CreatePanel({ open, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [gameVersion, setGameVersion] = useState('1.21.1')
  const inputRef = useRef(null)

  const { data: gameVersions } = useQuery({
    queryKey: ['fabric-game-versions'],
    queryFn: getFabricGameVersions,
    staleTime: 3_600_000,
  })

  const versions = gameVersions ?? MC_VERSIONS

  const { mutate: doCreate, isPending } = useMutation({
    mutationFn: () => createServer({ name: name.trim(), game_version: gameVersion, loader: 'fabric' }),
    onSuccess: (server) => {
      onClose()
      onCreated(server)
    },
  })

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setName(''); setGameVersion('1.21.1') }
  }, [open])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && open) onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <div className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${open ? 'w-72 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
      <div className="w-72 rounded-xl border border-zinc-700 bg-zinc-900 p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">New server</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Server name</label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && !isPending) doCreate() }}
              placeholder="My Fabric Server"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Minecraft version</label>
            <select
              value={gameVersion}
              onChange={(e) => setGameVersion(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-600"
            >
              {versions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <button
            onClick={() => doCreate()}
            disabled={!name.trim() || isPending}
            className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 active:scale-95 disabled:opacity-40"
          >
            {isPending ? 'Creating…' : 'Create server'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Servers() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: servers = [], isLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: listServers,
  })
  const [creating, setCreating] = useState(false)
  const [newServerId, setNewServerId] = useState(null)

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Servers</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Build, configure, and export Minecraft server packs</p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all active:scale-95 ${
            creating ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-emerald-500 hover:bg-emerald-400'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className={`transition-transform duration-200 ${creating ? 'rotate-45' : ''}`}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          {creating ? 'Cancel' : 'New server'}
        </button>
      </div>

      <div className="flex items-start gap-6">
        {/* Server list */}
        <div className="min-w-0 flex-1">
          {isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl bg-zinc-800" />
              ))}
            </div>
          )}

          {!isLoading && servers.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800 py-24 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
                  <rect x="2" y="2" width="20" height="8" rx="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-white">No servers yet</p>
                <p className="mt-1 text-sm text-zinc-500">Create your first server to get started</p>
              </div>
              <button
                onClick={() => setCreating(true)}
                className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 active:scale-95"
              >
                Create your first server
              </button>
            </div>
          )}

          {!isLoading && servers.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {servers.map((server) => (
                <ServerCard key={server.id} server={server} isNew={server.id === newServerId} />
              ))}
            </div>
          )}
        </div>

        {/* Inline create panel */}
        <CreatePanel
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(server) => {
            setCreating(false)
            setNewServerId(server.id)
            queryClient.invalidateQueries({ queryKey: ['servers'] })
          }}
        />
      </div>
    </div>
  )
}
