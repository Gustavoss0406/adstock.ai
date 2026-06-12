import { prisma } from "@/lib/prisma"

export async function validateTaskAntiHallucination(taskId: string): Promise<{ valid: boolean; issues: string[] }> {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { output: true, title: true } })
  if (!task?.output) return { valid: true, issues: [] }

  const output = task.output as any
  const issues: string[] = []

  const fakeMetricsPatterns = [
    /\d{2,3}%\s*(aumento|crescimento|redução|queda)/gi,
    /\d{3,4}\s*(cliques|visitas|leads|conversões)/gi,
    /ROI de \d+/gi,
  ]

  const content = output.content || ''
  for (const pattern of fakeMetricsPatterns) {
    if (pattern.test(content)) {
      issues.push(`Métrica potencialmente falsa detectada: "${content.match(pattern)?.[0]}"`)
    }
  }

  const fakePlatforms = ['tiktok', 'pinterest', 'facebook', 'twitter', 'youtube']
  for (const platform of fakePlatforms) {
    if (content.toLowerCase().includes(platform)) {
      issues.push(`Menção a plataforma não suportada: ${platform}`)
    }
  }

  return { valid: issues.length === 0, issues }
}
