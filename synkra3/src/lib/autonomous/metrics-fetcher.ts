import { prisma } from "@/lib/prisma"

export async function fetchAllMetrics(organizationId: string) {
  const integrations = await prisma.integration.findMany({
    where: { organizationId, status: "connected" },
    select: { platform: true, metadata: true },
  })

  const instagram = integrations.find(i => i.platform === "instagram")
  const website = integrations.find(i => i.platform === "website")

  return {
    instagram: instagram?.metadata || null,
    website: website?.metadata || null,
    integrations,
  }
}

export function buildMetricsPrompt(metrics: any): string {
  if (!metrics) return ""
  const lines: string[] = []
  if (metrics.instagram) {
    const ig = metrics.instagram as any
    lines.push(`Instagram: ${ig.followers?.toLocaleString() || "?"} seguidores, ${ig.recentPosts?.length || 0} posts recentes, ${ig.avgEngagementRate || "?"}% engajamento`)
  }
  if (metrics.website) {
    const ws = metrics.website as any
    lines.push(`Site: SEO score ${ws.seoScore || "?"}/100, ${ws.wordCount || 0} palavras, tecnologias: ${(ws.detectedTech || []).join(", ")}`)
  }
  return lines.join("\n")
}
