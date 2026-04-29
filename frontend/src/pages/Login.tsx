import { loginWithGoogle } from '../api/auth'

export default function Login() {
  return (
    <div className="mt-24 flex flex-col items-center text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Sign in required
      </div>

      <h1 className="mt-6 text-4xl font-bold tracking-tight">
        Welcome to <span className="text-emerald-400">ModSync</span>
      </h1>
      <p className="mt-3 max-w-sm text-zinc-400">
        Sign in with your Google account to access your modpacks, analyze mods, and more.
      </p>

      <button
        onClick={loginWithGoogle}
        className="mt-8 flex items-center gap-3 rounded-md bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-lg transition-all duration-150 hover:bg-gray-100 active:scale-95"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  )
}
