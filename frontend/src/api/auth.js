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

export async function checkUsernameAvailability(username) {
  const { data } = await client.get('/auth/username-availability', { params: { username } })
  return data
}

export async function updateUsername(username) {
  const { data } = await client.patch('/auth/me/username', { username })
  return data
}

export async function updateAvatar(payload) {
  const { data } = await client.patch('/auth/me/avatar', payload)
  return data
}
