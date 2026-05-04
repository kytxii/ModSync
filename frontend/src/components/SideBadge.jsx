const styles = {
  client: 'bg-blue-950/60 text-blue-300/80 border-blue-900/50',
  server: 'bg-violet-950/60 text-violet-300/80 border-violet-900/50',
  both: 'bg-emerald-950 text-emerald-400 border-emerald-900',
}

export default function SideBadge({ side }) {
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs capitalize ${styles[side] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
      {side}
    </span>
  )
}
