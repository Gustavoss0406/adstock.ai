import { NextRequest, NextResponse } from "next/server"
import { learnFromFeedback, analyzeApprovalPatterns } from "@/lib/autonomous/learning"

export async function POST(request: NextRequest) {
  try {
    const { organizationId, approved, taskId, agentId, content, note } = await request.json()
    if (!organizationId) return NextResponse.json({ error: "organizationId required" }, { status: 400 })

    await learnFromFeedback(organizationId, { taskId, approved, content, agentId, note })

    const patterns = await analyzeApprovalPatterns(organizationId)

    return NextResponse.json({
      success: true,
      patterns,
      message: approved ? "Aprovacao registrada. Padroes atualizados." : "Rejeicao registrada. Agente vai se adaptar.",
    })
  } catch (error) {
    console.error("[Learn Error]", error)
    return NextResponse.json({ error: "Learning failed" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get("organizationId")
  if (!organizationId) return NextResponse.json({ error: "organizationId required" }, { status: 400 })

  const patterns = await analyzeApprovalPatterns(organizationId)
  return NextResponse.json(patterns)
}
