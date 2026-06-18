import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import UsernamePrompt from './UsernamePrompt'

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!user.username) return <UsernamePrompt />
  return <Outlet />
}
