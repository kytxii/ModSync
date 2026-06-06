import client from './client'

export async function getFabricGameVersions() {
  const { data } = await client.get('/fabric/game-versions')
  return data
}

export async function getFabricLoaderVersions(gameVersion) {
  const { data } = await client.get(`/fabric/loader-versions/${gameVersion}`)
  return data
}
