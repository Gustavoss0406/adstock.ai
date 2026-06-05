/**
 * ── CHANNEL MAP ──────────────────────────────────────────
 *
 * Define TODOS os canais da agência com propósitos claros.
 * Cada mensagem dos agentes é roteada para o canal certo.
 */

export interface ChannelDefinition {
  name: string
  purpose: string
  types: string[]
  priority: "low" | "medium" | "high" | "critical"
  notifyCEO: boolean
  schedule?: string
  examples: string[]
}

export const CHANNEL_MAP: Record<string, ChannelDefinition> = {
  geral: {
    name: "geral",
    purpose: "Conversas gerais e coordenação rápida do time",
    types: ["coordination", "question", "announcement", "general"],
    priority: "low",
    notifyCEO: false,
    examples: [
      "Avisos gerais",
      "Coordenação entre agentes",
      "Perguntas rápidas ao time",
    ],
  },

  "daily-standup": {
    name: "daily-standup",
    purpose: "Daily automática diária (9h) e planejamento do dia",
    types: ["daily", "planning", "priorities", "daily_start", "daily_response", "daily_summary", "daily_speech", "pre_daily"],
    priority: "high",
    notifyCEO: false,
    schedule: "09:00",
    examples: [
      "Plano do dia",
      "Prioridades",
      "O que cada agente vai fazer",
    ],
  },

  aprovacoes: {
    name: "aprovações",
    purpose: "Conteúdos finalizados aguardando aprovação do CEO",
    types: ["approval_request", "content_ready", "review", "task_completed", "request_approval", "needs_approval", "team_vote"],
    priority: "critical",
    notifyCEO: true,
    examples: [
      "Arte pronta para aprovar",
      "Copy finalizada",
      "Carrossel completo",
      "Votação do time concluída",
    ],
  },

  alertas: {
    name: "alertas",
    purpose: "Alertas críticos, bloqueios e problemas urgentes",
    types: ["alert", "blocked", "error", "critical", "task_blocked", "api_error", "metric_alert", "conflict_detected", "alert_critical"],
    priority: "critical",
    notifyCEO: true,
    examples: [
      "Tarefa bloqueada",
      "API fora do ar",
      "Métrica caiu 15%+",
      "Prazo crítico",
    ],
  },

  estrategia: {
    name: "estrategia",
    purpose: "Planejamento estratégico e discussões de alto nível",
    types: ["strategy", "planning", "calendar_created", "strategy_change", "weekly_planning", "campaign"],
    priority: "high",
    notifyCEO: false,
    examples: [
      "Calendário da semana",
      "Prioridades da sprint",
      "Estratégia ajustada",
    ],
  },

  instagram: {
    name: "instagram",
    purpose: "Conteúdo e estratégia para Instagram",
    types: ["instagram_content", "post_scheduled", "engagement", "social_media", "instagram"],
    priority: "medium",
    notifyCEO: false,
    examples: [
      "Post agendado no Instagram",
      "Análise de engajamento",
      "Trends do Instagram",
    ],
  },

  linkedin: {
    name: "linkedin",
    purpose: "Posts e artigos para LinkedIn",
    types: ["linkedin_content", "b2b_strategy", "linkedin"],
    priority: "medium",
    notifyCEO: false,
    examples: [
      "Post para LinkedIn",
      "Artigo B2B",
      "Estratégia LinkedIn",
    ],
  },

  "blog-seo": {
    name: "blog-seo",
    purpose: "Planejamento de conteúdo para blog e SEO",
    types: ["seo", "blog", "keywords", "organic", "seo_research", "content_optimization", "keyword_research"],
    priority: "medium",
    notifyCEO: false,
    examples: [
      "Blog post criado",
      "Palavras-chave pesquisadas",
      "Otimização on-page",
    ],
  },

  criativo: {
    name: "criativo",
    purpose: "Peças criativas, designs e copy",
    types: ["design", "copy", "creative", "artwork_created", "content_created", "campaign_creative"],
    priority: "medium",
    notifyCEO: false,
    examples: [
      "Nova arte criada",
      "Copy pronta",
      "Briefing de design",
    ],
  },

  metricas: {
    name: "metricas",
    purpose: "Dados, relatórios e análises de performance",
    types: ["report", "metrics", "analysis", "weekly_report", "metric_analysis", "performance", "data_analysis", "daily_checkpoint"],
    priority: "high",
    notifyCEO: false,
    schedule: "Sunday 20:00",
    examples: [
      "Relatório da Lena",
      "Análise de performance",
      "Comparações semanais",
    ],
  },

  resultados: {
    name: "resultados",
    purpose: "Relatórios e conquistas da agência",
    types: ["milestone", "success", "celebration", "milestone_reached", "success_celebration", "weekly_report", "monthly_report"],
    priority: "low",
    notifyCEO: false,
    examples: [
      "Post atingiu 10% de engajamento",
      "1000 seguidores alcançados",
      "Melhor semana do mês",
    ],
  },
}

export type ChannelName = keyof typeof CHANNEL_MAP

export const DEFAULT_CHANNEL: ChannelName = "geral"

/**
 * Canais que sempre existem — criados no onboarding.
 */
export const DEFAULT_CHANNELS = [
  { name: "geral", description: CHANNEL_MAP.geral.purpose, isDefault: true },
  { name: "daily-standup", description: CHANNEL_MAP["daily-standup"].purpose, isDefault: true },
  { name: "aprovações", description: CHANNEL_MAP.aprovacoes.purpose, isDefault: false },
  { name: "alertas", description: CHANNEL_MAP.alertas.purpose, isDefault: false },
  { name: "estrategia", description: CHANNEL_MAP.estrategia.purpose, isDefault: false },
  { name: "instagram", description: CHANNEL_MAP.instagram.purpose, isDefault: false },
  { name: "linkedin", description: CHANNEL_MAP.linkedin.purpose, isDefault: false },
  { name: "blog-seo", description: CHANNEL_MAP["blog-seo"].purpose, isDefault: false },
  { name: "criativo", description: CHANNEL_MAP.criativo.purpose, isDefault: false },
  { name: "metricas", description: CHANNEL_MAP.metricas.purpose, isDefault: false },
  { name: "resultados", description: CHANNEL_MAP.resultados.purpose, isDefault: true },
]
