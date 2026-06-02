/**
 * ── AGENT AWARENESS MODULE ──────────────────────────────────
 *
 * Implementa o Agent Awareness Loop: cada agente detecta mudanças,
 * analisa relevância, decide ações e agenda execução.
 *
 * Baseado no documento: ORQUESTRAÇÃO DE AGENTES — PART 3 e PART 6
 */

import { prisma } from "@/lib/prisma"
import { scheduleAction } from "@/lib/orchestrator/scheduler"
import { chatCompletion } from "@/lib/ai/client"
import {
  getActionPriority,
  getPersonalityModifiers,
  calculateOrchestrationDelay,
  TIMING_CONFIG,
  ORCHESTRATION_EVENT_TYPES,
} from "@/lib/orchestrator/config"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DetectedChanges {
  mentions: Array<{
    id: string
    from: string | null
    fromAgentId: string | null
    content: string
    time: Date
    isFromCeo: boolean
  }>
  newTasks: Array<{
    id: string
    title: string
    priority: string
  }>
  unblockedTasks: Array<{
    id: string
    title: string
  }>
  awaitingApproval: Array<{
    id: string
    title: string
  }>
  stuckTask: {
    id: string
    title: string
    hoursStuck: number
  } | null
  stalePending: Array<{
    id: string
    title: string
    daysPending: number
  }>
  pendingReviews: Array<{
    id: string
    title: string
    daysWaiting: number
  }>
  currentTask: {
    id: string
    title: string
    status: string
    durationMs: number
    priority: string
    lastCommunicatedAt: Date | null
  } | null
  recentMessages: Array<{
    id: string
    content: string
    agentName: string | null
    agentRole: string | null
    createdAt: Date
  }>
  hasPendingTasks: boolean
  pendingTaskCount: number
}

interface ScheduledActionSpec {
  type: string
  priority: number
  context: Record<string, unknown>
  reason: string
}

interface RelevanceAnalysis {
  relevant: boolean
  shouldParticipate: boolean
  contribution: string | null
  reason: string
}

// ─────────────────────────────────────────────────────────────
// 1. DETECT CHANGES — O Que Mudou?
// ─────────────────────────────────────────────────────────────

/**
 * Detecta todas as mudanças relevantes para um agente desde sua última checagem.
 * Esta é a função PULL do awareness loop.
 */
export async function detectChanges(
  agentId: string,
  organizationId: string,
  since: Date,
): Promise<DetectedChanges> {
  const now = new Date()
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, name: true, role: true },
  })

  if (!agent) {
    throw new Error("Agent not found")
  }

  // ── Mentions ────────────────────────────────────────────
  const mentions = await prisma.message.findMany({
    where: {
      agent: { organizationId },
      createdAt: { gte: since },
      content: { contains: agent.name, mode: "insensitive" },
      agentId: { not: agent.id },
    },
    include: { agent: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  const mappedMentions = mentions.map(m => ({
    id: m.id,
    from: m.agent?.name || null,
    fromAgentId: m.agentId,
    content: m.content.slice(0, 200),
    time: m.createdAt,
    isFromCeo: !m.agentId && !!m.userId,
  }))

  // ── New Tasks ───────────────────────────────────────────
  const newTasks = await prisma.task.findMany({
    where: {
      organizationId,
      assignedTo: agent.id,
      createdAt: { gte: since },
    },
    orderBy: { priority: "desc" },
  })

  // ── Unblocked Tasks ─────────────────────────────────────
  const unblockedTasks = await prisma.task.findMany({
    where: {
      organizationId,
      assignedTo: agent.id,
      blocked: false,
      updatedAt: { gte: since },
      blockedById: null,
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  })

  // ── Awaiting Approval ───────────────────────────────────
  const awaitingApproval = await prisma.task.findMany({
    where: {
      organizationId,
      assignedTo: agent.id,
      status: "IN_REVIEW",
    },
    take: 3,
  })

  // ── Current Task ────────────────────────────────────────
  const currentTask = await prisma.task.findFirst({
    where: { organizationId, assignedTo: agent.id, status: "IN_PROGRESS" },
  })

  // ── Stuck Task (>8h no update) ─────────────────────────
  let stuckTask: DetectedChanges["stuckTask"] = null
  if (currentTask) {
    const stuckThreshold = new Date(now.getTime() - TIMING_CONFIG.STUCK_TASK_THRESHOLD_MS)
    if (currentTask.updatedAt < stuckThreshold) {
      stuckTask = {
        id: currentTask.id,
        title: currentTask.title,
        hoursStuck: Math.floor((now.getTime() - currentTask.updatedAt.getTime()) / 3600000),
      }
    }
  }

  // ── Stale Pending (>24h em TODO) ───────────────────────
  const staleThreshold = new Date(now.getTime() - TIMING_CONFIG.PENDING_TASK_ALERT_MS)
  const stalePending = await prisma.task.findMany({
    where: {
      organizationId,
      assignedTo: agent.id,
      status: "TODO",
      createdAt: { lt: staleThreshold },
    },
    take: 3,
  })

  // ── Pending Reviews (>24h em IN_REVIEW) ────────────────
  const reviewThreshold = new Date(now.getTime() - TIMING_CONFIG.REVIEW_REMINDER_MS)
  const pendingReviews = await prisma.task.findMany({
    where: {
      organizationId,
      assignedTo: agent.id,
      status: "IN_REVIEW",
      updatedAt: { lt: reviewThreshold },
    },
    take: 3,
  })

  // ── Recent Messages ─────────────────────────────────────
  const recentMessages = await prisma.message.findMany({
    where: {
      channel: { organizationId },
      createdAt: { gte: since },
      agentId: { not: agent.id },
    },
    include: { agent: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  // ── Pending Tasks ───────────────────────────────────────
  const pendingTasks = await prisma.task.findMany({
    where: {
      organizationId,
      status: "TODO",
      blocked: false,
      OR: [{ assignedTo: agent.id }, { assignedTo: null }],
    },
    orderBy: { priority: "desc" },
    take: 5,
  })

  return {
    mentions: mappedMentions,
    newTasks: newTasks.map(t => ({ id: t.id, title: t.title, priority: t.priority })),
    unblockedTasks: unblockedTasks.map(t => ({ id: t.id, title: t.title })),
    awaitingApproval: awaitingApproval.map(t => ({ id: t.id, title: t.title })),
    stuckTask,
    stalePending: stalePending.map(t => ({
      id: t.id,
      title: t.title,
      daysPending: Math.floor((now.getTime() - t.createdAt.getTime()) / 86400000),
    })),
    pendingReviews: pendingReviews.map(t => ({
      id: t.id,
      title: t.title,
      daysWaiting: Math.floor((now.getTime() - t.updatedAt.getTime()) / 86400000),
    })),
    currentTask: currentTask
      ? {
          id: currentTask.id,
          title: currentTask.title,
          status: currentTask.status,
          durationMs: now.getTime() - new Date(currentTask.startedAt || currentTask.updatedAt).getTime(),
          priority: currentTask.priority,
          lastCommunicatedAt: currentTask.lastCommunicatedAt,
        }
      : null,
    recentMessages: recentMessages.map(m => ({
      id: m.id,
      content: m.content.slice(0, 200),
      agentName: m.agent?.name || null,
      agentRole: m.agent?.role || null,
      createdAt: m.createdAt,
    })),
    hasPendingTasks: pendingTasks.length > 0,
    pendingTaskCount: pendingTasks.length,
  }
}

// ─────────────────────────────────────────────────────────────
// 2. ANALYZE & DECIDE — Preciso Agir?
// ─────────────────────────────────────────────────────────────

/**
 * Analisa as mudanças detectadas e retorna uma lista priorizada de ações.
 * Esta é a função ANALYZE do awareness loop.
 */
export function analyzeAndDecideActions(
  changes: DetectedChanges,
  agentName: string,
  agentStatus: string,
  channelId: string | null,
): ScheduledActionSpec[] {
  const actions: ScheduledActionSpec[] = []

  // Prioridade 10: CEO mencionou diretamente
  const ceoMentions = changes.mentions.filter(m => m.isFromCeo)
  if (ceoMentions.length > 0) {
    actions.push({
      type: "respond_to_ceo",
      priority: getActionPriority("respond_to_ceo"),
      context: {
        message: ceoMentions.map(m => m.content).join(" | "),
        mentionedBy: ceoMentions.map(m => m.fromAgentId).filter(Boolean),
        channelId,
      },
      reason: "CEO enviou mensagem diretamente",
    })
  }

  // Prioridade 9: Foi mencionado por outro agente
  const agentMentions = changes.mentions.filter(m => !m.isFromCeo)
  if (agentMentions.length > 0) {
    actions.push({
      type: "respond_to_mention",
      priority: getActionPriority("respond_to_mention"),
      context: {
        message: agentMentions.map(m => m.content).join(" | "),
        mentionedBy: agentMentions.map(m => m.fromAgentId).filter(Boolean),
        channelId,
      },
      reason: `Mencionado por ${agentMentions.map(m => m.from).filter(Boolean).join(", ")}`,
    })
  }

  // Prioridade 9: Tarefa desbloqueada
  if (changes.unblockedTasks.length > 0) {
    for (const task of changes.unblockedTasks) {
      actions.push({
        type: "start_unblocked_task",
        priority: getActionPriority("start_unblocked_task"),
        context: { taskId: task.id, taskTitle: task.title, channelId },
        reason: `Tarefa desbloqueada: "${task.title}"`,
      })
    }
  }

  // Prioridade 8: Nova tarefa urgente atribuída
  const urgentNewTasks = changes.newTasks.filter(t => t.priority === "CRITICAL" || t.priority === "HIGH")
  for (const task of urgentNewTasks) {
    actions.push({
      type: "acknowledge_urgent_task",
      priority: getActionPriority("acknowledge_urgent_task"),
      context: { taskId: task.id, taskTitle: task.title, channelId },
      reason: `Tarefa urgente atribuída: "${task.title}"`,
    })
  }

  // Prioridade 7: Nova tarefa normal atribuída
  const normalNewTasks = changes.newTasks.filter(t => t.priority !== "CRITICAL" && t.priority !== "HIGH")
  for (const task of normalNewTasks) {
    actions.push({
      type: "acknowledge_task",
      priority: getActionPriority("acknowledge_task"),
      context: { taskId: task.id, taskTitle: task.title, channelId },
      reason: `Nova tarefa: "${task.title}"`,
    })
  }

  // Prioridade 6: Ocioso e tem tarefas disponíveis
  if (
    agentStatus !== "WORKING" &&
    agentStatus !== "IN_MEETING" &&
    !changes.currentTask &&
    changes.hasPendingTasks
  ) {
    actions.push({
      type: "pick_next_task",
      priority: getActionPriority("pick_next_task"),
      context: { availableCount: changes.pendingTaskCount, channelId },
      reason: "Ocioso com tarefas disponíveis",
    })
  }

  // Prioridade 5: Tarefa em progresso travada ou longa sem update
  if (changes.stuckTask) {
    actions.push({
      type: "report_progress",
      priority: getActionPriority("report_progress"),
      context: {
        taskId: changes.stuckTask.id,
        taskTitle: changes.stuckTask.title,
        hoursStuck: changes.stuckTask.hoursStuck,
        channelId,
      },
      reason: `Tarefa travada há ${changes.stuckTask.hoursStuck}h: "${changes.stuckTask.title}"`,
    })
  } else if (changes.currentTask) {
    const taskDuration = changes.currentTask.durationMs
    const timeSinceLastComm = changes.currentTask.lastCommunicatedAt
      ? Date.now() - changes.currentTask.lastCommunicatedAt.getTime()
      : taskDuration

    if (
      taskDuration > TIMING_CONFIG.LONG_TASK_THRESHOLD_MS &&
      timeSinceLastComm > TIMING_CONFIG.PROGRESS_UPDATE_INTERVAL_MS
    ) {
      actions.push({
        type: "report_progress",
        priority: getActionPriority("report_progress"),
        context: {
          taskId: changes.currentTask.id,
          taskTitle: changes.currentTask.title,
          channelId,
        },
        reason: `Tarefa longa (>2h) sem update: "${changes.currentTask.title}"`,
      })
    }
  }

  // Prioridade 4: Tarefa parada há >24h
  if (changes.stalePending.length > 0) {
    for (const task of changes.stalePending) {
      actions.push({
        type: "acknowledge_pending_task",
        priority: getActionPriority("acknowledge_pending_task"),
        context: {
          taskId: task.id,
          taskTitle: task.title,
          daysPending: task.daysPending,
          channelId,
        },
        reason: `Tarefa parada há ${task.daysPending} dias: "${task.title}"`,
      })
    }
  }

  // Prioridade 4: Conversa relevante acontecendo
  if (changes.recentMessages.length >= 2 && channelId) {
    actions.push({
      type: "join_conversation",
      priority: getActionPriority("join_conversation"),
      context: {
        conversationTopic: changes.recentMessages
          .slice(0, 3)
          .map(m => `${m.agentName || "alguém"}: ${m.content.slice(0, 60)}`)
          .join(" | "),
        recentCount: changes.recentMessages.length,
        channelId,
      },
      reason: "Conversa ativa no canal",
    })
  }

  // Prioridade 3: Tarefa em revisão há >24h
  if (changes.pendingReviews.length > 0) {
    for (const task of changes.pendingReviews) {
      actions.push({
        type: "gentle_reminder",
        priority: getActionPriority("gentle_reminder"),
        context: {
          taskId: task.id,
          taskTitle: task.title,
          daysWaiting: task.daysWaiting,
          channelId,
        },
        reason: `Em revisão há ${task.daysWaiting} dias: "${task.title}"`,
      })
    }
  }

  // Ordenar por prioridade (maior primeiro)
  actions.sort((a, b) => b.priority - a.priority)

  return actions
}

// ─────────────────────────────────────────────────────────────
// 3. FULL AWARENESS CHECK — Detect → Analyze → Schedule → Update
// ─────────────────────────────────────────────────────────────

/**
 * Executa o loop completo de awareness para um agente:
 * 1. Detecta mudanças desde a última checagem
 * 2. Analisa e decide quais ações são necessárias
 * 3. Agenda as ações no scheduler
 * 4. Atualiza o timestamp de última checagem do agente
 *
 * Usado tanto pelo endpoint /api/agents/awareness quanto pelo heartbeat.
 */
export async function runAwarenessCheck(
  agentId: string,
  organizationId: string,
): Promise<{
  changes: DetectedChanges
  actionsScheduled: number
  actions: Array<{ type: string; priority: number; reason: string }>
}> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, name: true, status: true, lastCheckAt: true },
  })

  if (!agent) {
    throw new Error("Agent not found")
  }

  const channel = await prisma.channel.findFirst({
    where: { organizationId, name: "geral" },
    select: { id: true },
  })
  const channelId = channel?.id || null

  // 1. DETECT: O que mudou?
  const since = agent.lastCheckAt
    ? new Date(agent.lastCheckAt)
    : new Date(Date.now() - TIMING_CONFIG.AGENT_CHECK_INTERVAL_MS)

  const changes = await detectChanges(agentId, organizationId, since)

  // 2. ANALYZE: Preciso agir?
  const decidedActions = analyzeAndDecideActions(changes, agent.name, agent.status, channelId)

  // 3. SCHEDULE: Agendar ações
  let scheduled = 0
  const actionSummaries: Array<{ type: string; priority: number; reason: string }> = []

  // If agent needs to analyze something complex, enter THINKING state
  const needsThinking = decidedActions.some(a => a.priority >= 7)
  if (needsThinking && agent.status !== "IN_MEETING") {
    await prisma.agent.update({
      where: { id: agentId },
      data: { workState: "THINKING" },
    })
  }

  for (const action of decidedActions) {
    // Skip join_conversation if random participation check fails
    if (action.type === "join_conversation") {
      const personality = getPersonalityModifiers(agent.name)
      if (Math.random() >= personality.participation) {
        continue
      }
    }

    try {
      await scheduleAction({
        organizationId,
        agentId,
        agentName: agent.name,
        type: action.type,
        priority: action.priority,
        context: action.context,
      })
      scheduled++
      actionSummaries.push({
        type: action.type,
        priority: action.priority,
        reason: action.reason,
      })
    } catch {
      // Log falha mas não interrompe outras ações
      await logAwareness(organizationId, agent.id, ORCHESTRATION_EVENT_TYPES.ERROR, {
        error: `Failed to schedule ${action.type}`,
        reason: action.reason,
      })
    }
  }

  // 4. UPDATE: Persistir timestamp
  await prisma.agent.update({
    where: { id: agentId },
    data: { lastCheckAt: new Date() },
  })

  // Log do check
  await logAwareness(organizationId, agent.id, ORCHESTRATION_EVENT_TYPES.AWARENESS_CHECK, {
    changesDetected: {
      mentions: changes.mentions.length,
      newTasks: changes.newTasks.length,
      unblocked: changes.unblockedTasks.length,
      stuck: !!changes.stuckTask,
      stale: changes.stalePending.length,
      reviews: changes.pendingReviews.length,
    },
    actionsScheduled: scheduled,
    actions: actionSummaries,
  })

  return {
    changes,
    actionsScheduled: scheduled,
    actions: actionSummaries,
  }
}

// ─────────────────────────────────────────────────────────────
// 4. AI-DRIVEN CONVERSATION RELEVANCE
// ─────────────────────────────────────────────────────────────

/**
 * Analisa com IA se um agente deve participar de uma conversa.
 * Substitui a decisão puramente randômica por análise contextual.
 *
 * Baseado no documento: PART 6 — Análise de Relevância
 */
export async function analyzeConversationRelevance(
  agentId: string,
  messages: Array<{ authorName: string; content: string }>,
): Promise<RelevanceAnalysis> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { name: true, role: true },
  })

  if (!agent) {
    return { relevant: false, shouldParticipate: false, contribution: null, reason: "Agent not found" }
  }

  // Se menos de 2 mensagens, não tem conversa para analisar
  if (messages.length < 2) {
    return { relevant: false, shouldParticipate: false, contribution: null, reason: "Conversa muito curta" }
  }

  // Se o agente já falou recentemente, evitar redundância
  const personality = getPersonalityModifiers(agent.name)

  const prompt = `Voce e um sistema de coordenacao de agentes. Analise se o agente abaixo deve participar de uma conversa.

AGENTE: ${agent.name} (${agent.role})
PERSONALIDADE: ${personality.description}

MENSAGENS RECENTES:
${messages.map(m => `- ${m.authorName}: ${m.content.slice(0, 150)}`).join("\n")}

ANALISE:
1. Essa conversa e relevante para ${agent.name}? (sim/nao)
2. ${agent.name} tem algo UTIL para adicionar que ainda nao foi dito? (sim/nao)
3. Se sim, qual seria a contribuicao? (1 frase curta)

REGRAS:
- Nao participe se nao tiver algo especifico e util
- Nao repita o que ja foi dito
- Nao fale so por falar
- Se outro agente da mesma area ja falou, evite redundancia

Responda APENAS com JSON (sem markdown):
{"relevant":true|false,"shouldParticipate":true|false,"contribution":"frase ou null","reason":"razao curta"}`

  try {
    const reply = await chatCompletion(`[SYSTEM]\n${prompt}\n\n[USER]\nAnalise.`, {
      temperature: 0.3,
      maxTokens: 200,
    })

    const jsonMatch = reply.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const analysis: RelevanceAnalysis = JSON.parse(jsonMatch[0])
      return analysis
    }
  } catch {
    // Fallback: decisão probabilística baseada em personalidade
  }

  // Fallback: random check based on personality
  return {
    relevant: Math.random() < personality.participation,
    shouldParticipate: Math.random() < personality.participation,
    contribution: null,
    reason: "Fallback: decisão probabilística",
  }
}

// ─────────────────────────────────────────────────────────────
// 5. WAIT FOR RIGHT MOMENT — Silêncio no Canal
// ─────────────────────────────────────────────────────────────

/**
 * Aguarda o momento certo para um agente falar em um canal.
 * Verifica se há silêncio suficiente desde a última mensagem
 * e aplica delays baseados em personalidade.
 *
 * Baseado no documento: PART 6 — Esperar o Momento Certo
 */
export async function waitForRightMoment(
  agentId: string,
  channelId: string,
  maxWaitMs: number = 15000,
): Promise<{ ready: boolean; waitedMs: number }> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { name: true },
  })

  if (!agent) {
    return { ready: true, waitedMs: 0 }
  }

  const personality = getPersonalityModifiers(agent.name)
  const startTime = Date.now()

  // 1. Verificar última mensagem no canal
  const lastMessage = await prisma.message.findFirst({
    where: { channelId },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  })

  if (lastMessage) {
    const timeSinceLastMessage = Date.now() - lastMessage.createdAt.getTime()

    // Se última mensagem foi há menos de 5 segundos, esperar
    const minSilence = TIMING_CONFIG.TURN_BREATHING_ROOM_MS
    if (timeSinceLastMessage < minSilence) {
      const waitTime = minSilence - timeSinceLastMessage
      await sleep(waitTime)
    }
  }

  // 2. Delay adicional baseado em personalidade
  const personalityDelay = personality.minDelay
  await sleep(Math.min(personalityDelay, maxWaitMs - (Date.now() - startTime)))

  // 3. Verificar se alguém não falou enquanto esperávamos
  const newLastMessage = await prisma.message.findFirst({
    where: { channelId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  const someoneElseSpoke = lastMessage && newLastMessage && newLastMessage.id !== lastMessage.id

  const totalWaited = Date.now() - startTime

  return {
    ready: !someoneElseSpoke || totalWaited >= maxWaitMs,
    waitedMs: totalWaited,
  }
}

// ─────────────────────────────────────────────────────────────
// 6. BULK AWARENESS — Para todos os agentes de uma org
// ─────────────────────────────────────────────────────────────

/**
 * Executa o awareness check para todos os agentes ativos de uma organização.
 * Usado pelo heartbeat.
 */
export async function runBulkAwarenessCheck(
  organizationId: string,
): Promise<
  Array<{
    agentId: string
    agentName: string
    actionsScheduled: number
    actions: Array<{ type: string; priority: number; reason: string }>
  }>
> {
  const agents = await prisma.agent.findMany({
    where: {
      organizationId,
      status: { notIn: ["FIRED", "OFFLINE"] },
    },
    select: { id: true, name: true },
  })

  const results: Array<{
    agentId: string
    agentName: string
    actionsScheduled: number
    actions: Array<{ type: string; priority: number; reason: string }>
  }> = []

  for (const agent of agents) {
    try {
      const result = await runAwarenessCheck(agent.id, organizationId)
      results.push({
        agentId: agent.id,
        agentName: agent.name,
        actionsScheduled: result.actionsScheduled,
        actions: result.actions,
      })
    } catch (err) {
      console.error(`[Awareness] Error for ${agent.name}:`, err)
      results.push({
        agentId: agent.id,
        agentName: agent.name,
        actionsScheduled: 0,
        actions: [],
      })
    }
  }

  return results
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function logAwareness(
  organizationId: string,
  agentId: string,
  eventType: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.orchestrationLog.create({
      data: { organizationId, agentId, eventType, details },
    } as any)
  } catch {
    // Logging never breaks execution
  }
}
