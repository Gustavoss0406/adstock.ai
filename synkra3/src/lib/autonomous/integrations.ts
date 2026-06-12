import { prisma } from "@/lib/prisma"

export interface IntegrationMetrics {
  platform: string
  name: string
  metadata: any
}

export async function getIntegrationMetrics(organizationId: string): Promise<IntegrationMetrics[]> {
  const integrations = await prisma.integration.findMany({
    where: { organizationId, status: "connected" },
    select: { platform: true, name: true, metadata: true },
  })
  return integrations
}

export function buildIntegrationPrompt(integrations: IntegrationMetrics[]): string {
  if (!integrations.length) return ""
  return integrations.map(i => {
    const m = i.metadata as any || {}
    const followers = m.followers ? `${m.followers.toLocaleString()} seguidores` : ''
    const posts = m.recentPosts?.length ? `${m.recentPosts.length} posts` : ''
    const seo = m.seoScore ? `SEO score ${m.seoScore}/100` : ''
    return `- ${i.name} (${i.platform}): ${[followers, posts, seo].filter(Boolean).join(', ') || 'conectado'}`
  }).join('\n')
}

export function generateFallbackMetrics(industry: string) {
  return {
    instagram: { followers: 5000, avgEngagementRate: 3.2, recentPosts: [] },
    website: { seoScore: 50, wordCount: 1000, detectedTech: [] },
  }
}
