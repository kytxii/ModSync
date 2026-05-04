import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Analyzer from './pages/Analyzer'
import Modpacks from './pages/Modpacks'
import ModpackBuilder from './pages/ModpackBuilder'
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
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />

            {/* Protected */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analyzer" element={<Analyzer />} />
              <Route path="/modpacks" element={<Modpacks />} />
              <Route path="/modpacks/:code" element={<ModpackBuilder />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      </AnalyzerProvider>
    </QueryClientProvider>
  )
}
