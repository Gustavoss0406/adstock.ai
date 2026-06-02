import { NextRequest, NextResponse } from "next/server"
import { scoreRecentTasks, autoImproveTasks } from "@/lib/orchestrator/quality"

export const dynamic = "force-dynamic"

/**
 * GET /api/daily/quality?orgId=xxx&action=score|improve
 *
 * Score: avalia qualidade das tasks recentes
 * Improve: auto-melhora tasks de baixa qualidade
 */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId")
  const action = request.nextUrl.searchParams.get("action") || "score"

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 })
  }

  try {
    if (action === "improve") {
      const count = await autoImproveTasks(orgId)
      return NextResponse.json({ improved: count })
    }

    const result = await scoreRecentTasks(orgId, 10)
    return NextResponse.json({
      averageScore: result.averageScore,
      needsImprovement: result.needsImprovementCount,
      tasks: result.tasks.map(t => ({
        id: t.taskId,
        title: t.title,
        score: t.score,
        breakdown: `S:${t.specificity}/40 C:${t.completeness}/30 O:${t.originality}/20 A:${t.actionability}/10`,
        issues: t.issues,
        needsImprovement: t.needsImprovement,
      })),
    })
  } catch (error) {
    console.error("[Quality Error]", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
