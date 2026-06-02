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
    let created = await extractTasksFromSpeeches(organizationId, speeches, agents)

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
  const existingTitles = new Set<string>(
    (await prisma.task.findMany({
      where: { organizationId, status: { not: "DONE" } },
      select: { title: true },
    })).map(t => t.title.toLowerCase().slice(0, 30)),
  )

  // Build agent name map (lowercase first name -> id)
  const agentByName: Record<string, string> = {}
  for (const a of agents) {
    const firstName = a.name.split(" ")[0].toLowerCase()
    const fullName = a.name.toLowerCase()
    agentByName[firstName] = a.id
    agentByName[fullName] = a.id
  }

  // Pattern: "AgentName, [verb phrase]" → eg "Diego, voce mergulha na criacao dos 3 posts..."
  // Capture: (agent name) followed by verb-like description
  const actionVerbs = "criar|analisar|configurar|revisar|otimizar|planejar|escrever|produzir|executar|estruturar|finalizar|pesquisar|mapear|auditar|relatar|gerar|desenvolver|estudar|montar|preparar"
  const agentNames = agents.map(a => a.name.split(" ")[0]).join("|")

  // Match: "Agent, [verbo] rest of sentence"
  const taskPattern = new RegExp(
    `(${agentNames})[\\s,]*:?\\s*(?:voce\\s+)?(?:vai\\s+)?(?:sua\\s+missao\\s+e\\s+)?(?:e\\s+)?(${actionVerbs})[^.]*?\\.`,
    "gi"
  )

  let match
  while ((match = taskPattern.exec(allText)) !== null) {
    const rawTitle = match[0].trim()
    if (rawTitle.length < 20) continue

    // Clean: remove agent prefix
    const cleanTitle = rawTitle
      .replace(new RegExp(`^(${agentNames})[\\s,]*:?\\s*(?:voce\\s+)?(?:vai\\s+)?(?:sua\\s+missao\\s+e\\s+)?`, "i"), "")
      .trim()

    if (cleanTitle.length < 20 || existingTitles.has(cleanTitle.toLowerCase().slice(0, 30))) continue

    const agentName = match[1].toLowerCase()
    const assigneeId = agentByName[agentName] || null

    existingTitles.add(cleanTitle.toLowerCase().slice(0, 30))

    await prisma.task.create({
      data: {
        organizationId,
        title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
        type: "content",
        priority: "MEDIUM",
        status: "TODO",
        assignedTo: assigneeId,
        estimatedMinutes: 60,
        description: "Extraído da primeira daily.",
      },
    } as any)
    created++
  }

  // Fallback: numbered lists like "1. Criar calendario editorial para Instagram (Maya)"
  if (created === 0) {
    const listPattern = /(\d+)[\\.)]\s*((?:criar|analisar|configurar|revisar|otimizar|planejar|escrever|produzir|executar|estruturar|finalizar|pesquisar|mapear|auditar|relatar|gerar|desenvolver|estudar|montar|preparar)[^.]*?)\\./gi
    while ((match = listPattern.exec(allText)) !== null) {
      const title = match[2].trim()
      if (title.length < 20 || existingTitles.has(title.toLowerCase().slice(0, 30))) continue
      existingTitles.add(title.toLowerCase().slice(0, 30))

      // Try to find agent name in the title
      let assigneeId = null
      for (const a of agents) {
        if (title.toLowerCase().includes(a.name.split(" ")[0].toLowerCase())) {
          assigneeId = a.id
          break
        }
      }

      await prisma.task.create({
        data: {
          organizationId,
          title: title.charAt(0).toUpperCase() + title.slice(1),
          type: "content",
          priority: "MEDIUM",
          status: "TODO",
          assignedTo: assigneeId,
          estimatedMinutes: 60,
          description: "Extraído da primeira daily.",
        },
      } as any)
      created++
    }
  }

  return created
}
