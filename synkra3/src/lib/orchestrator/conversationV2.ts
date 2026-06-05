/**
 * ── CONVERSATION ENGINE v2 ─────────────────────────────────
 * Agentes respondem automaticamente a menções e cascatas.
 */

import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"
import { requestTurn, releaseTurn, calculateTypingTime, setTypingIndicator, clearTypingIndicator } from "./turns"
import { selectBestChannel } from "@/lib/channels/channel-selector"
import { ensureChannelExists } from "@/lib/channels/channel-validator"

export async function respondToMessage(
  agentId: string,
  agentName: string,
  organizationId: string,
  context: { what: string; from: string; detail: string },
): Promise<string | null> {
  const roleLabel = (await prisma.agent.findUnique({ where: { id: agentId }, select: { role: true } }))?.role || "agente"

  const prompt = `Voce e ${agentName} (${roleLabel}). Um colega do time interagiu com voce no chat.

O QUE ACONTECEU: ${context.what}
QUEM FALOU: ${context.from}
DETALHE: ${context.detail.slice(0, 300)}

REGRAS DE COMUNICACAO:
- Se for pergunta direta ou aviso IMPORTANTE, responda de forma acionavel.
- Se for apenas INFORMATIVO (ex: "terminei X"), nao responda — so o autor precisava avisar.
- NUNCA responda com "ok", "legal", "valeu", "boa", "perfeito" — isso e proibido.
- Se nao tem nada util ou acionavel pra dizer, NAO RESPONDA. Silencio e melhor.

Responda APENAS se necessario. 1-2 frases. 1a pessoa. Tom natural.`

  try {
    const reply = await chatCompletion(prompt, { temperature: 0.6, maxTokens: 200 })
    const clean = reply.replace(/^(Claro|Certo|OK|Ok|Entendido|Beleza)[,!.]?\s*/i, "").trim()
    if (clean.length < 10 || clean.includes("Nao consegui")) return null
    return clean
  } catch {
    return null
  }
}

export async function postAgentMessage(
  agentId: string,
  agentName: string,
  content: string,
  organizationId: string,
  channelName: string = "geral",
  priority: number = 5,
  messageType?: string,
  needsApproval?: boolean,
): Promise<string | null> {
  if (!content || content.length < 10) return null

  // ── Channel routing ─────────────────────────────────
  let finalChannelName = channelName
  if (messageType) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { role: true },
    })
    const best = selectBestChannel({
      content,
      agentId,
      agentRole: agent?.role || undefined,
      messageType,
      metadata: { needsCEOApproval: needsApproval },
    })
    finalChannelName = best
  }

  const channel = await prisma.channel.findFirst({ where: { organizationId, name: finalChannelName } })
  const channelId = channel?.id || await ensureChannelExists(finalChannelName, organizationId)
  if (!channelId) return null

  try {
    const turn = requestTurn(finalChannelName, agentId, agentName, priority)
    if (!turn.acquired) return null

    setTypingIndicator(finalChannelName, agentId, agentName)
    await new Promise(r => setTimeout(r, calculateTypingTime(agentName, content)))

    const msg = await prisma.message.create({
      data: {
        content,
        metadata: { type: messageType || "agent_conversation", agentId, agentName, timestamp: new Date().toISOString(), autoSelectedChannel: finalChannelName !== channelName },
        agentId,
        channelId,
      },
    } as any)

    clearTypingIndicator(finalChannelName)
    releaseTurn(finalChannelName, agentId)
    return msg.id
  } catch {
    return null
  }
}
