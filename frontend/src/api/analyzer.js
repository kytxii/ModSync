import client from './client'

export function getSide(r) {
  if (!r.client_side || !r.server_side) return '—'
  if (r.server_side === 'unsupported') return 'Client only'
  if (r.client_side === 'unsupported') return 'Server only'
  return 'Both'
}

export async function uploadMods(files) {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  const { data } = await client.post('/analyzer/upload', form, { headers: { 'Content-Type': undefined } })
  return data
}

export async function importModlist(mods) {
  const { data } = await client.post('/analyzer/import-modlist', mods)
  return data
}

export async function createModpackFromAnalysis(payload) {
  const { data } = await client.post('/analyzer/create-modpack', payload)
  return data
}
