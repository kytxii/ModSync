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

export async function addModsBulk(modpackId, mods) {
  const { data } = await client.post(`/modpacks/${modpackId}/mods/bulk`, mods)
  return data
}

export async function removeMod(modpackId, modId) {
  await client.delete(`/modpacks/${modpackId}/mods/${modId}`)
}

export async function exportModpack(id) {
  const response = await client.get(`/modpacks/${id}/export`, { responseType: 'blob' })
  return { blob: response.data, skipped: response.headers['x-export-skipped'] || '' }
}

export async function importModpack(code, name, isSync) {
  const { data } = await client.post('/modpacks/import', { code, name, is_synced: isSync })
  return data
}

export async function getModpackChangelog(modpackId) {
  const { data } = await client.get(`/modpacks/${modpackId}/changelog`)
  return data
}

export async function getSharedModpackChangelog(code) {
  const { data } = await client.get(`/modpacks/share/${code}/changelog`)
  return data
}

export async function getModVersions(modpackId, modId) {
  const { data } = await client.get(`/modpacks/${modpackId}/mods/${modId}/versions`)
  return data
}

export async function updateModVersion(modpackId, modId, input) {
  const { data } = await client.patch(`/modpacks/${modpackId}/mods/${modId}`, input)
  return data
}
