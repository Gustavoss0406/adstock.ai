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
import { writeBridgeWorkActivity, getToolForTask, writeAgentEvent } from "@/lib/orchestrator/bridgeWork"
import { notifyTaskChain } from "@/lib/orchestrator/conversation"
import { executeFullCascade } from "@/lib/autonomous/agent-engine"
import { shouldAgentSpeak, getVerbosityLevel, transitionToWorking, transitionToTaskCompleted, transitionToMentioned } from "@/lib/orchestrator/communication-rules"
import { detectAndHandleSpam } from "@/lib/orchestrator/spam-detection"
import { selectBestChannel, getMessageTypeForAction } from "@/lib/channels/channel-selector"
import { ensureChannelExists } from "@/lib/channels/channel-validator"

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

  return postWithTurn(ctx, targetChannelId, content, action.priority, action.context.threadId as string | undefined, {
    messageType: action.context.messageType as string || "post_message",
    taskType: action.context.taskType as string,
    needsApproval: action.context.needsApproval as boolean,
  })
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

  const verbosity = await getVerbosityLevel(ctx.organizationId)
  const speakCheck = await shouldAgentSpeak("mentioned", {
    verbosityLevel: verbosity,
    agentId: ctx.agent.id,
    organizationId: ctx.organizationId,
    content: message,
    channelId: targetChannelId,
  })
  if (!speakCheck.allowed) {
    return { success: false, action: "respond_to_mention", error: `Blocked: ${speakCheck.reason}` }
  }

  const prompt = `Voce e ${ctx.agent.name}. Responda a esta mensagem em 1-2 frases, em primeira pessoa.
Mensagem recebida: "${message}".

REGRAS DE COMUNICACAO:
- NUNCA responda com "ok", "legal", "valeu", "obrigado" ou confirmacoes vazias.
- Sua resposta deve ser ACIONAVEL: algo util, informativo ou que ajude o time.
- Seja natural. Nao diga que e IA. Use o tom da sua personalidade.`

  const reply = await chatCompletion(prompt, { maxTokens: 1500, temperature: 0.8 })
  const cleaned = reply.replace(/^(Claro|Certo|Com certeza|OK|Ok|Entendido|Beleza)[,!.]?\s*/i, "").trim()

  return postWithTurn(ctx, targetChannelId, cleaned, action.priority, undefined, {
    messageType: "respond_to_mention",
  })
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

  // ── Communication economy check ──────────────────────
  const verbosity = await getVerbosityLevel(ctx.organizationId)
  const speakCheck = await shouldAgentSpeak("respond_to_agent", {
    verbosityLevel: verbosity,
    agentId: ctx.agent.id,
    organizationId: ctx.organizationId,
    content: message,
    channelId: targetChannelId,
  })
  if (!speakCheck.allowed) {
    return { success: false, action: "respond_to_agent", error: `Blocked: ${speakCheck.reason}` }
  }

  const prompt = `Voce e ${ctx.agent.name}. Um colega de equipe te mencionou ou falou com voce. Responda em 1-2 frases, em primeira pessoa.
Mensagem recebida: "${message}".

REGRAS DE COMUNICACAO:
- NUNCA diga apenas "ok", "legal", "valeu", "boa", "obrigado". Seja sempre informativo.
- Se a mensagem for uma confirmacao vazia, NAO responda — ignore.
- Sua resposta deve ser ACIONAVEL: algo que o outro agente precise fazer, aprovar ou saber.
- Se nao tem nada acionavel pra dizer, nao diga nada.

Seja colaborativo e natural. Nao diga que e IA.`

  const reply = await chatCompletion(prompt, { maxTokens: 1500, temperature: 0.8 })
  const cleaned = reply.replace(/^(Claro|Certo|Com certeza|OK|Ok|Entendido|Beleza)[,!.]?\s*/i, "").trim()

  // Agent is communicating while working → WORKING_VISIBLE
  await prisma.agent.update({
    where: { id: ctx.agent.id },
    data: { workState: "WORKING_VISIBLE" },
  }).catch(() => {})

  return postWithTurn(ctx, targetChannelId, cleaned, action.priority, undefined, {
    messageType: "respond_to_agent",
  })
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

  const reply = await chatCompletion(prompt, { maxTokens: 1500, temperature: 0.7 })
  const cleaned = reply.replace(/^(Claro|Certo|Com certeza|OK|Ok|Entendido|Beleza)[,!.]?\s*/i, "").trim()

  return postWithTurn(ctx, targetChannelId, cleaned, 10, undefined, {
    messageType: "respond_to_ceo",
  })
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

  // ── Communication economy: only join if explicitly invited ──
  const verbosity = await getVerbosityLevel(ctx.organizationId)
  const speakCheck = await shouldAgentSpeak("join_conversation", {
    verbosityLevel: verbosity,
    agentId: ctx.agent.id,
    organizationId: ctx.organizationId,
    channelId: targetChannelId,
  })
  if (!speakCheck.allowed) {
    return { success: false, action: "join_conversation", error: `Blocked: ${speakCheck.reason}` }
  }

  const prompt = `Voce e ${ctx.agent.name}. Voce entrou em uma conversa relevante. Contribua em 1-2 frases, em primeira pessoa.
Contexto: "${conversationTopic}".

REGRAS DE COMUNICACAO:
- NUNCA diga confirmacoes vazias. Traga valor real para a discussao.
- Seu comentario deve ser acionavel ou informativo.
- Se nao tem nada relevante pra adicionar, NAO fale — silencio e melhor.
- Seja natural. Nao diga que e IA.`

  const reply = await chatCompletion(prompt, { maxTokens: 1500, temperature: 0.8 })
  const cleaned = reply.replace(/^(Claro|Certo|Com certeza|OK|Ok|Entendido|Beleza)[,!.]?\s*/i, "").trim()

  return postWithTurn(ctx, targetChannelId, cleaned, action.priority, undefined, {
    messageType: "join_conversation",
  })
}

// ─────────────────────────────────────────────────────────────
// TAREFAS
// ─────────────────────────────────────────────────────────────

async function executeAcknowledgeTask(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const title = (action.context.taskTitle as string) || "uma tarefa"
  // ── Communication economy: silently acknowledge, don't post ──
  await transitionToMentioned(ctx.agent.id)
  await logOrchestration(ctx.organizationId, ctx.agent.id, "task_acknowledged_silently", {
    taskTitle: title,
  })
  return { success: true, action: "acknowledge_task" }
}

async function executeAcknowledgePendingTask(
  action: ActionRecord,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const title = (action.context.taskTitle as string) || "uma tarefa"
  const daysPending = (action.context.daysPending as number) || 1
  const targetChannelId = (action.context.channelId as string) || ctx.channelId

  // ── Only post if severely delayed (>3 days), otherwise silent ──
  if (targetChannelId && daysPending >= 3) {
    const verbosity = await getVerbosityLevel(ctx.organizationId)
    const speakCheck = await shouldAgentSpeak("task_blocked", {
      verbosityLevel: verbosity,
      agentId: ctx.agent.id,
      organizationId: ctx.organizationId,
      content: `A tarefa "${title}" esta parada ha ${daysPending} dia(s). Vou comecar ela agora.`,
      channelId: targetChannelId,
      daysPending,
    })
    if (speakCheck.allowed) {
      const content = `A tarefa "${title}" esta parada ha ${daysPending} dia(s). Vou comecar ela agora.`
      return postWithTurn(ctx, targetChannelId, content, action.priority, undefined, {
        messageType: daysPending >= 5 ? "task_blocked" : "task_started",
        isBlocked: daysPending >= 5,
      })
    }
  }

  await logOrchestration(ctx.organizationId, ctx.agent.id, "pending_task_acknowledged_silently", {
    taskTitle: title,
    daysPending,
  })
  return { success: true, action: "acknowledge_pending_task" }
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

  // 4. Communication economy: start silently, update state only
  await transitionToWorking(ctx.agent.id)
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

  // Rich event: agent started working
  writeAgentEvent({
    agentId: ctx.agent.id,
    agentName: ctx.agent.name,
    eventType: "task_started",
    taskTitle: task.title,
    emote: task.type === "analysis" ? "🔍" : task.type === "content" ? "✍️" : task.type === "technical" ? "🔧" : "📋",
    tool: getToolForTask(task.type || "content"),
  })

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

  // 1. Update task — DONE directly (auto-approved)
  const currentTask = await prisma.task.findUnique({ where: { id: taskId } })
  const existingOutput = currentTask?.output as any

  // Generate real AI content if output is empty
  let outputData = existingOutput || {}
  if (!outputData || !outputData.content) {
    try {
      const gen = await generateDeliverableContent(
        {
          title: currentTask?.title || "",
          description: currentTask?.description,
          type: currentTask?.type || "content",
        },
        { name: ctx.agent.name, role: ctx.agent.role },
        ctx.organizationId,
      )
      // Filter out AI error fallbacks
      if (gen.content && !gen.content.includes("Nao consegui processar") && gen.content.length > 10) {
        outputData = { ...outputData, ...gen }
      } else {
        outputData.content = currentTask?.description || currentTask?.title || ""
      }
    } catch {
      outputData.content = currentTask?.description || currentTask?.title || ""
    }
    if (currentTask?.type === "content" || currentTask?.type === "campaign") {
      outputData.deliverableImage = null
      outputData.imageDescription = "Imagem do entregavel gerada pelo agente."
    }
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "DONE",
      completedAt: new Date(),
      lastCommunicatedAt: new Date(),
      progress: 100,
      output: outputData,
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

  // 4. Communication economy: only post completion (actionable)
  await transitionToTaskCompleted(ctx.agent.id)
  const targetChannelId = (action.context.channelId as string) || ctx.channelId
  if (targetChannelId) {
    const title = (action.context.taskTitle as string) || "tarefa"
    const verbosity = await getVerbosityLevel(ctx.organizationId)
    const speakCheck = await shouldAgentSpeak("task_completed", {
      verbosityLevel: verbosity,
      agentId: ctx.agent.id,
      organizationId: ctx.organizationId,
      content: `Conclui: "${title}".`,
      channelId: targetChannelId,
    })
    if (speakCheck.allowed) {
      await postWithTurn(ctx, targetChannelId, `Conclui: "${title}".`, action.priority, undefined, {
        messageType: "task_completed",
        taskType: currentTask?.type || undefined,
        needsApproval: true,
      })
    }
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

    // Rich event: agent celebrating
    writeAgentEvent({
      agentId: ctx.agent.id,
      agentName: ctx.agent.name,
      eventType: "task_completed",
      taskTitle: task.title,
      speechBubble: `Terminei! ✅`,
    })
  }

  // ── Post-completion: generate follow-up tasks ──────────
  await suggestNextTasks(ctx.organizationId, taskId, ctx.agent, action.context.taskTitle as string)

  // ── Post-completion: full cascade (notify + create tasks for next agents) ──
  setTimeout(() => {
    const targetChannelId = (action.context.channelId as string) || ctx.channelId
    if (targetChannelId) {
      executeFullCascade(ctx.organizationId, taskId, targetChannelId).catch(() => {})
    }
  }, 2000)

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

    const reply = await chatCompletion(prompt, { temperature: 0.7, maxTokens: 2000 })
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

  // ── Communication economy: silent progress update ──
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

  // Keep agent in WORKING_SILENT state
  await prisma.agent.update({
    where: { id: ctx.agent.id },
    data: { workState: "WORKING_SILENT" },
  }).catch(() => {})

  await logOrchestration(ctx.organizationId, ctx.agent.id, "silent_progress_update", {
    taskTitle: title,
    taskId: action.context.taskId,
  })

  return { success: true, action: "report_progress" }
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
  // ── Communication economy: only announce HIGH/CRITICAL tasks ──
  if (targetChannelId) {
    const isImportant = task.priority === "HIGH" || task.priority === "CRITICAL"
    if (isImportant) {
      const verbosity = await getVerbosityLevel(ctx.organizationId)
      const speakCheck = await shouldAgentSpeak("task_started", {
        verbosityLevel: verbosity,
        agentId: ctx.agent.id,
        organizationId: ctx.organizationId,
        channelId: targetChannelId,
        priority: 7,
      })
      if (speakCheck.allowed) {
        await postWithTurn(ctx, targetChannelId, `Comecando prioridade: "${task.title}".`, action.priority)
      }
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
  return postWithTurn(ctx, targetChannelId, content, action.priority, undefined, {
    messageType: "gentle_reminder",
    needsApproval: true,
  })
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
export async function postWithTurn(
  ctx: ExecutionContext,
  channelId: string | null,
  content: string,
  priority: number,
  threadId?: string,
  options?: { messageType?: string; taskType?: string; isBlocked?: boolean; isAlert?: boolean; needsApproval?: boolean },
): Promise<ExecutionResult> {
  // ── CHANNEL ROUTING: auto-select best channel ──────────
  let finalChannelId = channelId
  if (options?.messageType) {
    const bestChannel = selectBestChannel({
      content,
      agentId: ctx.agent.id,
      agentRole: ctx.agent.role,
      messageType: options.messageType,
      metadata: {
        taskType: options.taskType,
        isBlocked: options.isBlocked,
        isAlert: options.isAlert,
        needsCEOApproval: options.needsApproval,
      },
    })
    const routedId = await ensureChannelExists(bestChannel, ctx.organizationId)
    if (routedId) finalChannelId = routedId
  }

  if (!finalChannelId) {
    const geralId = await ensureChannelExists("geral", ctx.organizationId)
    finalChannelId = geralId
  }
  if (!finalChannelId) {
    return { success: false, action: "post_message", error: "No channel available" }
  }

  // ── Communication economy check ──────────────────────
  const verbosity = await getVerbosityLevel(ctx.organizationId)
  const eventType = (options?.messageType || "post_message") as import("@/lib/orchestrator/communication-rules").ActionableEventType

  const speakCheck = await shouldAgentSpeak(eventType, {
    verbosityLevel: verbosity,
    agentId: ctx.agent.id,
    organizationId: ctx.organizationId,
    content,
    threadId,
    channelId: finalChannelId,
    priority,
  })
  if (!speakCheck.allowed) {
    return { success: false, action: "post_message", error: `Blocked: ${speakCheck.reason}` }
  }

  // ── Spam detection ───────────────────────────────────
  const spamCheck = await detectAndHandleSpam(ctx.agent.id, content, "post_message")
  if (spamCheck.blocked) {
    return { success: false, action: "post_message", error: `Spam: ${spamCheck.reason}` }
  }
  // 1. Request turn — if not acquired, skip (will be retried on next heartbeat)
  const turn = requestTurn(finalChannelId, ctx.agent.id, ctx.agent.name, priority)

  if (!turn.acquired) {
    await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.TURN_QUEUED, {
      channelId: finalChannelId,
      position: turn.position,
      priority,
    })
    return { success: false, action: "post_message", error: `Turn not acquired, position ${turn.position}` }
  }

  await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.TURN_ACQUIRED, {
    channelId: finalChannelId,
    priority,
  })

  try {
    // 2. Show typing indicator
    setTypingIndicator(finalChannelId, ctx.agent.id, ctx.agent.name)
    await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.MESSAGE_TYPING_STARTED, {
      channelId: finalChannelId,
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
        channelId: finalChannelId,
      },
    })

    await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.MESSAGE_SENT, {
      messageId: message.id,
      channelId: finalChannelId,
      contentPreview: content.slice(0, 80),
      typingTimeMs: typingTime,
    })

    // 5. Clear typing indicator
    clearTypingIndicator(finalChannelId)
    await logOrchestration(ctx.organizationId, ctx.agent.id, ORCHESTRATION_EVENT_TYPES.MESSAGE_TYPING_ENDED, {
      channelId: finalChannelId,
    })

    // 6. Release turn after breathing room
    await sleep(2000)
    releaseTurn(finalChannelId, ctx.agent.id)

    return { success: true, action: "post_message", messageId: message.id }
  } catch (err) {
    // Cleanup on error
    clearTypingIndicator(finalChannelId)
    releaseTurn(finalChannelId, ctx.agent.id)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Gera conteudo de entregavel via AI quando uma tarefa e concluida,
 * substituindo o placeholder generico por conteudo real e contextual.
 */
async function generateDeliverableContent(
  task: { title: string; description?: string | null; type: string },
  agent: { name: string; role: string },
  orgId: string,
): Promise<{ content: string; title?: string }> {
  const typeLabel = task.type || "content"

  const prompt = `Voce e ${agent.name} (${agent.role}) em uma agencia de marketing digital.
Acabou de concluir uma tarefa e precisa registrar o entregavel produzido.

TITULO DA TAREFA: ${task.title}
DESCRICAO: ${task.description || "N/A"}
TIPO: ${typeLabel}

Gere o conteudo do entregavel que voce produziu para esta tarefa.
Seja especifico, realista e profissional. Escreva em portugues.
Nao se apresente — va direto ao conteudo produzido.

Retorne APENAS um JSON object com:
- "content": o texto completo do entregavel (minimo 3 frases especificas)
- "title": um titulo opcional para o entregavel`

  const reply = await chatCompletion(prompt, { temperature: 0.7, maxTokens: 2000 })

  // Filter out AI error fallback
  if (!reply || reply.includes("Nao consegui processar") || reply.length < 10) {
    return { content: task.description || task.title }
  }

  try {
    const jsonMatch = reply.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.content && !parsed.content.includes("Nao consegui") && parsed.content.length > 10) return parsed
    }
  } catch {}

  // Fallback: use reply as text if it's sensible
  if (reply.length > 10 && !reply.includes("Nao consegui")) {
    return { content: reply }
  }
  return { content: task.description || task.title }
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
