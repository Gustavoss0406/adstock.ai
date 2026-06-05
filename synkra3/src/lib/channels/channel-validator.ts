/**
 * ── CHANNEL VALIDATOR ────────────────────────────────────
 *
 * Garante que o canal existe no banco, criando se necessário.
 */

import { prisma } from "@/lib/prisma"
import { CHANNEL_MAP, type ChannelName } from "./channel-map"

export async function ensureChannelExists(
  channelName: ChannelName,
  organizationId: string,
): Promise<string> {
  // Busca canal existente
  const existing = await prisma.channel.findFirst({
    where: { organizationId, name: channelName },
    select: { id: true },
  })

  if (existing) return existing.id

  // Cria se não existe
  const config = CHANNEL_MAP[channelName]
  if (!config) return ""

  const created = await prisma.channel.create({
    data: {
      organizationId,
      name: channelName,
      description: config.purpose,
      isDefault: config.priority === "critical" || channelName === "geral",
    },
  })

  return created.id
}

/**
 * Retorna o ID do canal ou null se inválido.
 * Cache simples pra evitar queries repetidas.
 */
const channelIdCache: Record<string, string> = {}

export async function getChannelId(
  channelName: ChannelName,
  organizationId: string,
): Promise<string | null> {
  const cacheKey = `${organizationId}:${channelName}`
  if (channelIdCache[cacheKey]) return channelIdCache[cacheKey]

  const channel = await prisma.channel.findFirst({
    where: { organizationId, name: channelName },
    select: { id: true },
  })

  if (channel) {
    channelIdCache[cacheKey] = channel.id
    return channel.id
  }

  return null
}

export function clearChannelCache(): void {
  Object.keys(channelIdCache).forEach(k => delete channelIdCache[k])
}
