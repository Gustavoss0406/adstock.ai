/**
 * ── AGENT EXECUTION PIPELINE ──────────────────────────────
 *
 * 5 pillars for making AI agents ACTUALLY work:
 * 1. Ultra-specific prompts with rich context injection
 * 2. Forced JSON output with validation + retry (3 attempts)
 * 3. Rich context — per-agent data before every AI call
 * 4. Task pipelines — break complex tasks into sub-steps
 * 5. Tools — give agents real data access
 */

import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"
import { loadAgentTemplate } from "@/lib/agents/templates/loader"
import { buildCompanyContext } from "@/lib/autonomous/context"
import { analyzeApprovalPatterns } from "@/lib/autonomous/learning"

// ── TOOLS: Real data access ────────────────────────────────
interface AgentTools {
  getCalendar: () => Promise<Array<{ name: string; daysUntil: number }>>
  getApprovalHistory: () => Promise<{ approved: string[]; rejected: string[]; rate: number }>
  getRecentPerformance: () => Promise<{ best: { type: string; why: string } | null; worst: { type: string; why: string } | null }>
  getBrandKit: () => Promise<{ primaryColor: string | null; brandVoice: string | null; audience: string | null; industry: string | null }>
  getActiveTasks: () => Promise<Array<{ title: string; status: string; assignedTo: string }>>
  getCompanyInfo: () => Promise<{ name: string; industry: string | undefined }>
}

export async function getAgentTools(organizationId: string): Promise<AgentTools> {
  const ctx = await buildCompanyContext(organizationId)
  const patterns = await analyzeApprovalPatterns(organizationId)
  const onboarding = await prisma.onboarding.findUnique({ where: { organizationId } })
  const org = await prisma.organization.findUnique({ where: { id: organizationId } })

  return {
    getCalendar: async () => ctx.upcomingDates || [],
    getApprovalHistory: async () => ({
      approved: [],
      rejected: (patterns.commonRejects || []).slice(0, 5),
      rate: patterns.approvalRate,
    }),
    getRecentPerformance: async () => {
      const tasks = await prisma.task.findMany({
        where: { organizationId, status: "DONE", completedAt: { not: null } },
        orderBy: { completedAt: "desc" }, take: 20, select: { title: true, type: true },
      })
      if (tasks.length === 0) return { best: null, worst: null }
      const contentTasks = tasks.filter(t => t.type === "content")
      return {
        best: contentTasks[0] ? { type: contentTasks[0].title, why: "Tarefa concluída recentemente" } : null,
        worst: null,
      }
    },
    getBrandKit: async () => ({
      primaryColor: null,
      brandVoice: onboarding?.brandVoice || null,
      audience: onboarding?.targetAudience || null,
      industry: onboarding?.industry || null,
    }),
    getActiveTasks: async () => {
      const tasks = await prisma.task.findMany({
        where: { organizationId, status: { in: ["TODO", "IN_PROGRESS"] } },
        include: { assignee: { select: { name: true } } },
        take: 10,
      })
      return tasks.map(t => ({ title: t.title, status: t.status, assignedTo: t.assignee?.name || "nao atribuido" }))
    },
    getCompanyInfo: async () => ({ name: org?.name || "Agencia", industry: onboarding?.industry }),
  }
}

// ── PILLAR 1: Ultra-specific prompt builder ────────────────
export interface TaskExecutionInput {
  organizationId: string
  agentId: string
  agentName: string
  taskTitle: string
  taskDescription?: string
  taskType: "create_calendar" | "create_copy" | "create_carousel" | "analyze_metrics" | "create_blog_post" | "research_keywords" | "optimize_seo" | "schedule_post" | "create_daily_plan" | "generic"
}

interface ExecutionContext {
  tools: AgentTools
  agentTemplate: string
  company: { name: string; industry: string | undefined }
  approvalHistory: { approved: string[]; rejected: string[]; rate: number }
  calendar: Array<{ name: string; daysUntil: number }>
  brandKit: { voice: string | null; audience: string | null }
  activeTasks: Array<{ title: string; status: string; assignedTo: string }>
  performance: { best: { type: string; why: string } | null; worst: { type: string; why: string } | null }
}

export async function buildExecutionContext(input: TaskExecutionInput): Promise<ExecutionContext> {
  const tools = await getAgentTools(input.organizationId)
  const template = loadAgentTemplate(input.agentName)
  const [company, approval, calendar, brand, tasks, perf] = await Promise.all([
    tools.getCompanyInfo(),
    tools.getApprovalHistory(),
    tools.getCalendar(),
    tools.getBrandKit(),
    tools.getActiveTasks(),
    tools.getRecentPerformance(),
  ])

  return { tools, agentTemplate: template, company, approvalHistory: approval, calendar, brandKit: { voice: brand.voice, audience: brand.audience }, activeTasks: tasks, performance: perf }
}

function buildSpecificPrompt(task: TaskExecutionInput, ctx: ExecutionContext): { systemPrompt: string; userPrompt: string; outputSchema: string } {
  const identity = ctx.agentTemplate.slice(0, 400)

  const systemPrompt = `${identity}

Voce e ${task.agentName}. Voce tem acesso a ferramentas e dados reais da empresa.

REGRAS ABSOLUTAS:
1. RETORNE APENAS JSON valido. Nao adicione explicacoes, markdown, ou texto antes/depois.
2. Comece com { e termine com }.
3. Cada campo deve ser preenchido com dados ESPECIFICOS, nunca genericos.
4. Use os dados de contexto fornecidos — nao invente.

DADOS DISPONIVEIS (use-os):
- Empresa: ${ctx.company.name}, setor ${ctx.company.industry || "marketing"}
- Voz da marca: ${ctx.brandKit.voice || "profissional"}
- Publico: ${ctx.brandKit.audience || "geral"}
- Tarefas ativas: ${ctx.activeTasks.length} (${ctx.activeTasks.slice(0, 3).map(t => t.title).join(", ")})
- Calendario: ${ctx.calendar.map(c => `${c.name} em ${c.daysUntil}d`).join(", ") || "sem eventos"}
- Aprovacoes do CEO: taxa ${Math.round(ctx.approvalHistory.rate * 100)}%`

  const userPrompt = `TAREFA: ${task.taskTitle}
${task.taskDescription ? `DESCRICAO: ${task.taskDescription}` : ""}

${ctx.performance.best ? `MELHOR PERFORMANCE RECENTE: ${ctx.performance.best.type} — ${ctx.performance.best.why}` : ""}
${ctx.approvalHistory.rejected.length > 0 ? `EVITE (CEO rejeitou): ${ctx.approvalHistory.rejected.slice(0, 3).join(" | ")}` : ""}`

  const { outputSchema } = getTaskSchema(task.taskType)
  return { systemPrompt, userPrompt, outputSchema }
}

// ── PILLAR 2: Forced JSON + validation + retry ─────────────
function getTaskSchema(taskType: string): { outputSchema: string; validator: (data: any) => string | null } {
  const schemas: Record<string, { schema: string; validate: (d: any) => string | null }> = {
    create_calendar: {
      schema: `{"week":"dd/mm a dd/mm","posts":[{"date":"YYYY-MM-DD","platform":"instagram|linkedin","type":"reel|feed|carrossel","theme":"titulo","objective":"engajar|educar|vender","copyBrief":"80-150 palavras","visualBrief":"60-120 palavras","assignTo":"carlos|bruno|lena|diego","priority":"high|medium|low","reasoning":"30-60 palavras"}],"weekStrategy":"2-3 frases"}`,
      validate: (d: any) => {
        if (!d.posts || d.posts.length < 2) return "Precisa de pelo menos 2 posts"
        for (const p of d.posts) {
          if (!p.copyBrief || p.copyBrief.length < 30) return `copyBrief muito curto em "${p.theme}"`
          if (!p.visualBrief || p.visualBrief.length < 20) return `visualBrief muito curto em "${p.theme}"`
        }
        return null
      },
    },
    create_copy: {
      schema: `{"variants":[{"name":"Variação A - Emocional","copy":"texto da copy","tone":"emocional|direto|interativo","expectedEngagement":"alto|medio|baixo"}],"recommendation":"recomendo X porque..."}`,
      validate: (d: any) => {
        if (!d.variants || d.variants.length < 2) return "Precisa de pelo menos 2 variacoes"
        for (const v of d.variants) {
          if (!v.copy || v.copy.length < 30) return `copy muito curta em "${v.name}"`
        }
        return null
      },
    },
    create_carousel: {
      schema: `{"totalSlides":7,"theme":"tema","brandColors":{"primary":"#hex","light":"#hex","dark":"#hex"},"slides":[{"number":1,"type":"hero|problem|solution|feature|detail|howto|cta","background":"light|dark|gradient","content":"titulo e descricao","hasArrow":true}],"notes":"notas de design"}`,
      validate: (d: any) => {
        if (!d.slides || d.slides.length < 5) return "Precisa de pelo menos 5 slides"
        if (!d.brandColors?.primary) return "brandColors.primary obrigatorio"
        return null
      },
    },
    analyze_metrics: {
      schema: `{"summary":{"status":"crescimento|estavel|declinio","highlight":"destaque","concern":"preocupacao"},"recommendations":[{"priority":"high|medium|low","action":"o que fazer","reasoning":"por que","expectedImpact":"resultado esperado"}],"alerts":[{"type":"warning|critical|success","message":"texto do alerta"}]}`,
      validate: (d: any) => {
        if (!d.recommendations || d.recommendations.length < 1) return "Precisa de pelo menos 1 recomendacao"
        if (!d.summary?.status) return "summary.status obrigatorio"
        return null
      },
    },
    create_blog_post: {
      schema: `{"title":"titulo SEO","slug":"url-amigavel","metaDescription":"155 caracteres","wordCount":0,"content":"markdown completo","seoChecklist":{"titleHasKeyword":true,"hasMetaDescription":true,"internalLinks":3}}`,
      validate: (d: any) => {
        if (!d.content || d.content.length < 200) return "Conteudo muito curto (< 200 caracteres)"
        if (!d.title || d.title.length < 10) return "Titulo ausente ou curto"
        return null
      },
    },
    research_keywords: {
      schema: `{"priorityKeywords":[{"keyword":"palavra","volume":0,"difficulty":"low|medium|high","priority":1,"action":"o que fazer","eta":"prazo"}],"totalOpportunities":0}`,
      validate: (d: any) => {
        if (!d.priorityKeywords || d.priorityKeywords.length < 1) return "Precisa de pelo menos 1 keyword"
        return null
      },
    },
    optimize_seo: {
      schema: `{"page":"url","targetKeyword":"keyword","optimizations":[{"element":"title_tag|meta_description|h1|url|internal_links|images","current":"atual","optimized":"otimizado","reason":"por que"}],"estimatedImpact":"resultado esperado"}`,
      validate: (d: any) => {
        if (!d.optimizations || d.optimizations.length < 1) return "Precisa de pelo menos 1 otimizacao"
        return null
      },
    },
  }

  const task = schemas[taskType] || {
    schema: "{}",
    validate: () => null,
  }

  return { outputSchema: task.schema, validator: task.validate }
}

// ── Execute with retry ─────────────────────────────────────
export async function executeWithRetry(
  taskInput: TaskExecutionInput,
): Promise<{ success: boolean; output: any; attempts: number; error?: string }> {
  const ctx = await buildExecutionContext(taskInput)
  const { systemPrompt, userPrompt, outputSchema } = buildSpecificPrompt(taskInput, ctx)
  const { validator } = getTaskSchema(taskInput.taskType)

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nFORMATO DE SAIDA OBRIGATORIO (JSON):\n${outputSchema}\n\nREGRAS:\n- RETORNE APENAS o JSON, sem explicacoes\n- Nao use markdown (\`\`\`json)\n- Comece com { e termine com }`

  let result: any = null
  let errorMsg = ""

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const rawReply = await chatCompletion(fullPrompt, { temperature: 0.7, maxTokens: 2000 })
      const jsonMatch = rawReply.match(/[\{].*[\}]/s)
      if (!jsonMatch) {
        errorMsg = `Tentativa ${attempt}: sem JSON na resposta`
        fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nERRO NA TENTATIVA ANTERIOR: ${errorMsg}. RETORNE APENAS JSON VALIDO. Comece com { e termine com }.`
        continue
      }

      result = JSON.parse(jsonMatch[0])
      const validationError = validator(result)
      if (validationError) {
        errorMsg = `Tentativa ${attempt}: ${validationError}`
        fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nERRO NA TENTATIVA ANTERIOR: ${validationError}. Corrija e retorne JSON valido seguindo o schema: ${outputSchema}`
        result = null
        continue
      }

      return { success: true, output: result, attempts: attempt }
    } catch (e: any) {
      errorMsg = `Tentativa ${attempt}: ${e.message?.slice(0, 100) || "erro desconhecido"}`
      fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nERRO NA TENTATIVA ANTERIOR: ${errorMsg}. Retorne JSON valido.`
    }
  }

  return { success: false, output: null, attempts: 3, error: errorMsg }
}

// ── PILLAR 4: Task pipeline — break complex tasks ──────────
export async function executeCalendarPipeline(organizationId: string, agentId: string, agentName: string): Promise<{ created: number; posts: any[] }> {
  const result = await executeWithRetry({
    organizationId, agentId, agentName,
    taskTitle: "Criar calendario editorial da proxima semana",
    taskDescription: "Planejar posts para a semana incluindo datas comemorativas e baseado em performance recente",
    taskType: "create_calendar",
  })

  if (!result.success || !result.output) return { created: 0, posts: [] }

  let created = 0
  for (const post of result.output.posts || []) {
    const agent = await prisma.agent.findFirst({
      where: { organizationId, name: { contains: post.assignTo || "" }, status: { not: "FIRED" } },
    })

    await prisma.task.create({
      data: {
        organizationId,
        title: post.theme || "Post da semana",
        description: `Copy: ${post.copyBrief || ""}\nVisual: ${post.visualBrief || ""}\nReasoning: ${post.reasoning || ""}`,
        type: "content",
        priority: post.priority || "MEDIUM",
        status: "TODO",
        assignedTo: agent?.id || null,
        dueDate: post.date ? new Date(post.date) : null,
        estimatedMinutes: post.type === "carrossel" ? 120 : 60,
      },
    } as any)
    created++
  }

  // Post summary to chat
  const channel = await prisma.channel.findFirst({ where: { organizationId, name: "geral" } })
  if (channel) {
    await prisma.message.create({
      data: {
        content: `📅 Calendario da semana criado! ${created} posts planejados.\n\n${(result.output.posts || []).map((p: any) => `• ${p.date || "?"}: ${p.theme} (${p.platform || "instagram"})`).join("\n")}\n\nEstrategia: ${result.output.weekStrategy || "Foco em engajamento e relevancia."}`,
        metadata: { type: "calendar_created", posts: result.output.posts },
        agentId,
        channelId: channel.id,
      },
    } as any)
  }

  return { created, posts: result.output.posts || [] }
}

export async function executeCopyPipeline(organizationId: string, agentId: string, agentName: string, brief: string): Promise<{ variants: any[] } | null> {
  const result = await executeWithRetry({
    organizationId, agentId, agentName,
    taskTitle: brief,
    taskDescription: "Criar 3 variacoes de copy: emocional, direta, interativa",
    taskType: "create_copy",
  })

  if (!result.success) return null

  // Post to #aprovacoes
  let channel = await prisma.channel.findFirst({ where: { organizationId, name: "aprovacoes" } })
  if (!channel) channel = await prisma.channel.create({ data: { organizationId, name: "aprovacoes" } })

  const variants = result.output.variants || []
  const content = `${agentName} criou copies para: "${brief}"\n\n${variants.map((v: any) => `**${v.name}**\n${v.copy}\n_Tom: ${v.tone}_`).join("\n\n---\n\n")}\n\nRecomendacao: ${result.output.recommendation || "CEO, escolha a que preferir."}`

  await prisma.message.create({
    data: { content, metadata: { type: "copy_ready", needsApproval: true, output: result.output }, agentId, channelId: channel.id },
  } as any)

  return { variants }
}

export async function executeCarouselPipeline(organizationId: string, agentId: string, agentName: string, theme: string): Promise<any | null> {
  const result = await executeWithRetry({
    organizationId, agentId, agentName,
    taskTitle: theme,
    taskDescription: "Criar carrossel Instagram 7 slides com estrutura Hero→Problem→Solution→Features→Details→HowTo→CTA",
    taskType: "create_carousel",
  })

  if (!result.success) return null

  // Post preview
  let channel = await prisma.channel.findFirst({ where: { organizationId, name: "aprovacoes" } })
  if (!channel) channel = await prisma.channel.create({ data: { organizationId, name: "aprovacoes" } })

  const slides = result.output.slides || []
  await prisma.message.create({
    data: {
      content: `${agentName} criou carrossel: "${result.output.theme || theme}"\n\n${slides.map((s: any) => `Slide ${s.number}: ${s.type} — ${s.content?.slice(0, 80)}`).join("\n")}\n\nTotal: ${result.output.totalSlides || slides.length} slides`,
      metadata: { type: "carousel_ready", needsApproval: true, output: result.output },
      agentId, channelId: channel.id,
    },
  } as any)

  return result.output
}
