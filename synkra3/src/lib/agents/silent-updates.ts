/**
 * ── SILENT UPDATES ────────────────────────────────────────
 *
 * Atualiza o Kanban e o estado dos agentes sem postar no chat.
 * Usado para progresso de tarefas, mudancas de estado e trabalho
 * silencioso que nao precisa de mensagem no chat.
 */

import { prisma } from "@/lib/prisma"

export interface SilentUpdateData {
  taskId?: string
  progress?: number
  workState?: string
  status?: string
  activity?: string
  metadata?: Record<string, unknown>
}

export async function silentUpdate(
  agentId: string,
  updateType: "progress" | "state_change" | "started" | "paused" | "completed_quietly",
  data: SilentUpdateData,
): Promise<void> {
  // Update agent state
  if (data.workState || data.status) {
    const agentUpdate: Record<string, unknown> = {}
    if (data.workState) agentUpdate.workState = data.workState
    if (data.status) agentUpdate.status = data.status
    await prisma.agent.update({
      where: { id: agentId },
      data: agentUpdate as any,
    })
  }

  // Update task silently (Kanban updates without chat)
  if (data.taskId) {
    const taskUpdate: Record<string, unknown> = { updatedAt: new Date() }
    if (data.progress !== undefined) taskUpdate.progress = data.progress
    if (data.status) {
      taskUpdate.status = data.status
      if (data.status === "IN_PROGRESS" && !taskUpdate.startedAt) {
        taskUpdate.startedAt = new Date()
      }
      if (data.status === "DONE") {
        taskUpdate.completedAt = new Date()
      }
    }
    await prisma.task.update({
      where: { id: data.taskId },
      data: taskUpdate as any,
    })
  }

  // Log orchestration event silently
  try {
    const task = data.taskId
      ? await prisma.task.findUnique({ where: { id: data.taskId }, select: { title: true } })
      : null
    await prisma.orchestrationLog.create({
      data: {
        organizationId: "",
        agentId,
        eventType: `silent_${updateType}`,
        details: {
          taskId: data.taskId,
          taskTitle: task?.title,
          progress: data.progress,
          workState: data.workState,
          ...data.metadata,
        },
      },
    } as any)
  } catch {
    // Logging is best-effort
  }
}

/**
 * Atualiza progresso e estado do agente sem gerar mensagem no chat.
 */
export async function silentProgressUpdate(
  agentId: string,
  taskId: string,
  progress: number,
  taskTitle: string,
  organizationId: string,
): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: { progress, updatedAt: new Date() },
  })

  await prisma.agent
    .update({
      where: { id: agentId },
      data: { workState: progress >= 100 ? "IDLE" : "WORKING_SILENT" },
    })
    .catch(() => {})

  try {
    await prisma.orchestrationLog.create({
      data: {
        organizationId,
        agentId,
        eventType: "silent_progress_update",
        details: { taskId, taskTitle, progress },
      },
    } as any)
  } catch {}
}
