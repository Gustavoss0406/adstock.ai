import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPendingActions, markActionStatus, cancelStaleActions } from "@/lib/orchestrator/scheduler"
import { executeAction } from "@/lib/orchestrator/executor"
import { runBulkAwarenessCheck } from "@/lib/orchestrator/awareness"
import { detectProactiveConflicts, handleConflict } from "@/lib/orchestrator/conflict"
import { TIMING_CONFIG, getPersonalityModifiers, getTaskDurationMinutes } from "@/lib/orchestrator/config"
import { canActAutonomously } from "@/lib/orchestrator/autonomy"
import { processPendingMentions, processTimeBasedEvents, processWeeklyEvents, checkRejectionPattern } from "@/lib/orchestrator/runtime"
import { recordAgentMemory } from "@/lib/orchestrator/memory"
import { runPreDaily, runBlockedTaskCheck } from "@/lib/autonomous/agent-engine"
import { silentProgressUpdate } from "@/lib/agents/silent-updates"
import { postDailyDigest } from "@/lib/orchestrator/actionable-messages"

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

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json()
    if (!organizationId) return NextResponse.json({ error: "org required" }, { status: 400 })

    const agents = await prisma.agent.findMany({ where: { organizationId, status: { not: "FIRED" } } })
    const channel = await prisma.channel.findFirst({ where: { organizationId, name: "geral" } })
    const channelId = channel?.id || null
    const results: Array<{ agent: string; action: string }> = []

    // ─────────────────────────────────────────────────────────
    // 1. ACTION QUEUE PROCESSOR (via Unified Executor)
    // ─────────────────────────────────────────────────────────

    await cancelStaleActions(organizationId, TIMING_CONFIG.STALE_ACTION_CANCEL_MS)

    const pendingActions = await getPendingActions(organizationId, 10)

    for (const action of pendingActions) {
      const agent = agents.find(a => a.id === action.agentId)
      if (!agent) {
        await markActionStatus(action.id, "cancelled", "Agent not found")
        continue
      }

      await markActionStatus(action.id, "executing")

      try {
        const result = await executeAction(
          {
            id: action.id,
            type: action.type,
            priority: action.priority,
            context: (action.context as Record<string, unknown>) || {},
            agentId: action.agentId,
          },
          channelId,
        )

        if (result.success) {
          await markActionStatus(action.id, "completed")
          results.push({ agent: agent.name, action: `${action.type}: ok` })
        } else if (result.error?.includes("Turn not acquired")) {
          await markActionStatus(action.id, "pending")
          results.push({ agent: agent.name, action: `${action.type}: aguardando turno` })
        } else {
          await markActionStatus(action.id, "failed", result.error)
          results.push({ agent: agent.name, action: `${action.type}: ${result.error || "failed"}` })
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        await markActionStatus(action.id, "failed", message)
        results.push({ agent: agent.name, action: `erro: ${message.slice(0, 60)}` })
      }
    }

    // ─────────────────────────────────────────────────────────
    // 2. BULK AWARENESS CHECK (via Awareness Module)
    // ─────────────────────────────────────────────────────────

    const awarenessResults = await runBulkAwarenessCheck(organizationId)

    for (const ar of awarenessResults) {
      if (ar.actionsScheduled > 0) {
        results.push({
          agent: ar.agentName,
          action: `Awareness: ${ar.actionsScheduled} acao(oes) agendadas [${ar.actions.map(a => a.type).join(", ")}]`,
        })
      }
    }

    // ─────────────────────────────────────────────────────────
    // 3. PROACTIVE CONFLICT DETECTION
    // ─────────────────────────────────────────────────────────

    const conflicts = await detectProactiveConflicts(organizationId)
    for (const conflict of conflicts) {
      // Only handle if this conflict hasn't been detected recently
      const existingConflict = await prisma.agencyEvent.findFirst({
        where: {
          organizationId,
          type: "conflict_detected",
          createdAt: { gte: new Date(Date.now() - 300000) }, // 5 min window
          description: { contains: conflict.topic },
        },
      })

      if (!existingConflict) {
        const result = await handleConflict(organizationId, conflict, channelId ?? undefined)
        results.push({
          agent: "Sistema",
          action: `Conflito detectado: ${conflict.agentA} vs ${conflict.agentB} (${result.pausedActionCount} acoes pausadas)`,
        })
      }
    }

    // ─────────────────────────────────────────────────────────
    // 4. WORK MANAGEMENT (Auto-complete, Pick Next Task)
    // ─────────────────────────────────────────────────────────

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

        // Progress report: task >2h and no communication in 1h → SILENT update
        const needsProgressReport =
          taskDuration > TIMING_CONFIG.LONG_TASK_THRESHOLD_MS &&
          timeSinceLastComm > TIMING_CONFIG.PROGRESS_UPDATE_INTERVAL_MS

        if (needsProgressReport) {
          await silentProgressUpdate(agent.id, inProgress.id, inProgress.progress || 0, inProgress.title, organizationId)
          results.push({ agent: agent.name, action: `Progresso silencioso: ${inProgress.title}` })
        }

        // ── Time-based progress (replaces Math.random auto-complete) ──
        const personality = getPersonalityModifiers(agent.name)
        const estimatedMin = inProgress.estimatedMinutes
          || getTaskDurationMinutes(inProgress.type || "content", inProgress.priority)

        // Calculate elapsed minutes since task started
        const elapsedMin = taskDuration / 60000
        // Progress increment = % of estimated time elapsed, adjusted by personality work speed
        const newProgress = Math.min(100, Math.round(
          (elapsedMin / estimatedMin) * 100 * personality.workSpeed
        ))

        // Update progress in DB
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
          results.push({ agent: agent.name, action: `Concluiu: ${inProgress.title} (${newProgress}%)` })
        } else {
          results.push({ agent: agent.name, action: `Trabalhando: ${inProgress.title} (${newProgress}%)` })
        }
      } else {
        // No task in progress — pick next
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
              context: {
                taskId: task.id,
                taskTitle: task.title,
                channelId,
              },
            },
            channelId,
          )
          results.push({ agent: agent.name, action: `Comecou: ${task.title}` })
        } else {
          // No tasks available — agent stays idle silently
          if (canActAutonomously("inter_agent_chat")) {
            // Only ask Maya once every 30 minutes to reduce noise
            const lastAskLog = await prisma.orchestrationLog.findFirst({
              where: {
                agentId: agent.id,
                eventType: "asked_maya_for_tasks",
                createdAt: { gte: new Date(Date.now() - 1800000) },
              },
            })
            if (!lastAskLog) {
              const maya = agents.find(a => a.role === "STRATEGIST")
              if (maya && maya.id !== agent.id && channelId) {
                await executeAction(
                  {
                    id: `ask-maya-${agent.id}-${Date.now()}`,
                    type: "post_message",
                    priority: 2,
                    agentId: agent.id,
                    context: {
                      channelId,
                      message: `@Maya, terminei minhas tarefas. Tem algo novo pra mim ou alguma prioridade que eu deveria focar?`,
                      mentionAgentId: maya.id,
                      mentionAgentName: "Maya Ferreira",
                    },
                  },
                  channelId,
                )
                results.push({ agent: agent.name, action: "Pediu novas tarefas pra Maya" })
              }
            }
          }
          await prisma.agent.update({
            where: { id: agent.id },
            data: { status: "ACTIVE", workState: "IDLE" },
          })
          results.push({ agent: agent.name, action: "Sem tarefas" })
        }
      }
    }

    // ─────────────────────────────────────────────────────────
    // 5. TWO-WAY CONVERSATION (respond to pending mentions)
    // ─────────────────────────────────────────────────────────
    if (channelId) {
      const conversationResults = await processPendingMentions(organizationId, channelId)
      for (const r of conversationResults) {
        results.push({ agent: "Conversa", action: r })
      }
    }

    // ─────────────────────────────────────────────────────────
    // 6. TIME-BASED EVENTS (lunch, checkpoint, close)
    // ─────────────────────────────────────────────────────────
    if (channelId) {
      const timeResults = await processTimeBasedEvents(organizationId, channelId)
      for (const r of timeResults) {
        results.push({ agent: "Sistema", action: r })
      }

      // If not working hours, skip the rest
      if (timeResults.some(r => r.includes("fechou") || r.includes("pausaram"))) {
        return NextResponse.json({ heartbeat: true, tasksProcessed: results.length, results })
      }

      // ── 7. Weekly events ──
      try {
        const weeklyResults = await processWeeklyEvents(organizationId, channelId)
        for (const r of weeklyResults) results.push({ agent: "Sistema", action: r })
      } catch {}

      // ── 8. Pre-daily (08:55) ──
      try {
        const preDailyResults = await runPreDaily(organizationId, channelId)
        for (const r of preDailyResults) results.push({ agent: "Maya", action: r })
      } catch {}

      // ── 9. Blocked task check ──
      try {
        const blockedCount = await runBlockedTaskCheck(organizationId, channelId)
        if (blockedCount > 0) results.push({ agent: "Sistema", action: `${blockedCount} tarefas bloqueadas alertadas` })
      } catch {}

      // ── 10. AI Content fire-and-forget ──
      if (agents.length > 0 && channelId) {
        setTimeout(async () => {
          try {
            const { generateCreativeContent, handleContentDecision } = await import("@/lib/autonomous/agent-engine")
            const task = await prisma.task.findFirst({
              where: { assignedTo: agents[0].id, status: "IN_PROGRESS" },
            })
            if (task) {
              const content = await generateCreativeContent(agents[0].name, task.type || "content", task.title, "agencia de marketing")
              if (content) {
                await recordAgentMemory(agents[0].id, "completed_task", task.title, organizationId)
                await handleContentDecision(organizationId, content, agents[0].id, channelId)
              }
            }
          } catch {}
        }, 5000)
      }
    }

    return NextResponse.json({ heartbeat: true, tasksProcessed: results.length, results })
  } catch (error) {
    console.error("[Heartbeat Error]", error)
    return NextResponse.json({ error: "Heartbeat failed" }, { status: 500 })
  }
}
