import client from './client'

export interface User {
  id: number
  email: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export async function getMe(): Promise<User> {
  const { data } = await client.get<User>('/auth/me')
  return data
}

export function loginWithGoogle(): void {
  window.location.href = '/api/auth/google/login'
}

export async function logout(): Promise<void> {
  await client.post('/auth/logout')
}
