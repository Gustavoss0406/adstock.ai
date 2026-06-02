/**
 * ── AUTONOMY DECISION MATRIX ─────────────────────────────────
 *
 * Define o que agentes podem fazer sozinhos vs o que precisa de aprovação do CEO.
 * Configurável por empresa via OfficeSettings.
 */

export type AutonomousAction =
  | "create_internal_task"     | "distribute_task"
  | "inter_agent_chat"         | "document_progress"
  | "create_content"           | "publish_content"
  | "change_strategy"          | "spend_money"
  | "reply_comments"           | "schedule_post"
  | "create_blog_post"         | "analyze_metrics"
  | "start_working"            | "pick_next_task"
  | "complete_task"

export type ApprovalLevel = "autonomous" | "team_vote" | "ceo_required"

const DEFAULT_MATRIX: Record<AutonomousAction, ApprovalLevel> = {
  create_internal_task: "autonomous",
  distribute_task: "autonomous",
  inter_agent_chat: "autonomous",
  document_progress: "autonomous",
  start_working: "autonomous",
  pick_next_task: "autonomous",
  analyze_metrics: "autonomous",
  complete_task: "autonomous",

  create_content: "team_vote",
  schedule_post: "autonomous",
  reply_comments: "team_vote",
  create_blog_post: "team_vote",

  publish_content: "ceo_required",
  change_strategy: "ceo_required",
  spend_money: "ceo_required",
}

export function canActAutonomously(action: AutonomousAction, settings?: any): boolean {
  // Check company-specific settings first
  if (settings?.autonomousActions) {
    const level = settings.autonomousActions[action]
    if (level) return level === "autonomous"
  }

  const level = DEFAULT_MATRIX[action] || "ceo_required"
  return level === "autonomous"
}

export function needsTeamVote(action: AutonomousAction, settings?: any): boolean {
  if (settings?.autonomousActions) {
    const level = settings.autonomousActions[action]
    if (level) return level === "team_vote"
  }

  return DEFAULT_MATRIX[action] === "team_vote"
}

export function needsCEOApproval(action: AutonomousAction, settings?: any): boolean {
  return !canActAutonomously(action, settings) && !needsTeamVote(action, settings)
}

export function getApprovalLevel(action: AutonomousAction, settings?: any): ApprovalLevel {
  if (settings?.autonomousActions?.[action]) return settings.autonomousActions[action]
  return DEFAULT_MATRIX[action] || "ceo_required"
}
