import client from './client'

export async function getMe() {
  const { data } = await client.get('/auth/me')
  return data
}

export function loginWithGoogle() {
  window.location.href = '/api/auth/google/login'
}

export async function logout() {
  await client.post('/auth/logout')
}
