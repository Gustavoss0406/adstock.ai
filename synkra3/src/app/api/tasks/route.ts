import { prisma } from "@/lib/prisma"
import { getSupabaseSession } from "@/lib/auth/server"
import { NextRequest, NextResponse } from "next/server"
import { assignTaskToBestAgent } from "@/lib/agents/controller"
import { canOrganizationCreateTask, getOrganizationDailyTaskCount } from "@/lib/agents/daily-limit"
import { canTransitionStatus, logStatusChange } from "@/lib/orchestrator/quality-control"
import { z } from "zod"

const taskSchema = z.object({
  organizationId: z.string(),
  projectId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assignedTo: z.string().optional(),
  sprintId: z.string().optional(),
  dueDate: z.string().optional(),
  platform: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId é obrigatório" }, { status: 400 })
  }

  const tasks = await prisma.task.findMany({
    where: { organizationId: orgId },
    include: { assignee: true, project: true, sprint: true, attachments: true },
    orderBy: { createdAt: "desc" },
  })

  // Strip heavy fields to minimize egress
  const lightTasks = tasks.map(t => ({
    ...t,
    output: t.output ? {
      content: (t.output as any).content,
      strategy: (t.output as any).strategy,
      deliveryNote: (t.output as any).deliveryNote,
      hasArtwork: !!(t.output as any).artworkUrl,
      hasHtmlDoc: !!(t.output as any).htmlDocument,
    } : null,
  }))

  return NextResponse.json(lightTasks)
}

export async function POST(request: NextRequest) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validation = taskSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten() }, { status: 400 })
    }

    // Check organization daily limit (applies to both users and agents)
    const canCreate = await canOrganizationCreateTask(validation.data.organizationId)
    if (!canCreate.allowed) {
      const count = await getOrganizationDailyTaskCount(validation.data.organizationId)
      return NextResponse.json(
        { 
          error: canCreate.reason,
          dailyLimit: count.dailyLimit,
          tasksCreatedToday: count.totalTasksToday,
          remaining: count.remaining,
        }, 
        { status: 429 }
      )
    }

    let assignedTo: string | null | undefined = validation.data.assignedTo

    if (!assignedTo) {
      assignedTo = await assignTaskToBestAgent(
        validation.data.organizationId,
        validation.data.title,
        validation.data.description || ""
      )
    }

    // Enriquecer descrição com contexto da empresa se estiver vazia
    let description = validation.data.description || ""
    if (!description) {
      const onboarding = await prisma.onboarding.findUnique({ where: { organizationId: validation.data.organizationId } })
      if (onboarding) {
        description = `Contexto: ${onboarding.industry || ''} | ${onboarding.targetAudience || ''} | ${onboarding.brandVoice || ''}. ${onboarding.goals?.length ? 'Objetivos: ' + onboarding.goals.join(', ') + '.' : ''}`
      }
    }

    const task = await prisma.task.create({
      data: {
        ...validation.data,
        description,
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
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, ...data } = body

    // Check if status transition is allowed
    if (data.status) {
      const transition = await canTransitionStatus(id, data.status)
      if (!transition.allowed) {
        return NextResponse.json({ error: transition.reason }, { status: 400 })
      }

      // Log the status change
      const oldTask = await prisma.task.findUnique({ where: { id }, select: { status: true } })
      if (oldTask) {
        await logStatusChange(id, oldTask.status, data.status, data.statusReason || "Atualizado pelo usuário")
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === "DONE" ? { completedAt: new Date() } : {}),
        ...(data.status === "IN_PROGRESS" && !data.startedAt ? { startedAt: new Date() } : {}),
      },
      include: { assignee: true },
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error("[Task Update Error]", error)
    return NextResponse.json({ error: "Erro ao atualizar tarefa" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })

    // Soft delete: marca como CANCELLED (ainda conta no limite diário)
    await prisma.task.update({
      where: { id },
      data: { status: "CANCELLED" },
    })

    await logStatusChange(id, "UNKNOWN", "CANCELLED", "Deletado pelo usuário")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Task Delete Error]", error)
    return NextResponse.json({ error: "Erro ao deletar tarefa" }, { status: 500 })
  }
}
