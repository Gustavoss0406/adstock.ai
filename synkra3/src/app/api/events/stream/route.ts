/**
 * ── SSE v2: Real-time Agent + Orchestration Stream ─────────
 *
 * GET /api/events/stream?orgId=xxx
 *
 * Envia estado inicial e atualizações periódicas incluindo:
 * - Agent status + work states
 * - Channel lock states + typing indicators
 * - Action queue summary
 * - New events
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

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let lastEventId = ""

      // ── Initial state ───────────────────────────────────
      const initialData = await buildInitialPayload(orgId)
      if (initialData.recentEvents.length > 0) {
        lastEventId = initialData.recentEvents[0].id
      }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`))

      // ── Poll interval (every 5s) ────────────────────────
      const interval = setInterval(async () => {
        try {
          const updateData = await buildUpdatePayload(orgId, lastEventId)
          if (updateData) {
            if (updateData.events && updateData.events.length > 0) {
              lastEventId = updateData.events[0].id
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(updateData)}\n\n`))
          }
        } catch {
          // Silently skip polling errors
        }
      }, 5000)

      request.signal.addEventListener("abort", () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Payload Builders
// ─────────────────────────────────────────────────────────────

async function buildInitialPayload(orgId: string) {
  const [agents, tasks, recentEvents, channels] = await Promise.all([
    prisma.agent.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        status: true,
        workState: true,
        performance: true,
        morale: true,
        role: true,
        level: true,
        salary: true,
        lastCheckAt: true,
        updatedAt: true,
      },
    }),
    prisma.task.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        assignedTo: true,
        blocked: true,
        startedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.agencyEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.channel.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
    }),
  ])

  const turnMetrics = getTurnMetrics()
  const typingIndicators = getAllTypingIndicators()

  return {
    type: "initial",
    agents,
    tasks,
    recentEvents: recentEvents.map(e => ({
      id: e.id,
      type: e.type,
      title: e.title,
      description: e.description,
      createdAt: e.createdAt,
    })),
    orchestration: {
      channels: channels.map(ch => ({
        id: ch.id,
        name: ch.name,
        lockedBy: turnMetrics.locks[ch.name]?.lockedBy || null,
        lockAgeMs: turnMetrics.locks[ch.name]?.lockAgeMs || null,
        queueLength: turnMetrics.locks[ch.name]?.queueLength || 0,
        typing: typingIndicators.get(ch.name)
          ? {
              agentId: typingIndicators.get(ch.name)!.agentId,
              agentName: typingIndicators.get(ch.name)!.agentName,
            }
          : null,
      })),
    },
  }
}

async function buildUpdatePayload(orgId: string, lastEventId: string) {
  const [newEvents, updatedAgents] = await Promise.all([
    prisma.agencyEvent.findMany({
      where: { organizationId: orgId, id: { gt: lastEventId } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.agent.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        status: true,
        workState: true,
        performance: true,
        morale: true,
        lastCheckAt: true,
      },
    }),
  ])

  const turnMetrics = getTurnMetrics()
  const typingIndicators = getAllTypingIndicators()

  const channelsOrchestration = Array.from(
    new Set([
      ...Object.keys(turnMetrics.locks),
      ...Array.from(typingIndicators.keys()),
    ]),
  ).map(chName => ({
    name: chName,
    lockedBy: turnMetrics.locks[chName]?.lockedBy || null,
    lockAgeMs: turnMetrics.locks[chName]?.lockAgeMs || null,
    queueLength: turnMetrics.locks[chName]?.queueLength || 0,
    typing: typingIndicators.get(chName)
      ? {
          agentId: typingIndicators.get(chName)!.agentId,
          agentName: typingIndicators.get(chName)!.agentName,
        }
      : null,
  }))

  if (
    newEvents.length > 0 ||
    updatedAgents.length > 0 ||
    channelsOrchestration.length > 0
  ) {
    return {
      type: "update",
      events: newEvents.map(e => ({
        id: e.id,
        type: e.type,
        title: e.title,
        description: e.description,
        createdAt: e.createdAt,
      })),
      agents: updatedAgents,
      orchestration: {
        channels: channelsOrchestration,
      },
    }
  }

  return null
}
