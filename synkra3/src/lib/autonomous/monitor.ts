import { prisma } from "@/lib/prisma"
import { buildCompanyContext } from "./context"

export interface MetricAlert {
  type: "drop" | "surge" | "overdue" | "trend"
  title: string
  severity: "HIGH" | "MEDIUM" | "LOW"
  assignedRole?: string
}

export async function runMetricMonitor(organizationId: string): Promise<{ created: number; alerts: MetricAlert[] }> {
  const ctx = await buildCompanyContext(organizationId)
  const alerts: MetricAlert[] = []
  let created = 0

  // ── 1. Overdue tasks ──────────────────────────────
  if (ctx.overdueTasks > 0) {
    alerts.push({
      type: "overdue",
      title: `${ctx.overdueTasks} tarefas atrasadas precisam de atencao`,
      severity: ctx.overdueTasks > 3 ? "HIGH" : "MEDIUM",
      assignedRole: "STRATEGIST",
    })
  }

  // ── 2. Too many in review ─────────────────────────
  const reviewCount = ctx.taskCounts.inReview
  if (reviewCount > 5) {
    alerts.push({
      type: "surge",
      title: `${reviewCount} tarefas aguardando revisao — revisar e liberar`,
      severity: "MEDIUM",
      assignedRole: "ANALYST",
    })
  }

  // ── 3. Empty backlog warning ──────────────────────
  if (ctx.backlogSize < 3) {
    alerts.push({
      type: "trend",
      title: "Backlog esta com poucas tarefas — gerar novas ideias",
      severity: "LOW",
      assignedRole: "STRATEGIST",
    })
  }

  // ── 4. Check integration health ───────────────────
  if (ctx.connectedPlatforms.length === 0) {
    const existing = await prisma.task.findFirst({
      where: { organizationId, title: { contains: "Conectar" }, status: { not: "DONE" } },
    })
    if (!existing) {
      alerts.push({
        type: "trend",
        title: "Conectar contas (Instagram, Google) para comecar a analisar metricas",
        severity: "HIGH",
        assignedRole: "STRATEGIST",
      })
    }
  }

  // Create tasks for HIGH severity alerts
  for (const alert of alerts) {
    if (alert.severity !== "HIGH" && alert.severity !== "MEDIUM") continue

    const existing = await prisma.task.findFirst({
      where: {
        organizationId,
        title: { contains: alert.title.slice(0, 30) },
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    })
    if (existing) continue

    const assignee = alert.assignedRole
      ? await prisma.agent.findFirst({ where: { organizationId, role: alert.assignedRole as any, status: { not: "FIRED" } } })
      : null

    await prisma.task.create({
      data: {
        organizationId,
        title: alert.title,
        type: "analysis",
        priority: alert.severity,
        status: "TODO",
        assignedTo: assignee?.id || null,
        estimatedMinutes: alert.severity === "HIGH" ? 120 : 60,
      },
    } as any)
    created++
  }

  return { created, alerts }
}
