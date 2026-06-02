import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { extractTasksFromSpeeches } from "@/lib/agents/daily"

export const maxDuration = 90

export async function POST(request: NextRequest) {
  try {
    const { organizationId, speeches } = await request.json()
    if (!organizationId || !speeches?.length) {
      return NextResponse.json({ tasksCreated: 0, error: "Missing data" }, { status: 400 })
    }

    const agents = await prisma.agent.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    })

    // Try AI extraction first
    let created = await extractTasksFromSpeeches(
      organizationId,
      speeches,
      agents,
    )

    // Fallback: regex parse Maya's speech for explicit task assignments
    if (created === 0 && speeches.length > 0) {
      created = await parseTasksFromText(organizationId, speeches, agents)
    }

    return NextResponse.json({ tasksCreated: created })
  } catch (error) {
    console.error("[ExtractTasks Error]", error)
    return NextResponse.json({ tasksCreated: 0, error: String(error) }, { status: 500 })
  }
}

async function parseTasksFromText(
  organizationId: string,
  speeches: Array<{ agentName: string; content: string }>,
  agents: Array<{ id: string; name: string }>,
): Promise<number> {
  const allText = speeches.map(s => s.content).join("\n")
  let created = 0

  // Regex patterns for task mentions
  const patterns = [
    // "Diego, voce mergulha na criacao dos 3 posts para Instagram"
    /(\w+)[,:]?\s*(?:voce|sua missao|vai|fara?|criara?|assumira?|mergulha|entra|configura)[^.]*?(criar|analisar|configurar|revisar|otimizar|produzir|fazer|escrever|gerar|desenvolver|estudar|pesquisar|mapear|auditar|relatar|planejar|executar|estruturar|finalizar)[^.]*?\./gi,
    // Numbered lists like "1. Diego - criar posts"
    /(\d+)\.\s*(\w+)[^.]*?(?:criar|analisar|configurar|revisar|otimizar|produzir|fazer|escrever|gerar|desenvolver|estudar|pesquisar|mapear|auditar|relatar|planejar|executar|estruturar|finalizar)[^.]*?\./gi,
  ]

  const foundTasks = new Set<string>()

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(allText)) !== null) {
      const fullMatch = match[0].trim()
      if (fullMatch.length < 20) continue
      if (foundTasks.has(fullMatch.slice(0, 40))) continue
      foundTasks.add(fullMatch.slice(0, 40))

      // Try to find the agent name
      const agentName = match[1] || match[2]
      let assignee = agents.find(a =>
        a.name.toLowerCase().includes((agentName || "").toLowerCase())
      )

      // Default to unassigned if not found
      const title = fullMatch.slice(0, 120).trim()
        .replace(/^\d+\.\s*/, "")
        .replace(/^(\w+)[,:]?\s*/, "")

      if (title.length < 20) continue

      await prisma.task.create({
        data: {
          organizationId,
          title,
          type: "content",
          priority: "MEDIUM",
          status: "TODO",
          assignedTo: assignee?.id || null,
          estimatedMinutes: 60,
          description: `Extraído da primeira daily.`,
        },
      } as any)
      created++
    }
  }

  return created
}
