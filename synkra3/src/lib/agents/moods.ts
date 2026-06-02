import { AgentPersonality } from "@prisma/client"

export type AgentMood = "animado" | "normal" | "pensativo" | "estressado" | "criativo" | "cético"

export const MOOD_EMOJIS: Record<AgentMood, string> = {
  animado: "⚡",
  normal: "🙂",
  pensativo: "🤔",
  estressado: "😤",
  criativo: "🎨",
  cético: "🧐",
}

export const MOOD_LABELS: Record<AgentMood, string> = {
  animado: "Animado",
  normal: "Normal",
  pensativo: "Pensativo",
  estressado: "Estressado",
  criativo: "Criativo",
  cético: "Cético",
}

const MOOD_TONE_MODIFIERS: Record<AgentMood, string> = {
  animado: "Você está especialmente animado hoje. Seja mais entusiasmado, use exclamações e mostre energia positiva.",
  normal: "Você está num dia normal de trabalho. Mantenha o profissionalismo com um toque de bom humor.",
  pensativo: "Você está reflexivo hoje. Pense antes de falar, faça perguntas e considere diferentes ângulos.",
  estressado: "Você está um pouco sobrecarregado hoje. Seja mais direto, pragmático e não hesite em pedir ajuda.",
  criativo: "Você está num pico criativo. Sugira ideias ousadas, pense fora da caixa e proponha soluções inovadoras.",
  cético: "Você está com um olhar crítico hoje. Questione suposições, peça dados e seja cauteloso com ideias não testadas.",
}

export function generateDailyMood(personality: string, hour: number): AgentMood {
  const seed = (personality.charCodeAt(0) || 0) + hour + new Date().getDate()
  const rng = Math.abs(Math.sin(seed * 9301 + 49297) * 10000) % 100

  if (hour < 9) {
    if (rng < 30) return "pensativo"
    if (rng < 70) return "normal"
    return "cético"
  }

  if (hour >= 9 && hour < 12) {
    if (rng < 25) return "animado"
    if (rng < 50) return "criativo"
    if (rng < 75) return "normal"
    if (rng < 90) return "pensativo"
    return "estressado"
  }

  if (hour >= 15 && hour < 16) {
    if (rng < 40) return "animado"
    if (rng < 70) return "normal"
    return "criativo"
  }

  if (hour >= 17) {
    if (rng < 30) return "pensativo"
    if (rng < 60) return "normal"
    if (rng < 85) return "criativo"
    return "estressado"
  }

  return "normal"
}

export function getMoodSystemPrompt(mood: AgentMood): string {
  return `\n\nESTADO DE ESPÍRITO HOJE: ${mood.toUpperCase()}. ${MOOD_TONE_MODIFIERS[mood]}`
}

export function getMoodInteraction(mood: AgentMood, personality: AgentPersonality): string[] {
  const lines: Record<AgentMood, string[]> = {
    animado: [
      "Bora, time! Hoje vai ser produtivo demais! 🔥",
      "Acordei com energia total hoje! ☕⚡",
    ],
    normal: [
      "Bom dia, pessoal. Vamos começar bem o dia.",
      "Presente! O que temos pra hoje?",
    ],
    pensativo: [
      "Estive refletindo sobre nossa estratégia ontem à noite...",
      "Antes de começarmos, quero levantar uma questão.",
    ],
    estressado: [
      "Pessoal, tô com um monte de coisa acumulada. Podemos priorizar?",
      "Preciso de ajuda com uma entrega hoje.",
    ],
    criativo: [
      "Sonhei com uma ideia incrível essa noite! Posso compartilhar?",
      "E se a gente tentasse algo completamente diferente hoje? 🎨",
    ],
    cético: [
      "Antes de sairmos executando, vamos validar os dados primeiro?",
      "Não concordo com essa direção. Me mostrem os números.",
    ],
  }

  const rng = Math.floor(Math.random() * lines[mood].length)
  return [lines[mood][rng]]
}

export const DAILY_SCHEDULE = {
  "09:00": {
    event: "daily_standup",
    title: "Daily Standup",
    channel: "daily-standup",
    description: "Cada agente compartilha o que fez ontem, o que fará hoje e bloqueios",
    autoStart: true,
  },
  "14:00": {
    event: "approval_round",
    title: "Rodada de Aprovação",
    channel: "aprovações",
    description: "Artes e copies do dia são postados para revisão do time",
    autoStart: false,
  },
  "15:00": {
    event: "coffee_break",
    title: "Coffee Break",
    channel: "geral",
    description: "Pausa de 15 minutos — agentes interagem na copa",
    autoStart: false,
  },
  "17:30": {
    event: "daily_report",
    title: "Relatório do Dia",
    channel: "resultados",
    description: "Resumo automático do que foi concluído hoje",
    autoStart: true,
  },
}

export const MARKETING_CHANNELS = [
  { name: "daily-standup", description: "Daily às 9h — cada agente fala o que vai fazer", category: "geral" },
  { name: "aprovações", description: "Artes e copies para revisão e aprovação", category: "geral" },
  { name: "instagram", description: "Estratégia e conteúdo para Instagram", category: "conteúdo" },
  { name: "linkedin", description: "Posts e artigos para LinkedIn", category: "conteúdo" },
  { name: "blog-seo", description: "Planejamento de conteúdo para blog e SEO", category: "conteúdo" },
  { name: "planejamento-semanal", description: "Planejamento da semana e prioridades", category: "estratégia" },
  { name: "sprint-atual", description: "Acompanhamento da sprint em andamento", category: "estratégia" },
  { name: "resultados", description: "Relatórios e métricas da agência", category: "resultados" },
]

export const EASTER_EGGS = [
  { condition: "coffee_break", action: "Agentes se reúnem na copa para um café às 15h" },
  { condition: "no_tasks", action: "Agente sem demanda aparece dormindo na cadeira" },
  { condition: "conflict", action: "Dois agentes discutem com balõezinhos pixel art" },
  { condition: "art_approved", action: "Agente comemora com confete pixel quando arte é aprovada" },
  { condition: "friday", action: "Sexta-feira: todos os agentes aparecem mais animados" },
  { condition: "after_six", action: "Após 18h, agentes começam a sair do escritório" },
  { condition: "new_hire", action: "Agente novo chega com caixinha de pertences" },
]
