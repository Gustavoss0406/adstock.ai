import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getAgentTemplate } from "@/lib/agents/templates"
import { AgentStatus } from "@prisma/client"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId é obrigatório" }, { status: 400 })
  }

  const agents = await prisma.agent.findMany({
    where: { organizationId: orgId },
    include: {
      agentMetrics: { orderBy: { date: "desc" }, take: 1 },
      assignedTasks: true,
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(agents)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { organizationId, templateKey, name, role, personality } = body

    const org = await prisma.organization.findFirst({
      where: { id: organizationId, ownerId: session.user.id },
    })

    if (!org) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 })
    }

    let agentData

    if (templateKey) {
      const template = getAgentTemplate(templateKey)
      if (!template) {
        return NextResponse.json({ error: "Template não encontrado" }, { status: 400 })
      }
      agentData = {
        organizationId,
        name: template.name,
        role: template.role,
        personality: template.personality,
        avatar: template.avatar,
        bio: template.bio,
        skills: template.skills,
        traits: template.traits,
        promptTemplate: template.promptTemplate,
        salary: template.baseSalary,
        status: AgentStatus.IDLE,
      }
    } else {
      agentData = {
        organizationId,
        name,
        role,
        personality: personality || "ANALYTICAL",
        salary: 2000,
        status: AgentStatus.IDLE,
        skills: [],
        traits: [],
      }
    }

    const agent = await prisma.agent.create({ data: agentData })
    return NextResponse.json(agent, { status: 201 })
  } catch (error) {
    console.error("[Agent Create Error]", error)
    return NextResponse.json({ error: "Erro ao criar agente" }, { status: 500 })
  }
}
