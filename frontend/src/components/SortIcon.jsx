export default function SortIcon({ active, dir }) {
  if (!active) return <span className="ml-1 text-zinc-700">↕</span>;
  return (
    <span className="ml-1 text-emerald-400">{dir === "asc" ? "↑" : "↓"}</span>
  );
}
