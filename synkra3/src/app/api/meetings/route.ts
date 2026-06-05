import { prisma } from "@/lib/prisma"
import { getSupabaseSession } from "@/lib/auth/server"
import { NextRequest, NextResponse } from "next/server"
import { MeetingStatus, AgentStatus } from "@prisma/client"
import { runMeeting } from "@/lib/agents/controller"

export async function GET(request: NextRequest) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId é obrigatório" }, { status: 400 })
  }

  const meetings = await prisma.meeting.findMany({
    where: { organizationId: orgId },
    include: {
      participants: { include: { agent: true } },
      messages: { include: { agent: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { scheduledAt: "desc" },
    take: 50,
  })

  return NextResponse.json(meetings)
}

export async function POST(request: NextRequest) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { organizationId, type, title, topic, scheduledAt, runNow } = body

    const org = await prisma.organization.findFirst({
      where: { id: organizationId, members: { some: { userId: session.user.id } } },
    })

    if (!org) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 })
    }

    const meeting = await prisma.meeting.create({
      data: {
        organizationId,
        type: type || "DAILY",
        title: title || "Reunião",
        topic,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        status: MeetingStatus.SCHEDULED,
      },
    })

    if (runNow) {
      const result = await runMeeting(meeting.id)
      return NextResponse.json(result)
    }

    return NextResponse.json(meeting, { status: 201 })
  } catch (error) {
    console.error("[Meeting Create Error]", error)
    return NextResponse.json({ error: "Erro ao criar reunião" }, { status: 500 })
  }
}
