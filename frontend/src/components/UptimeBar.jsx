import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getServerUptime } from '../api/servers'

const SLOT_COUNT = 45

export default function UptimeBar({ serverId }) {
  const [hovered, setHovered] = useState(null)

  const { data: checks = [] } = useQuery({
    queryKey: ['server-uptime', serverId],
    queryFn: () => getServerUptime(serverId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const emptySlots = Math.max(0, SLOT_COUNT - checks.length)
  const slots = [
    ...Array(emptySlots).fill(null),
    ...checks,
  ]

  const onlineCount = checks.filter((c) => c.online).length
  const upPct = checks.length > 0 ? ((onlineCount / checks.length) * 100).toFixed(2) : null

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[0.7rem] text-zinc-500">
          {checks.length > 0 ? `Last ${checks.length} checks` : 'No data yet'}
        </span>
        {upPct !== null ? (
          <span className={`text-[0.7rem] font-semibold tabular-nums ${
            upPct >= 95 ? 'text-emerald-400' : upPct >= 80 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {upPct}% uptime
          </span>
        ) : (
          <span className="text-[0.7rem] text-zinc-600">—</span>
        )}
      </div>

      <div className="flex h-10 items-end gap-px">
        {slots.map((check, i) => {
          const alignRight = i >= SLOT_COUNT * 0.6
          return (
            <div
              key={i}
              className="relative flex flex-1 cursor-default items-end"
              style={{ height: '100%' }}
              onMouseEnter={() => check && setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === i && check && (
                <div className={`absolute bottom-full z-50 mb-2 whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 shadow-2xl pointer-events-none ${alignRight ? 'right-0' : 'left-0'}`}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${check.online ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className={`text-[0.7rem] font-semibold ${check.online ? 'text-emerald-400' : 'text-red-400'}`}>
                      {check.online ? 'Online' : 'Offline'}
                      {check.online && check.response_ms != null && (
                        <span className="ml-1.5 font-normal text-zinc-500">{check.response_ms}ms</span>
                      )}
                    </span>
                  </div>
                  <p className="text-[0.7rem] text-zinc-400">
                    {new Date(check.checked_at).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
              <div
                className={`w-full rounded-sm transition-all duration-150 ${
                  check === null
                    ? 'bg-zinc-800'
                    : check.online
                    ? 'bg-emerald-400'
                    : 'bg-red-500'
                } ${check && hovered === i ? 'opacity-100' : 'opacity-60'}`}
                style={{ height: check && hovered === i ? '100%' : '20px' }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
