import { NextRequest, NextResponse } from "next/server"
import { runAutonomousLoop } from "@/lib/autonomous"
import { runCalendarCheck } from "@/lib/autonomous/calendar"
import { runMetricMonitor } from "@/lib/autonomous/monitor"
import { maintainBacklog } from "@/lib/autonomous/backlog"
import { prisma } from "@/lib/prisma"

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json()
    if (!organizationId) return NextResponse.json({ error: "organizationId required" }, { status: 400 })

    // Run full autonomous loop
    const results = await runAutonomousLoop(organizationId)

    // Also run recurring tasks for today
    const now = new Date()
    const dayOfWeek = now.getDay()
    const todayStr = now.toISOString().slice(0, 10)

    const recurringTasks = [
      { day: 1, title: "Planejar calendario editorial da semana", role: "STRATEGIST", type: "content", priority: "HIGH" },
      { day: 2, title: "Analisar metricas de performance semanal", role: "ANALYST", type: "analysis", priority: "MEDIUM" },
      { day: 3, title: "Auditar SEO e verificar posicoes", role: "SEO", type: "analysis", priority: "MEDIUM" },
      { day: 5, title: "Relatorio semanal de resultados", role: "ANALYST", type: "analysis", priority: "HIGH" },
    ]

    let recurringCreated = 0
    for (const rt of recurringTasks) {
      if (dayOfWeek === rt.day) {
        const existing = await prisma.task.findFirst({
          where: { organizationId, title: rt.title, createdAt: { gte: new Date(todayStr) } },
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
              dueDate: new Date(now.getTime() + 86400000),
            },
          } as any)
          recurringCreated++
        }
      }
    }

    return NextResponse.json({
      proactive: true,
      loop: results,
      recurring: recurringCreated,
      total: results.total + recurringCreated,
      message: `${results.total + recurringCreated} acoes proativas executadas.`,
    })
  } catch (error) {
    console.error("[Proactive Error]", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
