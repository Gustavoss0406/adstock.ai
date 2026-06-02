import { prisma } from "@/lib/prisma"
import { Agent, AgentStatus, MeetingType, MeetingStatus } from "@prisma/client"
import { chatWithSystem, generateAgentResponse as aiGenerateResponse } from "@/lib/ai/client"
import { getAgentTemplate, getAgentPersonalityPrompt } from "./templates"
import { getRandomThinkingPhrase } from "@/lib/ai/config"

export interface AgentContext {
  organizationId: string
  organizationName: string
  industry?: string
  targetAudience?: string
  brandVoice?: string
  goals?: string[]
}

export async function createDefaultAgents(organizationId: string) {
  const templates = [
    "maya_content_director",
    "bruno_social_media",
    "lena_analyst",
    "carlos_designer",
    "diego_seo",
  ]

  const agents = []

  for (const key of templates) {
    const template = getAgentTemplate(key)
    if (!template) continue

    const agent = await prisma.agent.create({
      data: {
        organizationId,
        name: template.name,
        role: template.role,
        personality: template.personality,
        status: "ACTIVE",
        avatar: template.avatar || `https://ui-avatars.com/api/?name=${template.name}&background=8b5cf6&color=fff&size=200`,
        bio: template.bio,
        level: 1,
        salary: template.baseSalary,
        skills: template.skills,
        traits: template.traits,
        promptTemplate: template.promptTemplate,
      },
    })
    agents.push(agent)
  }

  return agents
}

export async function createDefaultChannels(organizationId: string) {
  const channels = [
    { name: "geral", description: "Chat principal da agência", isDefault: true },
    { name: "daily-standup", description: "Daily às 9h — cada agente fala o que vai fazer", isDefault: true },
    { name: "aprovações", description: "Artes e copies para revisão e aprovação do time", isDefault: false },
    { name: "estrategia", description: "Planejamento estratégico e discussões de alto nível", isDefault: false },
    { name: "instagram", description: "Conteúdo e estratégia para Instagram", isDefault: false },
    { name: "linkedin", description: "Posts e artigos para LinkedIn", isDefault: false },
    { name: "blog-seo", description: "Planejamento de conteúdo para blog e SEO", isDefault: false },
    { name: "criativo", description: "Peças criativas, designs e copy", isDefault: false },
    { name: "metricas", description: "Dados, relatórios e análises de performance", isDefault: false },
    { name: "resultados", description: "Relatórios e conquistas da agência", isDefault: true },
  ]

  const created = []
  for (const channel of channels) {
    const c = await prisma.channel.create({
      data: { organizationId, ...channel },
    })
    created.push(c)
  }
  return created
}

export async function scheduleDailyMeeting(organizationId: string) {
  const settings = await prisma.officeSettings.findUnique({
    where: { organizationId },
  })

  const dailyTime = settings?.dailyTime || "09:00"
  const tz = settings?.timezone || "America/Sao_Paulo"

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const [hours, minutes] = dailyTime.split(":").map(Number)
  tomorrow.setHours(hours, minutes, 0, 0)

  const meeting = await prisma.meeting.create({
    data: {
      organizationId,
      type: MeetingType.DAILY,
      status: MeetingStatus.SCHEDULED,
      title: "Daily Standup",
      topic: "Planejamento diário de marketing - alinhamento de tarefas e prioridades",
      scheduledAt: tomorrow,
    },
  })

  return meeting
}

export async function runMeeting(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      participants: { include: { agent: true } },
      organization: {
        include: {
          onboarding: true,
          agents: { where: { status: { not: "FIRED" } } },
        },
      },
    },
  })

  if (!meeting) throw new Error("Meeting not found")

  await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: MeetingStatus.IN_PROGRESS, startedAt: new Date() },
  })

  const agents = meeting.organization.agents
  const orgName = meeting.organization.name
  const onboarding = meeting.organization.onboarding

  const context = {
    organizationId: meeting.organizationId,
    organizationName: orgName,
    industry: onboarding?.industry || undefined,
    targetAudience: onboarding?.targetAudience || undefined,
    brandVoice: onboarding?.brandVoice || undefined,
    goals: onboarding?.goals || [],
  }

  for (const agent of agents) {
    await prisma.agent.update({
      where: { id: agent.id },
      data: { status: AgentStatus.IN_MEETING },
    })

    await prisma.meetingParticipant.upsert({
      where: { meetingId_agentId: { meetingId, agentId: agent.id } },
      create: { meetingId, agentId: agent.id },
      update: { joinedAt: new Date() },
    })
  }

  const conversationPrompts = agents.map((agent) => ({
    name: agent.name,
    role: agent.role,
    prompt: agent.promptTemplate || getAgentPersonalityPrompt(
      getAgentTemplate(getTemplateKey(agent))!
    ),
  }))

  const conversationContext = `
Empresa: ${orgName}
Setor: ${context.industry || "Não especificado"}
Público-alvo: ${context.targetAudience || "Não especificado"}
Voz da marca: ${context.brandVoice || "Não especificada"}
Objetivos: ${context.goals?.join(", ") || "Crescimento de marketing"}

Esta é a daily da agência às ${new Date().toLocaleTimeString("pt-BR")}.
Formato: cada agente fala na sua vez por 3 rodadas. Sejam diretos e produtivos.`

  const conversation: Array<{ agent: string; message: string }> = []
  for (const agent of conversationPrompts) {
    try {
      const reply = await chatWithSystem(agent.prompt, `${conversationContext}\n\nCompartilhe seu plano do dia.`, { temperature: 0.8, maxTokens: 300 })
      conversation.push({ agent: agent.name, message: reply })
    } catch {
      conversation.push({ agent: agent.name, message: "Estou processando..." })
    }
  }

  const messages = []
  for (const entry of conversation) {
    const agent = agents.find((a) => a.name === entry.agent)
    if (agent) {
      const msg = await prisma.message.create({
        data: {
          content: entry.message,
          meetingId,
          agentId: agent.id,
        },
      })
      messages.push(msg)
    }
  }

  const summary = conversation
    .map((c) => `**${c.agent}:** ${c.message.slice(0, 200)}...`)
    .join("\n\n")

  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: MeetingStatus.COMPLETED,
      endedAt: new Date(),
      summary,
    },
  })

  for (const agent of agents) {
    await prisma.agent.update({
      where: { id: agent.id },
      data: { status: AgentStatus.ACTIVE },
    })
  }

  return { meetingId, summary, messages }
}

export async function generateAgentResponse(
  agentId: string,
  context: string,
  userMessage: string
): Promise<string> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
  })

  if (!agent || !agent.promptTemplate) {
    return aiGenerateResponse(
      {
        name: "Assistente",
        role: "Agente de Marketing",
        prompt: "Você é um agente de marketing profissional. Responda de forma útil e direta.",
      },
      context,
      userMessage
    )
  }

  return aiGenerateResponse(
    {
      name: agent.name,
      role: agent.role,
      personality: agent.personality || undefined,
      prompt: agent.promptTemplate,
    },
    context,
    userMessage
  )
}

export async function assignTaskToBestAgent(
  organizationId: string,
  taskTitle: string,
  taskDescription: string
): Promise<string | null> {
  const agents = await prisma.agent.findMany({
    where: {
      organizationId,
      status: { not: "FIRED" },
    },
  })

  if (agents.length === 0) return null

  const analysisPrompt = `Você é um orquestrador de equipe de marketing. Dada a seguinte tarefa:
Título: ${taskTitle}
Descrição: ${taskDescription}

Agentes disponíveis:
${agents.map((a) => `- ${a.name} (${a.role}) - Skills: ${a.skills.join(", ")}`).join("\n")}

Qual agente deve receber esta tarefa? Responda APENAS com o nome do agente.`

  const response = await chatWithSystem(
    "Você é um orquestrador que atribui tarefas ao agente mais qualificado. Responda apenas um nome.",
    analysisPrompt,
    { temperature: 0.3 }
  )

  const bestAgent = agents.find((a) =>
    response.toLowerCase().includes(a.name.toLowerCase())
  )

  return bestAgent?.id || agents[0].id
}

export async function createAgencyEvent(
  organizationId: string,
  type: string,
  title: string,
  description?: string,
  metadata?: Record<string, unknown>
) {
  return prisma.agencyEvent.create({
    data: {
      organizationId,
      type,
      title,
      description,
      metadata: (metadata || undefined) as any,
    },
  })
}

function getTemplateKey(agent: Agent): string {
  const nameMap: Record<string, string> = {
    "Maya Ferreira": "maya_content_director",
    "Bruno Costa": "bruno_social_media",
    "Lena Souza": "lena_analyst",
    "Carlos Lima": "carlos_designer",
    "Diego Ramos": "diego_seo",
  }
  return nameMap[agent.name] || "maya_content_director"
}

export function getThinkingStatus(action: string): string {
  const statusMap: Record<string, string[]> = {
    analyze: [
      "Buscando referências de mercado...",
      "Analisando métricas de performance...",
      "Processando dados do público-alvo...",
      "Comparando com benchmarks do setor...",
    ],
    design: [
      "Criando conceito visual...",
      "Selecionando paleta de cores...",
      "Compondo elementos visuais...",
      "Ajustando para formato da plataforma...",
    ],
    write: [
      "Pesquisando palavras-chave...",
      "Estruturando o storytelling...",
      "Escrevendo primeira versão...",
      "Refinando o tom de voz...",
    ],
    plan: [
      "Mapeando jornada do cliente...",
      "Definindo KPIs principais...",
      "Estruturando cronograma...",
      "Alocando recursos da equipe...",
    ],
  }

  if (statusMap[action]) {
    return statusMap[action][Math.floor(Math.random() * statusMap[action].length)]
  }

  return getRandomThinkingPhrase()
}
