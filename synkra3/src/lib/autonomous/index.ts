/**
 * ── AUTONOMOUS ENGINE v1 ─────────────────────────────────────
 *
 * Motor autônomo que roda sem intervenção do CEO:
 * 1. Contexto: coleta métricas, calendário, histórico
 * 2. Planejamento: Maya decide o que precisa ser feito
 * 3. Distribuição: atribui tarefas ao agente certo
 * 4. Execução: heartbeat já cuida disso
 * 5. Aprendizado: aprende com aprovações/rejeições
 */

export { buildCompanyContext } from "./context"
export { runCalendarCheck } from "./calendar"
export { runMetricMonitor, type MetricAlert } from "./monitor"
export { maintainBacklog } from "./backlog"
export { learnFromFeedback, analyzeApprovalPatterns, type ApprovalPattern } from "./learning"
export { distributeTask, type DistributableTask } from "./distribute"
export { runAutonomousDaily } from "./daily"

import { prisma } from "@/lib/prisma"
import { runCalendarCheck } from "./calendar"
import { runMetricMonitor } from "./monitor"
import { maintainBacklog } from "./backlog"

/**
 * Run the full autonomous loop for one organization.
 * Returns summary of what was created.
 */
export async function runAutonomousLoop(organizationId: string): Promise<{
  calendar: number
  metrics: number
  backlog: number
  stuck: number
  total: number
}> {
  const results = { calendar: 0, metrics: 0, backlog: 0, stuck: 0, total: 0 }

  try {
    const events = await runCalendarCheck(organizationId)
    results.calendar = events.created
  } catch (e) { console.error("[Autonomous] Calendar error:", e) }

  try {
    const alerts = await runMetricMonitor(organizationId)
    results.metrics = alerts.created
  } catch (e) { console.error("[Autonomous] Metric error:", e) }

  try {
    const ideas = await maintainBacklog(organizationId)
    results.backlog = ideas.created
  } catch (e) { console.error("[Autonomous] Backlog error:", e) }

  // Stuck task detection
  try {
    const eightHoursAgo = new Date(Date.now() - 8 * 3600000)
    const stuck = await prisma.task.findMany({
      where: { organizationId, status: "IN_PROGRESS", updatedAt: { lt: eightHoursAgo } },
      include: { assignee: true },
    })
    for (const task of stuck) {
      await prisma.task.update({
        where: { id: task.id },
        data: { blocked: true, blockedReason: "Tarefa parada ha mais de 8 horas." },
      })
      const channel = await prisma.channel.findFirst({ where: { organizationId, name: "geral" } })
      if (channel) {
        await prisma.message.create({
          data: {
            content: `⚠️ "${task.title}" esta parada ha 8h. ${task.assignee?.name || "Nao atribuida"} — precisa de atencao.`,
            channelId: channel.id,
          },
        })
      }
      results.stuck++
    }
  } catch (e) { console.error("[Autonomous] Stuck error:", e) }

  results.total = results.calendar + results.metrics + results.backlog + results.stuck
  return results
}
