import { prisma } from "@/lib/prisma"

export interface ApprovalPattern {
  approvalRate: number
  preferredTone?: string
  commonRejects?: string[]
  bestAgent?: string
  totalApprovals: number
  totalRejections: number
}

export async function learnFromFeedback(
  organizationId: string,
  feedback: { taskId?: string; approved: boolean; content?: string; agentId?: string; note?: string },
): Promise<void> {
  // Store approval event
  await prisma.agencyEvent.create({
    data: {
      organizationId,
      type: feedback.approved ? "content_approved" : "content_rejected",
      title: feedback.approved ? "CEO aprovou conteudo" : "CEO rejeitou conteudo",
      description: feedback.note || "",
      metadata: {
        taskId: feedback.taskId,
        agentId: feedback.agentId,
        content: feedback.content?.slice(0, 200),
        timestamp: new Date().toISOString(),
      },
    },
  } as any)

  // If rejected, the agent should learn
  if (!feedback.approved && feedback.agentId) {
    await prisma.agent.update({
      where: { id: feedback.agentId },
      data: {
        // Slightly lower morale but learn from it
        morale: { decrement: 1 },
        skills: { push: `feedback:${feedback.note?.slice(0, 50) || "rejeicao"}` },
      },
    } as any)
  }
}

export async function analyzeApprovalPatterns(organizationId: string): Promise<ApprovalPattern> {
  const events = await prisma.agencyEvent.findMany({
    where: {
      organizationId,
      type: { in: ["content_approved", "content_rejected"] },
      createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
    },
    orderBy: { createdAt: "desc" },
  })

  const approved = events.filter(e => e.type === "content_approved")
  const rejected = events.filter(e => e.type === "content_rejected")
  const total = approved.length + rejected.length

  // Find best performing agent
  const agentScore: Record<string, { approved: number; rejected: number }> = {}
  for (const e of events) {
    const aid = (e.metadata as any)?.agentId
    if (!aid) continue
    if (!agentScore[aid]) agentScore[aid] = { approved: 0, rejected: 0 }
    if (e.type === "content_approved") agentScore[aid].approved++
    else agentScore[aid].rejected++
  }

  let bestAgent: string | undefined
  let bestRate = 0
  for (const [aid, score] of Object.entries(agentScore)) {
    const rate = score.approved / (score.approved + score.rejected)
    if (rate > bestRate && score.approved + score.rejected >= 3) {
      bestRate = rate
      bestAgent = aid
    }
  }

  // Detect patterns from rejections
  const rejectionNotes = rejected.map(e => (e.metadata as any)?.note).filter(Boolean) as string[]
  const commonRejects = rejectionNotes.length > 0
    ? rejectionNotes.slice(0, 5)
    : rejected.slice(0, 5).map(e => (e.metadata as any)?.content?.slice(0, 100))

  // Update company onboarding with learned preferences
  if (total >= 5) {
    try {
      const onboarding = await prisma.onboarding.findUnique({ where: { organizationId } })
      if (onboarding && bestRate > 0.7 && bestAgent) {
        const bestAgentData = await prisma.agent.findUnique({ where: { id: bestAgent } })
        const existingMeta = (onboarding as any).metadata || {}
        await prisma.onboarding.update({
          where: { organizationId },
          data: {
            metadata: {
              ...existingMeta,
              learnedPreferences: {
                approvalRate: approved.length / total,
                bestAgent: bestAgentData?.name,
                totalApprovals: approved.length,
                totalRejections: rejected.length,
                updatedAt: new Date().toISOString(),
              },
            },
          },
        } as any)
      }
    } catch {}
  }

  return {
    approvalRate: total > 0 ? approved.length / total : 0,
    totalApprovals: approved.length,
    totalRejections: rejected.length,
    commonRejects,
    bestAgent: bestAgent ? (await prisma.agent.findUnique({ where: { id: bestAgent } }))?.name || undefined : undefined,
  }
}
