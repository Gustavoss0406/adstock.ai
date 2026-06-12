import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { chatCompletionDaily } from "@/lib/ai/client"
import { getUpcomingEvents, getDayContext, extractTasksFromSpeeches } from "@/lib/agents/daily"
import { fetchAllMetrics, buildMetricsPrompt } from "@/lib/autonomous/metrics-fetcher"
import { getCompanyProfile, buildContextPrompt } from "@/lib/autonomous/company-profile"

export const maxDuration = 120

const BAD_TASK_PATTERNS = [
  "nao consegui processar", "dificuldades tecnicas", "me atualizar",
  "vou me atualizar", "aguardando", "em breve", "trabalhando em",
  "sem tarefas", "nenhuma tarefa",
]

function isValidTaskTitle(title: string): boolean {
  return title.length >= 20
    && !BAD_TASK_PATTERNS.some(p => title.toLowerCase().includes(p))
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId, agentId, previousSpeeches = [], isFirst, isLast, isSummary, isFirstDaily } = await request.json()
    if (!organizationId || !agentId) {
      return NextResponse.json({ error: "organizationId and agentId required" }, { status: 400 })
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        onboarding: true,
        integrations: { where: { status: "connected" }, select: { platform: true, name: true, metadata: true } },
      },
    })
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 })
 
    // Load brand identity from Organization
    const orgMeta = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { brandIdentity: true },
    })
    const brandIdentity = (orgMeta?.brandIdentity as Record<string, any>) || {}
    const insightsText = brandIdentity.name 
      ? `\nIDENTIDADE VISUAL: Cores ${brandIdentity.primaryColor || 'padrão'} e ${brandIdentity.secondaryColor || 'padrão'}. Fonte: ${brandIdentity.fontFamily || 'Inter'}.`
      : ""

    if (isSummary) {
      return generateSummary(organizationId, previousSpeeches, org)
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, role: true, personality: true, promptTemplate: true },
    })
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

    // Get tasks — filter out bad ones
    const [myTasks, allTasks] = await Promise.all([
      prisma.task.findMany({ where: { organizationId, assignedTo: agent.id, status: { not: "DONE" } }, orderBy: { priority: "desc" }, take: 5 }),
      prisma.task.findMany({ where: { organizationId, status: { not: "DONE" } }, include: { assignee: { select: { name: true } } }, orderBy: { priority: "desc" }, take: 10 }),
    ])

    const validMyTasks = myTasks.filter(t => isValidTaskTitle(t.title))
    const validAllTasks = allTasks.filter(t => isValidTaskTitle(t.title)).slice(0, 5)

    // Build context
    const dayContext = getDayContext()
    const upcomingEvents = getUpcomingEvents(7)
    const eventsText = upcomingEvents.length > 0
      ? "EVENTOS PROXIMOS:\n" + upcomingEvents.map(e => `- ${e.name} em ${e.daysUntil} dias${e.daysUntil <= 3 ? " (URGENTE!)" : ""}`).join("\n")
      : ""

    const companyCtx = [
      org.onboarding?.industry && `Setor: ${org.onboarding.industry}`,
      org.onboarding?.whatYouSell && `O QUE VENDE: ${org.onboarding.whatYouSell}`,
      org.onboarding?.targetAudience && `Publico-alvo: ${org.onboarding.targetAudience}`,
      org.onboarding?.brandVoice && `Voz da marca: ${org.onboarding.brandVoice}`,
      org.onboarding?.mainChallenges && `Desafio principal: ${org.onboarding.mainChallenges}`,
      (org.onboarding?.goals?.length ?? 0) > 0 && `Objetivos: ${org.onboarding?.goals?.join(", ")}`,
      (org.integrations?.length ?? 0) > 0 && `Integracoes conectadas: ${org.integrations?.map(i => i.platform).join(", ")}`,
      org.onboarding?.website && `Site: ${org.onboarding.website}`,
      insightsText,
    ].filter(Boolean).join(". ")

    const myTaskLines = validMyTasks.map(t => `- "${t.title}" (${t.priority})`).join("\n")
    const allTaskLines = validAllTasks.map(t => `- "${t.title}" — ${t.assignee?.name || "sem dono"}`).join("\n")

    // Previous speeches — last 2 only for focus
    const recentSpeeches = previousSpeeches.slice(-2)
    const prevLines = recentSpeeches.length > 0
      ? `\nColegas ja falaram:\n${recentSpeeches.map((s: any) => `${s.agentName}: ${s.content.slice(0, 120)}`).join("\n\n")}`
      : ""

    // Personality
    const personalityNames: Record<string, string> = {
      VISIONARY: "visionaria, lider, entusiasmada",
      BOLD: "ousada, direta, pratica",
      ANALYTICAL: "analitica, baseada em dados, cetica",
      CREATIVE: "criativa, perfeccionista, detalhista",
      DETAILED: "metodica, paciente, tecnica",
      DIPLOMATIC: "diplomatica, empatica, colaborativa",
    }
    const personalityDesc = personalityNames[agent.personality] || "profissional"

    // First daily: Maya's bootstrap prompt
    const connectedIntegrations = org.integrations?.length ?? 0
    const neededIntegrations = [
      !org.integrations?.some(i => i.platform.includes("Google") || i.platform.includes("Search")) ? "Google Search Console" : null,
      !org.integrations?.some(i => i.platform.includes("Instagram")) ? "Instagram Business" : null,
      !org.integrations?.some(i => i.platform.includes("LinkedIn")) ? "LinkedIn" : null,
    ].filter(Boolean)

    const integrationNote = neededIntegrations.length > 0
      ? `\nIntegracoes que precisam ser conectadas pelo CEO: ${neededIntegrations.join(", ")}. Avise o CEO sobre isso se for relevante para suas tarefas.`
      : connectedIntegrations > 0
        ? `\nIntegracoes conectadas: ${org.integrations?.map(i => i.platform).join(", ")}.`
        : ""

    const integrationData = org.integrations && org.integrations.length > 0
      ? org.integrations.map(i => {
          const m = (i.metadata as any) || {}
          const f = m.followers ? `${m.followers.toLocaleString()} seguidores` : ''
          const p = m.recentPosts?.length ? `${m.recentPosts.length} posts` : ''
          return `${i.name}: ${[f,p].filter(Boolean).join(', ') || 'conectado'}`
        }).join(' | ')
      : ''

    // Use cached profile if pre-warmed (saves 2-3s in first daily)
    const cachedProfile = (orgMeta?.brandIdentity as any)?.profileCache
    const profile = cachedProfile?.industry 
      ? cachedProfile 
      : await getCompanyProfile(organizationId).catch(() => null)
    const ctxStr = profile ? buildContextPrompt(profile, agent.role) : ''
    const niche = profile?.niche || org.onboarding?.industry || 'marketing'

    const firstDailyBootstrap = isFirstDaily && isFirst
      ? `PRIMEIRA DAILY da ${org.name}. ${niche}.
${org.onboarding?.goals?.length ? "Objetivos: " + org.onboarding.goals.join(", ") : ""}
${myTaskLines ? "Suas tarefas: " + myTaskLines.slice(0, 300) : ""}
${ctxStr}
${integrationData ? `DADOS REAIS: ${integrationData}. USE ESTES NÚMEROS na sua fala!` : 'Nenhuma rede conectada. Sugira conectar.'}
Apresente 4-6 prioridades da semana focadas no nicho acima. Pergunte ao CEO se aprova. Fale em 1a pessoa. ${personalityDesc}.`
      : ""

    // First daily: non-first agents acknowledge Maya's plan
    const firstDailyFollowUp = isFirstDaily && !isFirst
      ? `Voce esta na PRIMEIRA DAILY da ${org.name}. Maya acabou de apresentar as prioridades da semana (veja acima).

${ctxStr}

Comente brevemente sobre o plano dela, confirme o que voce vai fazer HOJE focado no nicho "${niche}", e se tiver alguma sugestao ou duvida, fale agora.

Seja ${personalityDesc}. Fale em 1a pessoa. 2-3 frases. Apenas FALE.`
      : ""

    // Aligned with document: what to do today, dependencies, blockers, ETA
    const userMessage = firstDailyBootstrap || firstDailyFollowUp || (isFirst
      ? `Voce e a PRIMEIRA a falar. De bom dia, de o tom, compartilhe:
1. O que vai fazer HOJE (posts, artes, artigos, analise, copy, SEO — foque no que a plataforma faz)
2. Precisa de algo de algum colega?
3. Algum bloqueio?
Inclua ETA. Seja ${personalityDesc}.`
      : isLast
        ? `Voce e a ULTIMA. Recapitule os planos, conecte dependencias, encerre a daily. Seja ${personalityDesc}.`
        : `Sua vez. Comente sobre o que os colegas disseram, depois compartilhe:
1. O que vai fazer HOJE (posts, artes, artigos, analise, copy, SEO — foque no que a plataforma faz)
2. Precisa de algo de algum colega?
3. Algum bloqueio?
Inclua ETA. Seja ${personalityDesc}.`)

    const prompt = isFirstDaily && isFirst
      ? userMessage
      : `${org.name} — Daily Standup
${companyCtx || "Agencia de marketing recem-criada."}
${dayContext}
${eventsText}
${validAllTasks.length > 0 ? `Tarefas do time:\n${allTaskLines}` : "Nenhuma tarefa pendente."}
${myTaskLines ? `\nSuas tarefas:\n${myTaskLines}` : ""}

DADOS REAIS DAS PLATAFORMAS CONECTADAS (USE ESTES NÚMEROS na sua fala):
${org.integrations && org.integrations.length > 0 ? org.integrations.map(i => {
  const m = (i.metadata as any) || {}
  const followers = m.followers ? `${m.followers.toLocaleString()} seguidores` : ''
  const posts = m.recentPosts?.length ? `${m.recentPosts.length} posts recentes` : ''
  const seo = m.seoScore ? `SEO Score: ${m.seoScore}/100` : ''
  return `- ${i.name}: ${[followers, posts, seo].filter(Boolean).join(', ') || 'conectado'}`
}).join('\n') : 'Nenhuma plataforma conectada.'}

IMPORTANTE: Mencione os números reais acima na sua fala. Ex: "Nossos 292M de seguidores..."

${prevLines}

${userMessage}

SOMENTE FALE SOBRE O QUE A PLATAFORMA FAZ:
- Planejar calendario editorial e criar copies (texto)
- Analisar dados REAIS do Instagram (seguidores, engajamento dos ultimos 5 posts — se conectado)
- Auditar SEO do site via scraper (meta tags, headings, SEO score)
- Criar briefings visuais e estruturas de carrosseis (descricao textual)
- Pesquisar e recomendar keywords baseadas no setor do cliente
- Revisar e aprovar entregas de outros agentes

A PLATAFORMA NAO FAZ (NAO FALE SOBRE):
- NAO publica em rede social nenhuma
- NAO agenda posts
- NAO tem TikTok, Pinterest, Facebook, Twitter, YouTube
- NAO acessa Google Search Console ou Analytics (tokens salvos mas dados NAO sao consultados)
- NAO gera imagens diretamente (apenas briefings textuais — o PNG so e gerado apos aprovacao da Maya)
- NAO faz Google Ads, media buying, pixels, remarketing
- NAO responde comentarios em redes sociais

Fale em 1a pessoa. 2-3 frases. Apenas FALE.`

    const maxTokens = isFirst && isFirstDaily ? 500 : 300
    let cleaned = ""
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await chatCompletionDaily(prompt, { temperature: 0.85, maxTokens })
      cleaned = raw?.replace(/^(Claro|Certo|Com certeza|OK|Ok|Entendido|Beleza)[,!.]?\s*/i, "")?.trim() || ""
      if (cleaned && cleaned.length > 20 && !/dificuldades|nao consegui/i.test(cleaned)) break
      if (attempt === 0) await new Promise(r => setTimeout(r, 1000))
    }

    if (!cleaned || cleaned.includes("Nao consegui processar")) {
      cleaned = isFirstDaily && isFirst
        ? `Bom dia, time! Vamos planejar a semana com base nos dados que temos.`
        : `Bom dia! Estou alinhado com o plano. Vou focar nas minhas tarefas de hoje.`
    }

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
    console.error("[DailySpeak Error]", error instanceof Error ? error.message : error, error instanceof Error ? error.stack?.substring(0,300) : '')
    return NextResponse.json({ error: "Failed to generate speech: " + (error instanceof Error ? error.message : String(error)) }, { status: 500 })
  }
}

async function generateSummary(
  organizationId: string,
  speeches: Array<{ agentName: string; content: string }>,
  org: any,
) {
  // Filter out failed/error speeches
  const validSpeeches = speeches.filter(s =>
    s.content.length >= 30 &&
    !s.content.includes("Nao consegui processar") &&
    !s.content.includes("dificuldades tecnicas") &&
    !s.content.includes("Vou me atualizar")
  )

  // Build simple summary from template — no AI needed
  const lines: string[] = []
  lines.push("RESUMO DO DIA:")
  for (const s of validSpeeches) {
    const plan = s.content.split(/[.!?]/)[0]?.slice(0, 100) || s.content.slice(0, 80)
    lines.push(`- ${s.agentName}: ${plan}`)
  }
  if (validSpeeches.length === 0) lines.push("- Nenhum agente reportou atividades.")

  lines.push("")
  lines.push("DEPENDENCIAS:")
  const deps = validSpeeches.filter(s =>
    s.content.toLowerCase().includes("preciso") ||
    s.content.toLowerCase().includes("aguardando") ||
    s.content.toLowerCase().includes("depende")
  )
  if (deps.length > 0) {
    for (const s of deps) {
      lines.push(`- ${s.agentName} mencionou dependencias`)
    }
  } else {
    lines.push("- Nenhuma dependencia reportada")
  }

  lines.push("")
  lines.push("ALERTAS:")
  lines.push("- Nenhum alerta")

  lines.push("")
  lines.push("ACOES CEO:")
  lines.push("- Nada necessario agora")

  // Save summary — respond immediately
  const summary = lines.join("\n")
  const channel = await prisma.channel.findFirst({ where: { organizationId, name: "daily-standup" } })
  if (channel) {
    await prisma.message.create({
      data: {
        content: summary,
        metadata: { type: "daily_summary", dailyDate: new Date().toISOString().slice(0, 10), agentCount: speeches.length },
        channelId: channel.id,
      },
    })
  }

  // Extract tasks in background (don't block response)
  const agents = await prisma.agent.findMany({ where: { organizationId }, select: { id: true, name: true } })
  extractTasksFromSpeeches(
    organizationId,
    validSpeeches.length > 0 ? validSpeeches : speeches,
    agents,
  ).then(async (tasksCreated) => {
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
  }).catch(() => {})

  return NextResponse.json({ agent: "Sistema", content: summary, tasksCreated: 0 })
}
