import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * DELETE /api/tasks/clear?orgId=xxx
 * 
 * Deleta todas tasks não concluídas de uma organização.
 * Mantém tasks DONE para histórico.
 */
export async function DELETE(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 })
  }

  try {
    // Delete all non-DONE tasks
    const result = await prisma.task.deleteMany({
      where: {
        organizationId: orgId,
        status: { not: "DONE" },
      },
    })

    // Delete associated pending actions
    await prisma.agentAction.deleteMany({
      where: {
        organizationId: orgId,
        status: "pending",
      },
    } as any)

    // Reset agent states
    await prisma.agent.updateMany({
      where: { organizationId: orgId, status: { not: "FIRED" } },
      data: { workState: "IDLE", status: "ACTIVE" },
    })

    return NextResponse.json({
      cleared: result.count,
      message: `${result.count} tarefas removidas. Agentes resetados.`,
    })
  } catch (error) {
    console.error("[Clear Tasks Error]", error)
    return NextResponse.json({ error: "Failed to clear tasks" }, { status: 500 })
  }
}
