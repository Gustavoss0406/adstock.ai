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
  { name: "Dia das Criancas", month: 10, day: 12, type: "campaign" },
]

export async function runCalendarCheck(organizationId: string): Promise<{ created: number; events: string[] }> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let created = 0
  const events: string[] = []

  for (const event of BR_EVENTS) {
    const eventDate = new Date(now.getFullYear(), event.month - 1, event.day)
    if (eventDate < today) eventDate.setFullYear(eventDate.getFullYear() + 1)

    const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / 86400000)
    if (daysUntil < 0 || daysUntil > 14) continue

    const existing = await prisma.task.findFirst({
      where: {
        organizationId,
        title: { contains: event.name },
        createdAt: { gte: new Date(today.getTime() - 14 * 86400000) },
      },
    })
    if (existing) continue

    const urgency = daysUntil <= 3 ? "CRITICAL" : daysUntil <= 7 ? "HIGH" : "MEDIUM"

    let title = `Preparar conteudo para ${event.name}`
    try {
      const reply = await chatCompletion(
        `Crie um titulo de tarefa curto e acionavel para: ${event.name} (${daysUntil} dias). Max 60 caracteres.`,
        { temperature: 0.5, maxTokens: 30 }
      )
      const clean = reply.trim().replace(/^["']|["']$/g, "")
      if (clean.length >= 15 && clean.length <= 80 && !/nao consegui|dificuldades tecnicas/i.test(clean)) title = clean
    } catch {}

    const assignee = event.type === "campaign"
      ? await prisma.agent.findFirst({ where: { organizationId, role: "STRATEGIST", status: { not: "FIRED" } } })
      : null

    await prisma.task.create({
      data: {
        organizationId, title, type: event.type,
        priority: urgency, status: "TODO",
        assignedTo: assignee?.id || null,
        dueDate: new Date(eventDate.getTime() - 86400000),
        estimatedMinutes: event.type === "campaign" ? 180 : 90,
      },
    } as any)

    events.push(title)
    created++
  }

  return { created, events }
}
