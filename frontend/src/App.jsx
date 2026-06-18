import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import GuestRoute from './components/GuestRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Analyzer from './pages/Analyzer'
import Modpacks from './pages/Modpacks'
import ModpackBuilder from './pages/ModpackBuilder'
import Servers from './pages/Servers'
import ServerBuilder from './pages/ServerBuilder'
import { AnalyzerProvider } from './context/AnalyzerContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AnalyzerProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            {/* Guest-only — redirects logged-in users to /dashboard */}
            <Route element={<GuestRoute />}>
              <Route path="/" element={<Home />} />
            </Route>
            <Route path="/login" element={<Login />} />

            {/* Protected */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analyzer" element={<Analyzer />} />
              <Route path="/modpacks" element={<Modpacks />} />
              <Route path="/modpacks/:code" element={<ModpackBuilder />} />
              <Route path="/servers" element={<Servers />} />
              <Route path="/servers/:code" element={<ServerBuilder />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      </AnalyzerProvider>
    </QueryClientProvider>
  )
}
