import { useQuery } from '@tanstack/react-query'
import { getMe } from '../api/auth'

export function useAuth() {
  const { data: user = null, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  return { user, isLoading }
}
