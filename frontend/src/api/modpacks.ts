import client from './client'

export interface ModpackMod {
  id: number
  modrinth_project_id: string
  version_id: string
  name: string
  side: string
  icon_url: string | null
  version_number: string | null
  version_type: string | null
  filename: string | null
  categories: string[]
}

export interface ModpackSummary {
  id: number
  name: string
  game_version: string
  loader: string
  share_code: string
  source_share_code: string | null
  icon_color: string | null
  icon_letter: string | null
  icon_url: string | null
  mod_count: number
  created_at: string
  updated_at: string
}

export interface Modpack extends ModpackSummary {
  mods: ModpackMod[]
}

export interface CreateModpackInput {
  name: string
  game_version: string
  loader: string
}

export interface AddModInput {
  modrinth_project_id: string
  version_id: string
  name: string
  side: string
  icon_url: string | null
  version_number: string | null
  version_type: string | null
  filename: string | null
  categories: string[]
}

export async function listModpacks(): Promise<ModpackSummary[]> {
  const { data } = await client.get<ModpackSummary[]>('/modpacks')
  return data
}

export async function getModpack(id: number): Promise<Modpack> {
  const { data } = await client.get<Modpack>(`/modpacks/${id}`)
  return data
}

export async function getModpackByCode(code: string): Promise<Modpack> {
  const { data } = await client.get<Modpack>(`/modpacks/code/${code}`)
  return data
}

export async function getSharedModpack(code: string): Promise<Modpack> {
  const { data } = await client.get<Modpack>(`/modpacks/share/${code}`)
  return data
}

export async function createModpack(input: CreateModpackInput): Promise<ModpackSummary> {
  const { data } = await client.post<ModpackSummary>('/modpacks', input)
  return data
}

export async function deleteModpack(id: number): Promise<void> {
  await client.delete(`/modpacks/${id}`)
}

export interface UpdateModpackInput {
  name?: string
  game_version?: string
  loader?: string
  icon_color?: string | null
  icon_letter?: string | null
  icon_url?: string | null
  source_share_code?: string | null
}

export async function updateModpack(id: number, input: UpdateModpackInput): Promise<ModpackSummary> {
  const { data } = await client.patch<ModpackSummary>(`/modpacks/${id}`, input)
  return data
}

export async function addMod(modpackId: number, input: AddModInput): Promise<ModpackMod> {
  const { data } = await client.post<ModpackMod>(`/modpacks/${modpackId}/mods`, input)
  return data
}

export async function removeMod(modpackId: number, modId: number): Promise<void> {
  await client.delete(`/modpacks/${modpackId}/mods/${modId}`)
}

export async function exportMrpack(id: number): Promise<Blob> {
  const { data } = await client.get<Blob>(`/modpacks/${id}/export`, { responseType: 'blob' })
  return data
}

export async function importModpack(code: string, name: string, isSync: boolean): Promise<ModpackSummary> {
  const { data } = await client.post<ModpackSummary>('/modpacks/import', { code, name, is_synced: isSync })
  return data
}
