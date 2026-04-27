import client from './client'

export interface ModResult {
  filename: string
  sha512: string
  found: boolean
  project_id: string | null
  project_name: string | null
  version_number: string | null
  game_versions: string[]
  loaders: string[]
  client_side: string | null
  server_side: string | null
}

export interface AnalyzerResponse {
  total: number
  found: number
  unknown: number
  results: ModResult[]
}

export function getSide(r: ModResult): string {
  if (!r.client_side || !r.server_side) return '—'
  if (r.server_side === 'unsupported') return 'Client only'
  if (r.client_side === 'unsupported') return 'Server only'
  return 'Both'
}

export async function uploadMods(files: File[]): Promise<AnalyzerResponse> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  const { data } = await client.post<AnalyzerResponse>('/analyzer/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function importPrismJson(json: object): Promise<AnalyzerResponse> {
  const { data } = await client.post<AnalyzerResponse>('/analyzer/import-json', json)
  return data
}

export async function importModlist(json: unknown): Promise<AnalyzerResponse> {
  const payload = Array.isArray(json) ? json : (json as Record<string, unknown>).mods ?? json
  const { data } = await client.post<AnalyzerResponse>('/analyzer/import-modlist', payload)
  return data
}
