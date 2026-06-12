import { prisma } from "@/lib/prisma"

export interface CompanyProfile {
  industry?: string
  targetAudience?: string
  brandVoice?: string
  goals?: string[]
  website?: string
  niche?: string
}

export async function getCompanyProfile(organizationId: string): Promise<CompanyProfile | null> {
  const onboarding = await prisma.onboarding.findUnique({
    where: { organizationId },
    select: { industry: true, targetAudience: true, brandVoice: true, goals: true, website: true },
  })
  if (!onboarding) return null
  return {
    industry: onboarding.industry || undefined,
    targetAudience: onboarding.targetAudience || undefined,
    brandVoice: onboarding.brandVoice || undefined,
    goals: onboarding.goals || undefined,
    website: onboarding.website || undefined,
    niche: onboarding.industry || undefined,
  }
}

export function buildContextPrompt(profile: CompanyProfile, role: string): string {
  const lines: string[] = []
  if (profile.industry) lines.push(`Setor: ${profile.industry}`)
  if (profile.targetAudience) lines.push(`Público-alvo: ${profile.targetAudience}`)
  if (profile.brandVoice) lines.push(`Tom da marca: ${profile.brandVoice}`)
  if (profile.goals?.length) lines.push(`Objetivos: ${profile.goals.join(", ")}`)
  return lines.length ? `\nCONTEXTO DA EMPRESA:\n${lines.join("\n")}\n` : ""
}
