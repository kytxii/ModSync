import client from './client'

export async function searchMods(params) {
  const { data } = await client.post('/mods/search', params)
  return data
}

export async function getCategories() {
  const { data } = await client.get('/mods/categories')
  return data
}

export async function getLatestVersion(projectId, gameVersion, loader) {
  const { data } = await client.get(`/mods/${projectId}/latest-version`, {
    params: { game_version: gameVersion, loader },
  })
  return data
}
