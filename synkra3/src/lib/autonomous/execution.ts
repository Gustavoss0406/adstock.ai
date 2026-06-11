/**
 * ── TASK-SPECIFIC PROMPTS + OUTPUT VALIDATORS ──────────────
 * Cada tipo de tarefa tem seu prompt estruturado e validador.
 */
import { buildCompanyContext, CompanyContext } from "@/lib/autonomous/context"

export interface TaskContext {
  companyId: string
  company: { name: string; industry?: string; brandVoice?: string; brandColor?: string; audience?: string; goals?: string[] }
  approvalHistory: { approved: string[]; rejected: string[]; approvalRate: number }
  metrics?: { instagram?: any; gsc?: any }
  calendar: { dayName: string; today: string; upcomingDates: string }
}

export type TaskType = "create_copy" | "create_carousel" | "analyze_metrics" | "create_blog_post" | "research_keywords" | "create_daily_plan" | "optimize_seo" | "generic"

export function buildTaskPrompt(type: TaskType, description: string, ctx: TaskContext): string {
  const base = `CONTEXTO DA EMPRESA:
Nome: ${ctx.company.name}
Setor: ${ctx.company.industry || "marketing"}
Tom da marca: ${ctx.company.brandVoice || "profissional"}
Publico: ${ctx.company.audience || "geral"}

HISTORICO DE APROVACOES (CEO):`

  const approvals = ctx.approvalHistory.approved.length > 0
    ? `\n✅ Aprovado: ${ctx.approvalHistory.approved.slice(0, 3).join(" | ")}`
    : ""
  const rejections = ctx.approvalHistory.rejected.length > 0
    ? `\n❌ Rejeitado: ${ctx.approvalHistory.rejected.slice(0, 3).join(" | ")}`
    : ""
  const approvalInfo = approvals + rejections

  const prompts: Record<TaskType, string> = {
    create_copy: `${base}${approvalInfo}

TAREFA: Criar copy para "${description}"

CRIE 3 VARIACOES de copy. Sempre:
- Variacao A: Mais emocional/storytelling
- Variacao B: Mais direta/objetiva  
- Variacao C: Mais perguntadora/interativa

APRENDA COM AS REJEICOES: Evite estilos que foram rejeitados.
USE O QUE FOI APROVADO: Siga o tom que o CEO gostou.

Retorne JSON:
{"variants":[{"name":"Variação A - Emocional","copy":"texto","tone":"emocional","expectedEngagement":"alto"}],"recommendation":"Recomendo X porque..."}`,

    create_carousel: `${base}${approvalInfo}

TAREFA: Criar carrossel Instagram sobre "${description}"

Use cores da marca: ${ctx.company.brandColor || "#6366F1"}.
Siga estrutura padrao de 7 slides: Hero, Problema, Solucao, Features, Detalhes, Como fazer, CTA.
Alterne backgrounds light/dark. Inclua barra de progresso e setas.

Retorne JSON:
{"totalSlides":7,"slides":[{"number":1,"type":"hero","hook":"...","background":"LIGHT_BG"}],"brandColors":{"primary":"...","light":"...","dark":"..."},"notes":"..."}`,

    analyze_metrics: `${base}${approvalInfo}

TAREFA: Analisar metricas de "${description}"

DADOS DISPONIVEIS:
${JSON.stringify(ctx.metrics || {}, null, 2)}

Analise crescimento, engajamento, top performers, worst performers.
Compare com periodo anterior. Identifique padroes.
Faca recomendacoes acionaveis com impacto esperado.

Retorne JSON:
{"summary":{"status":"crescimento","highlight":"...","concern":"..."},"instagram":{"followers":{"current":0,"growth":"0"},"engagement":{"rate":0,"trend":"stable"}},"recommendations":[{"priority":"high","action":"...","reasoning":"...","expectedImpact":"..."}],"alerts":[]}`,

    create_blog_post: `${base}${approvalInfo}

TAREFA: Criar blog post otimizado para "${description}"

Estrutura: H1 com keyword, Introducao, 3-5 H2 com variacoes, FAQ, Conclusao.
Target: 2000+ palavras, 3-5 imagens, 3-5 links internos, 1-2 links externos.
Otimizar title tag, meta description, URL.

Retorne JSON:
{"title":"...","slug":"...","metaDescription":"...","wordCount":0,"content":"...","seoChecklist":{"titleHasKeyword":true,"hasMetaDescription":true}}`,

    research_keywords: `${base}

TAREFA: Pesquisar palavras-chave para "${description}"

Foco em long-tail keywords com baixa dificuldade e volume decente.
Priorize: 1. Long-tail facil (vitorias rapidas) 2. Medio prazo 3. Head terms.

Retorne JSON:
{"priorityKeywords":[{"keyword":"...","volume":0,"difficulty":"low","priority":1,"action":"...","eta":"..."}],"totalOpportunities":0,"estimatedTraffic":"..."}`,

    create_daily_plan: `${base}

TAREFA: Criar plano de trabalho para hoje.
${ctx.calendar.dayName}, ${ctx.calendar.today}.
Eventos proximos: ${ctx.calendar.upcomingDates}.

Defina 3-5 prioridades do dia. Distribua 1 tarefa por agente.
Considere datas comemorativas e carga de trabalho.

Retorne JSON:
{"dailyMessage":"...","priorities":["..."],"tasks":[{"title":"...","assignedTo":"...","priority":"high","estimatedTime":"2h"}],"alerts":["..."]}`,

    optimize_seo: `${base}

TAREFA: Otimizar SEO de "${description}"

Checklist: title tag, meta description, H1, URL, internal links, images alt text, content length.
Identifique gaps e otimizacoes necessarias.
DADOS DISPONIVEIS: Apenas scraper do site (SEO score, meta tags, headings, tech stack).
GSC e Analytics NAO sao consultados.

Retorne JSON:
{"page":"...","targetKeyword":"...","optimizations":[{"element":"title_tag","current":"...","optimized":"...","reason":"..."}],"estimatedImpact":"..."}`,

    generic: `Tarefa: ${description}. Contexto: ${JSON.stringify(ctx)}. Execute a tarefa e retorne resultado.`,
  }

  return prompts[type] || prompts.generic
}

/**
 * Validate and parse the AI output for each task type.
 * Returns parsed JSON or throws if invalid.
 */
export function validateTaskOutput(type: TaskType, rawOutput: string): any {
  const jsonMatch = rawOutput.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No JSON found in output")

  const parsed = JSON.parse(jsonMatch[0])

  const validators: Record<TaskType, (d: any) => boolean> = {
    create_copy: (d: any) => Array.isArray(d?.variants) && d.variants.length >= 2 && d.variants[0]?.copy?.length > 10,
    create_carousel: (d: any) => d?.totalSlides >= 5 && Array.isArray(d?.slides) && d.slides.length >= 3,
    analyze_metrics: (d: any) => d?.summary?.status && Array.isArray(d?.recommendations),
    create_blog_post: (d: any) => d?.title?.length > 10 && d?.content?.length > 200,
    research_keywords: (d: any) => Array.isArray(d?.priorityKeywords) && d.priorityKeywords.length > 0,
    create_daily_plan: (d: any) => Array.isArray(d?.tasks) && d.tasks.length > 0,
    optimize_seo: (d: any) => Array.isArray(d?.optimizations) && d.optimizations.length > 0,
    generic: () => true,
  }

  const validator = validators[type] || validators.generic
  if (!validator(parsed)) throw new Error(`Invalid output format for task type: ${type}`)

  return parsed
}
