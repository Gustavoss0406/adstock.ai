import { prisma } from "@/lib/prisma"
import { buildCompanyContext } from "./context"
import { chatCompletion } from "@/lib/ai/client"
import { distributeTask } from "./distribute"
import { loadAgentTemplate } from "@/lib/agents/templates/loader"

/**
 * Autonomous daily — Maya analyzes context and creates a daily plan.
 * Posts to #daily-standup, creates tasks, agents respond.
 */
export async function runAutonomousDaily(organizationId: string): Promise<{
  plan: string
  tasksCreated: number
  channel: string
}> {
  const ctx = await buildCompanyContext(organizationId)
  const agents = await prisma.agent.findMany({
    where: { organizationId, status: { not: "FIRED" } },
    select: { id: true, name: true, role: true },
  })

  const maya = agents.find(a => a.role === "STRATEGIST") || agents[0]
  if (!maya) throw new Error("No agents")

  // ── Maya creates the daily plan ──
  const mayaTemplate = loadAgentTemplate("Maya Ferreira")
  const personalitySnippet = mayaTemplate.slice(0, 400)

  const prompt = `${personalitySnippet}

Voce e Maya, Diretora de Conteudo. Hora da daily autonoma de hoje!

CONTEXTO DA AGENCIA:
- Hoje: ${ctx.dayName}, ${ctx.today}
- Setor: ${ctx.industry || "marketing digital"}
- Desafio: ${ctx.mainChallenge || "crescimento"}
- Objetivos: ${(ctx.goals || []).join(", ") || "engajamento e leads"}
- Plataformas: ${ctx.connectedPlatforms.join(", ") || "nenhuma conectada"}
- Tarefas: ${ctx.taskCounts.todo} TODO, ${ctx.taskCounts.inProgress} em progresso, ${ctx.taskCounts.done} concluidas
- Atrasadas: ${ctx.overdueTasks}
- Proximos eventos: ${ctx.upcomingDates.map(d => `${d.name} (${d.daysUntil}d)`).join(", ") || "nenhum"}
- Backlog: ${ctx.backlogSize} ideias

TIME (5 agentes):
${agents.map(a => `- ${a.name} (${a.role}): ${a.name === maya.name ? "estrategia e copy" : a.role === "SOCIAL_MEDIA" ? "redes sociais e trends" : a.role === "ANALYST" ? "dados e metricas" : a.role === "DESIGNER" ? "design e identidade visual" : "SEO e otimizacao"}`).join("\n")}

SUA TAREFA: Crie o plano de trabalho para HOJE. Seja concisa e motivacional.

Formato:
1. Saudacao motivacional (2 frases)
2. 3-4 prioridades do dia (baseadas no contexto)
3. Distribuicao: quem faz o que (1 tarefa por agente)
4. Se tem datas comemorativas proximas, mencione
5. Se tem integracoes faltando, mencione
6. Termine com "Bora, time!"

Mantenha em 300-500 caracteres. Apenas FALE.`

  let plan: string
  try {
    const reply = await chatCompletion(prompt, { temperature: 0.85, maxTokens: 600 })
    plan = reply.replace(/^(Claro|Certo|Com certeza|OK|Ok)[,!.]?\s*/i, "").trim()
    if (plan.length < 50) throw new Error("Too short")
  } catch {
    plan = `Bom dia, time! Hoje e ${ctx.dayName} e temos ${ctx.taskCounts.todo} tarefas pendentes. Prioridades: executar o que esta em andamento e preparar novos conteudos. ${ctx.upcomingDates.length > 0 ? `Atencao: ${ctx.upcomingDates[0].name} em ${ctx.upcomingDates[0].daysUntil} dias!` : ""} Vamos la!`
  }

  // ── Post to #daily-standup ──
  let channel = await prisma.channel.findFirst({
    where: { organizationId, name: "daily-standup" },
  })
  if (!channel) {
    channel = await prisma.channel.create({
      data: { organizationId, name: "daily-standup", description: "Daily automatica" },
    })
  }

  await prisma.message.create({
    data: {
      content: plan,
      metadata: { type: "daily_start", dailyDate: ctx.today, autonomous: true },
      agentId: maya.id,
      channelId: channel.id,
    },
  } as any)

  // ── Extract and create tasks from the plan ──
  let tasksCreated = 0
  try {
    const taskPrompt = `Extraia tarefas deste plano de daily. Agentes: ${agents.map(a => a.name.split(" ")[0]).join(", ")}.

PLANO:
${plan}

Retorne APENAS JSON array: [{"title":"...","assignTo":"Diego|Bruno|Lena|Carlos|Maya","type":"content|analysis|technical|campaign","priority":"HIGH|MEDIUM|LOW"}]`

    const taskReply = await chatCompletion(taskPrompt, { temperature: 0.2, maxTokens: 500 })
    const jsonMatch = taskReply.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const tasks = JSON.parse(jsonMatch[0])
      const existingTitles = new Set(
        (await prisma.task.findMany({ where: { organizationId, status: { not: "DONE" } }, select: { title: true } }))
          .map(t => t.title.toLowerCase().slice(0, 30))
      )
      for (const t of tasks) {
        const title = (t.title || "").trim()
        if (title.length < 20 || existingTitles.has(title.toLowerCase().slice(0, 30))) continue
        const assignee = agents.find(a => a.name.toLowerCase().includes((t.assignTo || "").toLowerCase()))
        await prisma.task.create({
          data: {
            organizationId, title, type: t.type || "content",
            priority: t.priority || "MEDIUM", status: "TODO",
            assignedTo: assignee?.id || null,
            estimatedMinutes: 60,
            description: "Criada pela daily autonoma.",
          },
        } as any)
        tasksCreated++
      }
    }
  } catch {}

  // ── Mark daily as done ──
  await prisma.officeSettings.update({
    where: { organizationId },
    data: { lastDailyAt: new Date() },
  })

  await prisma.agencyEvent.create({
    data: {
      organizationId, type: "daily_completed",
      title: "Daily autonoma concluida",
      description: `${agents.length} agentes, ${tasksCreated} tarefas criadas.`,
      metadata: { tasksCreated, autonomous: true },
    },
  } as any)

  return { plan, tasksCreated, channel: channel.name }
}
