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
  const { data } = await client.post('/analyzer/upload', form)
  return data
}

export async function importPrismJson(json) {
  const { data } = await client.post('/analyzer/import-json', json)
  return data
}
