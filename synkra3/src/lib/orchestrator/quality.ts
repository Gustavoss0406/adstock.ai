/**
 * ── TASK QUALITY VALIDATOR ──────────────────────────────────
 *
 * Avalia a qualidade das tasks criadas e reporta métricas.
 * Garante que cards não são genéricos, duplicados ou inacionáveis.
 *
 * Critérios de qualidade (0-100):
 * - Especificidade (40 pts): título é específico e acionável
 * - Completude (30 pts): tem type, priority, estimatedMinutes, assignee
 * - Originalidade (20 pts): não é duplicata de tasks existentes
 * - Acionabilidade (10 pts): o agente designado pode executar (role match)
 */

import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"

export interface TaskQualityScore {
  taskId: string
  title: string
  score: number // 0-100
  specificity: number // 0-40
  completeness: number // 0-30
  originality: number // 0-20
  actionability: number // 0-10
  issues: string[]
  needsImprovement: boolean
}

/**
 * Avalia a qualidade de uma task específica.
 */
export async function scoreTaskQuality(taskId: string): Promise<TaskQualityScore> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignee: { select: { id: true, name: true, role: true } } },
  })

  if (!task) throw new Error("Task not found")

  const score: TaskQualityScore = {
    taskId,
    title: task.title,
    score: 0,
    specificity: 0,
    completeness: 0,
    originality: 0,
    actionability: 0,
    issues: [],
    needsImprovement: false,
  }

  // ── 1. Completeness (30 pts) ───────────────────────────
  if (task.type) score.completeness += 8
  if (task.priority) score.completeness += 8
  if (task.estimatedMinutes) score.completeness += 7
  if (task.assignedTo) score.completeness += 7
  if (score.completeness < 20) score.issues.push("Dados incompletos: preencha type, priority, estimatedMinutes, assignee")

  // ── 2. Originality (20 pts) ─────────────────────────────
  const similar = await prisma.task.count({
    where: {
      organizationId: task.organizationId,
      id: { not: taskId },
      title: { contains: task.title.slice(0, 20), mode: "insensitive" },
    },
  })
  score.originality = similar === 0 ? 20 : similar === 1 ? 10 : 0
  if (similar > 0) score.issues.push(`Similar a ${similar} task(s) existente(s)`)

  // ── 3. Actionability (10 pts) ───────────────────────────
  const roleTypeMatch: Record<string, string[]> = {
    STRATEGIST: ["content", "campaign"],
    DESIGNER: ["content", "campaign"],
    ANALYST: ["analysis", "technical"],
    SOCIAL_MEDIA: ["content", "campaign"],
    SEO: ["analysis", "technical"],
  }
  if (task.assignee) {
    const validTypes = roleTypeMatch[task.assignee.role] || ["content"]
    if (validTypes.includes(task.type || "")) {
      score.actionability = 10
    } else {
      score.actionability = 5
      score.issues.push(`Type "${task.type}" não combina com role "${task.assignee.role}"`)
    }
  } else {
    score.actionability = 5
    score.issues.push("Sem assignee — ninguém vai executar")
  }

  // ── 4. Specificity (40 pts) — AI evaluation ────────────
  try {
    const prompt = `Avalie a especificidade desta tarefa em uma escala de 0-40:
"${task.title}"

Critérios:
- 35-40: Muito específica (ex: "Criar 3 posts Instagram para Black Friday com template X")
- 25-34: Específica (ex: "Otimizar meta descriptions das páginas de produto")
- 15-24: Moderada (ex: "Criar conteúdo para redes sociais")
- 0-14: Vaga/genérica (ex: "Trabalhar em marketing", "Fazer tarefas")

Retorne APENAS o número (0-40):`

    const reply = await chatCompletion(prompt, { temperature: 0.1, maxTokens: 10 })
    const num = parseInt(reply.match(/\d+/)?.[0] || "15")
    score.specificity = Math.min(40, Math.max(0, num))
  } catch {
    score.specificity = 15 // Default moderate
  }

  if (score.specificity < 20) {
    score.issues.push("Título muito vago — seja mais específico")
  }

  // ── Total ──────────────────────────────────────────────
  score.score = score.specificity + score.completeness + score.originality + score.actionability
  score.needsImprovement = score.score < 60

  return score
}

/**
 * Avalia a qualidade das tasks recentes de uma organização.
 */
export async function scoreRecentTasks(
  organizationId: string,
  limit = 10,
): Promise<{
  averageScore: number
  needsImprovementCount: number
  tasks: TaskQualityScore[]
}> {
  const tasks = await prisma.task.findMany({
    where: {
      organizationId,
      status: { not: "DONE" },
    },
    include: { assignee: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  const scores: TaskQualityScore[] = []
  for (const task of tasks) {
    try {
      const score = await scoreTaskQuality(task.id)
      scores.push(score)
    } catch {
      // Skip failed evaluations
    }
  }

  const avg = scores.length > 0
    ? Math.round(scores.reduce((s, t) => s + t.score, 0) / scores.length)
    : 0

  return {
    averageScore: avg,
    needsImprovementCount: scores.filter(s => s.needsImprovement).length,
    tasks: scores,
  }
}

/**
 * Melhora uma task de baixa qualidade usando AI.
 * Retorna um título melhorado ou null se já estiver bom.
 */
export async function improveTaskTitle(
  taskId: string,
): Promise<{ originalTitle: string; improvedTitle: string } | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: { select: { name: true, role: true } },
      organization: { select: { onboarding: { select: { industry: true, brandVoice: true } } } },
    },
  })

  if (!task) return null

  const prompt = `Melhore este título de tarefa para ser mais específico e acionável:

Título atual: "${task.title}"
Agente: ${task.assignee?.name || "não atribuído"} (${task.assignee?.role || "?"})
Setor: ${task.organization?.onboarding?.industry || "marketing"}

Regras:
- Seja específico (o que, onde, quando, para que)
- Mantenha curto (max 80 caracteres)
- Use verbos de ação (Criar, Otimizar, Analisar, Configurar)
- Retorne APENAS o novo título, nada mais`

  try {
    const reply = await chatCompletion(prompt, { temperature: 0.5, maxTokens: 100 })
    const improved = reply.trim().replace(/^["']|["']$/g, "").slice(0, 150)

    if (improved.length > 5 && improved !== task.title) {
      await prisma.task.update({
        where: { id: taskId },
        data: { title: improved },
      })
      return { originalTitle: task.title, improvedTitle: improved }
    }
  } catch {}

  return null
}

/**
 * Auto-improve low-quality tasks. Call from heartbeat.
 */
export async function autoImproveTasks(organizationId: string): Promise<number> {
  const lowQualityTasks = await prisma.task.findMany({
    where: {
      organizationId,
      status: { not: "DONE" },
    },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  let improved = 0
  for (const task of lowQualityTasks) {
    try {
      // Use AI scoring to decide if task is vague (specificity < 20)
      const quality = await scoreTaskQuality(task.id)
      if (quality.specificity < 20) {
        const result = await improveTaskTitle(task.id)
        if (result) improved++
      }
    } catch {
      // Fallback: heuristic check
      const isVague = task.title.length < 15
        || /^(fazer|criar|trabalhar|ver|olhar|pensar|planejar|organizar|revisar|melhorar)\b/i.test(task.title)
      if (isVague) {
        try {
          const result = await improveTaskTitle(task.id)
          if (result) improved++
        } catch {}
      }
    }
  }

  return improved
}
