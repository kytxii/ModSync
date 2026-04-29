import client from './client'

export interface ModResult {
  filename: string
  sha512: string
  found: boolean
  project_id: string | null
  project_name: string | null
  icon_url: string | null
  version_number: string | null
  game_versions: string[]
  loaders: string[]
  categories: string[]
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
  const { data } = await client.post<AnalyzerResponse>('/analyzer/upload', form)
  return data
}

export async function importPrismJson(json: object): Promise<AnalyzerResponse> {
  const { data } = await client.post<AnalyzerResponse>('/analyzer/import-json', json)
  return data
}

