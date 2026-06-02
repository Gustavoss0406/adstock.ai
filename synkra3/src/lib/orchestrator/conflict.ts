/**
 * ── PROACTIVE CONFLICT DETECTION & RESOLUTION ──────────────
 *
 * Detecta conflitos entre agentes de forma proativa (awareness loop)
 * e reativa (chat route). Gerencia pausa/retomada de ações relacionadas.
 *
 * Baseado no documento: PART 10 — Detecção e Resolução de Conflitos
 */

import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"
import { ORCHESTRATION_EVENT_TYPES } from "@/lib/orchestrator/config"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ConflictDetection {
  conflict: boolean
  topic: string
  agentA: string
  positionA: string
  agentAId?: string
  agentB: string
  positionB: string
  agentBId?: string
}

interface ConflictResolution {
  resolved: boolean
  winner: string | null
  loser: string | null
}

// ─────────────────────────────────────────────────────────────
// 1. REACTIVE DETECTION (triggered by chat message)
// ─────────────────────────────────────────────────────────────

/**
 * Detecta conflito quando um agente específico acaba de falar.
 * Usa análise de IA das últimas mensagens para identificar discordâncias reais.
 *
 * Usado pelo chat route.
 */
export async function detectConflict(
  organizationId: string,
  currentMsg: string,
  currentAgentId: string,
  currentAgentName: string,
): Promise<ConflictDetection | null> {
  // Get last 8 messages from other agents
  const recent = await prisma.message.findMany({
    where: {
      agent: { organizationId },
      agentId: { not: currentAgentId },
    },
    include: { agent: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 8,
  })

  if (recent.length < 2) return null

  const otherAgentMsgs = recent.filter(
    m => m.agent?.name && m.agent.name !== currentAgentName,
  )
  if (otherAgentMsgs.length === 0) return null

  const context = otherAgentMsgs
    .slice(0, 3)
    .map(m => `${m.agent?.name}: ${m.content.slice(0, 200)}`)
    .join("\n")

  const system = `Analise se ha um conflito de opiniao entre agentes.

MENSAGENS RECENTES DE OUTROS AGENTES:
${context}

MENSAGEM ATUAL DE ${currentAgentName}:
"${currentMsg.slice(0, 300)}"

Ha um conflito claro de opiniao ou abordagem? Responda APENAS com JSON:
{"conflict":true|false,"topic":"topico","agentA":"nome do outro agente","positionA":"posicao resumida","agentB":"${currentAgentName}","positionB":"posicao resumida"}

So retorne conflito se for uma discordancia real, nao apenas opinioes diferentes.`

  try {
    const reply = await chatCompletion(
      `${system}\n\nAnalise.`,
      { temperature: 0.3, maxTokens: 200 },
    )
    const jsonMatch = reply.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0])
      if (data.conflict) {
        // Add agent IDs
        data.agentAId =
          otherAgentMsgs.find(m => m.agent?.name === data.agentA)?.agentId ||
          undefined
        return data
      }
    }
  } catch {
    // AI failed — no conflict detected
  }

  return null
}

// ─────────────────────────────────────────────────────────────
// 2. PROACTIVE DETECTION (triggered by awareness loop)
// ─────────────────────────────────────────────────────────────

/**
 * Varre mensagens recentes de todos os canais em busca de conflitos
 * entre agentes. Não precisa de uma mensagem "trigger".
 *
 * Usado pelo awareness loop / heartbeat.
 */
export async function detectProactiveConflicts(
  organizationId: string,
): Promise<ConflictDetection[]> {
  const conflicts: ConflictDetection[] = []

  // Get recent messages from all channels (last 2 minutes)
  const twoMinutesAgo = new Date(Date.now() - 120000)
  const recentMessages = await prisma.message.findMany({
    where: {
      channel: { organizationId },
      createdAt: { gte: twoMinutesAgo },
      agentId: { not: null },
    },
    include: { agent: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  })

  if (recentMessages.length < 3) return conflicts

  // Group by channel for context analysis
  const byChannel = new Map<string, typeof recentMessages>()
  for (const msg of recentMessages) {
    const ch = msg.channelId || "unknown"
    if (!byChannel.has(ch)) byChannel.set(ch, [])
    byChannel.get(ch)!.push(msg)
  }

  // For each channel with at least 3 messages from different agents
  for (const [, msgs] of byChannel) {
    const uniqueAgents = new Set(msgs.map(m => m.agentId).filter(Boolean))
    if (uniqueAgents.size < 2) continue

    // Analyze with AI
    const context = msgs
      .slice(0, 8)
      .map(m => `${m.agent?.name || "?"}: ${m.content.slice(0, 200)}`)
      .join("\n")

    const system = `Analise se ha um conflito de opiniao entre agentes nesta conversa.

MENSAGENS (ordem reversa, ultima primeiro):
${context}

Ha um conflito real de opiniao ou abordagem entre dois agentes? Nao confunda discussoes produtivas com conflitos.
Responda APENAS com JSON (ou {"conflict":false} se nao houver conflito):
{"conflict":true|false,"topic":"topico do conflito","agentA":"nome do agente A","positionA":"posicao de A","agentB":"nome do agente B","positionB":"posicao de B"}`

    try {
      const reply = await chatCompletion(
        `${system}\n\nAnalise.`,
        { temperature: 0.3, maxTokens: 200 },
      )
      const jsonMatch = reply.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        if (data.conflict) {
          const agentA = msgs.find(m => m.agent?.name === data.agentA)?.agent
          const agentB = msgs.find(m => m.agent?.name === data.agentB)?.agent
          conflicts.push({
            ...data,
            agentAId: agentA?.id || undefined,
            agentBId: agentB?.id || undefined,
          })
        }
      }
    } catch {
      // Skip channel on AI failure
    }
  }

  return conflicts
}

// ─────────────────────────────────────────────────────────────
// 3. HANDLE CONFLICT — Create card, notify, pause actions
// ─────────────────────────────────────────────────────────────

/**
 * Gerencia um conflito detectado:
 * 1. Cria um card de conflito (mensagem de sistema no canal)
 * 2. Pausa ações relacionadas aos agentes envolvidos
 * 3. Cria um AgencyEvent para tracking
 * 4. Retorna os IDs das ações pausadas para futura retomada
 *
 * Usado tanto pelo chat quanto pelo awareness loop.
 */
export async function handleConflict(
  organizationId: string,
  conflict: ConflictDetection,
  channelId?: string,
): Promise<{
  conflictEventId: string
  pausedActionCount: number
  messageId?: string
}> {
  // 1. Create conflict card message (JSON format for workspace renderer)
  let messageId: string | undefined
  if (channelId) {
    const conflictJson = {
      type: "conflict",
      topic: conflict.topic,
      agentA: conflict.agentA,
      agentB: conflict.agentB,
      positionA: conflict.positionA,
      positionB: conflict.positionB,
      agentAId: conflict.agentAId,
      agentBId: conflict.agentBId,
    }

    try {
      const msg = await prisma.message.create({
        data: {
          content: JSON.stringify(conflictJson),
          channelId,
        },
      })
      messageId = msg.id
    } catch {}
  }

  // 2. Create AgencyEvent
  const event = await prisma.agencyEvent.create({
    data: {
      organizationId,
      type: "conflict_detected",
      title: `Conflito: ${conflict.topic}`,
      description: `${conflict.agentA} vs ${conflict.agentB}: ${conflict.positionA.slice(0, 60)} vs ${conflict.positionB.slice(0, 60)}`,
      metadata: conflict,
    },
  } as any)

  // 3. Pause related actions for both agents
  const agentIds = [conflict.agentAId, conflict.agentBId].filter(
    Boolean,
  ) as string[]
  const pausedCount = await pauseRelatedActions(organizationId, agentIds)

  // 4. Update agent work states
  for (const agentId of agentIds) {
    try {
      await prisma.agent.update({
        where: { id: agentId },
        data: { workState: "WAITING" },
      })
    } catch {}
  }

  // 5. Log orchestration
  await logConflict(organizationId, conflict.agentAId || "", ORCHESTRATION_EVENT_TYPES.CONFLICT_DETECTED, {
    topic: conflict.topic,
    agentA: conflict.agentA,
    agentB: conflict.agentB,
    pausedActions: pausedCount,
  })

  return {
    conflictEventId: event.id,
    pausedActionCount: pausedCount,
    messageId,
  }
}

// ─────────────────────────────────────────────────────────────
// 4. PAUSE / RESUME RELATED ACTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Pausa todas as ações pendentes dos agentes envolvidos.
 * Retorna o número de ações pausadas.
 */
export async function pauseRelatedActions(
  organizationId: string,
  agentIds: string[],
): Promise<number> {
  if (agentIds.length === 0) return 0

  const result = await prisma.agentAction.updateMany({
    where: {
      organizationId,
      agentId: { in: agentIds },
      status: "pending",
    },
    data: {
      status: "paused",
      error: "Paused due to conflict",
    },
  } as any)

  return result.count
}

/**
 * Retoma ações pausadas para os agentes especificados.
 */
export async function resumeRelatedActions(
  organizationId: string,
  agentIds: string[],
): Promise<number> {
  if (agentIds.length === 0) return 0

  const result = await prisma.agentAction.updateMany({
    where: {
      organizationId,
      agentId: { in: agentIds },
      status: "paused",
    },
    data: {
      status: "pending",
      error: null,
      // Re-schedule for soon
      scheduledFor: new Date(Date.now() + 5000),
    },
  } as any)

  return result.count
}

// ─────────────────────────────────────────────────────────────
// 5. RESOLVE CONFLICT — Mark winner/loser, update morale
// ─────────────────────────────────────────────────────────────

/**
 * Resolve um conflito, ajustando moral/performance dos envolvidos
 * e retomando ações pausadas.
 */
export async function resolveConflict(
  organizationId: string,
  winnerAgentName: string,
  loserAgentName: string,
  topic?: string,
): Promise<ConflictResolution> {
  const [winner, loser] = await Promise.all([
    prisma.agent.findFirst({
      where: {
        organizationId,
        name: { contains: winnerAgentName, mode: "insensitive" },
      },
    }),
    prisma.agent.findFirst({
      where: {
        organizationId,
        name: { contains: loserAgentName, mode: "insensitive" },
      },
    }),
  ])

  if (winner) {
    await prisma.agent.update({
      where: { id: winner.id },
      data: {
        morale: { increment: 5 },
        performance: { increment: 1 },
        workState: "IDLE",
      },
    })
  }

  if (loser) {
    await prisma.agent.update({
      where: { id: loser.id },
      data: {
        morale: { decrement: 5 },
        performance: { decrement: 1 },
        workState: "IDLE",
      },
    })
  }

  // Resume paused actions for both agents
  const agentIds = [winner?.id, loser?.id].filter(Boolean) as string[]
  const resumed = await resumeRelatedActions(organizationId, agentIds)

  // Log resolution
  await prisma.agencyEvent.create({
    data: {
      organizationId,
      type: "conflict_resolved",
      title: `Conflito resolvido: ${topic || "estrategia"}`,
      description: `${winnerAgentName} venceu o debate contra ${loserAgentName}.`,
      metadata: {
        winner: winnerAgentName,
        loser: loserAgentName,
        topic,
        actionsResumed: resumed,
      },
    },
  } as any)

  await logConflict(organizationId, winner?.id || "", ORCHESTRATION_EVENT_TYPES.CONFLICT_RESOLVED, {
    winner: winnerAgentName,
    loser: loserAgentName,
    topic,
    actionsResumed: resumed,
  })

  return {
    resolved: true,
    winner: winner?.name || winnerAgentName,
    loser: loser?.name || loserAgentName,
  }
}

// ─────────────────────────────────────────────────────────────
// 6. DEPENDENCY-AWARE ACTION MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Quando uma tarefa depende de outra (blockedById), pausa as ações
 * do agente designado até que a tarefa bloqueante seja concluída.
 */
export async function pauseActionsForBlockedAgent(
  organizationId: string,
  agentId: string,
  blockedByTaskId: string,
  reason: string,
): Promise<number> {
  const blockedTask = await prisma.task.findUnique({
    where: { id: blockedByTaskId },
    select: { title: true },
  })

  const count = await pauseRelatedActions(organizationId, [agentId])

  if (blockedTask && count > 0) {
    await logConflict(organizationId, agentId, "task_dependency_paused", {
      blockedByTaskId,
      blockedByTitle: blockedTask.title,
      reason,
      pausedActions: count,
    })
  }

  return count
}

/**
 * Quando uma tarefa bloqueante é concluída, retoma ações
 * de todos os agentes com tarefas bloqueadas por ela.
 */
export async function resumeActionsOnUnblock(
  organizationId: string,
  completedTaskId: string,
): Promise<number> {
  const blockedTasks = await prisma.task.findMany({
    where: {
      organizationId,
      blockedById: completedTaskId,
      blocked: true,
    },
    select: { assignedTo: true },
  })

  const agentIds = [
    ...new Set(blockedTasks.map(t => t.assignedTo).filter(Boolean)),
  ] as string[]

  if (agentIds.length === 0) return 0

  const resumed = await resumeRelatedActions(organizationId, agentIds)

  for (const agentId of agentIds) {
    await logConflict(organizationId, agentId, "task_dependency_resumed", {
      unblockedBy: completedTaskId,
      actionsResumed: resumed,
    })
  }

  return resumed
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

async function logConflict(
  organizationId: string,
  agentId: string,
  eventType: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.orchestrationLog.create({
      data: {
        organizationId,
        agentId,
        eventType,
        details,
      },
    } as any)
  } catch {
    // Logging never breaks execution
  }
}
