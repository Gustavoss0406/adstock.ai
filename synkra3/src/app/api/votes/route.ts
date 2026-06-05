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

  const votes = await prisma.vote.findMany({
    where: { organizationId: orgId },
    include: {
      initiator: true,
      target: true,
      decisions: { include: { agent: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(votes)
}

export async function POST(request: NextRequest) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { organizationId, initiatorId, type, targetAgentId, title, description, options } = body

    const vote = await prisma.vote.create({
      data: {
        organizationId,
        initiatorId,
        type: type || "DECISION",
        targetAgentId,
        title,
        description,
        options: options || ["Sim", "Não"],
      },
      include: { initiator: true, target: true },
    })

    const agents = await prisma.agent.findMany({
      where: {
        organizationId,
        id: { not: initiatorId },
        status: { not: "FIRED" },
      },
    })

    for (const agent of agents) {
      const choice = options?.[Math.floor(Math.random() * options.length)] || "Sim"
      await prisma.voteDecision.create({
        data: {
          voteId: vote.id,
          agentId: agent.id,
          choice,
          reason: `Voto registrado por ${agent.name}`,
        },
      })
    }

    const finalVote = await prisma.vote.findUnique({
      where: { id: vote.id },
      include: {
        decisions: true,
      },
    })

    const tally: Record<string, number> = {}
    finalVote?.decisions.forEach((d) => {
      tally[d.choice] = (tally[d.choice] || 0) + 1
    })

    const winner = Object.entries(tally).sort(([, a], [, b]) => b - a)[0][0]

    await prisma.vote.update({
      where: { id: vote.id },
      data: { status: "RESOLVED" },
    })

    if (type === "FIRE" && targetAgentId) {
      await prisma.agent.update({
        where: { id: targetAgentId },
        data: { status: "FIRED" },
      })
    } else if (type === "PROMOTE" && targetAgentId) {
      await prisma.agent.update({
        where: { id: targetAgentId },
        data: { level: { increment: 1 }, salary: { multiply: 1.2 } },
      })
    }

    return NextResponse.json({
      vote: finalVote,
      tally,
      winner,
      result: winner,
    })
  } catch (error) {
    console.error("[Vote Error]", error)
    return NextResponse.json({ error: "Erro ao criar votação" }, { status: 500 })
  }
}
