import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAgentTemplate } from "@/lib/agents/templates"

const HIREABLE_PROFILES = [
  {
    key: "sage_seo",
    name: "Sage",
    role: "SEO",
    personality: "DETAILED",
    preview: "Especialista em SEO com foco em dados. Sage é meticuloso, paciente e obcecado por rankings. Passa horas analisando SERPs e planejando estratégias de conteúdo de longo prazo. Ideal para negócios que dependem de tráfego orgânico consistente.",
    strengths: ["Pesquisa de palavras-chave", "SEO técnico", "Content gap analysis", "Backlink building"],
    salary: 2800,
  },
  {
    key: "echo_creative_director",
    name: "Echo",
    role: "CREATIVE_DIRECTOR",
    personality: "VISIONARY",
    preview: "Diretor criativo com visão artística apurada. Echo pensa em campanhas integradas, tem faro para tendências e sabe o que viraliza. Ideal para empresas que querem construir uma marca com identidade forte e memorável.",
    strengths: ["Direção criativa", "Brand storytelling", "Campanhas integradas", "Curadoria visual"],
    salary: 4000,
  },
  {
    key: "nova_media_buyer",
    name: "Nova",
    role: "MEDIA_BUYER",
    personality: "BOLD",
    preview: "Media buyer agressiva e orientada a ROI. Nova é competitiva, adora testar criativos e otimizar campanhas. Fala a linguagem dos números e tem tolerância zero para desperdício de verba. Ideal para empresas prontas para investir em tráfego pago com retorno mensurável.",
    strengths: ["Meta Ads", "Google Ads", "Otimização de ROAS", "Testes A/B de criativos"],
    salary: 3200,
  },
  {
    key: "kira_community",
    name: "Kira",
    role: "COMMUNITY_MANAGER",
    personality: "DIPLOMATIC",
    preview: "Community manager com empatia e carisma naturais. Kira é a voz humana da sua marca, engajando seguidores, respondendo comentários e construindo relacionamentos genuínos. Ideal para marcas que querem uma comunidade forte e engajada.",
    strengths: ["Gestão de comunidades", "Social listening", "UGC campaigns", "Crise management"],
    salary: 2500,
  },
]

export async function GET() {
  return NextResponse.json(HIREABLE_PROFILES)
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId, profileKey } = await request.json()

    if (!organizationId || !profileKey) {
      return NextResponse.json({ error: "organizationId and profileKey required" }, { status: 400 })
    }

    const profile = HIREABLE_PROFILES.find(p => p.key === profileKey)
    if (!profile) {
      return NextResponse.json({ error: "Invalid profile" }, { status: 400 })
    }

    const template = getAgentTemplate(profile.key)
    const agent = await prisma.agent.create({
      data: {
        organizationId,
        name: template?.name || profile.name,
        role: template?.role || profile.role as any,
        personality: template?.personality || profile.personality as any,
        status: "ACTIVE",
        avatar: template?.avatar || `https://ui-avatars.com/api/?name=${profile.name}&background=8b5cf6&color=fff&size=200`,
        bio: profile.preview,
        level: 1,
        salary: profile.salary,
        skills: template?.skills || profile.strengths,
        traits: template?.traits || [],
        promptTemplate: template?.promptTemplate || "",
      },
    })

    await prisma.agencyEvent.create({
      data: {
        organizationId,
        type: "agent_hired",
        title: `${agent.name} foi contratado!`,
        description: `${agent.name} se juntou à equipe como ${profile.role}`,
      },
    })

    return NextResponse.json(agent)
  } catch (error) {
    console.error("[Hire Error]", error)
    return NextResponse.json({ error: "Failed to hire agent" }, { status: 500 })
  }
}
