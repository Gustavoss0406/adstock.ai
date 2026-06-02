import { NextRequest, NextResponse } from "next/server"
import { runAutonomousDaily } from "@/lib/autonomous/daily"

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json()
    if (!organizationId) return NextResponse.json({ error: "organizationId required" }, { status: 400 })

    const result = await runAutonomousDaily(organizationId)

    return NextResponse.json({
      success: true,
      ...result,
      message: `Daily autonoma concluida: ${result.tasksCreated} tarefas criadas. Plano postado em #${result.channel}.`,
    })
  } catch (error) {
    console.error("[Autonomous Daily Error]", error)
    return NextResponse.json({ error: "Autonomous daily failed" }, { status: 500 })
  }
}
