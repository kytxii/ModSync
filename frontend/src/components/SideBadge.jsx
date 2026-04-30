const styles = {
  client: 'bg-blue-950 text-blue-400 border-blue-900',
  server: 'bg-orange-950 text-orange-400 border-orange-900',
  both: 'bg-emerald-950 text-emerald-400 border-emerald-900',
}

export default function SideBadge({ side }) {
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs capitalize ${styles[side] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
      {side}
    </span>
  )
}
