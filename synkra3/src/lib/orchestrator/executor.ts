/**
 * ── UNIFIED EXECUTION ENGINE ────────────────────────────────
 *
 * Centraliza a execução de todos os tipos de ação dos agentes.
 * Cada ação passa pelo fluxo: validar → adquirir turno → simular digitação → executar → liberar turno.
 *
 * Baseado no documento: ORQUESTRAÇÃO DE AGENTES — PART 9
 */

import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"
import {
  requestTurn,
  releaseTurn,
  setTypingIndicator,
  clearTypingIndicator,
  calculateTypingTime,
  getPersonality,
  getTurnMetrics,
} from "@/lib/orchestrator/turns"
import {
  getActionPriority,
  calculateOrchestrationTypingTime,
  ORCHESTRATION_EVENT_TYPES,
  getTaskDurationMinutes,
} from "@/lib/orchestrator/config"
import { resumeActionsOnUnblock } from "@/lib/orchestrator/conflict"
import { writeBridgeWorkActivity, getToolForTask } from "@/lib/orchestrator/bridgeWork"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ExecutionContext {
  organizationId: string
  agent: {
    id: string
    name: string
    role: string
    personality: string
  }
  channelId: string | null
}

export interface ExecutionResult {
  success: boolean
  action: string
  error?: string
  messageId?: string
  taskId?: string
}

interface ActionRecord {
  id: string
  type: string
  priority: number
  context: Record<string, unknown>
  agentId: string
}

// ─────────────────────────────────────────────────────────────
// Role → Task Type matching (for auto-assignment)
// ─────────────────────────────────────────────────────────────

const ROLE_TASK_MATCH: Record<string, string[]> = {
  STRATEGIST: ["content", "campaign"],
  DESIGNER: ["content", "campaign"],
  COPYWRITER: ["content"],
  ANALYST: ["analysis", "technical"],
  SOCIAL_MEDIA: ["content", "campaign"],
  SEO: ["analysis", "technical"],
  MEDIA_BUYER: ["analysis", "campaign"],
  COMMUNITY_MANAGER: ["content"],
  CREATIVE_DIRECTOR: ["content", "campaign"],
  TRAFFIC_MANAGER: ["analysis", "campaign"],
}

// ─────────────────────────────────────────────────────────────
// MAIN DISPATCHER
// ─────────────────────────────────────────────────────────────

export async function executeAction(
  action: ActionRecord,
  channelId: string | null,
): Promise<ExecutionResult> {
  const agent = await prisma.agent.findUnique({
    where: { id: action.agentId },
    select: { id: true, name: true, role: true, personality: true, organizationId: true },
  })

  if (!agent) {
    return { success: false, action: action.type, error: "Agent not found" }
  }

  const ctx: ExecutionContext = {
    organizationId: agent.organizationId,
    agent: { id: agent.id, name: agent.name, role: agent.role, personality: agent.personality },
    channelId,
  }

  // Log execution start
  await logOrchestration(ctx.organizationId, agent.id, ORCHESTRATION_EVENT_TYPES.ACTION_EXECUTING, {
    actionId: action.id,
    actionType: action.type,
    priority: action.priority,
  })

  try {
    const result = await dispatchAction(action, ctx)

    if (result.success) {
      await logOrchestration(ctx.organizationId, agent.id, ORCHESTRATION_EVENT_TYPES.ACTION_COMPLETED, {
        actionId: action.id,
        actionType: action.type,
        ...result,
      })
    }

    return result
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    await logOrchestration(ctx.organizationId, agent.id, ORCHESTRATION_EVENT_TYPES.ACTION_FAILED, {
      actionId: action.id,
      actionType: action.type,
      error: message,
    })
    return { success: false, action: action.type, error: message }
  }
}

// ─────────────────────────────────────────────────────────────
// ACTION DISPATCHER
// ─────────────────────────────────────────────────────────────

async function dispatchAction(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  switch (action.type) {
    // ── Comunicação ──────────────────────────────────────
    case "post_message":
      return executePostMessage(action, ctx)
    case "respond_to_mention":
      return executeRespondToMention(action, ctx)
    case "respond_to_agent":
      return executeRespondToAgent(action, ctx)
    case "respond_to_ceo":
      return executeRespondToCeo(action, ctx)
    case "join_conversation":
      return executeJoinConversation(action, ctx)

    // ── Tarefas ──────────────────────────────────────────
    case "acknowledge_task":
    case "acknowledge_urgent_task":
      return executeAcknowledgeTask(action, ctx)
    case "acknowledge_pending_task":
      return executeAcknowledgePendingTask(action, ctx)
    case "acknowledge_feedback":
      return executeAcknowledgeFeedback(action, ctx)
    case "start_task":
    case "start_unblocked_task":
      return executeStartTask(action, ctx)
    case "complete_task":
      return executeCompleteTask(action, ctx)
    case "report_progress":
      return executeReportProgress(action, ctx)
    case "pick_next_task":
      return executePickNextTask(action, ctx)
    case "move_task":
      return executeMoveTask(action, ctx)
    case "update_task":
      return executeUpdateTask(action, ctx)
    case "request_approval":
      return executeRequestApproval(action, ctx)

    // ── Sistema ──────────────────────────────────────────
    case "speak_in_daily":
      return executeSpeakInDaily(action, ctx)
    case "update_state":
      return executeUpdateState(action, ctx)
    case "gentle_reminder":
      return executeGentleReminder(action, ctx)
    case "routine_check":
      return executeRoutineCheck(action, ctx)

    default:
      return { success: false, action: action.type, error: `Unknown action type: ${action.type}` }
  }
}

// ─────────────────────────────────────────────────────────────
// COMUNICAÇÃO
// ─────────────────────────────────────────────────────────────

async function executePostMessage(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const content = action.context.content as string | undefined
  const targetChannelId = (action.context.channelId as string) || ctx.channelId

  if (!content || !targetChannelId) {
    return { success: false, action: "post_message", error: "Missing content or channelId" }
  }

  return postWithTurn(ctx, targetChannelId, content, action.priority, action.context.threadId as string | undefined)
}

async function executeRespondToMention(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const message = (action.context.message as string) || "Oi"
  const targetChannelId = (action.context.channelId as string) || ctx.channelId

  if (!targetChannelId) {
    return { success: false, action: "respond_to_mention", error: "No channel" }
  }

  const prompt = `Voce e ${ctx.agent.name}. Responda a esta mensagem em 1-2 frases, em primeira pessoa.
Mensagem recebida: "${message}".
Seja natural. Nao diga que e IA. Use o tom da sua personalidade.`

  const reply = await chatCompletion(prompt, { maxTokens: 150, temperature: 0.8 })
  const cleaned = reply.replace(/^(Claro|Certo|Com certeza|OK|Ok|Entendido|Beleza)[,!.]?\s*/i, "").trim()

  return postWithTurn(ctx, targetChannelId, cleaned, action.priority)
}

async function executeRespondToAgent(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const message = (action.context.message as string) || "Oi"
  const targetChannelId = (action.context.channelId as string) || ctx.channelId

  if (!targetChannelId) {
    return { success: false, action: "respond_to_agent", error: "No channel" }
  }

  const prompt = `Voce e ${ctx.agent.name}. Um colega de equipe te mencionou ou falou com voce. Responda em 1-2 frases, em primeira pessoa.
Mensagem recebida: "${message}".
Seja colaborativo e natural. Nao diga que e IA.`

  const reply = await chatCompletion(prompt, { maxTokens: 150, temperature: 0.8 })
  const cleaned = reply.replace(/^(Claro|Certo|Com certeza|OK|Ok|Entendido|Beleza)[,!.]?\s*/i, "").trim()

  // Agent is communicating while working → WORKING_VISIBLE
  await prisma.agent.update({
    where: { id: ctx.agent.id },
    data: { workState: "WORKING_VISIBLE" },
  }).catch(() => {})

  return postWithTurn(ctx, targetChannelId, cleaned, action.priority)
}

async function executeRespondToCeo(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const message = (action.context.message as string) || "Oi"
  const targetChannelId = (action.context.channelId as string) || ctx.channelId

  if (!targetChannelId) {
    return { success: false, action: "respond_to_ceo", error: "No channel" }
  }

  const prompt = `Voce e ${ctx.agent.name}. O CEO (seu chefe) te mandou uma mensagem. Responda com respeito e clareza, em 1-2 frases.
Mensagem do CEO: "${message}".
Seja profissional mas direto. Nao diga que e IA.`

  const reply = await chatCompletion(prompt, { maxTokens: 150, temperature: 0.7 })
  const cleaned = reply.replace(/^(Claro|Certo|Com certeza|OK|Ok|Entendido|Beleza)[,!.]?\s*/i, "").trim()

  return postWithTurn(ctx, targetChannelId, cleaned, 10)
}

async function executeJoinConversation(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const conversationTopic = (action.context.conversationTopic as string) || "conversa da equipe"
  const targetChannelId = (action.context.channelId as string) || ctx.channelId

  if (!targetChannelId) {
    return { success: false, action: "join_conversation", error: "No channel" }
  }

  const prompt = `Voce e ${ctx.agent.name}. Voce entrou em uma conversa relevante. Contribua em 1-2 frases, em primeira pessoa.
Contexto: "${conversationTopic}".
Seja natural. Traga valor real para a discussao. Nao diga que e IA.`

  const reply = await chatCompletion(prompt, { maxTokens: 150, temperature: 0.8 })
  const cleaned = reply.replace(/^(Claro|Certo|Com certeza|OK|Ok|Entendido|Beleza)[,!.]?\s*/i, "").trim()

  return postWithTurn(ctx, targetChannelId, cleaned, action.priority)
}

// ─────────────────────────────────────────────────────────────
// TAREFAS
// ─────────────────────────────────────────────────────────────

async function executeAcknowledgeTask(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const title = (action.context.taskTitle as string) || "uma tarefa"
  const eta = action.context.eta as string | undefined
  const targetChannelId = (action.context.channelId as string) || ctx.channelId

  if (!targetChannelId) {
    return { success: false, action: "acknowledge_task", error: "No channel" }
  }

  const content = `Vi a tarefa "${title}".${eta ? ` ETA: ${eta}` : " Vou iniciar em breve."}`
  return postWithTurn(ctx, targetChannelId, content, action.priority)
}

async function executeAcknowledgePendingTask(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const title = (action.context.taskTitle as string) || "uma tarefa"
  const daysPending = (action.context.daysPending as number) || 1
  const targetChannelId = (action.context.channelId as string) || ctx.channelId

  if (!targetChannelId) {
    return { success: false, action: "acknowledge_pending_task", error: "No channel" }
  }

  const content = `A tarefa "${title}" esta parada ha ${daysPending} dia(s). Vou comecar ela agora.`
  return postWithTurn(ctx, targetChannelId, content, action.priority)
}

async function executeAcknowledgeFeedback(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const feedback = (action.context.feedback as string) || "recebi o feedback"
  const targetChannelId = (action.context.channelId as string) || ctx.channelId

  if (!targetChannelId) {
    return { success: false, action: "acknowledge_feedback", error: "No channel" }
  }

  const content = `Entendido! Ajustando conforme o feedback: "${feedback.slice(0, 100)}".`
  return postWithTurn(ctx, targetChannelId, content, action.priority)
}

async function executeStartTask(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const taskId = action.context.taskId as string
  if (!taskId) {
    return { success: false, action: "start_task", error: "Missing taskId" }
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) {
    return { success: false, action: "start_task", error: "Task not found" }
  }

  // 1. Update task
  await prisma.task.update({
    where: { id: taskId },
    data: {
      assignedTo: ctx.agent.id,
      status: "IN_PROGRESS",
      startedAt: task.startedAt || new Date(),
      progress: 0,
      estimatedMinutes: task.estimatedMinutes
        || getTaskDurationMinutes(task.type || "content", task.priority),
    },
  })

  // 2. Update agent
  await prisma.agent.update({
    where: { id: ctx.agent.id },
    data: { status: "WORKING", workState: "WORKING_SILENT" },
  })

  // 3. Unblock dependent tasks
  const blockedTasks = await prisma.task.findMany({
    where: { blockedById: taskId, blocked: true },
  })
  for (const bt of blockedTasks) {
    await prisma.task.update({
      where: { id: bt.id },
      data: { blocked: false, blockedById: null, blockedReason: null },
    })
    await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.TASK_UNBLOCKED, {
      taskId: bt.id,
      title: bt.title,
      unblockedBy: taskId,
    })
    // Resume paused actions for agents whose tasks were blocked by this one
    if (bt.assignedTo) {
      await resumeActionsOnUnblock(ctx.organizationId, taskId)
    }
  }

  // 4. Optionally communicate
  const targetChannelId = (action.context.channelId as string) || ctx.channelId
  if (targetChannelId) {
    const isImportant = task.priority === "HIGH" || task.priority === "CRITICAL"
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const tasksToday = await prisma.task.count({
      where: {
        assignedTo: ctx.agent.id,
        status: { in: ["IN_PROGRESS", "IN_REVIEW", "DONE"] },
        updatedAt: { gte: todayStart },
      },
    })
    const isFirstToday = tasksToday <= 1

    if (isImportant || isFirstToday) {
      const isUrgent = action.type === "start_unblocked_task"
      const prefix = isUrgent ? "Desbloqueado! " : ""
      await postWithTurn(ctx, targetChannelId, `${prefix}Comecando: "${task.title}".`, action.priority)
    }
  }

  await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.TASK_STARTED, {
    taskId,
    title: task.title,
    priority: task.priority,
  })

  // Bridge: pixel office shows real work
  writeBridgeWorkActivity(
    ctx.agent.id,
    ctx.agent.name,
    task.title,
    getToolForTask(task.type || "content"),
    `Comecando: ${task.title}`,
  )

  return { success: true, action: "start_task", taskId }
}

async function executeCompleteTask(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const taskId = action.context.taskId as string
  if (!taskId) {
    return { success: false, action: "complete_task", error: "Missing taskId" }
  }

  // 1. Update task
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "IN_REVIEW",
      completedAt: new Date(),
      lastCommunicatedAt: new Date(),
      progress: 100,
    },
  })

  // 2. Update agent
  await prisma.agent.update({
    where: { id: ctx.agent.id },
    data: {
      status: "ACTIVE",
      workState: "IDLE",
      performance: { increment: 0.5 },
    },
  })

  // 3. Auto-unblock dependent tasks
  const blockedTasks = await prisma.task.findMany({
    where: { blockedById: taskId, blocked: true },
  })
  for (const bt of blockedTasks) {
    await prisma.task.update({
      where: { id: bt.id },
      data: { blocked: false, blockedById: null, blockedReason: null },
    })
    await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.TASK_UNBLOCKED, {
      taskId: bt.id,
      title: bt.title,
      unblockedBy: taskId,
    })
    // Resume paused actions for agents whose tasks were blocked by this one
    if (bt.assignedTo) {
      await resumeActionsOnUnblock(ctx.organizationId, taskId)
    }
  }

  // 4. Optionally communicate
  const targetChannelId = (action.context.channelId as string) || ctx.channelId
  if (targetChannelId) {
    const title = (action.context.taskTitle as string) || "tarefa"
    await postWithTurn(ctx, targetChannelId, `Conclui: "${title}". Pronto para revisao!`, action.priority)
  }

  await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.TASK_COMPLETED, {
    taskId,
    title: action.context.taskTitle,
  })

  // Bridge: pixel office shows completion
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true, type: true } })
  if (task) {
    writeBridgeWorkActivity(
      ctx.agent.id,
      ctx.agent.name,
      task.title,
      "bash",
      `Concluido: ${task.title}`,
    )
  }

  // ── Post-completion: generate follow-up tasks ──────────
  await suggestNextTasks(ctx.organizationId, taskId, ctx.agent, action.context.taskTitle as string)

  return { success: true, action: "complete_task", taskId }
}

/**
 * Gera 1-2 próximas tasks via AI ao completar uma task.
 * Cria workflow contínuo: terminar uma task → nasce a próxima.
 */
async function suggestNextTasks(
  organizationId: string,
  completedTaskId: string,
  agent: { id: string; name: string; role: string },
  taskTitle: string,
): Promise<void> {
  // Only generate follow-ups ~60% of the time (not every completion)
  if (Math.random() > 0.6) return

  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, onboarding: { select: { industry: true, brandVoice: true } } },
    })

    const prompt = `${agent.name} (${agent.role}) acabou de completar a tarefa "${taskTitle}" na agencia ${org?.name || "marketing"}.
${org?.onboarding?.industry ? `Setor: ${org.onboarding.industry}.` : ""}

Sugira 1-2 proximas tarefas naturais que fariam sentido como continuacao. Sejam especificas e acionaveis.

Retorne APENAS JSON array: [{"title":"...", "assignTo":"${agent.name}"}]`

    const reply = await chatCompletion(prompt, { temperature: 0.7, maxTokens: 300 })
    const jsonMatch = reply.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return

    const tasks: Array<{ title: string; assignTo?: string }> = JSON.parse(jsonMatch[0])
    const created: string[] = []

    for (const t of tasks) {
      if (!t.title || t.title.length < 5) continue

      // Match assignTo to an agent
      let assigneeId = agent.id
      if (t.assignTo && t.assignTo !== agent.name) {
        const matched = await prisma.agent.findFirst({
          where: { organizationId, name: { contains: t.assignTo, mode: "insensitive" } },
          select: { id: true },
        })
        if (matched) assigneeId = matched.id
      }

      // Use role-appropriate type and duration
      const matchedTypes = ROLE_TASK_MATCH[agent.role] || ["content"]
      const taskType = matchedTypes[0]

      const newTask = await prisma.task.create({
        data: {
          organizationId,
          title: t.title,
          status: "TODO",
          priority: "MEDIUM",
          type: taskType,
          assignedTo: assigneeId,
          estimatedMinutes: getTaskDurationMinutes(taskType, "MEDIUM"),
          description: `Continuacao de: "${taskTitle}"`,
        },
      } as any)
      created.push(newTask.title)
    }

    if (created.length > 0) {
      await logOrchestration(organizationId, agent.id, "followup_tasks_generated", {
        completedTaskId,
        completedTask: taskTitle,
        newTasks: created,
      })
    }
  } catch {
    // Follow-up generation is best-effort, never blocks completion
  }
}

async function executeReportProgress(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const title = (action.context.taskTitle as string) || "minha tarefa"
  const targetChannelId = (action.context.channelId as string) || ctx.channelId

  if (!targetChannelId) {
    return { success: false, action: "report_progress", error: "No channel" }
  }

  // Update last communicated timestamp
  if (action.context.taskId) {
    await prisma.task.update({
      where: { id: action.context.taskId as string },
      data: { lastCommunicatedAt: new Date() },
    })
  }

  // Bridge: pixel office shows progress
  writeBridgeWorkActivity(
    ctx.agent.id,
    ctx.agent.name,
    title,
    "edit",
    `Progresso: ${title}`,
  )

  // Agent is communicating while working → WORKING_VISIBLE
  await prisma.agent.update({
    where: { id: ctx.agent.id },
    data: { workState: "WORKING_VISIBLE" },
  }).catch(() => {})

  const content = `Atualizacao: Continuo trabalhando em "${title}". Progresso: indo bem.`
  return postWithTurn(ctx, targetChannelId, content, action.priority)
}

async function executePickNextTask(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const matchingTypes = ROLE_TASK_MATCH[ctx.agent.role] || ["content"]

  // Find best available task
  const task = await prisma.task.findFirst({
    where: {
      organizationId: ctx.organizationId,
      status: "TODO",
      blocked: false,
      OR: [
        { assignedTo: ctx.agent.id },
        { assignedTo: null, type: { in: matchingTypes } },
        { assignedTo: null },
      ],
    },
    orderBy: { priority: "desc" },
  })

  if (!task) {
    return { success: true, action: "pick_next_task", taskId: undefined }
  }

  // Start the task
  await prisma.task.update({
    where: { id: task.id },
    data: {
      assignedTo: ctx.agent.id,
      status: "IN_PROGRESS",
      startedAt: new Date(),
      progress: 0,
      estimatedMinutes: getTaskDurationMinutes(task.type || "content", task.priority),
    },
  })

  await prisma.agent.update({
    where: { id: ctx.agent.id },
    data: { status: "WORKING", workState: "WORKING_SILENT" },
  })

  const targetChannelId = (action.context.channelId as string) || ctx.channelId
  if (targetChannelId) {
    const isImportant = task.priority === "HIGH" || task.priority === "CRITICAL"
    if (isImportant) {
      await postWithTurn(ctx, targetChannelId, `Comecando: "${task.title}".`, action.priority)
    }
  }

  await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.TASK_STARTED, {
    taskId: task.id,
    title: task.title,
    priority: task.priority,
  })

  return { success: true, action: "pick_next_task", taskId: task.id }
}

async function executeMoveTask(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const taskId = action.context.taskId as string
  const toColumn = action.context.toColumn as string

  if (!taskId || !toColumn) {
    return { success: false, action: "move_task", error: "Missing taskId or toColumn" }
  }

  const statusMap: Record<string, string> = {
    todo: "TODO",
    in_progress: "IN_PROGRESS",
    in_review: "IN_REVIEW",
    done: "DONE",
    cancelled: "CANCELLED",
  }

  const status = statusMap[toColumn.toLowerCase()] || toColumn.toUpperCase()

  await prisma.task.update({
    where: { id: taskId },
    data: { status: status as any, updatedAt: new Date() },
  })

  return { success: true, action: "move_task", taskId }
}

async function executeUpdateTask(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const taskId = action.context.taskId as string
  const updates = action.context.updates as Record<string, unknown> | undefined

  if (!taskId || !updates) {
    return { success: false, action: "update_task", error: "Missing taskId or updates" }
  }

  await prisma.task.update({
    where: { id: taskId },
    data: updates as any,
  })

  return { success: true, action: "update_task", taskId }
}

async function executeRequestApproval(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const title = (action.context.taskTitle as string) || "uma tarefa"
  const targetChannelId = (action.context.channelId as string) || ctx.channelId

  if (!targetChannelId) {
    return { success: false, action: "request_approval", error: "No channel" }
  }

  await prisma.agent.update({
    where: { id: ctx.agent.id },
    data: { workState: "WAITING" },
  })

  const content = `Terminei "${title}"! Aguardando sua aprovacao para publicar.`
  return postWithTurn(ctx, targetChannelId, content, action.priority)
}

// ─────────────────────────────────────────────────────────────
// SISTEMA
// ─────────────────────────────────────────────────────────────

async function executeSpeakInDaily(
  _action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  // A execução real da daily é gerenciada por daily.ts
  // Aqui apenas atualizamos o estado do agente
  await prisma.agent.update({
    where: { id: ctx.agent.id },
    data: { status: "IN_MEETING", workState: "SPEAKING" },
  })

  await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.DAILY_AGENT_SPOKE, {
    agentName: ctx.agent.name,
  })

  return { success: true, action: "speak_in_daily" }
}

async function executeUpdateState(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const newWorkState = action.context.workState as string
  const newStatus = action.context.status as string | undefined

  if (!newWorkState) {
    return { success: false, action: "update_state", error: "Missing workState" }
  }

  const data: Record<string, unknown> = { workState: newWorkState }
  if (newStatus) data.status = newStatus

  await prisma.agent.update({
    where: { id: ctx.agent.id },
    data: data as any,
  })

  await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.WORK_STATE_CHANGED, {
    workState: newWorkState,
    previousStatus: newStatus,
  })

  return { success: true, action: "update_state" }
}

async function executeGentleReminder(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const title = (action.context.taskTitle as string) || "uma tarefa"
  const targetChannelId = (action.context.channelId as string) || ctx.channelId

  if (!targetChannelId) {
    return { success: false, action: "gentle_reminder", error: "No channel" }
  }

  const content = `A tarefa "${title}" esta aguardando aprovacao ha um tempo. Alguma novidade?`
  return postWithTurn(ctx, targetChannelId, content, action.priority)
}

async function executeRoutineCheck(
  _action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  // Placeholder para checagens de rotina
  await prisma.agent.update({
    where: { id: ctx.agent.id },
    data: { lastCheckAt: new Date() },
  })

  return { success: true, action: "routine_check" }
}

// ─────────────────────────────────────────────────────────────
// CORE: Post with Turn Management
// ─────────────────────────────────────────────────────────────

/**
 * Fluxo completo de postagem com gerenciamento de turno:
 * 1. Adquirir lock do canal
 * 2. Mostrar indicador de digitação
 * 3. Simular tempo de digitação
 * 4. Salvar mensagem no banco
 * 5. Limpar indicador de digitação
 * 6. Liberar lock após tempo de respiro
 */
async function postWithTurn(
  ctx: ExecutionContext,
  channelId: string,
  content: string,
  priority: number,
  threadId?: string,
): Promise<ExecutionResult> {
  // 1. Request turn — if not acquired, skip (will be retried on next heartbeat)
  const turn = requestTurn(channelId, ctx.agent.id, ctx.agent.name, priority)

  if (!turn.acquired) {
    await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.TURN_QUEUED, {
      channelId,
      position: turn.position,
      priority,
    })
    return { success: false, action: "post_message", error: `Turn not acquired, position ${turn.position}` }
  }

  await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.TURN_ACQUIRED, {
    channelId,
    priority,
  })

  try {
    // 2. Show typing indicator
    setTypingIndicator(channelId, ctx.agent.id, ctx.agent.name)
    await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.MESSAGE_TYPING_STARTED, {
      channelId,
      contentLength: content.length,
    })

    // 3. Simulate typing time
    const typingTime = calculateTypingTime(ctx.agent.name, content)
    await sleep(typingTime)

    // 4. Save message
    const message = await prisma.message.create({
      data: {
        content,
        agentId: ctx.agent.id,
        channelId,
      },
    })

    await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.MESSAGE_SENT, {
      messageId: message.id,
      channelId,
      contentPreview: content.slice(0, 80),
      typingTimeMs: typingTime,
    })

    // 5. Clear typing indicator
    clearTypingIndicator(channelId)
    await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.MESSAGE_TYPING_ENDED, {
      channelId,
    })

    // 6. Release turn after breathing room
    await sleep(2000)
    releaseTurn(channelId, ctx.agent.id)

    return { success: true, action: "post_message", messageId: message.id }
  } catch (err) {
    // Cleanup on error
    clearTypingIndicator(channelId)
    releaseTurn(channelId, ctx.agent.id)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function logOrchestration(
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
    // Logging should never break execution
  }
}

// ─────────────────────────────────────────────────────────────
// BULK EXECUTION (for heartbeat)
// ─────────────────────────────────────────────────────────────

/**
 * Processa múltiplas ações pendentes. Usado pelo heartbeat.
 * Retorna sumário do que foi executado.
 */
export async function executePendingActions(
  organizationId: string,
  actions: ActionRecord[],
  channelId: string | null,
): Promise<Array<{ agent: string; action: string; success: boolean }>> {
  const results: Array<{ agent: string; action: string; success: boolean }> = []

  for (const action of actions) {
    const agent = await prisma.agent.findUnique({
      where: { id: action.agentId },
      select: { name: true },
    })

    const result = await executeAction(action, channelId)
    results.push({
      agent: agent?.name || "unknown",
      action: result.success ? `${action.type}: ok` : `${action.type}: ${result.error || "failed"}`,
      success: result.success,
    })
  }

  return results
}

/**
 * Retorna métricas do motor de orquestração para debug.
 */
export function getExecutorMetrics() {
  return {
    turns: getTurnMetrics(),
    roleTaskMatch: ROLE_TASK_MATCH,
  }
}
