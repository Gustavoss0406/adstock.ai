/**
 * ── AGENT CONVERSATION ENGINE ──────────────────────────────
 *
 * Permite que agentes conversem entre si automaticamente:
 * 1. Task completion → notify next agent in chain
 * 2. Dependency resolution → ask for what's needed
 * 3. Internal discussion → agents discuss creative decisions
 */

import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"
import { requestTurn, releaseTurn, calculateTypingTime, setTypingIndicator, clearTypingIndicator } from "./turns"
import { getPersonality } from "./config"

interface ConversationContext {
  organizationId: string
  channelName: string
  trigger: string // what caused this conversation
}

/**
 * When a task is completed, check if other tasks depend on it.
 * If yes, automatically notify the agent responsible for the next task.
 */
export async function notifyTaskChain(organizationId: string, completedTaskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: completedTaskId },
    include: { assignee: true },
  })
  if (!task) return

  // Find tasks that might be waiting for this one
  // Look for tasks with similar titles or by agents with related roles
  const agents = await prisma.agent.findMany({
    where: { organizationId, status: { not: "FIRED" } },
  })

  const channel = await prisma.channel.findFirst({
    where: { organizationId, name: "geral" },
  })
  if (!channel) return

  // Find the next logical agent to notify based on task type
  const nextAgent = getNextAgentInChain(task, agents)
  if (!nextAgent || nextAgent.id === task.assignedTo) return

  const agent = task.assignee
  if (!agent) return

  // Build conversation
  const prompt = `Voce e ${agent.name} (${agent.role}). Voce acabou de completar a tarefa "${task.title}".

${nextAgent.name} (${nextAgent.role}) trabalha na proxima etapa: "${getNextStepFor(task)}".

Avise ${nextAgent.name.split(" ")[0]} que a tarefa foi concluida e o que ele(a) precisa fazer agora.
Seja natural, direto(a), como um colega de trabalho.

Fale em 1a pessoa. 1-2 frases.`

  try {
    const reply = await chatCompletion(prompt, { temperature: 0.7, maxTokens: 200 })

    if (reply && reply.length > 10 && !reply.includes("Nao consegui")) {
      const channelName = "geral"
      requestTurn(channelName, agent.id, agent.name, 8)
      setTypingIndicator(channelName, agent.id, agent.name)

      await new Promise(r => setTimeout(r, calculateTypingTime(agent.name, reply)))

      await prisma.message.create({
        data: {
          content: reply,
          metadata: {
            type: "task_cascade",
            taskId: completedTaskId,
            notifyAgentId: nextAgent.id,
            notifyAgentName: nextAgent.name,
          },
          agentId: agent.id,
          channelId: channel.id,
        },
      } as any)

      clearTypingIndicator(channelName)
      releaseTurn(channelName, agent.id)
    }
  } catch {}
}

function getNextAgentInChain(task: any, agents: any[]): any {
  const type = (task.type || "").toLowerCase()

  // Copy → Design chain
  if (type === "content" && task.title?.toLowerCase().includes("copy")) {
    return agents.find(a => a.role === "DESIGNER")
  }
  // Design → Schedule chain
  if (type === "content" && task.title?.toLowerCase().includes("arte")) {
    return agents.find(a => a.role === "SOCIAL_MEDIA")
  }
  // Schedule → Monitor chain
  if (type === "campaign") {
    return agents.find(a => a.role === "ANALYST")
  }
  // Analysis → Strategy chain
  if (type === "analysis") {
    return agents.find(a => a.role === "STRATEGIST")
  }
  // SEO → Content chain
  if (task.title?.toLowerCase().includes("seo") || task.title?.toLowerCase().includes("blog")) {
    return agents.find(a => a.role === "SOCIAL_MEDIA")
  }

  // Default: notify Maya (orchestrator)
  return agents.find(a => a.role === "STRATEGIST") || agents[1] || null
}

function getNextStepFor(task: any): string {
  const type = (task.type || "").toLowerCase()
  if (type === "content" && task.title?.toLowerCase().includes("copy")) return "criar a arte visual"
  if (type === "content" && task.title?.toLowerCase().includes("arte")) return "agendar a publicacao"
  if (type === "campaign") return "monitorar o desempenho da campanha"
  if (type === "analysis") return "revisar os insights e ajustar a estrategia"
  return "continuar o fluxo de trabalho"
}

/**
 * Agent mentions another agent — the mentioned agent should respond.
 */
export async function respondToMention(
  organizationId: string,
  mentionedAgentId: string,
  mentionedAgentName: string,
  context: string,
): Promise<string | null> {
  try {
    const prompt = `Voce e ${mentionedAgentName}. Um colega mencionou voce no chat.

CONTEXTO:
${context.slice(0, 500)}

Responda de forma natural, como faria em um chat de trabalho.
Seja util e direto(a), no seu tom de voz caracteristico.
Fale em 1a pessoa. 1-3 frases.`

    const reply = await chatCompletion(prompt, { temperature: 0.7, maxTokens: 300 })

    if (reply && reply.length > 10 && !reply.includes("Nao consegui")) {
      return reply
    }
  } catch {}
  return null
}

/**
 * Agents hold an internal discussion before presenting to CEO.
 * Each agent votes based on their specialty.
 */
export async function internalTeamDiscussion(
  organizationId: string,
  topic: string,
  options: string[],
): Promise<{ winner: string; votes: Record<string, string>; consensus: number }> {
  const agents = await prisma.agent.findMany({
    where: { organizationId, status: { not: "FIRED" } },
  })

  const votes: Record<string, string> = {}

  for (const agent of agents) {
    const prompt = `Voce e ${agent.name} (${agent.role}). O time esta decidindo sobre: "${topic}"

OPCOES:
${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}

Baseado na sua especialidade (${agent.role}), qual voce escolhe?
Responda APENAS o numero da opcao (1, 2, 3, etc):`

    try {
      const reply = await chatCompletion(prompt, { temperature: 0.3, maxTokens: 10 })
      const num = reply.trim().match(/\d+/)?.[0]
      if (num) votes[agent.name] = options[parseInt(num) - 1] || options[0]
    } catch {}
  }

  // Calculate consensus
  const voteCounts: Record<string, number> = {}
  for (const v of Object.values(votes)) {
    voteCounts[v] = (voteCounts[v] || 0) + 1
  }
  const maxVotes = Math.max(...Object.values(voteCounts))
  const winner = Object.keys(voteCounts).find(k => voteCounts[k] === maxVotes) || options[0]
  const consensus = maxVotes / Object.values(votes).length

  return { winner, votes, consensus }
}
