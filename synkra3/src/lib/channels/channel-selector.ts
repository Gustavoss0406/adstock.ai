/**
 * ── CHANNEL SELECTOR ─────────────────────────────────────
 *
 * Analisa a mensagem e o contexto para escolher o canal ideal.
 * Usado automaticamente pelo postAgentMessage e postWithTurn.
 */

import type { ChannelName } from "./channel-map"

export interface MessageContext {
  content: string
  agentId: string
  agentRole?: string
  messageType: string
  metadata?: {
    taskType?: string
    priority?: string
    urgency?: "low" | "medium" | "high" | "critical"
    needsCEOApproval?: boolean
    platform?: string
    isBlocked?: boolean
    isAlert?: boolean
    metricChange?: number
  }
}

export function selectBestChannel(context: MessageContext): ChannelName {
  const { messageType, metadata, content, agentRole } = context
  const contentLower = content.toLowerCase()

  // ── GUARD: empty content → geral ──
  if (!content || content.trim().length === 0) {
    return "geral"
  }

  // ── REGRA 1: Plataforma específica (deve vir antes das keywords) ──
  const platformLower = (metadata?.platform || "").toLowerCase()
  if (platformLower === "instagram") return "instagram"
  if (platformLower === "linkedin") return "linkedin"

  // ── REGRA 2: Aprovações ──
  if (
    metadata?.needsCEOApproval ||
    messageType === "request_approval" ||
    messageType === "approval_request" ||
    messageType === "content_ready" ||
    messageType === "task_completed" ||
    messageType === "complete_task" ||
    messageType === "team_vote" ||
    contentLower.includes("aprovar") ||
    contentLower.includes("aprovação") ||
    contentLower.includes("pronto para revisão") ||
    (contentLower.includes("ceo") && (contentLower.includes("aprovar") || contentLower.includes("aprova")))
  ) {
    return "aprovações"
  }

  // ── REGRA 2: Relatórios e métricas (ANTES de alertas) ──
  if (
    messageType === "weekly_report" ||
    messageType === "metric_analysis" ||
    messageType === "report" ||
    messageType === "daily_checkpoint" ||
    messageType === "weekly_planning" ||
    contentLower.includes("relatório") ||
    contentLower.includes("análise de performance") ||
    contentLower.includes("checkpoint")
  ) {
    return "metricas"
  }

  // ── REGRA 3: Alertas e bloqueios ──
  if (
    metadata?.isBlocked ||
    metadata?.isAlert ||
    metadata?.urgency === "critical" ||
    messageType === "task_blocked" ||
    messageType === "api_error" ||
    messageType === "metric_alert" ||
    messageType === "conflict_detected" ||
    messageType === "alert_critical" ||
    contentLower.includes("bloqueado") ||
    contentLower.includes("erro crítico") ||
    contentLower.includes("fora do ar") ||
    contentLower.includes("urgente") ||
    (contentLower.includes("caiu") && (contentLower.includes("%") || contentLower.includes("métrica")) && !contentLower.includes("relatório"))
  ) {
    return "alertas"
  }

  // ── REGRA 4: Daily standup ──
  if (
    messageType === "daily_start" ||
    messageType === "daily_response" ||
    messageType === "daily_summary" ||
    messageType === "daily_speech" ||
    messageType === "speak_in_daily" ||
    messageType === "pre_daily" ||
    contentLower.includes("daily") ||
    contentLower.includes("plano do dia") ||
    contentLower.includes("standup")
  ) {
    return "daily-standup"
  }

  // ── REGRA 5: Plataforma específica (keyword-based, metadata já tratado no topo) ──
  if (
    contentLower.includes("instagram") ||
    contentLower.includes("post do insta") ||
    contentLower.includes("reel") ||
    contentLower.includes("stories")
  ) {
    return "instagram"
  }

  if (
    contentLower.includes("linkedin") ||
    contentLower.includes("artigo b2b") ||
    contentLower.includes("linkedin post")
  ) {
    return "linkedin"
  }

  // ── REGRA 6: SEO e blog ──
  if (
    metadata?.taskType === "seo" ||
    metadata?.taskType === "blog" ||
    messageType === "seo_research" ||
    messageType === "keyword_research" ||
    messageType === "content_optimization" ||
    contentLower.includes("seo") ||
    contentLower.includes("blog") ||
    contentLower.includes("palavra-chave") ||
    contentLower.includes("keyword") ||
    contentLower.includes("otimização") ||
    contentLower.includes("rank") ||
    contentLower.includes("orgânico")
  ) {
    return "blog-seo"
  }

  // ── REGRA 7: Criativo (design/copy) ──
  if (
    messageType === "artwork_created" ||
    messageType === "content_created" ||
    messageType === "campaign_creative" ||
    agentRole === "DESIGNER" ||
    agentRole === "COPYWRITER" ||
    contentLower.includes("arte") ||
    contentLower.includes("design") ||
    contentLower.includes("copy") ||
    contentLower.includes("criativo") ||
    contentLower.includes("briefing") ||
    contentLower.includes("protótipo")
  ) {
    return "criativo"
  }

  // ── REGRA 8: Estratégia ──
  if (
    messageType === "calendar_created" ||
    messageType === "strategy_change" ||
    messageType === "campaign" ||
    contentLower.includes("calendário") ||
    contentLower.includes("estratégia") ||
    contentLower.includes("sprint") ||
    contentLower.includes("roadmap") ||
    contentLower.includes("planejamento")
  ) {
    return "estrategia"
  }

  // ── REGRA 9: Celebrações / resultados ──
  if (
    messageType === "milestone_reached" ||
    messageType === "success_celebration" ||
    contentLower.includes("parabéns") ||
    contentLower.includes("alcançamos") ||
    contentLower.includes("conquistamos") ||
    contentLower.includes("bateu recorde") ||
    contentLower.includes("melhor semana")
  ) {
    return "resultados"
  }

  // ── REGRA 10: Fallback por agente ──
  const agentDefaultChannels: Record<string, ChannelName> = {
    STRATEGIST: "estrategia",
    DESIGNER: "criativo",
    COPYWRITER: "criativo",
    ANALYST: "metricas",
    SOCIAL_MEDIA: "instagram",
    SEO: "blog-seo",
    MEDIA_BUYER: "metricas",
    COMMUNITY_MANAGER: "instagram",
    CREATIVE_DIRECTOR: "criativo",
    TRAFFIC_MANAGER: "metricas",
  }

  if (agentRole && agentDefaultChannels[agentRole]) {
    return agentDefaultChannels[agentRole]
  }

  return "geral"
}

/**
 * Retorna o messageType correto baseado na ação do executor,
 * para que o channel selector possa rotear corretamente.
 */
export function getMessageTypeForAction(actionType: string): string {
  const map: Record<string, string> = {
    post_message: "announcement",
    respond_to_mention: "mention_response",
    respond_to_agent: "agent_conversation",
    respond_to_ceo: "ceo_response",
    join_conversation: "agent_conversation",
    acknowledge_task: "task_started",
    acknowledge_urgent_task: "task_started",
    acknowledge_pending_task: "task_started",
    acknowledge_feedback: "task_update",
    start_task: "task_started",
    start_unblocked_task: "task_started",
    complete_task: "task_completed",
    report_progress: "task_progress",
    pick_next_task: "task_started",
    move_task: "task_update",
    update_task: "task_update",
    request_approval: "request_approval",
    speak_in_daily: "daily_speech",
    update_state: "state_change",
    gentle_reminder: "reminder",
    routine_check: "health_check",
  }
  return map[actionType] || actionType
}
