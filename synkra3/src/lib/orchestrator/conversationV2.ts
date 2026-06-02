/**
 * ── CONVERSATION ENGINE v2 ─────────────────────────────────
 * Agentes respondem automaticamente a menções e cascatas.
 */

import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"
import { requestTurn, releaseTurn, calculateTypingTime, setTypingIndicator, clearTypingIndicator } from "./turns"
import { getPersonality } from "./config"

export async function respondToMessage(
  agentId: string,
  agentName: string,
  organizationId: string,
  context: { what: string; from: string; detail: string },
): Promise<string | null> {
  const personality = getPersonality(agentName)
  const roleLabel = (await prisma.agent.findUnique({ where: { id: agentId }, select: { role: true } }))?.role || "agente"

  const prompt = `Voce e ${agentName} (${roleLabel}). Um colega do time interagiu com voce no chat.

O QUE ACONTECEU: ${context.what}
QUEM FALOU: ${context.from}
DETALHE: ${context.detail.slice(0, 300)}

${personality ? `Personalidade: ${personality.type}, ${personality.description}` : ""}

Se for uma pergunta direta ou um aviso importante, responda.
Se for apenas informativo sem necessidade de resposta, nao responda.
Se precisar agir (criar tarefa, agendar, analisar), diga o que vai fazer.

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
): Promise<string | null> {
  if (!content || content.length < 10) return null

  const channel = await prisma.channel.findFirst({ where: { organizationId, name: channelName } })
  if (!channel) return null

  try {
    const turn = requestTurn(channelName, agentId, agentName, priority)
    if (!turn.acquired) return null

    setTypingIndicator(channelName, agentId, agentName)
    await new Promise(r => setTimeout(r, calculateTypingTime(agentName, content)))

    const msg = await prisma.message.create({
      data: {
        content,
        metadata: { type: "agent_conversation", agentId, agentName, timestamp: new Date().toISOString() },
        agentId,
        channelId: channel.id,
      },
    } as any)

    clearTypingIndicator(channelName)
    releaseTurn(channelName, agentId)
    return msg.id
  } catch {
    return null
  }
}
