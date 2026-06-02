/**
 * ── AGENT MEMORY ──────────────────────────────────────────
 * Cada agente tem memória persistente do que fez, decidiu, e recebeu de feedback.
 * Salvo em AgentMemory e atualizado a cada ciclo.
 */

import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"

interface AgentMemoryEntry {
  timestamp: string
  type: "completed_task" | "started_task" | "received_feedback" | "made_decision" | "mentioned" | "daily_summary" | "idle"
  detail: string
}

export async function getAgentMemory(agentId: string): Promise<AgentMemoryEntry[]> {
  const memory = await prisma.agencyEvent.findMany({
    where: {
      organizationId: (await prisma.agent.findUnique({ where: { id: agentId }, select: { organizationId: true } }))?.organizationId || "",
      metadata: { path: ["agentId"], equals: agentId },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  } as any)

  return memory.map(m => ({
    timestamp: m.createdAt.toISOString(),
    type: (m.type as any) || "idle",
    detail: m.description || "",
  }))
}

export async function recordAgentMemory(
  agentId: string,
  type: AgentMemoryEntry["type"],
  detail: string,
  organizationId: string,
): Promise<void> {
  await prisma.agencyEvent.create({
    data: {
      organizationId,
      type: `agent_${type}`,
      title: `${type.replace(/_/g, " ")}`,
      description: detail,
      metadata: { agentId, type, timestamp: new Date().toISOString() },
    },
  } as any)
}

/**
 * Build a summary of what the agent did today for checkpoint/daily summary.
 */
export async function summarizeAgentDay(agentId: string, agentName: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)

  const tasks = await prisma.task.findMany({
    where: {
      assignedTo: agentId,
      updatedAt: { gte: new Date(today) },
    },
  })

  const completed = tasks.filter(t => t.status === "DONE" || t.status === "IN_REVIEW").length
  const inProgress = tasks.filter(t => t.status === "IN_PROGRESS").length
  const todo = tasks.filter(t => t.status === "TODO").length

  const taskList = tasks.filter(t => t.status !== "TODO").slice(0, 5).map(t => t.title).join(", ")

  const prompt = `${agentName}, resuma seu dia de trabalho em 1-2 frases.
Voce completou ${completed} tarefas, tem ${inProgress} em andamento e ${todo} pendentes.
Tarefas: ${taskList || "nenhuma"}. Fale em 1a pessoa.`

  try {
    const reply = await chatCompletion(prompt, { temperature: 0.5, maxTokens: 150 })
    return reply.replace(/^(Claro|Certo|OK|Ok)[,!.]?\s*/i, "").trim() || `${agentName}: ${completed} concluidas, ${inProgress} em andamento.`
  } catch {
    return `${agentName}: ${completed} concluidas, ${inProgress} em andamento.`
  }
}

/**
 * Auto-schedule tasks for the agent based on time of day.
 */
export function isLunchTime(): boolean {
  const h = new Date().getHours()
  return h >= 12 && h < 13
}

export function isCheckpointTime(): boolean {
  const h = new Date().getHours()
  const m = new Date().getMinutes()
  return h === 17 && m >= 0 && m < 5
}

export function isClosingTime(): boolean {
  const h = new Date().getHours()
  return h >= 19
}

export function isWorkingHours(): boolean {
  const h = new Date().getHours()
  return h >= 9 && h < 19
}
