import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPendingActions, markActionStatus, cancelStaleActions } from "@/lib/orchestrator/scheduler"
import { executeAction } from "@/lib/orchestrator/executor"
import { runBulkAwarenessCheck } from "@/lib/orchestrator/awareness"
import { detectProactiveConflicts, handleConflict } from "@/lib/orchestrator/conflict"
import { TIMING_CONFIG, getPersonalityModifiers, getTaskDurationMinutes } from "@/lib/orchestrator/config"
import { autoImproveTasks } from "@/lib/orchestrator/quality"

export const maxDuration = 300 // 5min for full cycle across all orgs

const ROLE_MATCH: Record<string, string[]> = {
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

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key")
  if (apiKey !== process.env.ROUTINE_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const orgs = await prisma.organization.findMany({
      where: {
        agents: { some: { status: { notIn: ["FIRED", "OFFLINE"] } } },
      },
      select: { id: true, name: true },
    })

    const results: Array<{ org: string; actions: number; agents: number }> = []
    const errors: Array<{ org: string; error: string }> = []

    // Process orgs in parallel batches
    const BATCH_SIZE = 5
    for (let i = 0; i < orgs.length; i += BATCH_SIZE) {
      const batch = orgs.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.allSettled(
        batch.map(async (org) => {
          const stats = await processOrgHeartbeat(org.id)
          return { org: org.name, ...stats }
        }),
      )

      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          results.push(r.value)
        } else {
          const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason)
          errors.push({ org: "unknown", error: errMsg.slice(0, 100) })
        }
      }
    }

    const totalActions = results.reduce((sum, r) => sum + r.actions, 0)
    const totalAgents = results.reduce((sum, r) => sum + r.agents, 0)

    return NextResponse.json({
      success: true,
      orgsProcessed: results.length,
      errors: errors.length,
      totalActions,
      totalAgents,
      results: results.slice(0, 20), // Truncate for response size
      errorsList: errors.slice(0, 5),
    })
  } catch (error) {
    console.error("[HeartbeatCron Error]", error)
    return NextResponse.json({ error: "Heartbeat cron failed" }, { status: 500 })
  }
}

async function processOrgHeartbeat(organizationId: string): Promise<{
  actions: number
  agents: number
  awarenessScheduled: number
  workUpdates: number
  qualityImproved: number
}> {
  const agents = await prisma.agent.findMany({
    where: { organizationId, status: { not: "FIRED" } },
  })
  const channel = await prisma.channel.findFirst({
    where: { organizationId, name: "geral" },
  })
  const channelId = channel?.id || null

  if (agents.length === 0) return { actions: 0, agents: 0, awarenessScheduled: 0, workUpdates: 0, qualityImproved: 0 }

  // ── 1. Cancel stale actions ──────────────────────────
  await cancelStaleActions(organizationId, TIMING_CONFIG.STALE_ACTION_CANCEL_MS)

  // ── 2. Process pending actions (20 per cycle, parallel by channel) ──
  let actionsProcessed = 0
  const pendingActions = await getPendingActions(organizationId, 20)

  // Group actions by channel for parallel processing
  const byChannel = new Map<string, typeof pendingActions>()
  const noChannel: typeof pendingActions = []

  for (const action of pendingActions) {
    const chId = (action.context as any)?.channelId || null
    if (chId) {
      if (!byChannel.has(chId)) byChannel.set(chId, [])
      byChannel.get(chId)!.push(action)
    } else {
      noChannel.push(action)
    }
  }

  // Process each channel's actions sequentially within channel, but channels in parallel
  const channelPromises = Array.from(byChannel.entries()).map(async ([chId, actions]) => {
    let count = 0
    for (const action of actions) {
      const agent = agents.find(a => a.id === action.agentId)
      if (!agent) {
        await markActionStatus(action.id, "cancelled", "Agent not found")
        continue
      }
      await markActionStatus(action.id, "executing")
      try {
        const result = await executeAction(
          { id: action.id, type: action.type, priority: action.priority, context: (action.context as Record<string, unknown>) || {}, agentId: action.agentId },
          chId,
        )
        if (result.success) { await markActionStatus(action.id, "completed"); count++ }
        else if (result.error?.includes("Turn not acquired")) { await markActionStatus(action.id, "pending") }
        else { await markActionStatus(action.id, "failed", result.error) }
      } catch (err: unknown) {
        await markActionStatus(action.id, "failed", err instanceof Error ? err.message : String(err))
      }
    }
    return count
  })

  // Process channel-less actions sequentially
  for (const action of noChannel) {
    const agent = agents.find(a => a.id === action.agentId)
    if (!agent) { await markActionStatus(action.id, "cancelled", "Agent not found"); continue }
    await markActionStatus(action.id, "executing")
    try {
      const result = await executeAction(
        { id: action.id, type: action.type, priority: action.priority, context: (action.context as Record<string, unknown>) || {}, agentId: action.agentId },
        channelId,
      )
      if (result.success) { await markActionStatus(action.id, "completed"); actionsProcessed++ }
      else if (result.error?.includes("Turn not acquired")) { await markActionStatus(action.id, "pending") }
      else { await markActionStatus(action.id, "failed", result.error) }
    } catch (err: unknown) {
      await markActionStatus(action.id, "failed", err instanceof Error ? err.message : String(err))
    }
  }

  const channelResults = await Promise.all(channelPromises)
  actionsProcessed += channelResults.reduce((sum, c) => sum + c, 0)

  // ── 3. Bulk awareness check ──────────────────────────
  const awarenessResults = await runBulkAwarenessCheck(organizationId)
  const awarenessScheduled = awarenessResults.reduce((sum, a) => sum + a.actionsScheduled, 0)

  // ── 4. Proactive conflict detection ──────────────────
  try {
    const conflicts = await detectProactiveConflicts(organizationId)
    for (const conflict of conflicts) {
      const existing = await prisma.agencyEvent.findFirst({
        where: {
          organizationId,
          type: "conflict_detected",
          createdAt: { gte: new Date(Date.now() - 300000) },
          description: { contains: conflict.topic },
        },
      })
      if (!existing) {
        await handleConflict(organizationId, conflict, channelId ?? undefined)
      }
    }
  } catch {}

  // ── 5. Work management ───────────────────────────────
  let workUpdates = 0
  for (const agent of agents) {
    const inProgress = await prisma.task.findFirst({
      where: { assignedTo: agent.id, status: "IN_PROGRESS" },
    })

    if (inProgress) {
      const startedAt = inProgress.startedAt
        ? new Date(inProgress.startedAt).getTime()
        : new Date(inProgress.updatedAt).getTime()
      const taskDuration = Date.now() - startedAt
      const timeSinceLastComm = inProgress.lastCommunicatedAt
        ? Date.now() - new Date(inProgress.lastCommunicatedAt).getTime()
        : taskDuration

      const needsProgressReport =
        taskDuration > TIMING_CONFIG.LONG_TASK_THRESHOLD_MS &&
        timeSinceLastComm > TIMING_CONFIG.PROGRESS_UPDATE_INTERVAL_MS

      if (needsProgressReport && channelId) {
        await executeAction(
          {
            id: `progress-${inProgress.id}-${Date.now()}`,
            type: "report_progress",
            priority: 5,
            agentId: agent.id,
            context: { taskTitle: inProgress.title, taskId: inProgress.id, channelId },
          },
          channelId,
        )
        workUpdates++
      }

      // ── Time-based progress (replaces Math.random auto-complete) ──
      const personality = getPersonalityModifiers(agent.name)
      const estimatedMin = inProgress.estimatedMinutes
        || getTaskDurationMinutes(inProgress.type || "content", inProgress.priority)

      const elapsedMin = taskDuration / 60000
      const newProgress = Math.min(100, Math.round(
        (elapsedMin / estimatedMin) * 100 * personality.workSpeed
      ))

      if (newProgress !== (inProgress.progress || 0)) {
        await prisma.task.update({
          where: { id: inProgress.id },
          data: { progress: newProgress },
        })
      }

      if (newProgress >= 100) {
        await executeAction(
          {
            id: `auto-${inProgress.id}-${Date.now()}`,
            type: "complete_task",
            priority: 5,
            agentId: agent.id,
            context: { taskId: inProgress.id, taskTitle: inProgress.title, channelId },
          },
          channelId,
        )
        workUpdates++
      }
    } else {
      const matchingTypes = ROLE_MATCH[agent.role] || ["content"]
      const task = await prisma.task.findFirst({
        where: {
          organizationId,
          status: "TODO",
          blocked: false,
          OR: [
            { assignedTo: agent.id },
            { assignedTo: null, type: { in: matchingTypes } },
            { assignedTo: null },
          ],
        },
        orderBy: { priority: "desc" },
      })

      if (task) {
        await executeAction(
          {
            id: `auto-${task.id}-${Date.now()}`,
            type: "start_task",
            priority: 6,
            agentId: agent.id,
            context: { taskId: task.id, taskTitle: task.title, channelId },
          },
          channelId,
        )
        workUpdates++
      } else {
        await prisma.agent.update({
          where: { id: agent.id },
          data: { status: "ACTIVE", workState: "IDLE" },
        })
      }
    }
  }

  // ── 6. Auto-improve low-quality tasks ──────────────────
  let qualityImproved = 0
  try {
    qualityImproved = await autoImproveTasks(organizationId)
  } catch {}

  return {
    actions: actionsProcessed,
    agents: agents.length,
    awarenessScheduled,
    workUpdates,
    qualityImproved,
  }
}
