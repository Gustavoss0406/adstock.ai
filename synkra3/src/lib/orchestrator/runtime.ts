/**
 * ── AUTONOMOUS RUNTIME ─────────────────────────────────────
 *
 * Engine principal que roda o ciclo diário completo:
 * - Time-based events (lunch 12h, checkpoint 17h, close 19h)
 * - Approval cascade (CEO approves → next agent → schedule → monitor)
 * - Two-way conversation (notified agents respond)
 * - Agent memory (track what each agent did)
 * - Proactive work picking (idle → pick task → work → complete → cascade)
 */

import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"
import { executeAction } from "./executor"
import { notifyTaskChain } from "./conversation"
import { respondToMessage, postAgentMessage } from "./conversationV2"
import { recordAgentMemory, summarizeAgentDay, isLunchTime, isCheckpointTime, isClosingTime, isWorkingHours } from "./memory"
import { canActAutonomously } from "./autonomy"
import { scheduleAction } from "./scheduler"

// ── Process pending mentions (two-way conversation) ─────────
export async function processPendingMentions(organizationId: string, channelId: string): Promise<string[]> {
  const results: string[] = []
  const fiveMinutesAgo = new Date(Date.now() - 300000)

  const recentMessages = await prisma.message.findMany({
    where: {
      channelId: channelId || undefined,
      organizationId,
      metadata: { path: ["type"], equals: "task_cascade" },
      createdAt: { gte: fiveMinutesAgo },
    },
    include: { agent: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  for (const msg of recentMessages) {
    const meta = (msg.metadata as any) || {}
    const mentionedId = meta.notifyAgentId
    if (!mentionedId) continue

    // Check if already responded
    const responded = await prisma.message.findFirst({
      where: {
        organizationId,
        agentId: mentionedId,
        metadata: { path: ["replyTo"], equals: msg.id },
        createdAt: { gte: fiveMinutesAgo },
      },
    })
    if (responded) continue

    const mentionedAgent = await prisma.agent.findUnique({
      where: { id: mentionedId },
      select: { id: true, name: true },
    })
    if (!mentionedAgent) continue

    const reply = await respondToMessage(
      mentionedAgent.id,
      mentionedAgent.name,
      organizationId,
      {
        what: msg.content?.slice(0, 200) || "interacao",
        from: meta.notifyAgentName || msg.agent?.name || "um colega",
        detail: msg.content?.slice(0, 300) || "",
      },
    )

    if (reply) {
      const msgId = await postAgentMessage(mentionedAgent.id, mentionedAgent.name, reply, organizationId)
      if (msgId) {
        results.push(`${mentionedAgent.name} respondeu`)
      }
    }
  }

  return results
}

// ── Approval cascade ──────────────────────────────────────
export async function processApprovalCascade(organizationId: string, approvedTaskId: string): Promise<string[]> {
  const results: string[] = []
  const task = await prisma.task.findUnique({
    where: { id: approvedTaskId },
    include: { assignee: true },
  })
  if (!task) return results

  const agents = await prisma.agent.findMany({
    where: { organizationId, status: { not: "FIRED" } },
  })

  // Find the next agent in the workflow
  const nextAgent = getNextInWorkflow(task, agents)
  if (!nextAgent) return results

  // Notify the next agent
  const channel = await prisma.channel.findFirst({ where: { organizationId, name: "geral" } })
  if (!channel) return results

  const notifyPrompt = `Voce e ${task.assignee?.name || "Sistema"}.
O CEO acabou de APROVAR a tarefa "${task.title}".
Avise ${nextAgent.name.split(" ")[0]} que e a vez dele(a) trabalhar na proxima etapa.
Seja natural. 1 frases. Mencione @${nextAgent.name.split(" ")[0]}.`

  try {
    const reply = await chatCompletion(notifyPrompt, { temperature: 0.7, maxTokens: 150 })
    const clean = reply.replace(/^(Claro|Certo|OK|Ok)[,!.]?\s*/i, "").trim()

    if (clean.length > 10 && !clean.includes("Nao consegui")) {
      await prisma.message.create({
        data: {
          content: clean,
          metadata: {
            type: "approval_cascade",
            approvedTaskId,
            notifyAgentId: nextAgent.id,
            notifyAgentName: nextAgent.name,
          },
          channelId: channel.id,
        },
      } as any)

      // Auto-create the next task if appropriate
      const actionType = getNextActionType(task)
      if (actionType) {
        await scheduleAction(organizationId, nextAgent.id, actionType, 8, {
          taskId: `cascade-${approvedTaskId}-${Date.now()}`,
          title: `Dar continuidade: ${task.title}`,
          description: `Criado automaticamente apos aprovacao de "${task.title}" por ${task.assignee?.name || "CEO"}.`,
          type: getTaskTypeFor(task),
          priority: "HIGH",
          source: "approval_cascade",
        } as any)
      }

      results.push(`Notificacao: ${nextAgent.name} avisado`)
    }
  } catch {}

  return results
}

function getNextInWorkflow(task: any, agents: any[]): any {
  const title = (task.title || "").toLowerCase()
  const type = (task.type || "").toLowerCase()

  if (title.includes("copy") || type === "content") return agents.find(a => a.role === "DESIGNER")
  if (title.includes("arte") || title.includes("design")) return agents.find(a => a.role === "SOCIAL_MEDIA")
  if (title.includes("agendamento") || type === "campaign") return agents.find(a => a.role === "ANALYST")
  if (type === "analysis") return agents.find(a => a.role === "STRATEGIST")
  if (title.includes("seo") || title.includes("blog")) return agents.find(a => a.role === "SOCIAL_MEDIA")
  return agents.find(a => a.role === "SOCIAL_MEDIA") || null
}

function getNextActionType(task: any): string | null {
  const title = (task.title || "").toLowerCase()
  if (title.includes("copy")) return "start_task"
  if (title.includes("arte")) return "start_task"
  if (title.includes("campanha")) return "start_task"
  return null
}

function getTaskTypeFor(task: any): string {
  const title = (task.title || "").toLowerCase()
  if (title.includes("copy")) return "content"
  if (title.includes("arte")) return "content"
  if (title.includes("analise")) return "analysis"
  return "content"
}

// ── Time-based events ──────────────────────────────────────
export async function processTimeBasedEvents(organizationId: string, channelId: string): Promise<string[]> {
  const results: string[] = []
  const agents = await prisma.agent.findMany({
    where: { organizationId, status: { not: "FIRED" } },
  })

  // ── Lunch time (12:00-13:00) ──────────────────────────────
  if (isLunchTime()) {
    const today = new Date().toISOString().slice(0, 10)
    const alreadyLunched = await prisma.agencyEvent.findFirst({
      where: {
        organizationId,
        type: "agent_lunch",
        createdAt: { gte: new Date(today) },
      },
    })
    if (!alreadyLunched && agents.length > 0) {
      await prisma.agencyEvent.create({
        data: {
          organizationId, type: "agent_lunch",
          title: "Hora do almoco",
          description: "Agentes pausaram para o almoco.",
        },
      } as any)

      // Set agents to idle
      for (const agent of agents) {
        await prisma.agent.update({
          where: { id: agent.id },
          data: { status: "ACTIVE", workState: "IDLE" },
        })
      }
      results.push("Almoco: agentes pausaram")
    }
    return results // Don't process other events during lunch
  }

  // ── Checkpoint (17:00) ────────────────────────────────────
  if (isCheckpointTime()) {
    const today = new Date().toISOString().slice(0, 10)
    const alreadyChecked = await prisma.agencyEvent.findFirst({
      where: {
        organizationId,
        type: "daily_checkpoint",
        createdAt: { gte: new Date(today) },
      },
    })
    if (!alreadyChecked && channelId) {
      await prisma.agencyEvent.create({
        data: {
          organizationId, type: "daily_checkpoint",
          title: "Checkpoint do dia",
          description: "Agentes resumindo o que fizeram hoje.",
        },
      } as any)

      // Each agent posts their summary
      for (const agent of agents.slice(0, 5)) {
        const summary = await summarizeAgentDay(agent.id, agent.name)
        if (summary) {
          await prisma.message.create({
            data: {
              content: summary,
              metadata: { type: "daily_checkpoint", agentId: agent.id },
              agentId: agent.id,
              channelId: channelId,
            },
          } as any)
        }
      }
      results.push("Checkpoint: agentes resumiram o dia")
    }

    // Maya plans tomorrow
    const maya = agents.find(a => a.role === "STRATEGIST")
    if (maya && channelId) {
      const backlogCount = await prisma.task.count({ where: { organizationId, status: "TODO" } })
      if (backlogCount < 5) {
        const reply = await chatCompletion(
          `Voce e Maya. O backlog so tem ${backlogCount} tarefas. Planeje o amanha: crie 5 ideias.`,
          { temperature: 0.8, maxTokens: 150 }
        )
        if (reply && reply.length > 15 && !reply.includes("Nao consegui")) {
          await prisma.message.create({
            data: {
              content: reply,
              metadata: { type: "next_day_planning" },
              agentId: maya.id,
              channelId: channelId,
            },
          } as any)
          results.push("Planejamento: Maya planejou amanha")
        }
      }
    }
  }

  // ── Closing time (19:00) ──────────────────────────────────
  if (isClosingTime()) {
    const today = new Date().toISOString().slice(0, 10)
    const alreadyClosed = await prisma.agencyEvent.findFirst({
      where: {
        organizationId,
        type: "office_closed",
        createdAt: { gte: new Date(today) },
      },
    })
    if (!alreadyClosed) {
      await prisma.agencyEvent.create({
        data: {
          organizationId, type: "office_closed",
          title: "Escritorio fechado",
          description: "Agentes encerraram o dia. Voltamos amanha as 9h!",
        },
      } as any)

      for (const agent of agents) {
        await prisma.agent.update({
          where: { id: agent.id },
          data: { status: "ACTIVE", workState: "IDLE" },
        })
      }
      results.push("Fechamento: escritorio fechou ate amanha")
    }
    return results
  }

  return results
}

// ── Content creation (AI-powered) ───────────────────────────
export async function aiCreateContent(
  agentId: string,
  agentName: string,
  taskType: string,
  taskTitle: string,
  organizationId: string,
): Promise<string | null> {
  if (!isWorkingHours() || isLunchTime()) return null

  const prompt = getContentCreationPrompt(agentName, taskType, taskTitle)
  if (!prompt) return null

  try {
    const reply = await chatCompletion(prompt, { temperature: 0.8, maxTokens: 1000 })
    const output = reply.replace(/^(Claro|Certo|OK|Ok)[,!.]?\s*/i, "").trim()
    if (output.length < 20 || output.includes("Nao consegui")) return null
    return output
  } catch {
    return null
  }
}

function getContentCreationPrompt(agentName: string, taskType: string, taskTitle: string): string {
  switch (taskType) {
    case "content":
      return `Voce e ${agentName}. Crie o conteudo para a tarefa: "${taskTitle}".
Se for copy, crie 2 variacoes. Se for arte, descreva a composicao visual.
Seja criativo e siga boas praticas de marketing. JSON opcional se aplicavel.`

    case "analysis":
      return `Voce e ${agentName}. Analise: "${taskTitle}".
Apresente metricas, tendencias, oportunidades e recomendacoes.
Use formato estruturado com topicos.`

    case "technical":
      return `Voce e ${agentName}. Execute: "${taskTitle}".
Se for SEO, sugira keywords, title tags, meta descriptions.
Seja tecnico e preciso.`

    default:
      return ""
  }
}
