/**
 * ── COMMUNICATION RULES ENGINE ────────────────────────────
 *
 * Sistema de economia de comunicação para agentes.
 * Princípio: agentes só falam quando há informação acionável.
 */

import { prisma } from "@/lib/prisma"
import type { CommunicationState, VerbosityLevel } from "@prisma/client"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ActionableEventType =
  | "task_completed"
  | "task_blocked"
  | "conflict_detected"
  | "approval_needed"
  | "alert_critical"
  | "mentioned"
  | "ceo_message"
  | "meeting_speech"
  | "task_progress"
  | "task_started"
  | "acknowledge_task"
  | "report_progress"
  | "post_message"
  | "respond_to_agent"
  | "join_conversation"
  | "gentle_reminder"
  | "daily_checkpoint"
  | "weekly_report"

interface ShouldSpeakContext {
  verbosityLevel: VerbosityLevel
  agentId: string
  organizationId: string
  threadId?: string
  channelId?: string | null
  content?: string
  mentionedAgentId?: string
  daysPending?: number
  priority?: number
}

// ─────────────────────────────────────────────────────────────
// Event permission matrix per verbosity level
// ─────────────────────────────────────────────────────────────

const EVENT_PERMISSIONS: Record<
  VerbosityLevel,
  Partial<Record<ActionableEventType, boolean>>
> = {
  SILENT: {
    task_completed: false,
    task_blocked: true,
    conflict_detected: true,
    approval_needed: true,
    alert_critical: true,
    mentioned: true,
    ceo_message: true,
    meeting_speech: true,
    daily_checkpoint: false,
    weekly_report: false,
    task_started: false,
    acknowledge_task: false,
    report_progress: false,
    post_message: false,
    respond_to_agent: false,
    join_conversation: false,
    gentle_reminder: false,
  },
  MINIMAL: {
    task_completed: true,
    task_blocked: true,
    conflict_detected: true,
    approval_needed: true,
    alert_critical: true,
    mentioned: true,
    ceo_message: true,
    meeting_speech: true,
    daily_checkpoint: true,
    weekly_report: true,
    task_started: false,
    acknowledge_task: false,
    report_progress: false,
    post_message: false,
    respond_to_agent: false,
    join_conversation: false,
    gentle_reminder: false,
  },
  BALANCED: {
    task_completed: true,
    task_blocked: true,
    conflict_detected: true,
    approval_needed: true,
    alert_critical: true,
    mentioned: true,
    ceo_message: true,
    meeting_speech: true,
    daily_checkpoint: true,
    weekly_report: true,
    task_started: false,
    acknowledge_task: false,
    report_progress: false,
    post_message: false,
    respond_to_agent: true,
    join_conversation: false,
    gentle_reminder: true,
  },
  VERBOSE: {
    task_completed: true,
    task_blocked: true,
    conflict_detected: true,
    approval_needed: true,
    alert_critical: true,
    mentioned: true,
    ceo_message: true,
    meeting_speech: true,
    daily_checkpoint: true,
    weekly_report: true,
    task_started: true,
    acknowledge_task: true,
    report_progress: true,
    post_message: true,
    respond_to_agent: true,
    join_conversation: true,
    gentle_reminder: true,
  },
}

// ─────────────────────────────────────────────────────────────
// Spam phrases that are always blocked
// ─────────────────────────────────────────────────────────────

const BLOCKED_PHRASES = [
  /^(ok|okay|certo|beleza|valeu|obrigado|boa|legal|perfeito|top|show|demais|maneiro|bora|vamos|lindo|maravilhoso)[!.,]*$/i,
  /^(qualquer coisa|se precisar|tamo junto|estou a disposicao|conte comigo|precisar e so chamar)/i,
  /^(vou começar|vou iniciar|vou fazer|deixa comigo|pode deixar|farei isso)/i,
  /^[👍💜🔥😊👏🎉✨🚀💪🙌♥️🫶]+$/,
  /^(bom dia|boa tarde|boa noite) (pessoal|time|galera|equipe)[!]*$/i,
  /^(estou trabalhando|continuo trabalhando|seguimos|tamo na atividade)/i,
  /^(bora time|vamos que vamos|foco pessoal)/i,
  /^(otimo trabalho|parabens|mandou bem|arrasou)/i,
]

// ─────────────────────────────────────────────────────────────
// Core function
// ─────────────────────────────────────────────────────────────

export async function shouldAgentSpeak(
  eventType: ActionableEventType,
  ctx: ShouldSpeakContext,
): Promise<{ allowed: boolean; reason?: string }> {
  // 1. Check if agent is muted
  const isMuted = await checkIfMuted(ctx.agentId)
  if (isMuted) {
    return { allowed: false, reason: "agent_muted" }
  }

  // 2. Check communication state (skip if VERBOSE mode)
  const agent = await prisma.agent.findUnique({
    where: { id: ctx.agentId },
    select: { communicationState: true },
  })
  const state = agent?.communicationState || "SILENT"
  const isVerbose = ctx.verbosityLevel === "VERBOSE"

  // SILENT: only critical events (unless VERBOSE mode overrides)
  if (state === "SILENT" && !isVerbose) {
    const criticalEvents: ActionableEventType[] = [
      "task_completed",
      "task_blocked",
      "conflict_detected",
      "approval_needed",
      "alert_critical",
      "ceo_message",
      "mentioned",
      "meeting_speech",
    ]
    if (!criticalEvents.includes(eventType)) {
      return { allowed: false, reason: "agent_silent" }
    }
  }

  // RESPONSIVE: only when mentioned or critical
  if (state === "RESPONSIVE") {
    if (eventType !== "mentioned" && eventType !== "ceo_message" &&
        eventType !== "alert_critical" && eventType !== "task_blocked" &&
        eventType !== "conflict_detected") {
      const alreadyResponded = await checkRecentResponse(ctx.agentId, ctx.threadId)
      if (alreadyResponded) {
        return { allowed: false, reason: "already_responded_in_thread" }
      }
    }
  }

  // MEETING: free to speak
  if (state === "MEETING") {
    const meetingMsgCount = await getRecentMessageCount(ctx.agentId, 5)
    if (meetingMsgCount >= 5) {
      return { allowed: false, reason: "max_meeting_messages" }
    }
    return { allowed: true }
  }

  // MUTED: nothing allowed
  if (state === "MUTED") {
    return { allowed: false, reason: "agent_muted" }
  }

  // 3. Check verbosity permissions
  const permissions = EVENT_PERMISSIONS[ctx.verbosityLevel]
  if (permissions && permissions[eventType] === false) {
    return { allowed: false, reason: `verbosity_blocks_${eventType}` }
  }

  // 4. Check turn limits in thread
  if (ctx.threadId) {
    const turnsInThread = await countTurnsInThread(ctx.agentId, ctx.threadId)
    if (turnsInThread >= 2 && eventType !== "ceo_message" && eventType !== "alert_critical") {
      return { allowed: false, reason: "max_turns_in_thread" }
    }
  }

  // 5. Check for spam content
  if (ctx.content) {
    if (isSpamMessage(ctx.content)) {
      return { allowed: false, reason: "spam_content" }
    }
    if (ctx.content.length < 4 && eventType !== "task_completed") {
      return { allowed: false, reason: "message_too_short" }
    }
  }

  return { allowed: true }
}

// ─────────────────────────────────────────────────────────────
// State transitions
// ─────────────────────────────────────────────────────────────

export async function setAgentCommunicationState(
  agentId: string,
  state: CommunicationState,
): Promise<void> {
  await prisma.agent.update({
    where: { id: agentId },
    data: { communicationState: state },
  })
}

export async function transitionToWorking(agentId: string): Promise<void> {
  await prisma.agent.update({
    where: { id: agentId },
    data: { communicationState: "SILENT", workState: "WORKING_SILENT" },
  })
}

export async function transitionToTaskCompleted(agentId: string): Promise<void> {
  await prisma.agent.update({
    where: { id: agentId },
    data: { communicationState: "ACTIVE", workState: "IDLE" },
  })
}

export async function transitionToMentioned(agentId: string): Promise<void> {
  await prisma.agent.update({
    where: { id: agentId },
    data: { communicationState: "RESPONSIVE" },
  })
}

export async function transitionToMeeting(agentId: string): Promise<void> {
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      communicationState: "MEETING",
      status: "IN_MEETING",
      workState: "SPEAKING",
    },
  })
}

export async function endMeetingForAgent(agentId: string): Promise<void> {
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      communicationState: "SILENT",
      status: "ACTIVE",
      workState: "IDLE",
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function checkIfMuted(agentId: string): Promise<boolean> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { mutedUntil: true },
  })
  if (!agent?.mutedUntil) return false
  return new Date(agent.mutedUntil) > new Date()
}

async function checkRecentResponse(
  agentId: string,
  threadId?: string,
): Promise<boolean> {
  if (!threadId) return false
  const recentMsg = await prisma.message.findFirst({
    where: {
      agentId,
      metadata: { path: ["threadId"], equals: threadId },
      createdAt: { gte: new Date(Date.now() - 600000) },
    },
  })
  return !!recentMsg
}

async function countTurnsInThread(
  agentId: string,
  threadId: string,
): Promise<number> {
  const count = await prisma.message.count({
    where: {
      agentId,
      metadata: { path: ["threadId"], equals: threadId },
    },
  })
  return count
}

function isSpamMessage(content: string): boolean {
  const trimmed = content.trim()
  for (const pattern of BLOCKED_PHRASES) {
    if (pattern.test(trimmed)) return true
  }
  // Check for very short acknowledgments
  if (trimmed.length <= 3) return true
  return false
}

async function getRecentMessageCount(
  agentId: string,
  lastMinutes: number,
): Promise<number> {
  return prisma.message.count({
    where: {
      agentId,
      createdAt: { gte: new Date(Date.now() - lastMinutes * 60000) },
    },
  })
}

/**
 * Obtem o nivel de verbosidade da organizacao.
 */
export async function getVerbosityLevel(organizationId: string): Promise<VerbosityLevel> {
  const settings = await prisma.officeSettings.findUnique({
    where: { organizationId },
    select: { verbosityLevel: true },
  })
  return settings?.verbosityLevel || "BALANCED"
}

/**
 * Communication state machine: retorna o novo estado apos um evento.
 */
export function nextCommunicationState(
  current: CommunicationState,
  event: ActionableEventType,
): CommunicationState {
  const transitions: Record<string, Partial<Record<ActionableEventType, CommunicationState>>> = {
    SILENT: {
      task_completed: "ACTIVE",
      task_blocked: "ACTIVE",
      conflict_detected: "ACTIVE",
      mentioned: "RESPONSIVE",
      ceo_message: "RESPONSIVE",
      meeting_speech: "MEETING",
    },
    RESPONSIVE: {
      task_completed: "SILENT",
      post_message: "SILENT",
    },
    ACTIVE: {
      task_started: "SILENT",
      post_message: "SILENT",
    },
    MEETING: {
      task_started: "SILENT",
    },
  }
  return transitions[current]?.[event] || current
}
