import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { detectChanges, analyzeAndDecideActions, runAwarenessCheck, analyzeConversationRelevance } from "@/lib/orchestrator/awareness"
import { scheduleAction } from "@/lib/orchestrator/scheduler"

export async function POST(request: NextRequest) {
  try {
    const { organizationId, agentId, lastCheckAt, schedule = false, messages } = await request.json()
    if (!organizationId || !agentId) {
      return NextResponse.json({ error: "orgId and agentId required" }, { status: 400 })
    }

    // ── Mode 1: AI Conversation Relevance Analysis ────────
    if (messages && Array.isArray(messages) && messages.length > 0) {
      const relevance = await analyzeConversationRelevance(
        agentId,
        messages.map((m: any) => ({
          authorName: m.authorName || m.author || "desconhecido",
          content: m.content || "",
        })),
      )
      return NextResponse.json({ relevance })
    }

    // ── Mode 2: Full Awareness Check (with optional scheduling) ──
    if (schedule) {
      const result = await runAwarenessCheck(agentId, organizationId)
      return NextResponse.json({
        agent: result.changes.mentions.length > 0 ? "Active" : "Checked",
        checkedAt: new Date().toISOString(),
        changes: {
          mentions: result.changes.mentions.map(m => ({
            id: m.id,
            from: m.from,
            content: m.content.slice(0, 100),
            time: m.time,
            isFromCeo: m.isFromCeo,
          })),
          newTasks: result.changes.newTasks,
          unblocked: result.changes.unblockedTasks,
          awaitingApproval: result.changes.awaitingApproval,
          stuckTask: result.changes.stuckTask,
          stalePending: result.changes.stalePending,
          pendingReviews: result.changes.pendingReviews,
        },
        work: {
          currentTask: result.changes.currentTask,
          pendingCount: result.changes.pendingTaskCount,
          shouldPickNext: !result.changes.currentTask && result.changes.hasPendingTasks,
        },
        social: {
          recentMessageCount: result.changes.recentMessages.length,
        },
        actions: {
          scheduled: result.actionsScheduled,
          details: result.actions,
        },
      })
    }

    // ── Mode 3: Read-only Detection (backward compat) ────
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, role: true, lastCheckAt: true },
    })
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    const since = lastCheckAt
      ? new Date(lastCheckAt)
      : agent.lastCheckAt
        ? new Date(agent.lastCheckAt)
        : new Date(Date.now() - 60000)

    const changes = await detectChanges(agentId, organizationId, since)
    const channel = await prisma.channel.findFirst({
      where: { organizationId, name: "geral" },
      select: { id: true },
    })

    // Analyze but don't schedule (return what would be scheduled)
    const wouldSchedule = analyzeAndDecideActions(
      changes,
      agent.name,
      "ACTIVE",
      channel?.id || null,
    )

    return NextResponse.json({
      agent: agent.name,
      checkedAt: new Date().toISOString(),
      alerts: {
        mentions: changes.mentions.map(m => ({
          id: m.id,
          from: m.from,
          content: m.content.slice(0, 100),
          time: m.time,
          isFromCeo: m.isFromCeo,
        })),
        newTasks: changes.newTasks,
        unblocked: changes.unblockedTasks,
        awaitingApproval: changes.awaitingApproval,
        stuckTask: changes.stuckTask,
        stalePending: changes.stalePending,
        pendingReviews: changes.pendingReviews,
      },
      work: {
        currentTask: changes.currentTask,
        pendingCount: changes.pendingTaskCount,
        shouldPickNext: !changes.currentTask && changes.hasPendingTasks,
      },
      social: {
        recentMessageCount: changes.recentMessages.length,
        recentMessages: changes.recentMessages.slice(0, 5),
      },
      wouldSchedule: wouldSchedule.map(a => ({
        type: a.type,
        priority: a.priority,
        reason: a.reason,
      })),
    })
  } catch (error) {
    console.error("[Awareness Error]", error)
    return NextResponse.json({ error: "Awareness failed" }, { status: 500 })
  }
}
