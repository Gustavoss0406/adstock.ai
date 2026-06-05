/**
 * ── SPAM DETECTION ────────────────────────────────────────
 *
 * Detecta e penaliza mensagens spam dos agentes.
 * Sistema de 3 avisos: warn → warn → mute (1h).
 */

import { prisma } from "@/lib/prisma"
import { addHours } from "date-fns"

interface SpamCheckResult {
  blocked: boolean
  reason?: string
  warningLevel?: number
}

export async function detectAndHandleSpam(
  agentId: string,
  content: string,
  eventType: string,
): Promise<SpamCheckResult> {
  const spamScore = calculateSpamScore(content, eventType)

  if (spamScore < 2) {
    return { blocked: false }
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { spamCount: true, mutedUntil: true, communicationState: true },
  })
  if (!agent) return { blocked: false }

  const currentCount = agent.spamCount || 0
  const newCount = currentCount + 1

  await prisma.agent.update({
    where: { id: agentId },
    data: { spamCount: { increment: 1 } },
  })

  if (newCount >= 3) {
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        communicationState: "MUTED",
        mutedUntil: addHours(new Date(), 1),
      },
    })
    return { blocked: true, reason: "muted_1h", warningLevel: 3 }
  }

  if (newCount === 2) {
    return { blocked: true, reason: "second_warning", warningLevel: 2 }
  }

  return { blocked: true, reason: "first_warning", warningLevel: 1 }
}

function calculateSpamScore(content: string, eventType: string): number {
  let score = 0

  if (content.length < 10) score += 2
  if (content.length < 4) score += 1

  const spamPatterns = [
    /^(ok|okay|certo|beleza|valeu|obrigado|boa|legal|perfeito|top|show|demais|maneiro|bora|vamos|lindo|maravilhoso)[!.,]*$/i,
    /(qualquer coisa|se precisar|tamo junto|estou a disposicao|conte comigo|precisar e so chamar)/i,
    /(vou come[çc]ar|vou iniciar|vou fazer|deixa comigo|pode deixar|farei isso|to fazendo|estou fazendo)/i,
    /^[👍💜🔥😊👏🎉✨🚀💪🙌♥️🫶]+$/,
    /^(bom dia|boa tarde|boa noite) (pessoal|time|galera|equipe)[!]*$/i,
    /(estou trabalhando|continuo trabalhando|seguimos|tamo na atividade|indo bem|progresso.*indo)/i,
    /^(bora time|vamos que vamos|foco pessoal)/i,
    /^(otimo trabalho|parabens|mandou bem|arrasou)/i,
    /(vou pegar|vou comecar|vou iniciar|come[cç]ando|iniciando)/i,
  ]

  for (const pattern of spamPatterns) {
    if (pattern.test(content.trim())) {
      score += 2
      break
    }
  }

  // Emoji-only message is always spam
  if (/^[\p{Emoji}\s]+$/u.test(content.trim())) {
    score += 3
  }

  // Non-actionable event types have lower tolerance
  if (eventType === "post_message" || eventType === "join_conversation") {
    score += 1
  }

  return score
}

export async function resetSpamCount(agentId: string): Promise<void> {
  await prisma.agent.update({
    where: { id: agentId },
    data: { spamCount: 0 },
  })
}
