import { NextRequest, NextResponse } from "next/server"
import { resolveConflict } from "@/lib/orchestrator/conflict"

export async function POST(request: NextRequest) {
  try {
    const { organizationId, winnerAgentName, loserAgentName, topic } = await request.json()
    if (!organizationId || !winnerAgentName || !loserAgentName) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const result = await resolveConflict(organizationId, winnerAgentName, loserAgentName, topic)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
