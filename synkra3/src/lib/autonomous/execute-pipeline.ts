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

export async function getAgentTools(organizationId: string, agentRole?: string): Promise<AgentTools> {
  const ctx = await buildCompanyContext(organizationId)
  const patterns = await analyzeApprovalPatterns(organizationId)
  const onboarding = await prisma.onboarding.findUnique({ where: { organizationId } })
  const org = await prisma.organization.findUnique({ where: { id: organizationId } })

  return {
    getCalendar: async () => ctx.upcomingDates || [],
    getApprovalHistory: async () => {
      // Get real approval messages from DB (last 20 content_completed or approved messages)
      const events = await prisma.agencyEvent.findMany({
        where: { organizationId, type: { in: ["content_approved", "content_rejected"] } },
        orderBy: { createdAt: "desc" }, take: 20, select: { type: true, description: true, metadata: true },
      })
      const approved = events.filter(e => e.type === "content_approved").map(e => e.description || "")
      const rejected = events.filter(e => e.type === "content_rejected").map(e => e.description || "")
      return { approved: approved.slice(0, 5), rejected: rejected.length > 0 ? rejected.slice(0, 5) : (patterns.commonRejects || []).slice(0, 5), rate: patterns.approvalRate }
    },
    getRecentPerformance: async () => {
      const tasks = await prisma.task.findMany({
        where: { organizationId, status: "DONE", completedAt: { not: null } },
        orderBy: { completedAt: "desc" }, take: 20, select: { title: true, type: true, output: true },
      })
      if (tasks.length === 0) return { best: null, worst: null }
      const contentTasks = tasks.filter(t => t.type === "content" || t.type === "campaign")
      const analysisTasks = tasks.filter(t => t.type === "analysis")
      return {
        best: contentTasks[0] ? { type: contentTasks[0].title, why: "Conteudo concluido recentemente com output registrado" } : analysisTasks[0] ? { type: analysisTasks[0].title, why: "Analise concluida recentemente" } : null,
        worst: contentTasks.length > 3 ? { type: contentTasks[contentTasks.length - 1].title, why: "Ultimo concluido da lista" } : null,
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
  const taskRules = getTaskRules(task.taskType, ctx)

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\n${taskRules}\n\nFORMATO DE SAIDA OBRIGATORIO (JSON):\n${outputSchema}\n\nRETORNE APENAS o JSON, sem explicacoes, sem markdown. Comece com { e termine com }`

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

// ── Task-specific rules injection ───────────────────────────
function getTaskRules(taskType: string, ctx: ExecutionContext): string {
  const rules: Record<string, string> = {
    create_calendar: `REGRAS DA TAREFA:
- Incluir OBRIGATORIAMENTE posts para datas comemorativas: ${ctx.calendar.map(c => `${c.name} em ${c.daysUntil}d`).join(", ") || "nenhuma"}.
- Priorizar formatos que performaram melhor.
- Copies devem ter max 200 caracteres.
- Cada post precisa do campo "reasoning" explicando a escolha do dia/formato.`,
    create_copy: `REGRAS DA TAREFA:
- Criar EXATAMENTE 3 variacoes: A (emocional), B (direta), C (interativa).
- Copies devem ter max 200 caracteres.
- Tom de voz: ${ctx.brandKit.voice || "profissional"}.
- EVITE estilos rejeitados: ${ctx.approvalHistory.rejected.slice(0, 3).join(" | ") || "nenhum historico"}.`,
    create_carousel: `REGRAS DA TAREFA:
- EXATAMENTE 7 slides: Hero → Problem → Solution → Features → Details → HowTo → CTA.
- Slide 1 DEVE ser hook que para o scroll.
- Ultimo slide DEVE ter CTA, SEM seta de swipe.
- Alternar backgrounds light/dark.
- Cores derivadas da primaria (light + dark).`,
    analyze_metrics: `REGRAS DA TAREFA:
- Identificar 1-3 recomendacoes acionaveis com prioridade.
- Incluir highlight positivo E concern negativo.
- Comparar sempre com periodo anterior.`,
    create_blog_post: `REGRAS DA TAREFA:
- Minimo 2000 palavras.
- H1 com keyword exata.
- 3-5 H2, 8-12 H3.
- Meta description max 155 caracteres.
- 3-5 links internos.`,
    research_keywords: `REGRAS DA TAREFA:
- Priorizar long-tail com baixa dificuldade.
- Listar pelo menos 3 keywords com volume estimado.
- Incluir acao sugerida para cada keyword.`,
    optimize_seo: `REGRAS DA TAREFA:
- Verificar: title tag, meta description, H1, URL, internal links, images alt.
- Para cada elemento, mostrar "atual" e "otimizado".
- Explicar o motivo da otimizacao.`,
  }
  return rules[taskType] || "Execute a tarefa seguindo as melhores praticas da sua especialidade."
}

// ── PILLAR 4: Task pipeline — break complex tasks ──────────
export async function executeCalendarPipeline(organizationId: string, agentId: string, agentName: string): Promise<{ created: number; posts: any[] }> {
  // Try AI pipeline first
  let result = null
  try {
    result = await executeWithRetry({
      organizationId, agentId, agentName,
      taskTitle: "Criar calendario editorial da proxima semana",
      taskDescription: "Planejar posts para a semana incluindo datas comemorativas e baseado em performance recente",
      taskType: "create_calendar",
    })
  } catch {}

  // Fallback: create tasks directly without AI if pipeline fails or returns no posts
  if (!result?.success || !result?.output?.posts || result.output.posts.length < 1) {
    const ctx = await (await import("./context")).buildCompanyContext(organizationId)
    const agents = await prisma.agent.findMany({ where: { organizationId, status: { not: "FIRED" } }, select: { id: true, name: true, role: true } })

    // Generate generic calendar from template
    const days = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta"]
    const themes = ["Post motivacional", "Dica pratica", "Bastidores", "Depoimento de cliente", "Pergunta interativa"]
    const roles = { DESIGNER: null, ANALYST: null, SOCIAL_MEDIA: null, SEO: null, STRATEGIST: null }
    for (const a of agents) { if (a.role in roles) (roles as any)[a.role] = a }

    const weekRange = `${new Date().toISOString().slice(5,10).replace("-","/")} a ${new Date(Date.now()+7*86400000).toISOString().slice(5,10).replace("-","/")}`
    const posts = []
    let assigned: any[] = [roles.DESIGNER, roles.DESIGNER, roles.ANALYST, roles.SOCIAL_MEDIA].filter(Boolean)
    if (assigned.length === 0) assigned = agents.slice(0, 4)

    for (let i = 0; i < Math.min(4, assigned.length); i++) {
      const assignee = assigned[i]
      if (!assignee) continue
      posts.push({
        date: new Date(Date.now() + (i+1)*86400000).toISOString().slice(0,10),
        platform: "instagram",
        type: i === 2 ? "carrossel" : "reel",
        theme: themes[i] || `Post da semana`,
        objective: i === 0 ? "engajar" : i === 2 ? "educar" : "vender",
        copyBrief: `Copy de 100 caracteres sobre ${themes[i]} com tom profissional.`,
        visualBrief: `Arte limpa com cores da marca, texto centralizado.`,
        assignTo: assignee.name || agents[0].name,
        priority: i === 1 ? "HIGH" : "MEDIUM",
        reasoning: `${days[i] || `Dia ${i+1}`}: ${i === 0 ? "Comeco da semana" : i === 2 ? "Conteudo educativo" : "Engajamento"}`,
      })
    }

    return await createTasksFromPosts(organizationId, agentId, { week: weekRange, posts, weekStrategy: "Foco em engajamento e relevancia." })
  }

  return await createTasksFromPosts(organizationId, agentId, result.output)
}

async function createTasksFromPosts(organizationId: string, agentId: string, output: any): Promise<{ created: number; posts: any[] }> {
  let created = 0
  for (const post of output.posts || []) {
    const agent = await prisma.agent.findFirst({
      where: { organizationId, name: { contains: post.assignTo || "" }, status: { not: "FIRED" } },
    })
    await prisma.task.create({
      data: {
        organizationId, title: post.theme || "Post da semana",
        description: `Copy: ${post.copyBrief || ""}\nVisual: ${post.visualBrief || ""}\nReasoning: ${post.reasoning || ""}`,
        type: "content", priority: post.priority || "MEDIUM", status: "TODO",
        assignedTo: agent?.id || null,
        dueDate: post.date ? new Date(post.date) : null,
        estimatedMinutes: post.type === "carrossel" ? 120 : 60,
      },
    } as any)
    created++
  }

  // Post + notify
  const channel = await prisma.channel.findFirst({ where: { organizationId, name: "geral" } })
  if (channel) {
    await prisma.message.create({
      data: {
        content: `📅 Calendario criado! ${created} posts.\n\n${(output.posts || []).map((p: any) => `• ${p.date || "?"}: ${p.theme} → ${p.assignTo || "?"}`).join("\n")}\n\nEstrategia: ${output.weekStrategy || "Foco em engajamento."}`,
        metadata: { type: "calendar_created" }, agentId, channelId: channel.id,
      },
    } as any)
  }
  return { created, posts: output.posts || [] }
}

  // Post summary to chat + notify assigned agents
  const channel = await prisma.channel.findFirst({ where: { organizationId, name: "geral" } })
  if (channel) {
    await prisma.message.create({
      data: {
        content: `📅 Calendario criado! ${created} posts planejados.\n\n${(result.output.posts || []).map((p: any) => `• ${p.date || "?"}: ${p.theme} → ${p.assignTo || "?"}`).join("\n")}\n\nEstrategia: ${result.output.weekStrategy || "Foco em engajamento."}`,
        metadata: { type: "calendar_created", posts: result.output.posts },
        agentId,
        channelId: channel.id,
      },
    } as any)

    // Notify each assigned agent
    const assignedAgentIds = [...new Set((result.output.posts || []).map((p: any) => p.assignTo))]
    for (const name of assignedAgentIds) {
      const ag = await prisma.agent.findFirst({
        where: { organizationId, name: { contains: name || "" }, status: { not: "FIRED" } },
      })
      if (ag && ag.id !== agentId) {
        const count = (result.output.posts || []).filter((p: any) => p.assignTo === name).length
        await prisma.message.create({
          data: {
            content: `@${name.split(" ")[0]}, voce tem ${count} nova(s) tarefa(s) no Kanban! Da uma olhada.`,
            metadata: { type: "task_assigned", agentAssigned: ag.id, count },
            agentId,
            channelId: channel.id,
          },
        } as any)
      }
    }
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
