import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"
import { getUpcomingEvents, getDayContext, extractTasksFromSpeeches } from "@/lib/agents/daily"

export const maxDuration = 60

/**
 * POST /api/daily/speak
 * Body: { organizationId, agentId, previousSpeeches[], isFirst, isLast, isSummary? }
 *
 * Generates ONE agent speech. Called sequentially by the client.
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, agentId, previousSpeeches = [], isFirst, isLast, isSummary } = await request.json()
    if (!organizationId || !agentId) {
      return NextResponse.json({ error: "organizationId and agentId required" }, { status: 400 })
    }

    // Get full org context including onboarding
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        onboarding: true,
        integrations: { where: { status: "connected" }, select: { platform: true, name: true } },
      },
    })
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 })

    // Summary mode — just format the summary
    if (isSummary) {
      return generateSummary(organizationId, previousSpeeches, org)
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, role: true, personality: true, promptTemplate: true },
    })
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

    // Get agent's tasks and all pending tasks for context
    const [myTasks, allTasks] = await Promise.all([
      prisma.task.findMany({ where: { organizationId, assignedTo: agent.id, status: { not: "DONE" } }, orderBy: { priority: "desc" }, take: 5 }),
      prisma.task.findMany({ where: { organizationId, status: { not: "DONE" } }, include: { assignee: { select: { name: true } } }, orderBy: { priority: "desc" }, take: 10 }),
    ])

    // Build rich company context
    const dayContext = getDayContext()
    const upcomingEvents = getUpcomingEvents(7)
    const eventsText = upcomingEvents.length > 0
      ? "EVENTOS PROXIMOS:\n" + upcomingEvents.map(e => `- ${e.name} em ${e.daysUntil} dias${e.daysUntil <= 3 ? " (URGENTE!)" : ""}`).join("\n")
      : ""

    const companyCtx = [
      org.onboarding?.industry && `Setor: ${org.onboarding.industry}`,
      org.onboarding?.targetAudience && `Publico-alvo: ${org.onboarding.targetAudience}`,
      org.onboarding?.brandVoice && `Voz da marca: ${org.onboarding.brandVoice}`,
      org.onboarding?.mainChallenges && `Desafio principal: ${org.onboarding.mainChallenges}`,
      (org.onboarding?.goals?.length ?? 0) > 0 && `Objetivos: ${org.onboarding?.goals?.join(", ")}`,
      (org.integrations?.length ?? 0) > 0 && `Integracoes conectadas: ${org.integrations?.map(i => i.platform).join(", ")}`,
      org.onboarding?.website && `Site: ${org.onboarding.website}`,
    ].filter(Boolean).join(". ")

    const myTaskLines = myTasks.map(t => `- "${t.title}" (${t.priority})`).join("\n")
    const allTaskLines = allTasks.map(t => `- [${t.status === "TODO" ? "A FAZER" : "ANDAMENTO"}] "${t.title}" — ${t.assignee?.name || "sem dono"}`).join("\n")

    // Previous speeches — show relevant parts for cross-references
    const prevLines = previousSpeeches.length > 0
      ? `\nCOLEGAS JA FALARAM:\n${previousSpeeches.map((s: any) => `${s.agentName}: ${s.content.slice(0, 200)}`).join("\n\n")}`
      : ""

    // Agent personality
    const persona = agent.promptTemplate || `profissional de marketing da agencia ${org.name}`
    const personalityNames: Record<string, string> = {
      VISIONARY: "visionaria, lider, entusiasmada",
      BOLD: "ousada, direta, pratica",
      ANALYTICAL: "analitica, baseada em dados, cetica",
      CREATIVE: "criativa, perfeccionista, detalhista",
      DETAILED: "metodica, paciente, tecnica",
      DIPLOMATIC: "diplomatica, empatica, colaborativa",
    }
    const personalityDesc = personalityNames[agent.personality] || "profissional"

    // Build prompt with deep conversation context
    const userMessage = isFirst
      ? `Voce e a PRIMEIRA a falar na daily de hoje. De bom dia, de o tom da reuniao, e compartilhe seu plano do dia. Seja ${personalityDesc}. Mencione colegas especificos se precisar de algo deles. Inclua ETA.`
      : isLast
        ? `Voce e a ULTIMA a falar. Recapitule o que cada colega disse, conecte os planos, identifique dependencias, e encerre a daily. Seja ${personalityDesc}.`
        : `Sua vez de falar. Comente sobre o que os colegas disseram (concorda? precisa de algo deles? tem algo a complementar?). Depois compartilhe seu plano. Seja ${personalityDesc}. Inclua ETA.`

    const prompt = `${org.name} — Daily Standup
Contexto da agencia: ${companyCtx || "Agencia de marketing recem-criada, comecando do zero."}
${dayContext}
${eventsText}
${allTaskLines ? `\nTODAS AS TAREFAS PENDENTES:\n${allTaskLines}` : "Nenhuma tarefa pendente no momento."}
${myTaskLines ? `\nSUAS TAREFAS:\n${myTaskLines}` : "Voce nao tem tarefas atribuidas ainda."}
${prevLines}

${userMessage}

Fale em primeira pessoa. 2-3 frases. Nao descreva seu raciocinio — apenas FALE.`

    // Generate speech
    const reply = await chatCompletion(prompt, {
      temperature: 0.9,
      maxTokens: 3000,
      model: "deepseek-v4-pro",
    })

    const cleaned = reply
      ?.replace(/^(Claro|Certo|Com certeza|OK|Ok|Entendido|Beleza)[,!.]?\s*/i, "")
      ?.trim() || "Nao consegui processar."

    // Save message
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

    return NextResponse.json({ agent: agent.name, content: cleaned, agentId: agent.id })
  } catch (error) {
    console.error("[DailySpeak Error]", error)
    return NextResponse.json({ error: "Failed to generate speech" }, { status: 500 })
  }
}

async function generateSummary(
  organizationId: string,
  speeches: Array<{ agentName: string; content: string }>,
  org: any,
) {
  const dayContext = getDayContext()
  const speechesText = speeches.map(s => `${s.agentName}: ${s.content}`).join("\n\n")

  const prompt = `${org.name} — Resumo da Daily Standup
${dayContext}

FALAS DOS AGENTES:
${speechesText || "Nenhum agente falou."}

Preencha APENAS este formato (sem analise, sem introducao):
RESUMO DO DIA:
- NOME: o que vai fazer hoje

DEPENDENCIAS:
- quem depende de quem (ou "Nenhuma")

ALERTAS:
- problemas ou urgencias (ou "Nenhum")

ACOES CEO:
- decisoes que o CEO precisa tomar (ou "Nada necessario")`

  try {
    const reply = await chatCompletion(prompt, { temperature: 0.2, maxTokens: 500, model: "deepseek-v4-pro" })
    const cleaned = reply?.trim() || "Daily concluida."

    // Save summary message
    const channel = await prisma.channel.findFirst({ where: { organizationId, name: "daily-standup" } })
    if (channel) {
      await prisma.message.create({
        data: {
          content: cleaned,
          metadata: { type: "daily_summary", dailyDate: new Date().toISOString().slice(0, 10), agentCount: speeches.length },
          channelId: channel.id,
        },
      })
    }

    // Extract tasks from speeches
    const agents = await prisma.agent.findMany({ where: { organizationId }, select: { id: true, name: true } })
    const tasksCreated = await extractTasksFromSpeeches(organizationId, speeches, agents)

    // Create daily metrics
    await prisma.dailyMetrics.create({
      data: {
        organizationId,
        date: new Date(),
        agentCount: speeches.length,
        speechCount: speeches.length,
        tasksExtracted: tasksCreated,
        status: "completed",
      },
    } as any)

    return NextResponse.json({ agent: "Sistema", content: cleaned, tasksCreated })
  } catch {
    return NextResponse.json({ agent: "Sistema", content: "Daily concluida.", tasksCreated: 0 })
  }
}
