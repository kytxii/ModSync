import client from './client'

export interface ModSearchRequest {
  query: string
  game_version?: string
  loader?: string
  category?: string
  side?: string
  index?: string
  limit?: number
  offset?: number
}

export interface ModCategory {
  name: string
  header: string
  icon: string
}

export interface ModSearchHit {
  project_id: string
  slug: string
  title: string
  description: string
  icon_url: string | null
  downloads: number
  client_side: string
  server_side: string
  latest_version: string | null
  versions: string[]
  categories: string[]
}

export interface ModSearchResponse {
  hits: ModSearchHit[]
  total_hits: number
  limit: number
  offset: number
}

export async function searchMods(params: ModSearchRequest): Promise<ModSearchResponse> {
  const { data } = await client.post<ModSearchResponse>('/mods/search', params)
  return data
}

export async function getCategories(): Promise<ModCategory[]> {
  const { data } = await client.get<ModCategory[]>('/mods/categories')
  return data
}

export async function getLatestVersion(
  projectId: string,
  gameVersion: string,
  loader: string,
): Promise<{ version_id: string; version_number: string; version_type: string | null; filename: string | null }> {
  const { data } = await client.get(`/mods/${projectId}/latest-version`, {
    params: { game_version: gameVersion, loader },
  })
  return data
}
