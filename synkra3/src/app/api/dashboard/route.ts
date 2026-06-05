import { prisma } from "@/lib/prisma"
import { getSupabaseSession } from "@/lib/auth/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId é obrigatório" }, { status: 400 })
  }

  const [totalTasks, completedTasks, activeAgents, totalMeetings] = await Promise.all([
    prisma.task.count({ where: { organizationId: orgId } }),
    prisma.task.count({ where: { organizationId: orgId, status: "DONE" } }),
    prisma.agent.count({ where: { organizationId: orgId, status: { not: "FIRED" } } }),
    prisma.meeting.count({ where: { organizationId: orgId } }),
  ])

  const messages = await prisma.message.count({
    where: { channel: { organizationId: orgId } },
  })

  const agentsWithMetrics = await prisma.agent.findMany({
    where: { organizationId: orgId, status: { not: "FIRED" } },
    include: {
      agentMetrics: { orderBy: { date: "desc" }, take: 7 },
      assignedTasks: { where: { status: "DONE" } },
    },
  })

  const agentPerformance = agentsWithMetrics.map((agent) => ({
    name: agent.name,
    role: agent.role,
    level: agent.level,
    morale: agent.morale,
    performance: agent.performance,
    completedTasks: agent.assignedTasks.length,
    metrics: agent.agentMetrics.map((m) => ({
      date: m.date.toISOString(),
      qualityScore: m.qualityScore,
      speedScore: m.speedScore,
      tasksCompleted: m.tasksCompleted,
    })),
  }))

  return NextResponse.json({
    summary: {
      totalTasks,
      completedTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      activeAgents,
      totalMeetings,
      messages,
    },
    agentPerformance,
  })
}
