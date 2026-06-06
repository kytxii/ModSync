import client from './client'

export async function listServers() {
  const { data } = await client.get('/servers')
  return data
}

export async function getServer(id) {
  const { data } = await client.get(`/servers/${id}`)
  return data
}

export async function getServerByCode(code) {
  const { data } = await client.get(`/servers/code/${code}`)
  return data
}

export async function createServer(input) {
  const { data } = await client.post('/servers', input)
  return data
}

export async function updateServer(id, input) {
  const { data } = await client.patch(`/servers/${id}`, input)
  return data
}

export async function deleteServer(id) {
  await client.delete(`/servers/${id}`)
}

export async function addServerMod(serverId, input) {
  const { data } = await client.post(`/servers/${serverId}/mods`, input)
  return data
}

export async function removeServerMod(serverId, modId) {
  await client.delete(`/servers/${serverId}/mods/${modId}`)
}

export async function getServerStatus(serverId) {
  const { data } = await client.get(`/servers/${serverId}/status`)
  return data
}

export async function exportServerPack(serverId) {
  return client.get(`/servers/${serverId}/export`, {
    params: { eula: 'true' },
    responseType: 'blob',
  })
}

export async function exportToClient(serverId) {
  const { data } = await client.post(`/servers/${serverId}/export-to-client`)
  return data
}

export async function getServerUptime(serverId) {
  const { data } = await client.get(`/servers/${serverId}/uptime`)
  return data
}

export async function resetServerUptime(serverId) {
  await client.delete(`/servers/${serverId}/uptime`)
}

export async function uploadServerIcon(serverId, file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post(`/servers/${serverId}/icon`, form, {
    headers: { 'Content-Type': undefined },
  })
  return data
}

export async function deleteServerIcon(serverId) {
  const { data } = await client.delete(`/servers/${serverId}/icon`)
  return data
}

export async function getMissingDeps(serverId) {
  const { data } = await client.get(`/servers/${serverId}/dependencies/missing`)
  return data
}

export async function resolveMissingDeps(serverId) {
  const { data } = await client.post(`/servers/${serverId}/dependencies/resolve`)
  return data
}

export async function getSparkDownload(serverId) {
  const { data } = await client.get(`/servers/${serverId}/management/spark-download`)
  return data
}

export async function getManagementState(serverId) {
  const { data } = await client.get(`/servers/${serverId}/management/state`)
  return data
}

export async function testRcon(serverId) {
  const { data } = await client.post(`/servers/${serverId}/rcon/test`)
  return data
}

export async function runRconCommand(serverId, command) {
  const { data } = await client.post(`/servers/${serverId}/rcon/command`, { command })
  return data
}
