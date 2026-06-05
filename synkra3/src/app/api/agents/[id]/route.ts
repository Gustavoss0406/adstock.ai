import { prisma } from "@/lib/prisma"
import { getSupabaseSession } from "@/lib/auth/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const agent = await prisma.agent.findUnique({
    where: { id: params.id },
    include: {
      agentMetrics: { orderBy: { date: "desc" }, take: 30 },
      assignedTasks: true,
      createdArtworks: true,
      messages: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  })

  if (!agent) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 })
  }

  return NextResponse.json(agent)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { level, salary, status, morale, promptTemplate } = body

    const agent = await prisma.agent.findUnique({ where: { id: params.id } })
    if (!agent) {
      return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 })
    }

    const updated = await prisma.agent.update({
      where: { id: params.id },
      data: {
        ...(level !== undefined && { level }),
        ...(salary !== undefined && { salary }),
        ...(status !== undefined && { status }),
        ...(morale !== undefined && { morale }),
        ...(promptTemplate !== undefined && { promptTemplate }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: "Erro ao atualizar agente" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const reason = request.nextUrl.searchParams.get("reason") || ""

  await prisma.agent.update({
    where: { id: params.id },
    data: {
      status: "FIRED",
      bio: `Demitido em ${new Date().toISOString()}. Motivo: ${reason}`,
    },
  })

  // Clean up pixel office session file
  try {
    const fs = await import("fs")
    const path = await import("path")
    const os = await import("os")
    const fp = path.join(os.homedir(), ".pixel-agents", "sessions", `synkra-${params.id}.jsonl`)
    if (fs.existsSync(fp)) fs.unlinkSync(fp)
  } catch {}

  return NextResponse.json({ success: true })
}
