import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"

export interface DistributableTask {
  title: string
  description?: string
  source: "calendar" | "metric_alert" | "ceo_request" | "automated" | "backlog"
  urgency?: "HIGH" | "MEDIUM" | "LOW"
  type?: string
  preferRole?: string
}

/**
 * Smart distribution — uses AI to decide the best agent.
 * Falls back to workload-based if AI fails.
 */
export async function distributeTask(organizationId: string, task: DistributableTask): Promise<{
  assignedTo: string | null
  agentName: string | null
  reasoning: string
}> {
  const agents = await prisma.agent.findMany({
    where: { organizationId, status: { not: "FIRED" } },
    select: { id: true, name: true, role: true },
  })

  if (agents.length === 0) return { assignedTo: null, agentName: null, reasoning: "Sem agentes ativos" }

  // ── AI-powered distribution ──
  let assignedTo: string | null = null
  let reasoning = ""

  const workloads = await Promise.all(
    agents.map(async a => ({
      agent: a,
      taskCount: await prisma.task.count({
        where: { organizationId, assignedTo: a.id, status: { in: ["TODO", "IN_PROGRESS"] } },
      }),
    }))
  )

  try {
    const prompt = `Escolha o melhor agente para esta tarefa.

TAREFA: ${task.title}
Fonte: ${task.source}
Prioridade: ${task.urgency || "MEDIUM"}

AGENTES DISPONIVEIS (carga atual):
${workloads.map(w => `- ${w.agent.name} (${w.agent.role}): ${w.taskCount} tarefas pendentes`).join("\n")}

ESPECIALIDADES:
- STRATEGIST: estrategia, copy, planejamento, calendario editorial
- SOCIAL_MEDIA: redes sociais, engajamento, trends, comunidade
- ANALYST: analise de dados, metricas, relatorios, performance
- DESIGNER: design, artes, identidade visual, criativos
- SEO: SEO, blog, otimizacao, keywords, trafego organico

Retorne APENAS o nome do agente (ex: "Maya"):`

    const reply = await chatCompletion(prompt, { temperature: 0.3, maxTokens: 20 })
    const chosenName = reply.trim()
    const found = agents.find(a =>
      a.name.toLowerCase().includes(chosenName.toLowerCase())
    )
    if (found) {
      assignedTo = found.id
      reasoning = `${found.name} selecionado(a) por IA — melhor match de especialidade`
    }
  } catch {}

  // ── Workload-based fallback ──
  if (!assignedTo) {
    let candidates = workloads
    if (task.preferRole) {
      const roleMatches = workloads.filter(w => w.agent.role === task.preferRole)
      if (roleMatches.length > 0) candidates = roleMatches
    }
    candidates.sort((a, b) => a.taskCount - b.taskCount)
    const best = candidates[0]
    assignedTo = best.agent.id
    reasoning = `${best.agent.name} selecionado(a) por menor carga (${best.taskCount} tarefas)`
  }

  // ── Create task ──
  await prisma.task.create({
    data: {
      organizationId,
      title: task.title,
      type: task.type || "content",
      priority: task.urgency || "MEDIUM",
      status: "TODO",
      assignedTo,
      estimatedMinutes: task.urgency === "HIGH" ? 120 : 60,
      description: task.description || `Origem: ${task.source}. ${reasoning}.`,
    },
  } as any)

  const agent = agents.find(a => a.id === assignedTo)
  return { assignedTo, agentName: agent?.name || null, reasoning }
}
