import { useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { loginWithGoogle } from '../api/auth'

const features = [
  {
    title: 'Mod Analyzer',
    description: 'Upload your mods folder and get instant compatibility reports, conflict detection, and update checks against Modrinth.',
  },
  {
    title: 'Modpack Builder',
    description: 'Search Modrinth, build a named modpack, and share it with a single link. Friends can export directly to .mrpack.',
  },
  {
    title: 'Server Profiles',
    description: 'Track server mod lists with live status, see which mods are client-only vs required, and diff against your own setup.',
  },
]

function FeatureCard({ title, description }: { title: string; description: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-left transition-colors duration-300 hover:border-emerald-900/60"
      style={{
        background: hovered
          ? `radial-gradient(250px circle at ${pos.x}px ${pos.y}px, rgba(16,185,129,0.08), transparent 70%), rgb(24,24,27)`
          : undefined,
      }}
    >
      <div className="mb-3 h-1.5 w-8 rounded-full bg-emerald-500" />
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400">{description}</p>
    </div>
  )
}

export default function Home() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null

  return (
    <div className="mt-20 flex flex-col items-center text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Powered by Modrinth
      </div>

      <h1 className="mt-6 text-3xl sm:text-5xl font-bold tracking-tight">
        Minecraft mod management,{' '}
        <span className="text-emerald-400">simplified.</span>
      </h1>

      <p className="mt-4 max-w-xl text-lg text-zinc-400">
        Analyze mod folders, build shareable modpacks, and track server profiles — all in one place.
      </p>

      {!user && (
        <button
          onClick={loginWithGoogle}
          className="mt-8 rounded-md bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition-all duration-150 hover:bg-emerald-400 hover:shadow-emerald-800/50 active:scale-95"
        >
          Get started with Google
        </button>
      )}

      {user && (
        <p className="mt-6 text-zinc-400">
          Welcome back,{' '}
          <span className="font-medium text-white">{user.display_name}</span>.
        </p>
      )}

      <div className="mt-20 grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
        {features.map((f) => (
          <FeatureCard key={f.title} title={f.title} description={f.description} />
        ))}
      </div>
    </div>
  )
}
