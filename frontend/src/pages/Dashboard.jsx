import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { listModpacks } from '../api/modpacks'

function ModpackRow({ modpack }) {
  const navigate = useNavigate()
  return (
    <tr
      className="cursor-pointer bg-zinc-950 transition-colors duration-150 hover:bg-zinc-900/60"
      onClick={() => navigate(`/modpacks/${modpack.share_code}`)}
    >
      <td className="px-4 py-2.5 font-medium text-white">{modpack.name}</td>
      <td className="px-4 py-2.5 capitalize text-zinc-400">{modpack.game_version}</td>
      <td className="px-4 py-2.5 capitalize text-zinc-400">{modpack.loader}</td>
      <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{modpack.share_code}</td>
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

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">
        {firstName ? `Welcome back, ${firstName}.` : 'Dashboard'}
      </h1>

      {/* Status strip */}
      <div className="mt-3 flex items-center gap-5 text-sm">
        {isLoading ? (
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
        ) : (
          <span>
            <span className="font-semibold text-white">{modpacks.length}</span>
            <span className="ml-1.5 text-zinc-500">
              modpack{modpacks.length !== 1 ? 's' : ''}
            </span>
          </span>
        )}
        <span className="h-3 w-px bg-zinc-800" />
        <span className="text-zinc-600">
          Server profiles <span className="text-xs text-zinc-700">· Phase 4</span>
        </span>
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
            Your Modpacks{!isLoading && modpacks.length > 0 ? ` (${modpacks.length})` : ''}
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
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Version</th>
                <th className="px-4 py-2.5">Loader</th>
                <th className="px-4 py-2.5">Share Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {isLoading ? (
                <TableSkeleton />
              ) : modpacks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-600">
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
                modpacks.slice(0, 5).map((m) => (
                  <ModpackRow key={m.id} modpack={m} />
                ))
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
