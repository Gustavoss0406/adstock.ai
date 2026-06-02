import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { learnFromFeedback } from "@/lib/autonomous/learning"

export const maxDuration = 30

// GET: list pending approvals
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get("organizationId")
  if (!organizationId) return NextResponse.json({ error: "organizationId required" }, { status: 400 })

  const channel = await prisma.channel.findFirst({
    where: { organizationId, name: "aprovacoes" },
  })
  if (!channel) return NextResponse.json({ approvals: [] })

  const messages = await prisma.message.findMany({
    where: {
      channelId: channel.id,
      metadata: { path: ["needsApproval"], equals: true },
    },
    include: { agent: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return NextResponse.json({
    approvals: messages.map(m => ({
      id: m.id,
      agent: m.agent?.name || "Sistema",
      content: m.content,
      metadata: m.metadata,
      createdAt: m.createdAt,
    })),
  })
}

// POST: respond to approval (approved/rejected/revision)
export async function POST(request: NextRequest) {
  try {
    const { organizationId, messageId, decision, feedback } = await request.json()
    if (!organizationId || !messageId || !decision) {
      return NextResponse.json({ error: "organizationId, messageId, decision required" }, { status: 400 })
    }

    // Update message metadata
    const message = await prisma.message.update({
      where: { id: messageId },
      data: {
        metadata: {
          needsApproval: decision === "revision",
          approved: decision === "approved",
          rejected: decision === "rejected",
          feedback: feedback || "",
          respondedAt: new Date().toISOString(),
        },
      },
    } as any)

    // If approved/rejected, learn from it
    const taskMeta = (message.metadata as any) || {}
    await learnFromFeedback(organizationId, {
      approved: decision === "approved",
      taskId: taskMeta.taskId,
      agentId: message.agentId || undefined,
      content: taskMeta.output?.slice(0, 500),
      note: feedback,
    })

    // If approved, move task to next stage
    if (decision === "approved" && taskMeta.taskId) {
      await prisma.task.update({
        where: { id: taskMeta.taskId },
        data: { status: "DONE" },
      })
    }

    // If revision needed, re-open task
    if (decision === "revision" && taskMeta.taskId) {
      await prisma.task.update({
        where: { id: taskMeta.taskId },
        data: { status: "TODO", description: `${(await prisma.task.findUnique({ where: { id: taskMeta.taskId } }))?.description || ""}\n\nFeedback do CEO: ${feedback || "Revisao solicitada."}` },
      } as any)
    }

    // Post response in general channel
    const channel = await prisma.channel.findFirst({ where: { organizationId, name: "geral" } })
    if (channel) {
      const decisionText = decision === "approved" ? "✅ APROVADO"
        : decision === "rejected" ? "❌ REJEITADO"
        : "📝 REVISAO SOLICITADA"

      await prisma.message.create({
        data: {
          content: `${decisionText}: ${message.content?.slice(0, 80) || "Conteudo"}${feedback ? `\nFeedback: ${feedback}` : ""}`,
          channelId: channel.id,
          metadata: { type: "approval_response", decision },
        },
      })
    }

    return NextResponse.json({
      success: true,
      decision,
      message: `Decisao registrada: ${decision}`,
    })
  } catch (error) {
    console.error("[Approval Error]", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
