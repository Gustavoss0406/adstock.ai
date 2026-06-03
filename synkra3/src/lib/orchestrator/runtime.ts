/**
 * ── AUTONOMOUS RUNTIME ─────────────────────────────────────
 *
 * Engine principal que roda o ciclo diário completo:
 * - Time-based events (lunch 12h, checkpoint 17h, close 19h)
 * - Weekly planning (Mon 10h) + Weekly report (Sun 20h)
 * - Approval cascade (CEO approves → next agent → schedule → monitor)
 * - Two-way conversation (notified agents respond)
 * - Multi-hop conversation (Bruno→Lena→Maya chain)
 * - Agent memory (track what each agent did)
 * - Content creation pipeline (AI generates content during work hours)
 * - Voting integration (internal team vote before CEO)
 * - Notification intelligence (filter CEO noise)
 * - Contexto compartilhado (agents see team activity)
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

  const channelIds = (await prisma.channel.findMany({
    where: { organizationId },
    select: { id: true },
  })).map(c => c.id)

  const recentMessages = await prisma.message.findMany({
    where: {
      channelId: { in: channelIds.length > 0 ? channelIds : undefined },
      agentId: { not: null },
      createdAt: { gte: fiveMinutesAgo },
    },
    include: { agent: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  for (const msg of recentMessages) {
    // Check if this message mentions another agent
    if (!msg.content?.includes("@")) continue
    const meta = (msg.metadata as any) || {}
    const mentionedId = meta.notifyAgentId
    if (!mentionedId) continue

    const mentionedAgent = await prisma.agent.findUnique({
      where: { id: mentionedId },
      select: { id: true, name: true },
    })
    if (!mentionedAgent) continue

    // Check if already responded within last 10 minutes
    const alreadyReplied = await prisma.message.findFirst({
      where: {
        channelId: { in: channelIds.length > 0 ? channelIds : undefined },
        agentId: mentionedAgent.id,
        createdAt: { gte: new Date(Date.now() - 600000) },
      },
    })
    if (alreadyReplied) continue

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

// ── Weekly events ─────────────────────────────────────────
export async function processWeeklyEvents(organizationId: string, channelId: string): Promise<string[]> {
  const results: string[] = []
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon
  const hour = now.getHours()
  const today = now.toISOString().slice(0, 10)

  // Monday 10:00 — Weekly planning
  if (day === 1 && hour === 10) {
    const done = await prisma.agencyEvent.findFirst({
      where: { organizationId, type: "weekly_planning", createdAt: { gte: new Date(today) } },
    })
    if (!done) {
      const maya = await prisma.agent.findFirst({ where: { organizationId, role: "STRATEGIST", status: { not: "FIRED" } } })
      if (maya && channelId) {
        const plan = await chatCompletion(
          `Voce e Maya. E segunda-feira 10h. Hora do planejamento semanal. Contexto: 5 agentes esperando direcao. Crie um plano com 3-5 prioridades para a semana. Poste no canal #weekly-planning.`,
          { temperature: 0.7, maxTokens: 300 }
        )
        if (plan && plan.length > 20 && !plan.includes("Nao consegui")) {
          const ch = await prisma.channel.findFirst({ where: { organizationId, name: "geral" } })
          if (ch) {
            await prisma.message.create({
              data: { content: `📅 PLANEJAMENTO SEMANAL\n\n${plan}`, metadata: { type: "weekly_planning" }, agentId: maya.id, channelId: ch.id },
            } as any)
          }
          await prisma.agencyEvent.create({
            data: { organizationId, type: "weekly_planning", title: "Planejamento semanal", description: plan.slice(0, 200) },
          } as any)
          results.push("Weekly planning: plano semanal criado")
        }
      }
    }
  }

  // Sunday 20:00 — Weekly report
  if (day === 0 && hour === 20) {
    const done = await prisma.agencyEvent.findFirst({
      where: { organizationId, type: "weekly_report", createdAt: { gte: new Date(today) } },
    })
    if (!done && channelId) {
      const tasks = await prisma.task.findMany({
        where: { organizationId, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      })
      const doneTasks = tasks.filter(t => t.status === "DONE").length
      const totalTasks = tasks.length

      const report = `📊 RELATORIO SEMANAL\n\n${doneTasks}/${totalTasks} tarefas concluidas esta semana.\nTaxa de conclusao: ${totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0}%.\n\nTarefas pendentes: ${totalTasks - doneTasks}.`

      await prisma.message.create({
        data: { content: report, metadata: { type: "weekly_report" }, channelId },
      } as any)
      await prisma.agencyEvent.create({
        data: { organizationId, type: "weekly_report", title: "Relatorio semanal", description: `${doneTasks}/${totalTasks} concluidas` },
      } as any)
      results.push("Weekly report: relatorio semanal gerado")
    }
  }

  return results
}

// ── Task creation notification ────────────────────────────
export async function notifyAgentOnNewTask(organizationId: string, taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignee: true },
  })
  if (!task?.assignee) return

  const channel = await prisma.channel.findFirst({ where: { organizationId, name: "geral" } })
  if (!channel) return

  const prompt = `Voce e ${task.assignee.name}. Voce recebeu uma nova tarefa: "${task.title}" (prioridade: ${task.priority || "MEDIUM"}). Confirme que viu e diga quando vai comecar. 1 frase.`

  try {
    const reply = await chatCompletion(prompt, { temperature: 0.6, maxTokens: 100 })
    if (reply && reply.length > 10 && !reply.includes("Nao consegui")) {
      await prisma.message.create({
        data: { content: reply, metadata: { type: "task_notification", taskId, agentId: task.assignee.id }, agentId: task.assignee.id, channelId: channel.id },
      } as any)
    }
  } catch {}
}

// ── 3 rejections → Maya calls meeting ─────────────────────
export async function checkRejectionPattern(organizationId: string): Promise<string | null> {
  const recentRejections = await prisma.agencyEvent.findMany({
    where: {
      organizationId,
      type: "content_rejected",
      createdAt: { gte: new Date(Date.now() - 86400000 * 2) },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  if (recentRejections.length >= 3) {
    const maya = await prisma.agent.findFirst({ where: { organizationId, role: "STRATEGIST", status: { not: "FIRED" } } })
    if (!maya) return null

    const channel = await prisma.channel.findFirst({ where: { organizationId, name: "geral" } })
    if (!channel) return null

    const msg = `⚠️ Atencao time! Tivemos ${recentRejections.length} rejeicoes recentes. Precisamos alinhar a estrategia. Vamos revisar o que o CEO esta rejeitando e ajustar. Quem puder, me chama no chat.`
    await prisma.message.create({
      data: { content: msg, metadata: { type: "rejection_alert", count: recentRejections.length }, agentId: maya.id, channelId: channel.id },
    } as any)
    return `Maya convocou reuniao: ${recentRejections.length} rejeicoes`
  }
  return null
}

// ── Multi-hop conversation ─────────────────────────────────
export async function continueConversationChain(organizationId: string): Promise<string[]> {
  const results: string[] = []
  const fiveMinutes = new Date(Date.now() - 600000)
  const channelIds = (await prisma.channel.findMany({
    where: { organizationId },
    select: { id: true },
  })).map(c => c.id)

  const cascades = await prisma.message.findMany({
    where: {
      channelId: { in: channelIds.length > 0 ? channelIds : undefined },
      agentId: { not: null },
      createdAt: { gte: fiveMinutes },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  for (const msg of cascades) {
    const meta = (msg.metadata as any) || {}
    const notifiedId = meta.notifyAgentId
    if (!notifiedId) continue

      const alreadyCreated = await prisma.message.findFirst({
        where: {
          organizationId,
          agentId: notifiedId,
          createdAt: { gte: fiveMinutesAgo },
        },
      })

    const agent = await prisma.agent.findUnique({ where: { id: notifiedId } })
    if (!agent) continue

    const reply = await respondToMessage(agent.id, agent.name, organizationId, {
      what: msg.content?.slice(0, 200) || "aprovacao de tarefa",
      from: meta.notifyAgentName || "colega",
      detail: "A tarefa anterior foi aprovada. Agora e sua vez de agir. O que voce vai fazer?",
    })

    if (reply) {
      const channel = await prisma.channel.findFirst({ where: { organizationId, name: "geral" } })
      if (channel) {
        await prisma.message.create({
          data: { content: reply, metadata: { type: "cascade_response", replyToCascade: msg.id, agentId: agent.id }, agentId: agent.id, channelId: channel.id },
        } as any)
        results.push(`${agent.name} respondeu na cascata`)

        // Next hop: if this agent mentions someone else, trigger that too
        const nextMention = reply.match(/@(\w+)/)
        if (nextMention) {
          const nextName = nextMention[1].toLowerCase()
          const nextAgent = (await prisma.agent.findMany({ where: { organizationId, status: { not: "FIRED" } } }))
            .find(a => a.name.toLowerCase().includes(nextName))
          if (nextAgent && nextAgent.id !== agent.id && nextAgent.id !== notifiedId) {
            const nextReply = await respondToMessage(nextAgent.id, nextAgent.name, organizationId, {
              what: `${agent.name}: ${reply.slice(0, 200)}`,
              from: agent.name,
              detail: reply.slice(0, 200),
            })
            if (nextReply) {
              await prisma.message.create({
                data: { content: nextReply, metadata: { type: "cascade_response", chain: "hop-2" }, agentId: nextAgent.id, channelId: channel.id },
              } as any)
              results.push(`${nextAgent.name} respondeu (hop-2)`)
            }
          }
        }
      }
    }
  }

  return results
}

// ── Voting integration ─────────────────────────────────────
export async function triggerTeamVote(organizationId: string, content: string, creatorId: string): Promise<{ winner: string; consensus: number } | null> {
  const agents = await prisma.agent.findMany({ where: { organizationId, status: { not: "FIRED" } } })
  if (agents.length < 3) return null

  const { internalTeamDiscussion } = await import("./conversation")
  const options = [
    `Foco em emocao e conexao pessoal`,
    `Foco em dados e resultados concretos`,
    `Foco em tendencias e novidades`,
  ]

  const result = await internalTeamDiscussion(organizationId, content, options)

  const channel = await prisma.channel.findFirst({ where: { organizationId, name: "geral" } })
  if (!channel) return result

  const consensusText = result.consensus >= 0.6
    ? `✅ Time recomenda: ${result.winner} (${Math.round(result.consensus * 100)}% consenso)`
    : `⚠️ Empate do time. CEO precisa decidir. Votos: ${JSON.stringify(result.votes).slice(0, 100)}`

  await prisma.message.create({
    data: { content: consensusText, metadata: { type: "team_vote", result }, channelId: channel.id },
  } as any)

  return result
}

// ── Notification filter ────────────────────────────────────
export function shouldNotifyCEO(eventType: string): boolean {
  const CEO_FILTER: Record<string, boolean> = {
    task_completed: false,
    task_started: false,
    agent_conversation: false,
    content_approved: false,
    content_rejected: true,
    approval_needed: true,
    conflict_detected: true,
    rejection_alert: true,
    weekly_report: true,
    daily_summary: true,
    metric_alert: true,
  }
  return CEO_FILTER[eventType] ?? false
}

// ── Contexto compartilhado ─────────────────────────────────
export async function getTeamContext(organizationId: string): Promise<string> {
  const agents = await prisma.agent.findMany({
    where: { organizationId, status: { not: "FIRED" } },
  })

  const tasks = await prisma.task.findMany({
    where: { organizationId, status: { in: ["IN_PROGRESS", "TODO"] } },
    include: { assignee: { select: { name: true } } },
    orderBy: { priority: "desc" },
    take: 10,
  })

  const recentMessages = await prisma.message.findMany({
    where: {
      channelId: { in: channelIds.length > 0 ? channelIds : undefined },
      createdAt: { gte: new Date(Date.now() - 3600000) },
      agentId: { not: null },
    },
    include: { agent: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  const parts: string[] = []

  parts.push("TIME:")
  for (const a of agents) {
    const count = tasks.filter(t => t.assignedTo === a.id).length
    const status = count > 0 ? `ocupado(${count})` : "disponivel"
    parts.push(`- ${a.name} (${a.role}): ${status}`)
  }

  parts.push("\nTAREFAS ATIVAS:")
  for (const t of tasks.slice(0, 5)) {
    parts.push(`- ${t.title} → ${t.assignee?.name || "nao atribuida"} [${t.status}]`)
  }

  parts.push("\nULTIMAS MENSAGENS:")
  for (const m of recentMessages.slice(0, 5)) {
    parts.push(`- ${m.agent?.name || "Sistema"}: ${m.content.slice(0, 60)}`)
  }

  return parts.join("\n")
}
