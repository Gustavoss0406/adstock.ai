import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { executeWithRetry, executeCalendarPipeline, executeCopyPipeline, executeCarouselPipeline } from "@/lib/autonomous/execute-pipeline"

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const { organizationId, agentId, taskType, taskTitle, taskDescription } = await request.json()
    if (!organizationId || !agentId) {
      return NextResponse.json({ error: "organizationId and agentId required" }, { status: 400 })
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { id: true, name: true } })
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

    // Route to appropriate pipeline
    if (taskType === "create_calendar") {
      const result = await executeCalendarPipeline(organizationId, agent.id, agent.name)
      return NextResponse.json({ success: true, ...result, message: `${result.created} posts criados no Kanban` })
    }

    if (taskType === "create_copy") {
      const result = await executeCopyPipeline(organizationId, agent.id, agent.name, taskTitle || "copy generica")
      return NextResponse.json({ success: true, variants: result?.variants?.length || 0 })
    }

    if (taskType === "create_carousel") {
      const result = await executeCarouselPipeline(organizationId, agent.id, agent.name, taskTitle || "carrossel")
      return NextResponse.json({ success: !!result, slides: result?.slides?.length || 0 })
    }

    // Generic execution with retry
    const result = await executeWithRetry({
      organizationId, agentId, agentName: agent.name,
      taskTitle: taskTitle || "Tarefa generica",
      taskDescription: taskDescription || "",
      taskType: taskType || "generic",
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[Pipeline Error]", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
