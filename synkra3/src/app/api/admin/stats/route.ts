import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession, verifyAdminToken } from "@/lib/auth/admin-session"

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const [totalUsers, totalOrgs, totalAgents, totalTasks, totalMeetings, totalProjects] =
      await Promise.all([
        prisma.user.count(),
        prisma.organization.count(),
        prisma.agent.count(),
        prisma.task.count(),
        prisma.meeting.count(),
        prisma.project.count(),
      ])

    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, email: true, createdAt: true },
    })

    const recentOrgs = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, createdAt: true, _count: { select: { members: true } } },
    })

    return NextResponse.json({
      totalUsers,
      totalOrgs,
      totalAgents,
      totalTasks,
      totalMeetings,
      totalProjects,
      recentUsers,
      recentOrgs,
    })
  } catch (error) {
    console.error("[Admin Stats Error]", error)
    return NextResponse.json({ error: "Erro ao buscar estatisticas" }, { status: 500 })
  }
}
