/**
 * ── ACTIONABLE MESSAGES ───────────────────────────────────
 *
 * Mensagens que TEM valor e sao permitidas em qualquer estado.
 * Substitui as postagens genericas por mensagens estruturadas
 * que informam, pedem acao ou alertam sobre algo real.
 */

import { prisma } from "@/lib/prisma"
import { postWithTurn } from "@/lib/orchestrator/executor"

interface ActionableContext {
  organizationId: string
  channelId: string
  agent: { id: string; name: string; role: string; personality: string }
}

/**
 * Posta uma mensagem de conclusao de tarefa.
 * Formato: "Terminei [TITULO]. [PROXIMO PASSO]"
 */
export async function postTaskCompleted(
  ctx: ActionableContext,
  taskTitle: string,
  nextStep?: string,
  priority: number = 6,
) {
  const nextLine = nextStep ? ` Proximo: ${nextStep}.` : ""
  const content = `Terminei "${taskTitle}".${nextLine}`
  return postWithTurn(
    { organizationId: ctx.organizationId, agent: ctx.agent, channelId: ctx.channelId },
    ctx.channelId,
    content,
    priority,
  )
}

/**
 * Posta uma mensagem de bloqueio.
 * Formato: "Bloqueado em [TITULO]: [MOTIVO]. @[NOME], preciso de decisao."
 */
export async function postTaskBlocked(
  ctx: ActionableContext,
  taskTitle: string,
  reason: string,
  needsAgent?: { name: string; id: string },
  priority: number = 8,
) {
  const mentionPart = needsAgent
    ? ` @${needsAgent.name.split(" ")[0]}, preciso de decisao.`
    : ""
  const content = `Bloqueado em "${taskTitle}": ${reason}.${mentionPart}`
  return postWithTurn(
    { organizationId: ctx.organizationId, agent: ctx.agent, channelId: ctx.channelId },
    ctx.channelId,
    content,
    priority,
  )
}

/**
 * Posta um alerta critico baseado em metricas.
 * Formato: "[METRICA] [DIRECAO] [%] — [ACAO]"
 */
export async function postMetricAlert(
  ctx: ActionableContext,
  metric: string,
  direction: string,
  percentage: number,
  action: string,
  priority: number = 9,
) {
  const content = `⚠️ ${metric} ${direction} ${percentage}% — ${action}`
  return postWithTurn(
    { organizationId: ctx.organizationId, agent: ctx.agent, channelId: ctx.channelId },
    ctx.channelId,
    content,
    priority,
  )
}

/**
 * Posta um pedido de aprovacao do CEO.
 * Formato: "@CEO, [CONTEUDO] pronto pra aprovar. [CONTEXTO]"
 */
export async function postApprovalRequest(
  ctx: ActionableContext,
  contentType: string,
  context: string,
  priority: number = 7,
) {
  const content = `@CEO, ${contentType} pronto pra aprovar. ${context}`
  return postWithTurn(
    { organizationId: ctx.organizationId, agent: ctx.agent, channelId: ctx.channelId },
    ctx.channelId,
    content,
    priority,
  )
}

/**
 * Posta resumo diario do agente (digest mode).
 */
export async function postDailyDigest(
  agentId: string,
  agentName: string,
  organizationId: string,
  channelId: string,
): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tasksCompleted = await prisma.task.count({
    where: {
      assignedTo: agentId,
      status: "DONE",
      updatedAt: { gte: today },
    },
  })

  const tasksStarted = await prisma.task.count({
    where: {
      assignedTo: agentId,
      status: "IN_PROGRESS",
      updatedAt: { gte: today },
    },
  })

  const tasksBlocked = await prisma.task.count({
    where: {
      assignedTo: agentId,
      blocked: true,
      status: "IN_PROGRESS",
    },
  })

  const messagesSent = await prisma.message.count({
    where: {
      agentId,
      createdAt: { gte: today },
    },
  })

  const parts: string[] = []
  if (tasksCompleted > 0) parts.push(`✅ ${tasksCompleted} tarefas finalizadas`)
  if (tasksStarted > 0) parts.push(`🔄 ${tasksStarted} em andamento`)
  if (tasksBlocked > 0) parts.push(`⚠️ ${tasksBlocked} bloqueadas`)
  if (messagesSent > 0) parts.push(`💬 ${messagesSent} mensagens`)
  if (tasksCompleted === 0 && tasksStarted === 0 && tasksBlocked === 0) {
    if (messagesSent > 0) parts.push(`💬 ${messagesSent} mensagens`)
  }

  if (parts.length === 0) return

  const digest = `${agentName}: ${parts.join(" | ")}.`

  await prisma.message.create({
    data: {
      content: digest,
      metadata: { type: "daily_digest", agentId },
      agentId,
      channelId,
    },
  } as any)
}
