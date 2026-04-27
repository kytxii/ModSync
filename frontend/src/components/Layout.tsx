import { NavLink, Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { loginWithGoogle, logout } from '../api/auth'

export default function Layout() {
  const { user, isLoading } = useAuth()
  const queryClient = useQueryClient()

  async function handleLogout() {
    await logout()
    queryClient.clear()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800 bg-zinc-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-base font-semibold tracking-tight">ModSync</span>
          </div>
          <nav className="flex items-center gap-1">
            {[
              { to: '/analyzer', label: 'Analyzer' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${
                    isActive
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        {!isLoading && (
          user ? (
            <div className="flex items-center gap-3">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full ring-2 ring-zinc-700"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-medium">
                  {user.display_name[0]}
                </div>
              )}
              <span className="text-sm text-zinc-300">{user.display_name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-zinc-500 transition-colors duration-150 hover:text-white"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-emerald-400 active:scale-95"
            >
              Sign in with Google
            </button>
          )
        )}
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
