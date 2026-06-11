import { prisma } from "@/lib/prisma"

/**
 * Quality Control System
 * Prevents status regression and enforces delivery standards
 */

export interface QualityCheck {
  passed: boolean
  issues: string[]
  score: number
}

/**
 * Check if a task can transition to a new status
 * Prevents regression from DONE to TODO/IN_PROGRESS
 * Enforces delivery standards: DONE must have deliveryStatus=APPROVED
 */
export async function canTransitionStatus(
  taskId: string,
  newStatus: string,
  options?: { forceDeliveryStatus?: string }
): Promise<{ allowed: boolean; reason?: string }> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { status: true, title: true, type: true, deliveryStatus: true, output: true },
  })

  if (!task) {
    return { allowed: false, reason: "Task não encontrada" }
  }

  // Prevent regression from DONE
  if (task.status === "DONE" && newStatus !== "DONE") {
    return {
      allowed: false,
      reason: `Task "${task.title}" já foi concluída. Não é permitido voltar para ${newStatus}. Se precisa de revisão, crie uma nova task de rework.`,
    }
  }

  // Prevent regression from IN_REVIEW to TODO
  if (task.status === "IN_REVIEW" && newStatus === "TODO") {
    return {
      allowed: false,
      reason: `Task "${task.title}" está em revisão. Use status "IN_PROGRESS" para ajustes, não "TODO".`,
    }
  }

  // Guard: cannot go to DONE without approved delivery
  if (newStatus === "DONE" && task.deliveryStatus !== "APPROVED" && options?.forceDeliveryStatus !== "APPROVED") {
    return {
      allowed: false,
      reason: `Task "${task.title}" não pode ir para DONE sem deliveryStatus=APPROVED. Atual: ${task.deliveryStatus || 'não definido'}. Passe pela revisão da Maya primeiro.`,
    }
  }

  // Guard: cannot go to DONE if artworkPending (PNG not exported yet)
  if (newStatus === "DONE") {
    const output = (task.output as any) || {}
    if (output.artworkPending === true) {
      return {
        allowed: false,
        reason: `Task "${task.title}" tem artworkPending=true. Exporte o PNG via Vertex AI antes de concluir.`,
      }
    }
  }

  return { allowed: true }
}

/**
 * Validate task quality before marking as DONE
 */
export async function validateTaskQuality(taskId: string): Promise<QualityCheck> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      attachments: true,
      assignee: { select: { name: true, role: true } },
    },
  })

  if (!task) {
    return { passed: false, issues: ["Task não encontrada"], score: 0 }
  }

  const issues: string[] = []
  let score = 100

  // Check if task has output
  if (!task.output || Object.keys(task.output as object).length === 0) {
    issues.push("Task não tem output/documentação")
    score -= 30
  }

  // Check description quality
  if (!task.description || task.description.length < 50) {
    issues.push("Descrição muito curta ou vazia")
    score -= 20
  }

  // Check attachments for visual/design tasks
  const requiresAttachment = ["carousel", "design", "copy", "blog_post", "content"]
  if (requiresAttachment.includes(task.type || "") && task.attachments.length === 0) {
    issues.push(`Task do tipo "${task.type}" requer attachment (PNG/DOC/MD)`)
    score -= 40
  }

  // Check if task was properly worked on
  if (!task.startedAt) {
    issues.push("Task não tem data de início")
    score -= 10
  }

  // Check if task has reasonable duration
  if (task.startedAt && task.completedAt) {
    const durationMs = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()
    const durationMin = durationMs / 60000
    
    if (durationMin < 1) {
      issues.push("Task concluída muito rapidamente (< 1 min)")
      score -= 15
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    score: Math.max(0, score),
  }
}

/**
 * Create a rework task instead of resetting status
 */
export async function createReworkTask(
  originalTaskId: string,
  feedback: string,
  organizationId: string
): Promise<string | null> {
  const originalTask = await prisma.task.findUnique({
    where: { id: originalTaskId },
    select: { title: true, type: true, assignedTo: true, description: true },
  })

  if (!originalTask) return null

  const reworkTask = await prisma.task.create({
    data: {
      organizationId,
      title: `[REWORK] ${originalTask.title}`,
      description: `Revisão da task original: ${originalTask.title}\n\nFeedback do CEO:\n${feedback}\n\n---\nDescrição original:\n${originalTask.description || ""}`,
      type: originalTask.type,
      priority: "HIGH",
      status: "TODO",
      assignedTo: originalTask.assignedTo,
      estimatedMinutes: 60,
    },
  })

  return reworkTask.id
}

/**
 * Log status change for audit
 */
export async function logStatusChange(
  taskId: string,
  oldStatus: string,
  newStatus: string,
  reason?: string
): Promise<void> {
  await prisma.agencyEvent.create({
    data: {
      organizationId: (await prisma.task.findUnique({ where: { id: taskId } }))?.organizationId || "",
      type: "task_status_change",
      title: `Task status: ${oldStatus} → ${newStatus}`,
      description: reason || "Mudança de status",
      metadata: {
        taskId,
        oldStatus,
        newStatus,
        timestamp: new Date().toISOString(),
      },
    },
  })
}
