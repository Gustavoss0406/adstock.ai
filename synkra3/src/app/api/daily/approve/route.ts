import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/daily/approve
 * Body: { organizationId, dailyDate (optional) }
 *
 * Marca a daily como aprovada pelo CEO:
 * - Desbloqueia agentes (WAITING → ACTIVE/IDLE)
 * - Cria agency event "daily_approved"
 * - Retoma ações pausadas dos agentes
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, dailyDate } = await request.json()
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId required" }, { status: 400 })
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        agents: { where: { status: { not: "FIRED" } } },
      },
    })

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    // 1. Reset all agents from WAITING to ACTIVE
    let agentsUpdated = 0
    for (const agent of org.agents) {
      if (agent.workState === "WAITING") {
        await prisma.agent.update({
          where: { id: agent.id },
          data: { workState: "IDLE", status: "ACTIVE" },
        })
        agentsUpdated++
      }
    }

    // 2. Resume paused actions for all agents
    const resumedResult = await prisma.agentAction.updateMany({
      where: {
        organizationId,
        status: "paused",
      },
      data: {
        status: "pending",
        error: null,
        scheduledFor: new Date(Date.now() + 5000),
      },
    } as any)

    // 3. Create approval event
    await prisma.agencyEvent.create({
      data: {
        organizationId,
        type: "daily_approved",
        title: "Daily aprovada pelo CEO",
        description: `${agentsUpdated} agentes liberados para trabalhar. ${resumedResult.count} ações retomadas.`,
        metadata: { dailyDate: dailyDate || new Date().toISOString().slice(0, 10) },
      },
    } as any)

    // 4. Post approval message in daily-standup channel
    const channel = await prisma.channel.findFirst({
      where: { organizationId, name: "daily-standup" },
    })
    if (channel) {
      await prisma.message.create({
        data: {
          content: "Tudo certo, time! Mãos à obra. 🚀",
          channelId: channel.id,
          metadata: { type: "daily_approval", dailyDate: dailyDate || new Date().toISOString().slice(0, 10) },
        },
      })
    }

    // Update daily metrics
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    await prisma.dailyMetrics.updateMany({
      where: {
        organizationId,
        date: { gte: today },
        status: "completed",
      },
      data: {
        approvedAt: new Date(),
        status: "approved",
      },
    } as any)

    return NextResponse.json({
      approved: true,
      agentsUpdated,
      actionsResumed: resumedResult.count,
    })
  } catch (error) {
    console.error("[Daily Approve Error]", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
