import { NextRequest, NextResponse } from "next/server"
import { runDaily } from "@/lib/agents/daily"

export const maxDuration = 300 // 5min for full daily with AI calls

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json()
    if (!organizationId) return NextResponse.json({ error: "organizationId required" }, { status: 400 })

    const result = await runDaily(organizationId)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[Daily Error]", error)
    return NextResponse.json({ error: "Daily failed" }, { status: 500 })
  }
}
