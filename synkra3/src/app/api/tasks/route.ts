import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { assignTaskToBestAgent } from "@/lib/agents/controller"
import { z } from "zod"

const taskSchema = z.object({
  organizationId: z.string(),
  projectId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assignedTo: z.string().optional(),
  sprintId: z.string().optional(),
  dueDate: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId é obrigatório" }, { status: 400 })
  }

  const tasks = await prisma.task.findMany({
    where: { organizationId: orgId },
    include: { assignee: true, project: true, sprint: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(tasks)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validation = taskSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten() }, { status: 400 })
    }

    let assignedTo: string | null | undefined = validation.data.assignedTo

    if (!assignedTo) {
      assignedTo = await assignTaskToBestAgent(
        validation.data.organizationId,
        validation.data.title,
        validation.data.description || ""
      )
    }

    const task = await prisma.task.create({
      data: {
        ...validation.data,
        assignedTo: assignedTo || null,
        dueDate: validation.data.dueDate ? new Date(validation.data.dueDate) : undefined,
      },
      include: { assignee: true },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error("[Task Create Error]", error)
    return NextResponse.json({ error: "Erro ao criar tarefa" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, ...data } = body

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === "DONE" ? { completedAt: new Date() } : {}),
      },
      include: { assignee: true },
    })

    return NextResponse.json(task)
  } catch (error) {
    return NextResponse.json({ error: "Erro ao atualizar tarefa" }, { status: 500 })
  }
}
