import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { PIXEL_OFFICE_API_URL } from "@/lib/ai/config"

/**
 * POST /api/office/sync
 * Body: { organizationId }
 *
 * Sincroniza agentes de uma org com o Pixel Office (Render/cloud).
 * Envia dados dos agentes via POST para o servidor do pixel office.
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json()
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId required" }, { status: 400 })
    }

    // Get all active agents
    const agents = await prisma.agent.findMany({
      where: { organizationId, status: { notIn: ["FIRED", "OFFLINE"] } },
      select: { id: true, name: true, role: true, personality: true, workState: true, status: true },
      orderBy: { createdAt: "asc" },
    })

    if (agents.length === 0) {
      return NextResponse.json({ synced: 0 })
    }

    // Format for pixel office existingAgents message
    const agentIds = agents.map((_, i) => i + 1)
    const agentMeta: Record<number, { palette?: number; hueShift?: number }> = {}
    const folderNames: Record<number, string> = {}

    // Assign palettes to first 6 agents, rotate for extras
    const PALETTE_COUNT = 6
    agents.forEach((agent, i) => {
      agentMeta[i + 1] = {
        palette: i % PALETTE_COUNT,
        hueShift: Math.floor(i / PALETTE_COUNT) > 0 ? (i % PALETTE_COUNT) * 45 + 45 : 0,
      }
      folderNames[i + 1] = agent.name
    })

    // Send to pixel office server
    const response = await fetch(`${PIXEL_OFFICE_API_URL}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agents: agentIds, agentMeta, folderNames }),
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      console.error("[Office Sync] Pixel office returned", response.status)
      return NextResponse.json({ synced: 0, error: `Pixel office returned ${response.status}` })
    }

    return NextResponse.json({ synced: agents.length, agents: agents.map(a => a.name) })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[Office Sync Error]", msg)
    return NextResponse.json({ synced: 0, error: msg }, { status: 500 })
  }
}
