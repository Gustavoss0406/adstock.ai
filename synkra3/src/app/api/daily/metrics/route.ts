import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * GET /api/daily/metrics?orgId=xxx&period=7|14|30
 *
 * Retorna métricas de saúde da daily:
 * - Últimas N dailies com status
 * - Taxa de completude
 * - Média de agentes/tarefas
 * - Dias sem daily
 * - Métricas por agente
 */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId")
  const period = parseInt(request.nextUrl.searchParams.get("period") || "7")

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 })
  }

  try {
    const now = new Date()
    const since = new Date(now.getTime() - period * 86400000)

    // ── Daily metrics for period ──────────────────────────
    const metrics = await prisma.dailyMetrics.findMany({
      where: {
        organizationId: orgId,
        date: { gte: since },
      },
      orderBy: { date: "desc" },
      take: period,
    })

    // ── Aggregate stats ───────────────────────────────────
    const completed = metrics.filter(m => m.status === "completed" || m.status === "approved")
    const approved = metrics.filter(m => m.status === "approved").length
    const totalSpeechCount = completed.reduce((sum, m) => sum + m.speechCount, 0)
    const totalTasksExtracted = completed.reduce((sum, m) => sum + m.tasksExtracted, 0)
    const totalFallbacks = completed.reduce((sum, m) => sum + m.agentFallbacks, 0)
    const alertsDays = completed.filter(m => m.hadAlerts).length
    const readDays = completed.filter(m => m.readAt).length
    const approvedDays = approved
    const commentedDays = completed.filter(m => m.userCommented).length

    // ── Agent participation ───────────────────────────────
    const agents = await prisma.agent.findMany({
      where: {
        organizationId: orgId,
        status: { not: "FIRED" },
      },
      select: {
        id: true,
        name: true,
        role: true,
        personality: true,
        lastDailySpokeAt: true,
      },
    })

    const daysSinceSunday = now.getDay() // 0=Sun, 1=Mon
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - daysSinceSunday + (daysSinceSunday === 0 ? -6 : 1)) // Monday
    weekStart.setHours(0, 0, 0, 0)

    // Count how many dailies each agent participated in this week
    const agentWeeklyParticipation: Array<{
      agentId: string
      agentName: string
      role: string
      personality: string
      dailiesThisWeek: number
      lastSpokeAt: string | null
      daysSinceLastSpoke: number | null
    }> = []

    for (const agent of agents) {
      const dailiesThisWeek = metrics.filter(m => {
        // Check if agent spoke in this daily
        // We don't have per-agent telemetry yet, so estimate via lastDailySpokeAt
        if (!agent.lastDailySpokeAt) return false
        const spokeDate = new Date(agent.lastDailySpokeAt)
        return spokeDate >= weekStart && spokeDate <= now
      }).length

      agentWeeklyParticipation.push({
        agentId: agent.id,
        agentName: agent.name,
        role: agent.role,
        personality: agent.personality,
        dailiesThisWeek,
        lastSpokeAt: agent.lastDailySpokeAt?.toISOString() || null,
        daysSinceLastSpoke: agent.lastDailySpokeAt
          ? Math.floor((now.getTime() - agent.lastDailySpokeAt.getTime()) / 86400000)
          : null,
      })
    }

    // ── Missing days (no daily) ───────────────────────────
    const missingDays: string[] = []
    for (let i = 0; i < period; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const hasMetrics = metrics.some(m => {
        const mDate = new Date(m.date).toISOString().slice(0, 10)
        return mDate === dateStr
      })
      if (!hasMetrics) {
        missingDays.push(dateStr)
      }
    }

    return NextResponse.json({
      period,
      periodStart: since.toISOString(),
      periodEnd: now.toISOString(),

      summary: {
        totalDailies: metrics.length,
        completedDailies: completed.length,
        approvedDailies: approvedDays,
        readDailies: readDays,
        commentedDailies: commentedDays,
        alertsDailies: alertsDays,
        avgAgentCount: completed.length > 0
          ? Math.round(completed.reduce((s, m) => s + m.agentCount, 0) / completed.length)
          : 0,
        avgSpeechCount: completed.length > 0
          ? Math.round(totalSpeechCount / completed.length)
          : 0,
        avgTasksExtracted: completed.length > 0
          ? Math.round(totalTasksExtracted / completed.length)
          : 0,
        totalFallbacks,
        missingDays: missingDays.length,
        missingDates: missingDays,
      },

      agents: agentWeeklyParticipation,

      dailies: metrics.map(m => ({
        date: new Date(m.date).toISOString().slice(0, 10),
        status: m.status,
        agentCount: m.agentCount,
        speechCount: m.speechCount,
        tasksExtracted: m.tasksExtracted,
        hadAlerts: m.hadAlerts,
        hadConflicts: m.hadConflicts,
        agentFallbacks: m.agentFallbacks,
        readAt: m.readAt?.toISOString() || null,
        approvedAt: m.approvedAt?.toISOString() || null,
        userCommented: m.userCommented,
        commentCount: m.commentCount,
      })),
    })
  } catch (error) {
    console.error("[Daily Metrics Error]", error)
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
  }
}
