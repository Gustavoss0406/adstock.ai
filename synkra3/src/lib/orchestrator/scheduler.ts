import { prisma } from "@/lib/prisma"
import { getPersonality, seededRandom } from "@/lib/orchestrator/turns"

export type ActionType =
  // Comunicação
  | "post_message"
  | "respond_to_mention"
  | "respond_to_agent"
  | "respond_to_ceo"
  | "join_conversation"
  // Tarefas
  | "acknowledge_task"
  | "acknowledge_urgent_task"
  | "acknowledge_pending_task"
  | "acknowledge_feedback"
  | "start_task"
  | "start_unblocked_task"
  | "complete_task"
  | "report_progress"
  | "pick_next_task"
  | "move_task"
  | "update_task"
  | "request_approval"
  // Sistema
  | "speak_in_daily"
  | "update_state"
  | "gentle_reminder"
  | "routine_check"

const BASE_DELAYS: Record<string, number> = {
  // Comunicação
  post_message: 0,
  respond_to_mention: 5000,
  respond_to_agent: 10000,
  respond_to_ceo: 3000,
  join_conversation: 20000,
  // Tarefas
  acknowledge_task: 10000,
  acknowledge_urgent_task: 5000,
  acknowledge_pending_task: 30000,
  acknowledge_feedback: 10000,
  start_task: 0,
  start_unblocked_task: 15000,
  complete_task: 0,
  report_progress: 60000,
  pick_next_task: 30000,
  move_task: 0,
  update_task: 0,
  request_approval: 0,
  // Sistema
  speak_in_daily: 0,
  update_state: 0,
  gentle_reminder: 30000,
  routine_check: 300000,
}

export function calculateDelay(type: string, agentName: string, priority: number): number {
  const baseDelay = BASE_DELAYS[type] ?? 10000
  const p = getPersonality(agentName)

  const responseMultiplier = 0.5 + p.responseSpeed * 0.5
  const priorityFactor = Math.max(0.2, (11 - priority) * 0.2)

  let delay = baseDelay * responseMultiplier * priorityFactor

  // Seeded variation ±20% for reproducibility
  const variation = 0.8 + seededRandom(type + agentName + priority + Date.now()) * 0.4
  delay *= variation

  // Floor at minDelay from personality
  return Math.max(p.minDelay, Math.floor(delay))
}

export async function scheduleAction(params: {
  organizationId: string
  agentId: string
  agentName: string
  type: string
  priority: number
  context?: Record<string, unknown>
}): Promise<string> {
  const delay = calculateDelay(params.type, params.agentName, params.priority)
  const scheduledFor = new Date(Date.now() + delay)

  const action = await prisma.agentAction.create({
    data: {
      organizationId: params.organizationId,
      agentId: params.agentId,
      type: params.type,
      priority: params.priority,
      status: "pending",
      context: params.context || {},
      scheduledFor,
    },
  } as any)

  return action.id
}

export async function getPendingActions(organizationId: string, limit = 5) {
  return prisma.agentAction.findMany({
    where: {
      organizationId,
      status: "pending",
      scheduledFor: { lte: new Date() },
    },
    orderBy: { priority: "desc" },
    take: limit,
    include: { agent: { select: { name: true, role: true } } },
  })
}

export async function markActionStatus(actionId: string, status: string, error?: string) {
  return prisma.agentAction.update({
    where: { id: actionId },
    data: {
      status,
      executedAt: status !== "pending" ? new Date() : undefined,
      error,
    },
  } as any)
}

export async function cancelStaleActions(organizationId: string, olderThanMs = 5 * 60000) {
  return prisma.agentAction.updateMany({
    where: {
      organizationId,
      status: "pending",
      scheduledFor: { lt: new Date(Date.now() - olderThanMs) },
    },
    data: { status: "cancelled", error: "Stale action expired" },
  } as any)
}
