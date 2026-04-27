import client from './client'

export interface ModSearchRequest {
  query: string
  game_version?: string
  loader?: string
  limit?: number
  offset?: number
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
  game_versions: string[]
  loaders: string[]
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
