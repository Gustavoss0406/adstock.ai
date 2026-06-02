/**
 * ── DAILY STANDUP v3 ────────────────────────────────────────
 *
 * Reunião diária automática com:
 * - Ordem de fala configurável (OfficeSettings.dailyOrder)
 * - Sistema de turnos integrado (1 agente por vez)
 * - Simulação de digitação com indicador visual
 * - Delay humano entre falas (10-15s)
 * - Contexto histórico (daily anterior, semana anterior)
 * - ETA explícito nas falas
 * - Agentes comentam entre si (discussão)
 * - Skip de fim de semana e feriados
 * - Extração de tarefas das falas
 */

import { prisma } from "@/lib/prisma"
import { chatCompletion, chatWithMessages } from "@/lib/ai/client"
import {
  requestTurn,
  releaseTurn,
  calculateTypingTime,
  setTypingIndicator,
  clearTypingIndicator,
  getPersonality,
} from "@/lib/orchestrator/turns"
import { TIMING_CONFIG, getTaskDurationMinutes } from "@/lib/orchestrator/config"
import { detectProactiveConflicts, handleConflict } from "@/lib/orchestrator/conflict"

// ─────────────────────────────────────────────────────────────
// Brazilian Events Calendar
// ─────────────────────────────────────────────────────────────

const BR_EVENTS = [
  { name: "Dia das Maes", month: 5, day: 10 },
  { name: "Dia dos Namorados", month: 6, day: 12 },
  { name: "Dia dos Pais", month: 8, day: 10 },
  { name: "Black Friday", month: 11, day: 28 },
  { name: "Natal", month: 12, day: 25 },
  { name: "Carnaval", month: 2, day: 15 },
  { name: "Pascoa", month: 4, day: 15 },
  { name: "Dia do Cliente", month: 9, day: 15 },
]

// ─────────────────────────────────────────────────────────────
// Brazilian National Holidays (fixed dates)
// ─────────────────────────────────────────────────────────────

const BR_HOLIDAYS: Array<{ name: string; month: number; day: number }> = [
  { name: "Confraternizacao Universal", month: 1, day: 1 },
  { name: "Tiradentes", month: 4, day: 21 },
  { name: "Dia do Trabalhador", month: 5, day: 1 },
  { name: "Independencia do Brasil", month: 9, day: 7 },
  { name: "Nossa Senhora Aparecida", month: 10, day: 12 },
  { name: "Finados", month: 11, day: 2 },
  { name: "Proclamacao da Republica", month: 11, day: 15 },
  { name: "Natal", month: 12, day: 25 },
]

/**
 * Verifica se hoje é um dia que a daily deve rodar.
 * Considera: dailyEnabled, dailyDays, feriados nacionais.
 */
export function shouldRunDailyToday(settings?: {
  dailyEnabled?: boolean
  dailyDays?: string[]
  timezone?: string
}): { shouldRun: boolean; reason?: string } {
  if (settings?.dailyEnabled === false) {
    return { shouldRun: false, reason: "daily desabilitada nas configuracoes" }
  }

  const now = new Date()
  const timezone = settings?.timezone || "America/Sao_Paulo"

  // Get local day of week
  let localDayOfWeek: string
  try {
    localDayOfWeek = now.toLocaleDateString("en-US", { timeZone: timezone, weekday: "long" }).toLowerCase()
  } catch {
    localDayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
  }

  // Check dailyDays config
  const days = settings?.dailyDays
  if (days && days.length > 0) {
    if (!days.map(d => d.toLowerCase()).includes(localDayOfWeek)) {
      return { shouldRun: false, reason: `${localDayOfWeek} nao esta nos dias configurados (${days.join(", ")})` }
    }
  }

  // Check holidays
  let localMonth: number
  let localDay: number
  try {
    const dateStr = now.toLocaleDateString("pt-BR", { timeZone: timezone })
    const [d, m] = dateStr.split("/").map(Number)
    localMonth = m
    localDay = d
  } catch {
    localMonth = now.getMonth() + 1
    localDay = now.getDate()
  }

  for (const holiday of BR_HOLIDAYS) {
    if (holiday.month === localMonth && holiday.day === localDay) {
      return { shouldRun: false, reason: `feriado: ${holiday.name}` }
    }
  }

  return { shouldRun: true }
}

/**
 * Verifica se hoje é feriado.
 */
export function isHolidayToday(timezone?: string): string | null {
  const now = new Date()
  const tz = timezone || "America/Sao_Paulo"

  let month: number
  let day: number
  try {
    const dateStr = now.toLocaleDateString("pt-BR", { timeZone: tz })
    const [d, m] = dateStr.split("/").map(Number)
    month = m
    day = d
  } catch {
    month = now.getMonth() + 1
    day = now.getDate()
  }

  for (const holiday of BR_HOLIDAYS) {
    if (holiday.month === month && holiday.day === day) return holiday.name
  }
  return null
}

export function getUpcomingEvents(daysAhead = 7): Array<{ name: string; daysUntil: number }> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const result: Array<{ name: string; daysUntil: number }> = []

  for (const event of BR_EVENTS) {
    const eventDate = new Date(now.getFullYear(), event.month - 1, event.day)
    if (eventDate < today) eventDate.setFullYear(eventDate.getFullYear() + 1)
    const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / 86400000)
    if (daysUntil >= 0 && daysUntil <= daysAhead) result.push({ name: event.name, daysUntil })
  }
  return result.sort((a, b) => a.daysUntil - b.daysUntil)
}

// ─────────────────────────────────────────────────────────────
// Day Context
// ─────────────────────────────────────────────────────────────

export function getDayContext(): string {
  const now = new Date()
  const dayOfWeek = now.toLocaleDateString("pt-BR", { weekday: "long" })
  const dateStr = now.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
  const dayNum = now.getDay()

  let mood = "Hoje e um dia normal de trabalho."
  if (dayNum === 1) mood = "E SEGUNDA-FEIRA. Comeco de semana! Hora de definir prioridades e organizar a semana. Traga energia extra e foco no planejamento."
  if (dayNum === 5) mood = "E SEXTA-FEIRA. Dia de fechar ciclos, entregar o que ficou pendente e celebrar as conquistas da semana. Tom de encerramento."
  if (dayNum === 0 || dayNum === 6) mood = "E fim de semana, mas estamos trabalhando. Planejamento mais leve, foco em preparar a proxima semana."

  const hour = now.getHours()
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"

  return `${greeting}! ${dayOfWeek}, ${dateStr}. ${mood}`
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Gera resposta AI com retry exponencial (3 tentativas).
 * Fallback progressivo: tenta temp mais baixa a cada retry.
 */
async function generateWithRetry(
  prompt: string,
  agentName: string,
  maxRetries = 0, // No retries — deepseek is reliable, speed > redundancy
): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const temp = 0.9 - (attempt * 0.15)
      const reply = await chatCompletion(prompt, {
        temperature: temp,
        maxTokens: 1500,
      })
      return reply
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt) * 2000 // 2s, 4s
        console.warn(
          `[Daily] Retry ${attempt + 1}/${maxRetries} for ${agentName} in ${backoff}ms: ${lastError.message.slice(0, 80)}`,
        )
        await sleep(backoff)
      }
    }
  }

  throw lastError || new Error(`Failed after ${maxRetries + 1} attempts for ${agentName}`)
}

async function getPreviousDailyContext(
  organizationId: string,
): Promise<string> {
  try {
    // Get last completed daily
    const lastDaily = await prisma.agencyEvent.findFirst({
      where: { organizationId, type: "daily_completed" },
      orderBy: { createdAt: "desc" },
      select: { description: true, createdAt: true, metadata: true },
    })

    if (!lastDaily) return ""

    const daysAgo = Math.floor(
      (Date.now() - new Date(lastDaily.createdAt).getTime()) / 86400000,
    )

    // Get tasks completed since last daily
    const completedTasks = await prisma.task.count({
      where: {
        organizationId,
        status: { in: ["DONE", "IN_REVIEW"] },
        updatedAt: { gte: lastDaily.createdAt },
      },
    })

    // Get messages sent since last daily
    const messagesSince = await prisma.message.count({
      where: {
        channel: { organizationId },
        agentId: { not: null },
        createdAt: { gte: lastDaily.createdAt },
      },
    })

    return `CONTEXTO HISTORICO: Daily anterior (${daysAgo} dia(s) atras).
${(lastDaily.description || "")
    .replace(/Nao consegui falar agora[^.]*\./gi, "")
    .slice(0, 200)}`
  } catch {
    return ""
  }
}

function cleanAgentReply(reply: string): string {
  let cleaned = reply.trim()
  
  // deepseek-v4-pro usually produces clean output, but sometimes meta-text leaks.
  // Strip it if present at the start.
  if (/^O usu[áa]rio quer/i.test(cleaned) || /^The user wants/i.test(cleaned)) {
    // Find the first sentence that looks like actual speech (not analysis)
    const sentences = cleaned.split(/[.!?]\s+/)
    const speechStart = sentences.findIndex(s => {
      const t = s.trim()
      return /^(Bom dia|Boa noite|Boa tarde|Hoje|Vou|Estou|Alinhad[oa]|Seguindo)/i.test(t) && t.length > 15
    })
    if (speechStart >= 0) {
      cleaned = sentences.slice(speechStart).join(". ").trim()
    }
  }
  
  // Strip acknowledgment prefixes
  cleaned = cleaned.replace(/^(Claro|Certo|Com certeza|OK|Ok|Entendido|Beleza)[,!.]?\s*/i, "")
  
  return cleaned.trim()
}

// ─────────────────────────────────────────────────────────────
// Task Extraction (standalone function)
// ─────────────────────────────────────────────────────────────

export async function extractTasksFromSpeeches(
  organizationId: string,
  speeches: Array<{ agentName: string; content: string }>,
  agents: Array<{ id: string; name: string }>,
): Promise<number> {
  if (speeches.length === 0) return 0

  // Get org context for better task extraction
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { onboarding: { select: { industry: true, brandVoice: true, targetAudience: true, goals: true } } },
  })

  const contextParts: string[] = []
  if (org?.onboarding?.industry) contextParts.push(`Setor: ${org.onboarding.industry}`)
  if (org?.onboarding?.targetAudience) contextParts.push(`Publico: ${org.onboarding.targetAudience}`)
  if (org?.onboarding?.goals?.length) contextParts.push(`Objetivos: ${org.onboarding.goals.join(", ")}`)
  const contextStr = contextParts.length > 0 ? `\nCONTEXTO DA AGENCIA: ${contextParts.join(". ")}.` : ""

  const taskSystem = `Extraia tarefas concretas e ESPECIFICAS das falas de reuniao.${contextStr}

    Regras:
- Titulos com pelo menos 20 caracteres, acionaveis
- Nao crie tarefas duplicadas
- Use verbos de acao: Criar, Analisar, Configurar, Otimizar, Revisar
- Priorize tarefas MENCIONADAS nas falas (nao invente)
- Max 8 tarefas
- NUNCA crie tarefas com titulos como "Nao consegui processar", "dificuldades tecnicas", "aguardando", "me atualizar"

Retorne APENAS JSON array: [{"title":"...","assignTo":"nome do agente","type":"content|analysis|technical|campaign","priority":"HIGH|MEDIUM|LOW"}]. Nada alem do JSON.`

  try {
    const taskReply = await chatWithMessages(
      [
        { role: "system", content: taskSystem },
        {
          role: "user",
          content: `FALAS:\n${speeches.map(s => `${s.agentName}: ${s.content}`).join("\n\n")}\n\nExtraia as tarefas.`,
        },
      ],
      { temperature: 0.3, maxTokens: 2000 },
    )

    const jsonMatch = taskReply.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return 0

    const extracted = JSON.parse(jsonMatch[0])
    let created = 0

    // Check for duplicates
    const existingTitles = new Set(
      (await prisma.task.findMany({
        where: { organizationId, status: { not: "DONE" } },
        select: { title: true },
      })).map(t => t.title.toLowerCase().slice(0, 30)),
    )

    for (const et of extracted) {
      const assigned = agents.find(a =>
        a.name.toLowerCase().includes((et.assignTo || "").toLowerCase()),
      )

      const title = (et.title || "").trim()
      const titleLower = title.toLowerCase()

      // Blacklist: forbidden phrases
      const forbidden = ["nao consegui", "dificuldades tecnicas", "aguardando", "me atualizar", "em breve", "sem tarefas"]
      if (title.length < 20 || forbidden.some(f => titleLower.includes(f))) continue

      // Whitelist: must contain at least 1 action verb
      const actionVerbs = ["criar", "analisar", "configurar", "revisar", "otimizar", "planejar", "escrever", "produzir", "executar", "estruturar", "finalizar", "pesquisar", "mapear", "auditar", "relatar"]
      if (!actionVerbs.some(v => titleLower.includes(v))) continue

      // Duplicate check
      if (existingTitles.has(titleLower.slice(0, 30))) continue

      existingTitles.add(titleLower.slice(0, 30))
      await prisma.task.create({
        data: {
          organizationId,
          title: et.title,
          type: et.type || "content",
          priority: et.priority || "MEDIUM",
          status: "TODO",
          assignedTo: assigned?.id || null,
          estimatedMinutes: getTaskDurationMinutes(et.type || "content", et.priority || "MEDIUM"),
          description: `Extraído da daily de ${new Date().toLocaleDateString("pt-BR")}.`,
        },
      } as any)
      created++
    }

    return created
  } catch {
    return 0
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN: runDaily
// ─────────────────────────────────────────────────────────────

export async function runDaily(
  organizationId: string,
): Promise<{
  agents: number
  results: Array<{ agent: string; content: string }>
  summary: string
  tasksExtracted: number
}> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      agents: { where: { status: { not: "FIRED" } }, orderBy: { createdAt: "asc" } },
      onboarding: true,
      officeSettings: true,
    },
  })
  if (!org || !org.agents.length) throw new Error("No org or agents")

  const settings = org.officeSettings
  const channelName = "daily-standup"

  // ── Resolve channel ─────────────────────────────────────
  let channel = await prisma.channel.findFirst({
    where: { organizationId, name: channelName },
  })
  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        organizationId,
        name: channelName,
        description: "Daily automatica de alinhamento",
      },
    })
  }

  // ── Lock channel for daily (system owns the lock) ──────
  requestTurn(channelName, "system", "Sistema", 10)

  // ── Set all agents to IN_MEETING ───────────────────────
  for (const a of org.agents) {
    await prisma.agent.update({
      where: { id: a.id },
      data: { status: "IN_MEETING", workState: "SPEAKING" },
    })

    // Bridge event for pixel office sync
    if (process.env.ENABLE_PIXEL_BRIDGE) {
      try {
        const fs = await import("fs")
        const fp = `${process.env.HOME || "/Users/gustavo"}/.pixel-agents/sessions/synkra-${a.id}.jsonl`
        if (fs.existsSync(fp)) {
          fs.appendFileSync(
            fp,
            JSON.stringify({
              type: "assistant",
              message: {
                content: [
                  {
                    type: "text",
                    text: `${a.name} esta indo para a sala de reuniao. Daily as ${settings?.dailyTime || "09:00"}.`,
                  },
                ],
              },
            }) + "\n",
            "utf-8",
          )
        }
      } catch {}
    }
  }

  // ── Notify: daily starting (once, outside loop) ────────
  await prisma.agencyEvent.create({
    data: {
      organizationId,
      type: "daily_starting",
      title: "Daily iniciada",
      description: `${org.agents.length} agentes se reunindo na sala.`,
      metadata: { agentCount: org.agents.length, dailyTime: settings?.dailyTime || "09:00", dailyDate: new Date().toISOString().slice(0, 10) },
    },
  } as any)

  // ── Build context ──────────────────────────────────────
  const dayContext = getDayContext()
  const upcomingEvents = getUpcomingEvents(7)
  const eventsText =
    upcomingEvents.length > 0
      ? "EVENTOS PROXIMOS:\n" +
        upcomingEvents
          .map(
            e =>
              `- ${e.name} em ${e.daysUntil} dias${e.daysUntil <= 3 ? " (URGENTE)" : ""}`,
          )
          .join("\n")
      : "Nenhum evento especial nos proximos 7 dias."

  // Load tasks for context
  const tasks = await prisma.task.findMany({
    where: { organizationId, status: { not: "DONE" } },
    include: { assignee: { select: { name: true } } },
    orderBy: { priority: "desc" },
    take: 20,
  })

  const companyCtx = [
    org.onboarding?.industry && `Setor: ${org.onboarding.industry}`,
    org.onboarding?.targetAudience && `Publico: ${org.onboarding.targetAudience}`,
    org.onboarding?.brandVoice && `Voz da marca: ${org.onboarding.brandVoice}`,
  ]
    .filter(Boolean)
    .join(". ")

  const dailyTime = settings?.dailyTime || "09:00"

  // ── Historical context ─────────────────────────────────
  const previousContext = await getPreviousDailyContext(organizationId)

  // ── Daily start announcement (system message) ──────────
  setTypingIndicator(channelName, "system", "Sistema")
  const announcementContent = `${dayContext}\n\nEquipe se reunindo para a daily das ${dailyTime}. Acompanhe ao vivo ou leia o resumo depois.`
  const announcementTypingTime = calculateTypingTime("Sistema", announcementContent)
  await sleep(announcementTypingTime)

  await prisma.message.create({
    data: {
      content: announcementContent,
      metadata: { type: "daily_start", dailyDate: new Date().toISOString().slice(0, 10) },
      channel: { connect: { id: channel.id } },
    },
  } as any)
  clearTypingIndicator(channelName)

  // ── Build speaker order ────────────────────────────────
  // Prefer configured order from settings, fallback to all agents by createdAt
  let dailyOrder: typeof org.agents
  const configuredOrder = settings?.dailyOrder

  if (configuredOrder && configuredOrder.length > 0) {
    // Order by configured names, include only agents that exist
    const ordered: typeof org.agents = []
    for (const name of configuredOrder) {
      const agent = org.agents.find(
        a => a.name.toLowerCase() === name.toLowerCase() || a.name.toLowerCase().includes(name.toLowerCase()),
      )
      if (agent && !ordered.find(a => a.id === agent.id)) {
        ordered.push(agent)
      }
    }
    // Append any agents not in the configured order
    for (const agent of org.agents) {
      if (!ordered.find(a => a.id === agent.id)) {
        ordered.push(agent)
      }
    }
    dailyOrder = ordered
  } else {
    dailyOrder = org.agents
  }

  // ── Generate speeches SEQUENTIALLY (one agent at a time) ──
  // Each agent thinks individually, speaks, then the next starts.
  // This mirrors real human daily standup flow.
  const results: Array<{ agent: string; content: string }> = []
  const allSpeeches: Array<{ agentName: string; content: string }> = []

  for (let i = 0; i < dailyOrder.length; i++) {
    const agent = dailyOrder[i]
    const isFirst = i === 0
    const isLast = i === dailyOrder.length - 1
    const agentTasks = tasks.filter(t => t.assignedTo === agent.id)
    const myTaskLines = agentTasks
      .map(t => `- "${t.title}"${t.priority ? ` (${t.priority})` : ""}`)
      .join("\n")

    // Real discussion context — only last 2 speakers (keeps prompt lean)
    const recentSpeeches = allSpeeches.slice(-2)
    const previousSpeeches = recentSpeeches
      .map((s, j) => `${dailyOrder[allSpeeches.length - recentSpeeches.length + j]?.name || s.agentName}: ${s.content.slice(0, 100)}`)
      .join("\n\n")
    const discussionHint = previousSpeeches
      ? `\nColegas ja falaram:\n${previousSpeeches}\n\nComente brevemente e compartilhe seu plano.`
      : ""

    const userMessage = `${agent.name}, ${isFirst ? "de bom dia e compartilhe seu plano do dia" : isLast ? "recapitule e encerre a daily" : "sua vez de falar"}. Inclua ETA. Responda em 1-2 frases curtas, primeira pessoa.`

    const prompt = `${dayContext}
${org.name} — agencia de marketing.
${myTaskLines ? `\nTarefas de ${agent.name}:\n${myTaskLines}` : ""}
${eventsText}
${discussionHint}
${previousContext || ""}

${userMessage}`

    // Notify: agent about to speak
    await prisma.agencyEvent.create({
      data: {
        organizationId,
        type: "daily_agent_speaking",
        title: `${agent.name} vai falar`,
        description: `Ordem: ${i + 1}/${dailyOrder.length}`,
        metadata: { agentId: agent.id, agentName: agent.name, order: i + 1, total: dailyOrder.length, dailyDate: new Date().toISOString().slice(0, 10) },
      },
    } as any)

    // ── Generate speech (individual call per agent) ──
    let cleaned: string
    let success = true
    try {
      const reply = await generateWithRetry(prompt, agent.name)
      cleaned = cleanAgentReply(reply)
    } catch (err) {
      console.error(`[Daily] Agent ${agent.name} failed:`, err instanceof Error ? err.message : String(err))
      cleaned = "Estou com dificuldades tecnicas. Vou me atualizar e falar depois na daily."
      success = false
    }

    // ── Display immediately after generation ──
    // Acquire turn for this agent
    releaseTurn(channelName, "system")
    const agTurn = requestTurn(channelName, agent.id, agent.name, 10)
    if (!agTurn.acquired) {
      await sleep(2000)
      const retry = requestTurn(channelName, agent.id, agent.name, 10)
      if (!retry.acquired) {
        results.push({ agent: agent.name, content: "Nao consegui falar agora. Vou me atualizar depois." })
        continue
      }
    }

    // Typing simulation
    setTypingIndicator(channelName, agent.id, agent.name)
    const typingTime = calculateTypingTime(agent.name, cleaned)
    await sleep(typingTime)

    // Save message
    await prisma.message.create({
      data: {
        content: cleaned,
        metadata: { type: "daily_speech", agentName: agent.name, dailyDate: new Date().toISOString().slice(0, 10), fallback: !success || undefined },
        agent: { connect: { id: agent.id } },
        channel: { connect: { id: channel.id } },
      },
    } as any)

    // Track per-agent participation
    if (success) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { lastDailySpokeAt: new Date() },
      })
    }

    clearTypingIndicator(channelName)
    allSpeeches.push({ agentName: agent.name, content: cleaned })
    results.push({ agent: agent.name, content: cleaned })

    // Release turn
    releaseTurn(channelName, agent.id)

    // Inter-speaker delay (human pacing)
    if (!isLast) {
      await sleep(TIMING_CONFIG.DAILY_POST_SPEECH_DELAY_MS + Math.random() * 5000)
    }
  }

  // ── Generate summary ───────────────────────────────────
  let summary: string
  try {
    const speechesText = allSpeeches
      .map(s => `${s.agentName}: ${s.content}`)
      .join("\n\n")

    const summaryReply = await chatCompletion(
      `Resuma esta daily standup preenchendo APENAS o formato abaixo. Nao analise as falas, apenas preencha.

${dayContext}

FALAS:
${speechesText || "Nenhum agente falou."}

FORMATO (preencha exatamente assim):
RESUMO:
- NOME: o que vai fazer hoje
DEPENDENCIAS:
- quem depende de quem
ALERTAS:
- problemas detectados
ACOES CEO:
- o que o CEO precisa decidir`,
      { temperature: 0.1, maxTokens: 400 },
    )
    summary = summaryReply.trim()

    // Extract content after RESUMO: marker if present  
    const resumoMatch = summary.match(/RESUMO:?\s*([\s\S]+)$/im)
    if (resumoMatch) {
      summary = resumoMatch[0].trim()
    }
    // If still has meta-text, filter paragraphs
    summary = summary
      .replace(/^(O usu[áa]rio quer[^.!?\n]*[.!?\n])\s*/gi, "")
      .replace(/^The user wants[^.!?\n]*[.!?\n]\s*/gi, "")
      .trim() || summary
  } catch {
    summary = "Resumo indisponivel no momento."
  }

  // Post summary with typing simulation
  setTypingIndicator(channelName, "system", "Sistema")
  const summaryTypingTime = calculateTypingTime("Sistema", summary)
  await sleep(summaryTypingTime)

  await prisma.message.create({
    data: {
      content: summary,
      metadata: { type: "daily_summary", dailyDate: new Date().toISOString().slice(0, 10), agentCount: results.length },
      channel: { connect: { id: channel.id } },
    },
  } as any)
  clearTypingIndicator(channelName)

  // ── Reset agents (stay IN_MEETING until all done, then ACTIVE) ──
  for (const a of org.agents) {
    await prisma.agent.update({
      where: { id: a.id },
      data: { status: "ACTIVE", workState: "IDLE" },
    })

    // Bridge exit events
    if (process.env.ENABLE_PIXEL_BRIDGE) {
      try {
        const fs = await import("fs")
        const fp = `${process.env.HOME || "/Users/gustavo"}/.pixel-agents/sessions/synkra-${a.id}.jsonl`
        if (fs.existsSync(fp)) {
          fs.appendFileSync(
            fp,
            JSON.stringify({
              type: "assistant",
              message: {
                content: [
                  {
                    type: "text",
                    text: `${a.name} voltou da daily e esta comecando a trabalhar.`,
                  },
                ],
              },
            }) + "\n",
            "utf-8",
          )
        }
      } catch {}
    }
  }

  // Release system lock
  releaseTurn(channelName, "system")

  // ── Extract tasks from speeches ────────────────────────
  const tasksExtracted = await extractTasksFromSpeeches(
    organizationId,
    allSpeeches,
    org.agents.map(a => ({ id: a.id, name: a.name })),
  )

  // ── Agency event ───────────────────────────────────────
  await prisma.agencyEvent.create({
    data: {
      organizationId,
      type: "daily_completed",
      title: `Daily concluida — ${results.length} agentes`,
      description: results
        .map(r => `${r.agent}: ${r.content.slice(0, 60)}`)
        .join(" | "),
    },
  } as any)

  // ── Mark daily completed ──────────────────────────────
  await prisma.officeSettings.update({
    where: { organizationId },
    data: { lastDailyAt: new Date() },
  })

  // ── Track daily metrics ────────────────────────────────
  const fallbackCount = results.filter(r =>
    r.content.includes("dificuldades tecnicas"),
  ).length
  const hadAlerts = summary.includes("ALERTA") || summary.includes("⚠️")
  const hadConflicts = false // Conflicts are tracked as agency events

  await prisma.dailyMetrics.create({
    data: {
      organizationId,
      date: new Date(),
      agentCount: results.length,
      speechCount: allSpeeches.length,
      tasksExtracted,
      status: "completed",
      hadAlerts,
      hadConflicts,
      agentFallbacks: fallbackCount,
      durationMs: Date.now() - new Date(settings?.lastDailyAt || Date.now()).getTime(),
    },
  } as any)

  return { agents: results.length, results, summary, tasksExtracted }
}
