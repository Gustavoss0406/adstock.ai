import { NextRequest, NextResponse } from "next/server"
import { runAutonomousLoop } from "@/lib/autonomous"
import { buildCompanyContext } from "@/lib/autonomous/context"
import { analyzeApprovalPatterns } from "@/lib/autonomous/learning"

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json()
    if (!organizationId) return NextResponse.json({ error: "organizationId required" }, { status: 400 })

    const results = await runAutonomousLoop(organizationId)

    return NextResponse.json({
      success: true,
      ...results,
      message: `Loop autonomo concluido: ${results.total} acoes (${results.calendar} calendario, ${results.metrics} metricas, ${results.backlog} backlog, ${results.stuck} stuck)`,
    })
  } catch (error) {
    console.error("[Autonomous Run Error]", error)
    return NextResponse.json({ error: "Autonomous loop failed" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get("organizationId")
  if (!organizationId) return NextResponse.json({ error: "organizationId required" }, { status: 400 })

  const [context, patterns] = await Promise.all([
    buildCompanyContext(organizationId),
    analyzeApprovalPatterns(organizationId),
  ])

  return NextResponse.json({
    context,
    patterns,
    autonomyLevel: calculateAutonomyLevel(patterns),
  })
}

function calculateAutonomyLevel(patterns: any): number {
  if (patterns.totalApprovals + patterns.totalRejections === 0) return 100
  const rate = patterns.approvalRate * 100
  // Bonus for high approval count
  const volumeBonus = Math.min(patterns.totalApprovals, 20)
  return Math.min(100, Math.round(rate + volumeBonus * 0.5))
}
