import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"

const BR_EVENTS: Array<{ name: string; month: number; day: number; type: string }> = [
  { name: "Dia das Maes", month: 5, day: 10, type: "campaign" },
  { name: "Dia dos Namorados", month: 6, day: 12, type: "campaign" },
  { name: "Dia dos Pais", month: 8, day: 10, type: "campaign" },
  { name: "Black Friday", month: 11, day: 28, type: "campaign" },
  { name: "Natal", month: 12, day: 25, type: "campaign" },
  { name: "Ano Novo", month: 1, day: 1, type: "campaign" },
  { name: "Carnaval", month: 2, day: 15, type: "content" },
  { name: "Pascoa", month: 4, day: 15, type: "content" },
  { name: "Dia do Cliente", month: 9, day: 15, type: "content" },
  { name: "Cyber Monday", month: 11, day: 29, type: "campaign" },
]

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json()
    if (!organizationId) return NextResponse.json({ error: "org required" }, { status: 400 })

    const now = new Date()
    const results: Array<{ type: string; title: string }> = []

    // 1. Check upcoming events (7 days ahead)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const nextWeek = new Date(today.getTime() + 7 * 86400000)

    for (const event of BR_EVENTS) {
      const eventDate = new Date(now.getFullYear(), event.month - 1, event.day)
      if (eventDate < today) eventDate.setFullYear(eventDate.getFullYear() + 1)

      const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / 86400000)

      if (daysUntil >= 0 && daysUntil <= 7) {
        // Check if task already exists for this event
        const existing = await prisma.task.findFirst({
          where: {
            organizationId,
            title: { contains: event.name },
            createdAt: { gte: new Date(today.getTime() - 7 * 86400000) },
          },
        })

        if (!existing) {
          const urgency = daysUntil <= 2 ? "CRITICAL" : daysUntil <= 5 ? "HIGH" : "MEDIUM"

          // Use AI to create a well-formatted task
          const system = `Voce e um gerente de projetos. Crie uma tarefa para o evento "${event.name}" que esta a ${daysUntil} dias. 
O nome da tarefa deve ser curto e acionavel, estilo: "Criar conteudo para ${event.name}" ou "Planejar campanha de ${event.name}".
Responda APENAS com um titulo de tarefa de no maximo 60 caracteres.`

          let title: string
          try {
            const reply = await chatCompletion(`[SYSTEM]\n${system}\n\n[USER]\nCrie o titulo da tarefa.`, { temperature: 0.5, maxTokens: 40 })
            title = reply.trim().replace(/^["']|["']$/g, "")
            if (title.length > 80) title = title.slice(0, 80)
          } catch {
            title = `Preparar conteudo para ${event.name}`
          }

          // Assign to Maya (strategist) by default for campaign events
          const assignee = event.type === "campaign"
            ? await prisma.agent.findFirst({ where: { organizationId, role: "STRATEGIST", status: { not: "FIRED" } } })
            : null

          await prisma.task.create({
            data: {
              organizationId, title, type: event.type,
              priority: urgency, status: "TODO",
              assignedTo: assignee?.id || null,
              dueDate: new Date(eventDate.getTime() - 86400000), // Due day before event
            },
          })

          results.push({ type: "event_task", title })
        }
      }
    }

    // 2. Stuck detection: tasks in progress for > 8 hours
    const eightHoursAgo = new Date(now.getTime() - 8 * 3600000)
    const stuckTasks = await prisma.task.findMany({
      where: {
        organizationId,
        status: "IN_PROGRESS",
        updatedAt: { lt: eightHoursAgo },
      },
      include: { assignee: true },
    })

    for (const task of stuckTasks) {
      // Mark as blocked
      await prisma.task.update({
        where: { id: task.id },
        data: { blocked: true, blockedReason: "Tarefa parada ha mais de 8 horas. Precisa de atencao." },
      })

      // Post alert in channel
      const channel = await prisma.channel.findFirst({ where: { organizationId, name: "geral" } })
      if (channel) {
        await prisma.message.create({
          data: {
            content: `Alerta: A tarefa "${task.title}" esta parada ha mais de 8 horas. ${task.assignee?.name || "Nao atribuida"} — precisa de atencao.`,
            channelId: channel.id,
          },
        })
      }

      await prisma.agencyEvent.create({
        data: {
          organizationId, type: "task_stuck",
          title: `Tarefa travada: ${task.title}`,
          description: `${task.assignee?.name || "Nao atribuida"} nao atualiza ha 8h.`,
        },
      })

      results.push({ type: "stuck_alert", title: task.title })
    }

    // 3. Recurring tasks: check day of week
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, etc.
    const todayStr = now.toISOString().slice(0, 10)

    const recurringTasks = [
      { day: 1, title: "Planejar calendario editorial da semana", role: "STRATEGIST", type: "content", priority: "HIGH" },
      { day: 2, title: "Analisar metricas de performance semanal", role: "ANALYST", type: "analysis", priority: "MEDIUM" },
      { day: 3, title: "Auditar SEO e verificar posicoes", role: "SEO", type: "analysis", priority: "MEDIUM" },
      { day: 5, title: "Relatorio semanal de resultados", role: "ANALYST", type: "analysis", priority: "HIGH" },
    ]

    for (const rt of recurringTasks) {
      if (dayOfWeek === rt.day) {
        const existing = await prisma.task.findFirst({
          where: {
            organizationId,
            title: rt.title,
            createdAt: { gte: new Date(todayStr) },
          },
        })

        if (!existing) {
          const agent = await prisma.agent.findFirst({
            where: { organizationId, role: rt.role as any, status: { not: "FIRED" } },
          })

          await prisma.task.create({
            data: {
              organizationId, title: rt.title, type: rt.type,
              priority: rt.priority, status: "TODO" as any,
              assignedTo: agent?.id || null,
              dueDate: new Date(today.getTime() + 86400000),
            },
          } as any)

          results.push({ type: "recurring_task", title: rt.title })
        }
      }
    }

    return NextResponse.json({ proactive: true, actions: results.length, results })
  } catch (error) {
    console.error("[Proactive Error]", error)
    return NextResponse.json({ error: "Proactive failed" }, { status: 500 })
  }
}
