import client from './client'

export async function listModpacks() {
  const { data } = await client.get('/modpacks')
  return data
}

export async function getModpack(id) {
  const { data } = await client.get(`/modpacks/${id}`)
  return data
}

export async function getModpackByCode(code) {
  const { data } = await client.get(`/modpacks/code/${code}`)
  return data
}

export async function getSharedModpack(code) {
  const { data } = await client.get(`/modpacks/share/${code}`)
  return data
}

export async function createModpack(input) {
  const { data } = await client.post('/modpacks', input)
  return data
}

export async function deleteModpack(id) {
  await client.delete(`/modpacks/${id}`)
}

export async function updateModpack(id, input) {
  const { data } = await client.patch(`/modpacks/${id}`, input)
  return data
}

export async function addMod(modpackId, input) {
  const { data } = await client.post(`/modpacks/${modpackId}/mods`, input)
  return data
}

export async function removeMod(modpackId, modId) {
  await client.delete(`/modpacks/${modpackId}/mods/${modId}`)
}

export async function exportMrpack(id) {
  const { data } = await client.get(`/modpacks/${id}/export`, { responseType: 'blob' })
  return data
}

export async function importModpack(code, name, isSync) {
  const { data } = await client.post('/modpacks/import', { code, name, is_synced: isSync })
  return data
}
