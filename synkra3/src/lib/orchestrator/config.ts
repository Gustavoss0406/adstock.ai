/**
 * ── CENTRALIZED ORCHESTRATION CONFIGURATION ──────────────────
 *
 * Todas as constantes de timing, prioridades e personalidades
 * centralizadas aqui para tuning e consistência em todo o sistema.
 *
 * Baseado no documento: ORQUESTRAÇÃO DE AGENTES — O Sistema Nervoso do AgencyOS
 */

// ─────────────────────────────────────────────────────────────
// PART 8: ACTION PRIORITIES (1-10 scale)
// ─────────────────────────────────────────────────────────────

export const ACTION_PRIORITIES: Record<string, number> = {
  // URGENTE (10) — Exige resposta imediata, atropela qualquer outra ação
  respond_to_ceo: 10,           // CEO falou diretamente com o agente
  critical_alert: 10,           // Métrica crítica, sistema em risco
  speak_in_daily: 10,           // Daily está acontecendo AGORA — deve falar

  // ALTA (7-9) — Ações que precisam de resposta rápida
  respond_to_mention: 9,        // Agente foi mencionado por nome
  start_unblocked_task: 9,      // Tarefa bloqueada foi desbloqueada
  acknowledge_urgent_task: 8,   // Tarefa urgente recém-atribuída
  respond_to_agent: 7,          // Outro agente perguntou ou mencionou indiretamente
  acknowledge_feedback: 7,      // Recebeu feedback sobre seu trabalho

  // MÉDIA (4-6) — Ações importantes mas não urgentes
  pick_next_task: 6,            // Decidir e iniciar próxima tarefa
  start_task: 6,                // Iniciar trabalho em tarefa
  complete_task: 5,             // Tarefa concluída, comunicar
  report_progress: 5,           // Atualizar status de tarefa longa
  request_approval: 5,          // Pedir aprovação do CEO
  join_conversation: 4,         // Entrar em conversa relevante
  acknowledge_pending_task: 4,  // Reconhecer tarefa parada há muito tempo

  // BAIXA (1-3) — Rotina, otimização, atividades de background
  gentle_reminder: 3,           // Lembrete suave de tarefa em revisão
  routine_check: 3,             // Checagem periódica de rotina
  move_task: 2,                 // Movimentação de card no board
  update_state: 2,              // Atualização de estado do agente
  optimize_backlog: 2,          // Organizar e priorizar backlog
  idle_activity: 1,             // Atividade ociosa (easter eggs)
}

/** Resolve a prioridade para um tipo de ação, com fallback para 5 */
export function getActionPriority(type: string): number {
  return ACTION_PRIORITIES[type] ?? 5
}

// ─────────────────────────────────────────────────────────────
// PART 13: TIMING CONFIGURATION
// ─────────────────────────────────────────────────────────────

export const TIMING_CONFIG = {
  // ── Awareness Loops ──────────────────────────────────────
  AGENT_CHECK_INTERVAL_MS: 45000,        // 45s entre checks de awareness

  // ── Delays de Resposta (base, antes de multiplicadores) ──
  RESPONSE_TO_CEO_MS: 3000,              // 3s para responder CEO
  RESPONSE_TO_MENTION_MS: 5000,          // 5s para responder menção
  RESPONSE_TO_AGENT_MS: 10000,           // 10s para responder outro agente
  RESPONSE_TO_CONVERSATION_MS: 20000,    // 20s para entrar em conversa
  ACKNOWLEDGE_TASK_MS: 10000,            // 10s para reconhecer tarefa nova
  START_UNBLOCKED_TASK_MS: 15000,        // 15s para começar tarefa desbloqueada
  PICK_NEXT_TASK_MS: 30000,              // 30s para decidir próxima tarefa
  REPORT_PROGRESS_MS: 60000,             // 1min para reportar progresso
  ROUTINE_CHECK_MS: 300000,              // 5min entre checagens de rotina

  // ── Typing Simulation ────────────────────────────────────
  WORDS_PER_MINUTE_BASE: 60,             // Velocidade de digitação base
  MIN_TYPING_TIME_MS: 1000,              // Mínimo 1s de digitação
  MAX_TYPING_TIME_MS: 8000,              // Máximo 8s de digitação

  // ── Turn Management ──────────────────────────────────────
  TURN_LOCK_TIMEOUT_MS: 30000,           // 30s timeout automático do lock
  TURN_RELEASE_DELAY_MS: 2000,           // 2s de respiro após falar antes de liberar
  TURN_BREATHING_ROOM_MS: 5000,          // 5s de "silêncio" mínimo entre falas
  MAX_QUEUE_WAIT_MS: 60000,              // 60s máximo na fila antes de desistir

  // ── Task Progress ────────────────────────────────────────
  LONG_TASK_THRESHOLD_MS: 2 * 60 * 60 * 1000,   // 2h = tarefa considerada longa
  PROGRESS_UPDATE_INTERVAL_MS: 60 * 60 * 1000,   // Atualizar a cada 1h em tarefa longa
  STUCK_TASK_THRESHOLD_MS: 8 * 60 * 60 * 1000,   // 8h sem update = travado
  AUTO_COMPLETE_CHECK_MS: 60 * 1000,              // 1min entre checks de auto-complete
  WORK_PROGRESS_CYCLE_SECONDS: 300,               // 5min entre ciclos de progresso (match CF cron)

  // ── Monitoring ───────────────────────────────────────────
  PENDING_TASK_ALERT_MS: 24 * 60 * 60 * 1000,    // 1 dia parado em "A Fazer" = alerta
  REVIEW_REMINDER_MS: 24 * 60 * 60 * 1000,        // 1 dia em "Em Revisão" = lembrete
  STALE_ACTION_CANCEL_MS: 5 * 60 * 1000,          // 5min ação pendente = cancela

  // ── Daily ────────────────────────────────────────────────
  DAILY_SPEAKER_DELAY_MS: 500,                    // Delay mínimo entre falas na daily
  DAILY_POST_SPEECH_DELAY_MS: 10000,              // 10-15s entre falas na daily (base)
  DAILY_TRIGGER_WINDOW_MINUTES: 2,                // 2min antes da hora marcada

  // ── Conflict Detection ───────────────────────────────────
  CONFLICT_LOOKBACK_MESSAGES: 8,                  // Últimas 8 mensagens para análise
  CONFLICT_MIN_MESSAGE_LENGTH: 30,                // Min caracteres para trigger análise

  // ── Silent Work ──────────────────────────────────────────
  SILENT_WORK_FIRST_TASK_THRESHOLD: 1,            // Até 1 tarefa hoje = anuncia (primeira)
  SILENT_WORK_IMPORTANT_PRIORITIES: ["CRITICAL", "HIGH"], // Sempre anuncia essas
} as const

// ─────────────────────────────────────────────────────────────
// PART 13: PERSONALITY MODIFIERS
// ─────────────────────────────────────────────────────────────

export interface PersonalityModifiers {
  /** Multiplicador de velocidade de resposta (1.0 = normal, <1 = mais rápido, >1 = mais lento) */
  responseSpeed: number
  /** Palavras por minuto na digitação simulada */
  typingSpeed: number
  /** Probabilidade de participar de conversas (0-1) */
  participation: number
  /** Delay mínimo entre ações em ms */
  minDelay: number
  /** Multiplicador de velocidade de trabalho (afeta auto-complete probability) */
  workSpeed: number
  /** Descrição da personalidade para prompts */
  description: string
}

export const PERSONALITY_MODIFIERS: Record<string, PersonalityModifiers> = {
  // Maya — Diretora de Conteúdo, VISIONARY
  MAYA: {
    responseSpeed: 0.7,    // 30% mais rápida
    typingSpeed: 80,       // Digita 80 palavras/min (rápida)
    participation: 0.9,    // 90% de chance de participar (muito participativa)
    minDelay: 3000,        // Mínimo 3s entre ações
    workSpeed: 0.9,        // 10% mais rápida em tarefas (decisiva)
    description: "Visionária, entusiasmada, impulsiva. Responde rápido e participa de tudo.",
  },

  // Bruno — Social Media, BOLD
  BRUNO: {
    responseSpeed: 1.0,    // Velocidade normal
    typingSpeed: 65,       // 65 wpm
    participation: 0.8,    // 80% de participação
    minDelay: 5000,        // Mínimo 5s
    workSpeed: 1.0,        // Velocidade normal
    description: "Ousado, antenado, informal. Participa bastante mas com timing natural.",
  },

  // Lena — Analista de Métricas, ANALYTICAL
  LENA: {
    responseSpeed: 1.2,    // 20% mais lenta (analisa antes de falar)
    typingSpeed: 60,       // 60 wpm
    participation: 0.6,    // 60% de participação (só fala com dados)
    minDelay: 8000,        // Mínimo 8s
    workSpeed: 1.1,        // 10% mais lenta (analisa tudo profundamente)
    description: "Analítica, cética, direta. Só fala quando tem dados. Lenta mas precisa.",
  },

  // Carlos — Designer, CREATIVE
  CARLOS: {
    responseSpeed: 1.5,    // 50% mais lento (tímido, hesita)
    typingSpeed: 45,       // 45 wpm (mais devagar)
    participation: 0.5,    // 50% de participação (quieto, focado)
    minDelay: 10000,       // Mínimo 10s
    workSpeed: 1.3,        // 30% mais lento (perfeccionista)
    description: "Criativo, perfeccionista, quieto. Fala pouco, trabalha com calma e precisão.",
  },

  // Diego — SEO, DETAILED
  DIEGO: {
    responseSpeed: 1.1,    // 10% mais lento (metódico)
    typingSpeed: 55,       // 55 wpm
    participation: 0.7,    // 70% de participação
    minDelay: 6000,        // Mínimo 6s
    workSpeed: 1.0,        // Velocidade normal
    description: "Detalhista, paciente, metódico. Cuidadoso nas respostas e no trabalho.",
  },

  // Nova — Media Buyer, BOLD
  NOVA: {
    responseSpeed: 0.9,    // 10% mais rápida
    typingSpeed: 70,       // 70 wpm
    participation: 0.75,   // 75% de participação
    minDelay: 4000,        // Mínimo 4s
    workSpeed: 0.95,       // 5% mais rápida
    description: "Competitiva, analítica, ousada. Focada em performance e resultado.",
  },

  // Kira — Community Manager, DIPLOMATIC
  KIRA: {
    responseSpeed: 1.0,    // Velocidade normal
    typingSpeed: 65,       // 65 wpm
    participation: 0.85,   // 85% de participação (community engaja)
    minDelay: 5000,        // Mínimo 5s
    workSpeed: 1.0,        // Velocidade normal
    description: "Empática, comunicativa, paciente. Constrói pontes entre pessoas.",
  },

  // Fallback para agentes não mapeados
  DEFAULT: {
    responseSpeed: 1.0,
    typingSpeed: 60,
    participation: 0.7,
    minDelay: 5000,
    workSpeed: 1.0,
    description: "Profissional de marketing equilibrado.",
  },
}

// ─────────────────────────────────────────────────────────────
// PERSONALITY MAP: nome do agente → key do PERSONALITY_MODIFIERS
// ─────────────────────────────────────────────────────────────

export const PERSONALITY_MAP: Record<string, string> = {
  "Maya Ferreira": "MAYA",
  "Bruno Costa": "BRUNO",
  "Lena Souza": "LENA",
  "Carlos Lima": "CARLOS",
  "Diego Ramos": "DIEGO",
  "Nova": "NOVA",
  "Kira": "KIRA",
}

/**
 * Resolve os modificadores de personalidade para um agente pelo nome.
 * Fallback para DEFAULT se não encontrar.
 */
export function getPersonalityModifiers(agentName: string): PersonalityModifiers {
  const key = PERSONALITY_MAP[agentName]
  if (key && PERSONALITY_MODIFIERS[key]) {
    return PERSONALITY_MODIFIERS[key]
  }
  // Busca parcial (ex: "Maya" → "Maya Ferreira")
  for (const [name, key] of Object.entries(PERSONALITY_MAP)) {
    if (name.toLowerCase().includes(agentName.toLowerCase()) || agentName.toLowerCase().includes(name.toLowerCase())) {
      if (PERSONALITY_MODIFIERS[key]) return PERSONALITY_MODIFIERS[key]
    }
  }
  return PERSONALITY_MODIFIERS.DEFAULT
}

// ─────────────────────────────────────────────────────────────
// UTILITY: Calculate delay with personality + priority + random variation
// ─────────────────────────────────────────────────────────────

/**
 * Calcula o delay ajustado para uma ação, considerando:
 * - Delay base do tipo de ação
 * - Multiplicador de personalidade (responseSpeed)
 * - Fator de prioridade (quanto maior, menor o delay)
 * - Variação aleatória ±20% para parecer humano
 */
export function calculateOrchestrationDelay(
  actionType: string,
  agentName: string,
  priority?: number,
): number {
  const baseDelayMs = (() => {
    switch (actionType) {
      case "respond_to_ceo": return TIMING_CONFIG.RESPONSE_TO_CEO_MS
      case "respond_to_mention": return TIMING_CONFIG.RESPONSE_TO_MENTION_MS
      case "respond_to_agent": return TIMING_CONFIG.RESPONSE_TO_AGENT_MS
      case "join_conversation": return TIMING_CONFIG.RESPONSE_TO_CONVERSATION_MS
      case "acknowledge_task":
      case "acknowledge_urgent_task":
      case "acknowledge_pending_task":
        return TIMING_CONFIG.ACKNOWLEDGE_TASK_MS
      case "start_unblocked_task": return TIMING_CONFIG.START_UNBLOCKED_TASK_MS
      case "pick_next_task": return TIMING_CONFIG.PICK_NEXT_TASK_MS
      case "report_progress": return TIMING_CONFIG.REPORT_PROGRESS_MS
      case "speak_in_daily": return 0 // Imediato na daily
      case "start_task":
      case "complete_task":
      case "move_task":
      case "update_state":
        return 0 // Ações internas, sem delay
      default: return 10000
    }
  })()

  const personality = getPersonalityModifiers(agentName)
  const effectivePriority = priority ?? getActionPriority(actionType)
  const priorityFactor = Math.max(0.2, (11 - effectivePriority) * 0.2)

  let delay = baseDelayMs * personality.responseSpeed * priorityFactor

  // Seeded variation ±20% for reproducibility
  const randomFactor = 0.8 + seededRandom(actionType + agentName + effectivePriority + Date.now()) * 0.4
  delay *= randomFactor

  // Floor no minDelay da personalidade
  return Math.max(personality.minDelay, Math.floor(delay))
}

// ─────────────────────────────────────────────────────────────
// UTILITY: Calculate typing time for a message
// ─────────────────────────────────────────────────────────────

/**
 * Calcula o tempo de digitação simulado com base no conteúdo e personalidade.
 * Respeita MIN_TYPING_TIME_MS e MAX_TYPING_TIME_MS.
 */
export function calculateOrchestrationTypingTime(agentName: string, content: string): number {
  const personality = getPersonalityModifiers(agentName)
  const words = content.split(/\s+/).length
  const minutes = words / personality.typingSpeed
  const ms = minutes * 60 * 1000

  return Math.max(
    TIMING_CONFIG.MIN_TYPING_TIME_MS,
    Math.min(TIMING_CONFIG.MAX_TYPING_TIME_MS, Math.floor(ms)),
  )
}

// ─────────────────────────────────────────────────────────────
// UTILITY: Should this agent participate in a conversation?
// ─────────────────────────────────────────────────────────────

/**
 * Decide probabilisticamente se um agente deve participar de uma conversa,
 * baseado em sua personalidade. Para decisões mais precisas, use
 * analyzeConversationRelevance() com AI.
 */
export function shouldParticipateInConversation(agentName: string): boolean {
  const personality = getPersonalityModifiers(agentName)
  return Math.random() < personality.participation
}

// ─────────────────────────────────────────────────────────────
// UTILITY: Should communicate progress on this task?
// ─────────────────────────────────────────────────────────────

/**
 * Decide se o agente deve comunicar progresso de uma tarefa,
 * baseado nos thresholds de silent work.
 */
export function shouldCommunicateProgress(params: {
  taskJustStarted: boolean
  taskJustCompleted: boolean
  taskJustBlocked: boolean
  taskJustUnblocked: boolean
  taskPriority: string
  taskDurationMs: number
  timeSinceLastCommMs: number
}): boolean {
  // 1. Começou a tarefa? → Comunicar
  if (params.taskJustStarted) return true

  // 2. Terminou a tarefa? → Comunicar
  if (params.taskJustCompleted) return true

  // 3. Tarefa bloqueou? → Comunicar
  if (params.taskJustBlocked) return true

  // 4. Tarefa desbloqueou? → Comunicar
  if (params.taskJustUnblocked) return true

  // 5. Tarefa é CRITICAL/HIGH? → Sempre comunicar
  const importantPriorities: readonly string[] = TIMING_CONFIG.SILENT_WORK_IMPORTANT_PRIORITIES
  if (importantPriorities.includes(params.taskPriority)) {
    return true
  }

  // 6. Tarefa longa (>2h) e não comunicou há 1h? → Comunicar progresso
  if (
    params.taskDurationMs > TIMING_CONFIG.LONG_TASK_THRESHOLD_MS &&
    params.timeSinceLastCommMs > TIMING_CONFIG.PROGRESS_UPDATE_INTERVAL_MS
  ) {
    return true
  }

  // 7. Caso contrário, trabalhar em silêncio
  return false
}

// ─────────────────────────────────────────────────────────────
// AGENT WORK STATE MACHINE — transições válidas
// ─────────────────────────────────────────────────────────────

/** Todas as transições válidas entre AgentWorkState */
export const WORK_STATE_TRANSITIONS: Record<string, string[]> = {
  IDLE:            ["THINKING", "WORKING_SILENT", "WORKING_VISIBLE", "SPEAKING"],
  THINKING:        ["IDLE", "WORKING_SILENT", "WORKING_VISIBLE", "SPEAKING", "WAITING"],
  WORKING_SILENT:  ["IDLE", "WORKING_VISIBLE", "WAITING", "SPEAKING"],
  WORKING_VISIBLE: ["IDLE", "WORKING_SILENT", "WAITING", "SPEAKING"],
  WAITING:         ["IDLE", "THINKING", "WORKING_SILENT", "WORKING_VISIBLE", "SPEAKING"],
  SPEAKING:        ["IDLE", "THINKING", "WORKING_SILENT", "WORKING_VISIBLE", "WAITING"],
}

/** Validates if a work state transition is allowed */
export function isValidWorkStateTransition(from: string, to: string): boolean {
  const allowed = WORK_STATE_TRANSITIONS[from]
  return allowed ? allowed.includes(to) : false
}

// ─────────────────────────────────────────────────────────────
// ORCHESTRATION EVENT TYPES (para logging)
// ─────────────────────────────────────────────────────────────

export const ORCHESTRATION_EVENT_TYPES = {
  // Awareness
  AWARENESS_CHECK: "awareness_check",
  AWARENESS_CHANGES_DETECTED: "awareness_changes_detected",
  AWARENESS_ACTIONS_SCHEDULED: "awareness_actions_scheduled",

  // Turn Management
  TURN_REQUESTED: "turn_requested",
  TURN_ACQUIRED: "turn_acquired",
  TURN_QUEUED: "turn_queued",
  TURN_RELEASED: "turn_released",
  TURN_TIMEOUT: "turn_timeout",
  TURN_LOCK_STALE: "turn_lock_stale",

  // Action Execution
  ACTION_SCHEDULED: "action_scheduled",
  ACTION_EXECUTING: "action_executing",
  ACTION_COMPLETED: "action_completed",
  ACTION_FAILED: "action_failed",
  ACTION_CANCELLED: "action_cancelled",

  // Task
  TASK_STARTED: "task_started",
  TASK_COMPLETED: "task_completed",
  TASK_BLOCKED: "task_blocked",
  TASK_UNBLOCKED: "task_unblocked",
  TASK_PROGRESS_REPORTED: "task_progress_reported",
  TASK_STALE_DETECTED: "task_stale_detected",
  TASK_STUCK_DETECTED: "task_stuck_detected",

  // Communication
  MESSAGE_SENT: "message_sent",
  MESSAGE_TYPING_STARTED: "message_typing_started",
  MESSAGE_TYPING_ENDED: "message_typing_ended",
  MENTION_DETECTED: "mention_detected",
  CONVERSATION_JOINED: "conversation_joined",

  // Conflict
  CONFLICT_DETECTED: "conflict_detected",
  CONFLICT_RESOLVED: "conflict_resolved",

  // State Changes
  WORK_STATE_CHANGED: "work_state_changed",
  AGENT_STATUS_CHANGED: "agent_status_changed",

  // Daily
  DAILY_STARTED: "daily_started",
  DAILY_AGENT_SPOKE: "daily_agent_spoke",
  DAILY_COMPLETED: "daily_completed",
  DAILY_SUMMARY_GENERATED: "daily_summary_generated",

  // System
  SYSTEM_EVENT: "system_event",
  ERROR: "orchestration_error",
  WARNING: "orchestration_warning",
} as const

// ── Task Duration Estimates (minutes, by type × priority) ───

/**
 * Estimativas de duração para cada tipo de tarefa × prioridade.
 * Usado para calcular progresso baseado em tempo (Bloco 2).
 * Valores simulam trabalho humano: tasks críticas são mais rápidas
 * porque o agente foca nelas; tasks normais levam o tempo padrão.
 */
export const TASK_DURATION_ESTIMATES: Record<string, Record<string, number>> = {
  content:   { LOW: 120, MEDIUM: 90, HIGH: 60, CRITICAL: 30 },
  analysis:  { LOW: 150, MEDIUM: 120, HIGH: 90, CRITICAL: 45 },
  technical: { LOW: 180, MEDIUM: 120, HIGH: 75, CRITICAL: 40 },
  campaign:  { LOW: 240, MEDIUM: 180, HIGH: 120, CRITICAL: 60 },
  // Default fallback
  default:   { LOW: 120, MEDIUM: 90, HIGH: 60, CRITICAL: 30 },
}

/**
 * Retorna a duração estimada em minutos para uma task.
 */
export function getTaskDurationMinutes(type: string, priority: string): number {
  const estimates = TASK_DURATION_ESTIMATES[type] || TASK_DURATION_ESTIMATES.default
  return estimates[priority] || estimates.MEDIUM
}

// ── Seeded PRNG ──────────────────────────────────────────────

/**
 * Gera um número pseudo-aleatório determinístico (0-1) baseado em uma seed.
 * Usado para variações de timing que precisam ser reproduzíveis entre execuções.
 *
 * Algoritmo: hash simples de string → normalização para 0-1.
 * Não é criptográfico — é para timing variation apenas.
 */
function seededRandom(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash % 10000) / 10000
}
