import { useQuery } from '@tanstack/react-query'
import { getMe, type User } from '../api/auth'

export function useAuth() {
  const { data: user = null, isLoading } = useQuery<User | null, Error>({
    queryKey: ['me'],
    queryFn: getMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  return { user, isLoading }
}
