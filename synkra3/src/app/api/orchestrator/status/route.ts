/**
 * ── ORCHESTRATION STATUS ENDPOINT ─────────────────────────────
 *
 * GET /api/orchestrator/status?orgId=xxx
 *
 * Retorna o estado completo da orquestração para o dashboard de debug.
 * Inclui: estados dos agentes, fila de ações, locks de canal, métricas.
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTurnMetrics, getAllTypingIndicators } from "@/lib/orchestrator/turns"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 })
  }

  try {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 3600000)
    const twentyFourHoursAgo = new Date(now.getTime() - 86400000)

    // ── Parallel data fetch ────────────────────────────────

    const [
      agents,
      pendingActions,
      channels,
      actionStats24h,
      messagesLastHour,
      taskMoves24h,
      recentLogs,
      conflictCount,
    ] = await Promise.all([
      // All agents with work state
      prisma.agent.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          name: true,
          role: true,
          personality: true,
          status: true,
          workState: true,
          performance: true,
          morale: true,
          lastCheckAt: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
      }),

      // Pending actions in queue (next 5 min)
      prisma.agentAction.findMany({
        where: {
          organizationId: orgId,
          status: "pending",
          scheduledFor: { lte: new Date(now.getTime() + 300000) },
        },
        include: {
          agent: { select: { id: true, name: true } },
        },
        orderBy: { priority: "desc" },
        take: 20,
      }),

      // Channels
      prisma.channel.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true },
      }),

      // Action stats (24h)
      prisma.agentAction.groupBy({
        by: ["status", "type"],
        where: {
          organizationId: orgId,
          createdAt: { gte: twentyFourHoursAgo },
        },
        _count: true,
      }),

      // Messages last hour
      prisma.message.count({
        where: {
          channel: { organizationId: orgId },
          createdAt: { gte: oneHourAgo },
        },
      }),

      // Task moves (24h) — using updatedAt as proxy for moves
      prisma.task.count({
        where: {
          organizationId: orgId,
          updatedAt: { gte: twentyFourHoursAgo },
        },
      }),

      // Recent orchestration logs
      prisma.orchestrationLog.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          agent: { select: { name: true } },
        },
      }),

      // Conflict count (24h)
      prisma.agencyEvent.count({
        where: {
          organizationId: orgId,
          type: "conflict_detected",
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
    ])

    // ── Turn metrics (in-memory) ──────────────────────────
    const turnMetrics = getTurnMetrics()
    const typingIndicators = getAllTypingIndicators()

    // ── Channel lock state per channel ────────────────────
    const channelStates = channels.map(ch => ({
      id: ch.id,
      name: ch.name,
      locked: !!turnMetrics.locks[ch.name]?.lockedBy,
      lockedBy: turnMetrics.locks[ch.name]?.lockedBy || null,
      lockAgeMs: turnMetrics.locks[ch.name]?.lockAgeMs || null,
      queueLength: turnMetrics.locks[ch.name]?.queueLength || 0,
      typing: typingIndicators.get(ch.name)
        ? {
            agentId: typingIndicators.get(ch.name)!.agentId,
            agentName: typingIndicators.get(ch.name)!.agentName,
            ageMs: typingIndicators.get(ch.name)!.startedAt
              ? Date.now() - typingIndicators.get(ch.name)!.startedAt
              : 0,
          }
        : null,
    }))

    // ── Action queue (next actions) ──────────────────────
    const actionQueue = pendingActions.map(a => ({
      id: a.id,
      type: a.type,
      priority: a.priority,
      agentId: a.agentId,
      agentName: a.agent?.name || "unknown",
      scheduledFor: a.scheduledFor,
      secondsUntil: Math.max(
        0,
        Math.floor((new Date(a.scheduledFor).getTime() - now.getTime()) / 1000),
      ),
    }))

    // ── Aggregate action stats ────────────────────────────
    const actionStats: Record<string, number> = {}
    for (const stat of actionStats24h) {
      const key = `${stat.status}_${stat.type}`
      actionStats[key] = (actionStats[key] || 0) + stat._count
    }

    const totalActions24h = actionStats24h.reduce((sum, s) => sum + s._count, 0)
    const completedActions24h = actionStats24h
      .filter(s => s.status === "completed")
      .reduce((sum, s) => sum + s._count, 0)
    const failedActions24h = actionStats24h
      .filter(s => s.status === "failed")
      .reduce((sum, s) => sum + s._count, 0)

    // ── Agent work state distribution ─────────────────────
    const workStateDistribution: Record<string, number> = {}
    for (const agent of agents) {
      const ws = agent.workState || "UNKNOWN"
      workStateDistribution[ws] = (workStateDistribution[ws] || 0) + 1
    }

    const statusDistribution: Record<string, number> = {}
    for (const agent of agents) {
      const s = agent.status || "UNKNOWN"
      statusDistribution[s] = (statusDistribution[s] || 0) + 1
    }

    // ── Average response time (from orchestration logs) ──
    const messageSentLogs = recentLogs.filter(
      l => l.eventType === "message_sent" && l.details,
    )
    let avgResponseTimeMs: number | null = null
    if (messageSentLogs.length > 0) {
      const totalTypingTime = messageSentLogs.reduce((sum, l) => {
        const details = l.details as Record<string, unknown> | null
        return sum + ((details?.typingTimeMs as number) || 0)
      }, 0)
      avgResponseTimeMs = Math.round(totalTypingTime / messageSentLogs.length)
    }

    // ── Recent activity log ───────────────────────────────
    const activityLog = recentLogs.slice(0, 20).map(l => ({
      id: l.id,
      timestamp: l.createdAt,
      agentName: l.agent?.name || "system",
      eventType: l.eventType,
      details: l.details,
    }))

    return NextResponse.json({
      timestamp: now.toISOString(),
      organizationId: orgId,

      // Agent states
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
        personality: a.personality,
        status: a.status,
        workState: a.workState,
        performance: a.performance,
        morale: a.morale,
        lastCheckAt: a.lastCheckAt,
        lastUpdated: a.updatedAt,
      })),
      workStateDistribution,
      statusDistribution,

      // Channels
      channels: channelStates,
      totalChannels: channels.length,
      lockedChannels: channelStates.filter(c => c.locked).length,
      channelsWithTyping: channelStates.filter(c => c.typing).length,

      // Action queue
      actionQueue,
      pendingActionCount: pendingActions.length,

      // Metrics
      metrics: {
        messagesLastHour: messagesLastHour,
        taskMoves24h: taskMoves24h,
        totalActions24h,
        completedActions24h,
        failedActions24h,
        conflicts24h: conflictCount,
        avgResponseTimeMs,
        totalLocks: turnMetrics.totalLocks,
        pendingReleases: turnMetrics.pendingReleases,
      },

      // Activity log
      activityLog,

      // Raw turn metrics for deep debug
      _debug: {
        turnMetrics,
        typingIndicators: Array.from(typingIndicators.entries()).map(
          ([ch, state]) => ({
            channelId: ch,
            agentName: state.agentName,
            ageMs: Date.now() - state.startedAt,
          }),
        ),
      },
    })
  } catch (error) {
    console.error("[Orchestrator Status Error]", error)
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 })
  }
}
