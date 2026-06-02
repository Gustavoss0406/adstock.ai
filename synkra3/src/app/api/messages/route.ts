import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId é obrigatório" }, { status: 400 })
  }

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { channel: { organizationId: orgId } },
        { agent: { organizationId: orgId } },
      ],
    },
    include: { agent: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json(messages)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
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
