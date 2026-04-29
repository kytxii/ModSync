import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { loginWithGoogle, logout } from "../api/auth";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/analyzer", label: "Analyzer" },
  { to: "/modpacks", label: "Modpacks" },
];

export default function Layout() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    await logout();
    queryClient.clear();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-3 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1.5" fill="white" />
                <rect x="9" y="1" width="6" height="6" rx="1.5" fill="white" opacity="0.7" />
                <rect x="1" y="9" width="6" height="6" rx="1.5" fill="white" opacity="0.7" />
                <rect x="9" y="9" width="6" height="6" rx="1.5" fill="white" opacity="0.4" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">ModSync</span>
          </NavLink>

          {/* Nav links — desktop */}
          <div className="hidden md:flex h-16 items-stretch gap-1 mx-8">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `relative flex items-center px-5 text-sm font-medium transition-colors ${
                    isActive ? "text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {label}
                    {isActive && (
                      <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-emerald-400" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Desktop: user menu or sign-in */}
            {!isLoading &&
              (user ? (
                <div className="relative h-16 hidden md:flex items-stretch" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className={`relative flex items-center gap-2.5 px-4 text-sm font-medium transition-colors ${menuOpen ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-7 w-7 rounded-full ring-1 ring-zinc-700"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold">
                        {user.display_name[0]}
                      </div>
                    )}
                    <span>{user.display_name}</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      className={`transition-transform ${menuOpen ? "rotate-180 text-zinc-300" : "text-zinc-500"}`}
                    >
                      <path
                        d="M2 4l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {menuOpen && (
                      <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-emerald-400" />
                    )}
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-[calc(100%+1px)] z-50 w-56 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/50">
                      <div className="border-b border-zinc-800 px-4 py-3">
                        <p className="truncate text-sm font-semibold text-white">{user.display_name}</p>
                        <p className="truncate text-xs text-zinc-500 mt-0.5">{user.email}</p>
                      </div>
                      <div className="p-1.5">
                        <button
                          onClick={handleLogout}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={loginWithGoogle}
                  className="hidden md:block rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all hover:bg-emerald-400 active:scale-95"
                >
                  Sign in with Google
                </button>
              ))}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              className="flex md:hidden items-center justify-center rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              aria-label="Toggle menu"
            >
              {mobileNavOpen ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4 4l10 10M14 4L4 14" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="3" y1="5" x2="15" y2="5" />
                  <line x1="3" y1="9" x2="15" y2="9" />
                  <line x1="3" y1="13" x2="15" y2="13" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-zinc-800">
            <div className="mx-auto max-w-7xl px-4 py-2 space-y-0.5">
              {NAV_LINKS.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}

              {!isLoading && (
                <div className="border-t border-zinc-800 mt-2 pt-2">
                  {user ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2.5 px-3 py-2">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-6 w-6 rounded-full ring-1 ring-zinc-700"
                          />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold">
                            {user.display_name[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{user.display_name}</p>
                          <p className="truncate text-xs text-zinc-500">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setMobileNavOpen(false); handleLogout(); }}
                        className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                      >
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setMobileNavOpen(false); loginWithGoogle(); }}
                      className="w-full rounded-lg bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-400"
                    >
                      Sign in with Google
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
