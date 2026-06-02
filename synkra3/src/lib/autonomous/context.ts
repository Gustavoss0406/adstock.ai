import { prisma } from "@/lib/prisma"
import { getUpcomingEvents, getDayContext } from "@/lib/agents/daily"

export interface CompanyContext {
  today: string
  dayOfWeek: string
  dayName: string
  upcomingDates: Array<{ name: string; daysUntil: number }>
  connectedPlatforms: string[]
  taskCounts: { todo: number; inProgress: number; inReview: number; done: number }
  overdueTasks: number
  backlogSize: number
  industry?: string
  goals?: string[]
  mainChallenge?: string
}

export async function buildCompanyContext(organizationId: string): Promise<CompanyContext> {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const [org, tasks, integrations] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      include: { onboarding: true },
    }),
    prisma.task.findMany({
      where: { organizationId },
      select: { status: true, dueDate: true },
    }),
    prisma.integration.findMany({
      where: { organizationId, status: "connected" },
      select: { platform: true },
    }),
  ])

  const upcomingDates = getUpcomingEvents(7)
  const dayContext = getDayContext()

  return {
    today,
    dayOfWeek: dayContext.split(",")[0]?.split("!")[1]?.trim() || now.toLocaleDateString("pt-BR", { weekday: "long" }),
    dayName: now.toLocaleDateString("pt-BR", { weekday: "long" }),
    upcomingDates,
    connectedPlatforms: integrations.map(i => i.platform),
    taskCounts: {
      todo: tasks.filter(t => t.status === "TODO").length,
      inProgress: tasks.filter(t => t.status === "IN_PROGRESS").length,
      inReview: tasks.filter(t => t.status === "IN_REVIEW").length,
      done: tasks.filter(t => t.status === "DONE").length,
    },
    overdueTasks: tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== "DONE").length,
    backlogSize: tasks.filter(t => t.status === "TODO").length,
    industry: org?.onboarding?.industry || undefined,
    goals: org?.onboarding?.goals || undefined,
    mainChallenge: org?.onboarding?.mainChallenges || undefined,
  }
}
