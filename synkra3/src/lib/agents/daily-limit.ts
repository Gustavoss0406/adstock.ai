import { prisma } from "@/lib/prisma"

const ORG_DAILY_LIMIT = 10

export async function canOrganizationCreateTask(orgId: string): Promise<{ allowed: boolean; reason?: string }> {
  const count = await prisma.task.count({
    where: { organizationId: orgId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
  })
  const allowed = count < ORG_DAILY_LIMIT
  return { allowed, reason: allowed ? undefined : `Limite diário de ${ORG_DAILY_LIMIT} tasks atingido (${count} criadas hoje)` }
}

export async function getOrganizationDailyTaskCount(orgId: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const totalTasksToday = await prisma.task.count({ where: { organizationId: orgId, createdAt: { gte: today } } })
  return { totalTasksToday, dailyLimit: ORG_DAILY_LIMIT, remaining: Math.max(0, ORG_DAILY_LIMIT - totalTasksToday) }
}
