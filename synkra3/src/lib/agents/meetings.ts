import { AgentPersonality, AgentRole } from "@prisma/client"

export const MEETING_TEMPLATES = {
  DAILY: {
    title: "Daily Standup",
    duration: 15,
    structure: [
      { phase: "checkin", duration: 2, description: "Cada agente marca presença" },
      { phase: "yesterday", duration: 4, description: "O que cada um concluiu ontem" },
      { phase: "today", duration: 5, description: "O que cada um fará hoje" },
      { phase: "blockers", duration: 3, description: "Bloqueios e pedidos de ajuda" },
      { phase: "wrapup", duration: 1, description: "Resumo e encerramento" },
    ],
  },
  WEEKLY: {
    title: "Weekly Review",
    duration: 30,
    structure: [
      { phase: "metrics", duration: 8, description: "Revisão de métricas da semana" },
      { phase: "wins", duration: 5, description: "Vitórias e aprendizados" },
      { phase: "improvements", duration: 7, description: "O que melhorar" },
      { phase: "next_week", duration: 8, description: "Planejamento próxima semana" },
      { phase: "wrapup", duration: 2, description: "Resumo e encerramento" },
    ],
  },
  SPRINT_PLANNING: {
    title: "Sprint Planning",
    duration: 45,
    structure: [
      { phase: "review_backlog", duration: 10, description: "Revisão do backlog" },
      { phase: "prioritize", duration: 10, description: "Priorização de tarefas" },
      { phase: "estimate", duration: 15, description: "Estimativas e capacidade" },
      { phase: "commit", duration: 8, description: "Compromisso da sprint" },
      { phase: "wrapup", duration: 2, description: "Encerramento" },
    ],
  },
  BRAINSTORMING: {
    title: "Brainstorming Session",
    duration: 30,
    structure: [
      { phase: "context", duration: 3, description: "Contexto e objetivo" },
      { phase: "diverge", duration: 12, description: "Geração livre de ideias" },
      { phase: "cluster", duration: 5, description: "Agrupamento de ideias" },
      { phase: "converge", duration: 8, description: "Seleção das melhores ideias" },
      { phase: "wrapup", duration: 2, description: "Próximos passos" },
    ],
  },
}

export const AGENT_INTERACTIONS = {
  greeting: (agentName: string, personality: AgentPersonality): string => {
    const greetings: Record<AgentPersonality, string[]> = {
      ANALYTICAL: [
        `Bom dia, time. Analisando os números de ontem...`,
        `Olá! Já estou processando os dados mais recentes.`,
      ],
      CREATIVE: [
        `Bom dia! Acordei cheio de ideias hoje! 🎨`,
        `Oiii time! Tive uma inspiração incrível essa noite...`,
      ],
      PRAGMATIC: [
        `Bom dia. Vamos direto ao que interessa.`,
        `Presente. Qual a prioridade hoje?`,
      ],
      VISIONARY: [
        `Bom dia, equipe! Hoje vamos construir algo extraordinário.`,
        `Olá! Estou vendo oportunidades enormes no horizonte...`,
      ],
      DETAILED: [
        `Bom dia. Revisei todos os detalhes pendentes e preparei uma lista...`,
        `Presente. Organizei tudo que precisamos verificar hoje.`,
      ],
      BOLD: [
        `BOM DIA! Vamos causar hoje! 🔥`,
        `Cheguei! Prontos para ousar?`,
      ],
      DIPLOMATIC: [
        `Bom dia a todos! Como estão se sentindo hoje?`,
        `Olá, time. Espero que todos estejam bem.`,
      ],
      DISRUPTIVE: [
        `E aí, galera! Vamos quebrar tudo hoje? 🚀`,
        `Salve! Tô com umas ideias que vão mudar o jogo...`,
      ],
    }

    const options = greetings[personality] || greetings.ANALYTICAL
    return options[Math.floor(Math.random() * options.length)]
  },

  disagreement: (
    agent1: { name: string; personality: AgentPersonality },
    agent2: { name: string; personality: AgentPersonality },
    topic: string
  ): string => {
    const patterns: Record<string, string> = {
      ANALYTICAL_CREATIVE: `Entendo sua visão criativa, ${agent2.name}, mas os dados mostram outra direção. Deixe-me mostrar os números...`,
      CREATIVE_ANALYTICAL: `${agent1.name} sente que a abordagem de ${agent2.name} é muito conservadora e limita a criatividade da campanha.`,
      VISIONARY_PRAGMATIC: `${agent1.name} acredita numa abordagem mais ousada, enquanto ${agent2.name} prefere ir com mais cautela.`,
      BOLD_DIPLOMATIC: `${agent1.name} quer uma campanha agressiva, mas ${agent2.name} sugere uma abordagem mais equilibrada.`,
    }

    const key = `${agent1.personality}_${agent2.personality}`
    return (
      patterns[key] ||
      `${agent1.name} e ${agent2.name} têm visões diferentes sobre "${topic}". Ambos apresentaram argumentos válidos.`
    )
  },

  collaboration: (agentName: string, otherAgent: string, task: string): string => {
    const templates = [
      `${agentName} compartilhou "${task}" com ${otherAgent} para revisão.`,
      `${agentName} e ${otherAgent} estão colaborando em "${task}".`,
      `${agentName} pediu feedback de ${otherAgent} sobre "${task}".`,
      `${agentName} finalizou sua parte em "${task}" e passou para ${otherAgent}.`,
    ]
    return templates[Math.floor(Math.random() * templates.length)]
  },
}

export function getMeetingMessage(
  agentName: string,
  meetingType: string,
  phase: string
): string {
  const messages: Record<string, Record<string, string[]>> = {
    DAILY: {
      checkin: [
        `${agentName} entrou na sala. ☕`,
        `${agentName} está presente e pronto!`,
      ],
      yesterday: [
        `Finalizei as análises de ontem e os números estão promissores.`,
        `Concluí as artes pendentes e já estão na pasta de aprovação.`,
      ],
      today: [
        `Hoje vou focar em otimizar as campanhas ativas.`,
        `Vou criar conteúdo para o Instagram baseado nas trends de hoje.`,
      ],
      blockers: [
        `Preciso de acesso à conta de anúncios para continuar.`,
        `Aguardando aprovação do cliente para prosseguir.`,
      ],
      wrapup: [
        `Ótimo alinhamento, time! Vamos executar! 🚀`,
        `Resumo registrado. Até amanhã!`,
      ],
    },
  }

  return (
    messages[meetingType]?.[phase]?.[
      Math.floor(Math.random() * (messages[meetingType]?.[phase]?.length || 1))
    ] || `${agentName} contribuiu para a discussão.`
  )
}
