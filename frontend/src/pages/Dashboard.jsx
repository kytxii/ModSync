import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { listModpacks } from '../api/modpacks'

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const TIME_UNITS = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
]

function relativeTime(dateString) {
  const diffSeconds = (new Date(dateString).getTime() - Date.now()) / 1000
  for (const [unit, secondsInUnit] of TIME_UNITS) {
    if (Math.abs(diffSeconds) >= secondsInUnit) {
      return RTF.format(Math.round(diffSeconds / secondsInUnit), unit)
    }
  }
  return RTF.format(Math.round(diffSeconds / 60), 'minute')
}

function lastUpdatedLabel(modpack) {
  const updatedMs = new Date(modpack.updated_at).getTime()
  if ((Date.now() - updatedMs) / 1000 < 60) return 'Just now'
  const rel = relativeTime(modpack.updated_at)
  return updatedMs === new Date(modpack.created_at).getTime() ? `Created ${rel}` : `Updated ${rel}`
}

function mostFrequent(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best = null
  for (const [value, count] of counts) {
    if (!best || count > best.count || (count === best.count && value < best.value)) {
      best = { value, count }
    }
  }
  return best?.value ?? '—'
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function OpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function PackageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}

function LayersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

function CpuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  )
}

function StatTile({ icon, label, value, loading }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <p className="text-xs font-medium uppercase tracking-wider">{label}</p>
      </div>
      {loading ? (
        <div className="mt-2.5 h-7 w-16 animate-pulse rounded bg-zinc-800" />
      ) : (
        <p className="mt-1.5 truncate text-2xl font-bold text-white">{value}</p>
      )}
    </div>
  )
}

function CopyShareButton({ shareCode }) {
  const [copied, setCopied] = useState(false)

  if (!shareCode) return null

  async function handleClick(e) {
    e.stopPropagation()
    try {
      await copyToClipboard(`${window.location.origin}/share/${shareCode}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.warn('Could not copy share link to clipboard')
    }
  }

  return (
    <button
      onClick={handleClick}
      title="Copy share link"
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
        copied
          ? 'border-emerald-800 bg-emerald-950 text-emerald-400'
          : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white'
      }`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function ModpackRow({ modpack }) {
  const navigate = useNavigate()
  return (
    <tr className="bg-zinc-950 transition-colors duration-150 hover:bg-zinc-900/60">
      <td className="px-4 py-2.5 font-medium text-white">{modpack.name}</td>
      <td className="px-4 py-2.5 capitalize text-zinc-400">{modpack.game_version}</td>
      <td className="px-4 py-2.5 capitalize text-zinc-400">{modpack.loader}</td>
      <td className="px-4 py-2.5 text-zinc-500">{lastUpdatedLabel(modpack)}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-2">
          <CopyShareButton shareCode={modpack.share_code} />
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/modpacks/${modpack.share_code}`)
            }}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors duration-150 hover:border-zinc-600 hover:text-white"
          >
            <OpenIcon />
            Open
          </button>
        </div>
      </td>
    </tr>
  )
}

function TableSkeleton() {
  return (
    <>
      {[...Array(3)].map((_, i) => (
        <tr key={i} className="bg-zinc-950">
          <td className="px-4 py-2.5"><div className="h-4 w-32 animate-pulse rounded bg-zinc-800" /></td>
          <td className="px-4 py-2.5"><div className="h-4 w-16 animate-pulse rounded bg-zinc-800" /></td>
          <td className="px-4 py-2.5"><div className="h-4 w-14 animate-pulse rounded bg-zinc-800" /></td>
          <td className="px-4 py-2.5"><div className="h-4 w-20 animate-pulse rounded bg-zinc-800" /></td>
          <td className="px-4 py-2.5"><div className="ml-auto h-6 w-28 animate-pulse rounded bg-zinc-800" /></td>
        </tr>
      ))}
    </>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: modpacks = [], isLoading } = useQuery({
    queryKey: ['modpacks'],
    queryFn: listModpacks,
  })

  const firstName = user?.display_name.split(' ')[0]

  const stats = useMemo(() => {
    const totalMods = modpacks.reduce((sum, m) => sum + (m.mod_count ?? 0), 0)
    return {
      totalModpacks: modpacks.length,
      totalMods,
      topVersion: modpacks.length ? mostFrequent(modpacks.map((m) => m.game_version)) : '—',
      topLoader: modpacks.length ? mostFrequent(modpacks.map((m) => m.loader)) : '—',
    }
  }, [modpacks])

  const recentModpacks = useMemo(
    () => [...modpacks].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 5),
    [modpacks]
  )

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">
        {firstName ? `Welcome back, ${firstName}.` : 'Dashboard'}
      </h1>

      {/* Stats strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<PackageIcon />} label="Modpacks" value={stats.totalModpacks} loading={isLoading} />
        <StatTile icon={<LayersIcon />} label="Mods" value={stats.totalMods} loading={isLoading} />
        <StatTile icon={<TagIcon />} label="Top version" value={stats.topVersion} loading={isLoading} />
        <StatTile icon={<CpuIcon />} label="Top loader" value={stats.topLoader} loading={isLoading} />
      </div>

      {/* Quick actions */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate('/modpacks')}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition-all duration-150 hover:bg-emerald-400 active:scale-95"
        >
          New modpack
        </button>
        <button
          onClick={() => navigate('/analyzer')}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-all duration-150 hover:border-zinc-600 hover:text-white active:scale-95"
        >
          Analyze mods
        </button>
      </div>

      {/* Modpacks table */}
      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Recently updated{!isLoading && modpacks.length > 0 ? ` (${modpacks.length})` : ''}
          </p>
          {modpacks.length > 5 && (
            <button
              onClick={() => navigate('/modpacks')}
              className="text-xs text-zinc-500 underline-offset-2 transition-colors duration-150 hover:text-white hover:underline"
            >
              View all
            </button>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Version</th>
                <th className="px-4 py-2.5">Loader</th>
                <th className="px-4 py-2.5">Last updated</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {isLoading ? (
                <TableSkeleton />
              ) : recentModpacks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-600">
                    No modpacks yet.{' '}
                    <button
                      onClick={() => navigate('/modpacks')}
                      className="text-emerald-500 underline-offset-2 transition-colors hover:text-emerald-400 hover:underline"
                    >
                      Create one
                    </button>
                  </td>
                </tr>
              ) : (
                recentModpacks.map((m) => <ModpackRow key={m.id} modpack={m} />)
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Server Profiles */}
      <div className="mt-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Server Profiles</p>
        <div className="flex items-center justify-between rounded-xl border border-dashed border-zinc-800 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-zinc-500">Coming in Phase 4</p>
            <p className="mt-0.5 text-xs text-zinc-600">Track server mod lists and diff against your own setup.</p>
          </div>
          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-600">
            Soon
          </span>
        </div>
      </div>
    </div>
  )
}
