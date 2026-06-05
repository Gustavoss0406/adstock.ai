import { prisma } from "@/lib/prisma"
import { getSupabaseSession } from "@/lib/auth/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  const channelId = request.nextUrl.searchParams.get("channelId")
  const since = request.nextUrl.searchParams.get("since")
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50")

  if (!orgId) {
    return NextResponse.json({ error: "orgId é obrigatório" }, { status: 400 })
  }

  const where: any = {
    channel: { organizationId: orgId },
  }

  if (channelId) {
    where.channelId = channelId
  }

  if (since) {
    where.createdAt = { gt: new Date(since) }
  }

  const messages = await prisma.message.findMany({
    where,
    include: { agent: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  })

  return NextResponse.json(messages)
}

export async function POST(request: NextRequest) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const { channelId, content, agentId } = await request.json()

    const message = await prisma.message.create({
      data: {
        channelId,
        content,
        agentId,
        userId: session.user.id,
      },
      include: { agent: true },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Erro ao enviar mensagem" }, { status: 500 })
  }
}
