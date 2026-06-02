import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"
import { getUpcomingEvents, getDayContext } from "@/lib/agents/daily"

export const maxDuration = 60 // 60s is enough for 1 agent

/**
 * POST /api/daily/speak
 * Body: { organizationId, agentId, previousSpeeches[], isFirst, isLast }
 *
 * Generates ONE agent speech for the daily standup.
 * Called sequentially by the client for each agent.
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, agentId, previousSpeeches = [], isFirst, isLast } = await request.json()
    if (!organizationId || !agentId) {
      return NextResponse.json({ error: "organizationId and agentId required" }, { status: 400 })
    }

    // Get agent
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, role: true, personality: true, promptTemplate: true },
    })
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

    // Get org context
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, onboarding: { select: { industry: true, brandVoice: true } } },
    })
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 })

    // Get agent's tasks
    const tasks = await prisma.task.findMany({
      where: { organizationId, assignedTo: agent.id, status: { not: "DONE" } },
      orderBy: { priority: "desc" },
      take: 5,
    })

    // Build context
    const dayContext = getDayContext()
    const upcomingEvents = getUpcomingEvents(7)
    const eventsText = upcomingEvents.length > 0
      ? "EVENTOS PROXIMOS:\n" + upcomingEvents.map(e => `- ${e.name} em ${e.daysUntil} dias`).join("\n")
      : ""

    const myTaskLines = tasks.map(t => `- "${t.title}"`).join("\n")
    const companyCtx = org.onboarding?.industry ? `Setor: ${org.onboarding.industry}.` : ""

    // Previous speeches context
    const prevLines = previousSpeeches.length > 0
      ? `\nColegas ja falaram:\n${previousSpeeches.map((s: any) => `${s.agentName}: ${s.content.slice(0, 100)}`).join("\n\n")}`
      : ""

    const userMessage = `${agent.name}, ${isFirst ? "de bom dia e compartilhe seu plano do dia" : isLast ? "recapitule e encerre a daily" : "sua vez de falar"}. Inclua ETA. Responda em 1-2 frases curtas, primeira pessoa.`

    const prompt = `${dayContext}
${org.name} — agencia de marketing.${companyCtx ? ` ${companyCtx}` : ""}
${myTaskLines ? `\nTarefas de ${agent.name}:\n${myTaskLines}` : ""}
${eventsText}
${prevLines}

${userMessage}`

    // Generate speech
    const reply = await chatCompletion(prompt, {
      temperature: 0.9,
      maxTokens: 3000,
      model: "deepseek-v4-pro",
    })

    const cleaned = reply
      ?.replace(/^(Claro|Certo|Com certeza|OK|Ok|Entendido|Beleza)[,!.]?\s*/i, "")
      ?.trim() || "Nao consegui processar."

    // Save message to channel
    const channel = await prisma.channel.findFirst({
      where: { organizationId, name: "daily-standup" },
    })
    if (channel) {
      await prisma.message.create({
        data: {
          content: cleaned,
          metadata: { type: "daily_speech", agentName: agent.name, dailyDate: new Date().toISOString().slice(0, 10) },
          agentId: agent.id,
          channelId: channel.id,
        },
      })
    }

    return NextResponse.json({
      agent: agent.name,
      content: cleaned,
      agentId: agent.id,
    })
  } catch (error) {
    console.error("[DailySpeak Error]", error)
    return NextResponse.json({ error: "Failed to generate speech" }, { status: 500 })
  }
}
