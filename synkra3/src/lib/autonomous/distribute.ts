import { prisma } from "@/lib/prisma"

export interface DistributableTask {
  title: string
  description?: string
  source: "calendar" | "metric_alert" | "ceo_request" | "automated" | "backlog"
  urgency?: "HIGH" | "MEDIUM" | "LOW"
  type?: string
  preferRole?: string
}

/**
 * Distribute a new demand to the best agent based on role + workload.
 */
export async function distributeTask(organizationId: string, task: DistributableTask): Promise<{
  assignedTo: string | null
  agentName: string | null
  reasoning: string
}> {
  // 1. Get all active agents with their workloads
  const agents = await prisma.agent.findMany({
    where: { organizationId, status: { not: "FIRED" } },
    select: { id: true, name: true, role: true },
  })

  const workloads = await Promise.all(
    agents.map(async a => ({
      agent: a,
      taskCount: await prisma.task.count({
        where: { organizationId, assignedTo: a.id, status: { in: ["TODO", "IN_PROGRESS"] } },
      }),
    }))
  )

  // 2. If preferred role is specified, filter by it
  let candidates = workloads
  if (task.preferRole) {
    const roleMatches = workloads.filter(w => w.agent.role === task.preferRole)
    if (roleMatches.length > 0) candidates = roleMatches
  }

  // 3. Pick agent with lowest workload
  candidates.sort((a, b) => a.taskCount - b.taskCount)
  const best = candidates[0]
  const agent = agents.find(a => a.id === best.agent.id)

  // 4. Create the task
  await prisma.task.create({
    data: {
      organizationId,
      title: task.title,
      type: task.type || "content",
      priority: task.urgency || "MEDIUM",
      status: "TODO",
      assignedTo: best.agent.id,
      estimatedMinutes: task.urgency === "HIGH" ? 120 : 60,
      description: task.description || `Demanda gerada automaticamente. Origem: ${task.source}.`,
    },
  } as any)

  return {
    assignedTo: best.agent.id,
    agentName: agent?.name || null,
    reasoning: `${agent?.name || "Agente"} selecionado por menor carga (${best.taskCount} tarefas pendentes)`,
  }
}
