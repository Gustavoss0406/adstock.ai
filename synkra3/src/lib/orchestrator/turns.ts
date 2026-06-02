/**
 * ── TURN MANAGER v2 ─────────────────────────────────────────
 *
 * Garante que apenas 1 agente fala por vez em cada canal.
 *
 * ARQUITETURA ATUAL: In-memory Map (single process).
 *
 * ═══════════════════════════════════════════════════════════
 * PLANO DE MIGRAÇÃO: Redis / Cloudflare Durable Objects
 * ═══════════════════════════════════════════════════════════
 *
 * ## Opção A: Redis (recomendado para Vercel + Upstash)
 *
 *   Estrutura de chaves:
 *     lock:{channelId}        → JSON { lockedBy, lockedAt }
 *     queue:{channelId}       → LIST de { agentId, priority, queuedAt }
 *     typing:{channelId}      → JSON { agentId, agentName, startedAt }
 *
 *   Operações:
 *     requestTurn  → SETNX lock:{ch} + RPUSH queue:{ch}
 *     releaseTurn  → DEL lock:{ch} + LPOP queue:{ch}
 *     waitForTurn  → BLPOP queue:{ch} com timeout
 *     lock timeout → SET lock:{ch} EX 30 (TTL automático)
 *
 *   Vantagem: TTL nativo do Redis elimina necessidade de timeout manual.
 *   Vantagem: BLPOP bloqueante substitui polling.
 *
 * ## Opção B: Cloudflare Durable Objects
 *
 *   Cada canal vira um Durable Object com estado próprio.
 *   WebSocket entre DO e clientes notifica mudanças de lock.
 *
 *   Vantagem: Consistência forte sem Redis. Já usa CF Workers.
 *   Desvantagem: Cold start em DOs (~100ms).
 *
 * ## Transição:
 *   1. Criar interface ITurnManager com as funções abaixo
 *   2. Implementar MemoryTurnManager (atual) e RedisTurnManager
 *   3. Feature flag por organizationId
 *   4. Migrar gradualmente
 *
 * ═══════════════════════════════════════════════════════════
 */

// ── Types ──────────────────────────────────────────────────

interface ChannelLock {
  channelId: string
  lockedBy: string | null  // agentId or "system"
  lockedAt: number | null
  queue: Array<{ agentId: string; agentName: string; priority: number; queuedAt: number }>
}

interface PersonalityTiming {
  responseSpeed: number
  typingSpeed: number
  participation: number
  minDelay: number
}

interface TypingState {
  agentId: string
  agentName: string
  startedAt: number
}

interface TurnResult {
  acquired: boolean
  position: number
}

// ── State ──────────────────────────────────────────────────

import { getPersonalityModifiers, TIMING_CONFIG } from "@/lib/orchestrator/config"

const LOCKS = new Map<string, ChannelLock>()
const TYPING = new Map<string, TypingState>()
const PENDING_RELEASES = new Map<string, ReturnType<typeof setTimeout>>()

const TURN_TIMEOUT_MS = 30000
const BREATHING_ROOM_MS = 2000
const WAIT_FOR_TURN_POLL_MS = 1000
const WAIT_FOR_TURN_DEFAULT_TIMEOUT_MS = 30000

// ── Internal ───────────────────────────────────────────────

function getLock(channelId: string): ChannelLock {
  if (!LOCKS.has(channelId)) {
    LOCKS.set(channelId, { channelId, lockedBy: null, lockedAt: null, queue: [] })
  }
  return LOCKS.get(channelId)!
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function processQueue(channelId: string): boolean {
  const lock = getLock(channelId)
  if (lock.lockedBy || lock.queue.length === 0) return false

  const next = lock.queue.shift()!
  lock.lockedBy = next.agentId
  lock.lockedAt = Date.now()
  return true
}

// ── Turn Acquisition / Release ─────────────────────────────

export function requestTurn(
  channelId: string,
  agentId: string,
  agentName: string,
  priority = 5,
): TurnResult {
  const lock = getLock(channelId)

  // Auto-release stale locks (prevents dead agent from holding channel forever)
  if (lock.lockedBy && lock.lockedAt && Date.now() - lock.lockedAt > TURN_TIMEOUT_MS) {
    lock.lockedBy = null
    lock.lockedAt = null
    processQueue(channelId)
  }

  // Já tem o lock? (evita re-enfileirar por condição de corrida com processQueue)
  if (lock.lockedBy === agentId) {
    lock.lockedAt = Date.now() // refresh lock timestamp
    return { acquired: true, position: 0 }
  }

  // Canal livre → pegar imediatamente
  if (!lock.lockedBy) {
    lock.lockedBy = agentId
    lock.lockedAt = Date.now()
    return { acquired: true, position: 0 }
  }

  // Canal ocupado → entrar na fila
  const position = lock.queue.filter(q => q.priority >= priority).length
  lock.queue.push({ agentId, agentName, priority, queuedAt: Date.now() })
  lock.queue.sort((a, b) => b.priority - a.priority || a.queuedAt - b.queuedAt)

  return { acquired: false, position: position + 1 }
}

/**
 * Versão síncrona do release (compatível com código existente).
 * Agenda o processamento da fila após o delay de respiro.
 * O timeout é rastreável e cancelável via PENDING_RELEASES.
 */
export function releaseTurn(channelId: string, agentId: string): void {
  const lock = getLock(channelId)
  if (lock.lockedBy !== agentId) return

  lock.lockedBy = null
  lock.lockedAt = null

  // Cancel any pending release for this channel (prevents double-processing)
  const existing = PENDING_RELEASES.get(channelId)
  if (existing) {
    clearTimeout(existing)
    PENDING_RELEASES.delete(channelId)
  }

  // Schedule queue processing after breathing room
  const timer = setTimeout(() => {
    PENDING_RELEASES.delete(channelId)
    processQueue(channelId)
  }, BREATHING_ROOM_MS)

  PENDING_RELEASES.set(channelId, timer)
}

/**
 * Versão async do release — usa sleep em vez de setTimeout,
 * permitindo await e evitando condições de corrida em fluxos assíncronos.
 */
export async function asyncReleaseTurn(channelId: string, agentId: string): Promise<void> {
  const lock = getLock(channelId)
  if (lock.lockedBy !== agentId) return

  lock.lockedBy = null
  lock.lockedAt = null

  // Cancel any pending sync release
  const existing = PENDING_RELEASES.get(channelId)
  if (existing) {
    clearTimeout(existing)
    PENDING_RELEASES.delete(channelId)
  }

  // Breathing room before processing next
  await sleep(BREATHING_ROOM_MS)

  processQueue(channelId)
}

// ── waitForTurn — Async Polling ────────────────────────────

/**
 * Tenta adquirir o turno repetidamente até conseguir ou timeout.
 * Útil para ações que precisam esperar (em vez de pular).
 *
 * @param timeoutMs Tempo máximo de espera (default 30s)
 * @returns true se turno adquirido, false se timeout
 */
export async function waitForTurn(
  channelId: string,
  agentId: string,
  agentName: string,
  priority = 5,
  timeoutMs = WAIT_FOR_TURN_DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const result = requestTurn(channelId, agentId, agentName, priority)
    if (result.acquired) return true

    // Wait before next attempt
    await sleep(WAIT_FOR_TURN_POLL_MS)
  }

  return false
}

// ── Queue Inspection ───────────────────────────────────────

export function getQueuePosition(channelId: string, agentId: string): number {
  const lock = getLock(channelId)
  return lock.queue.findIndex(q => q.agentId === agentId) + 1
}

export function getQueueLength(channelId: string): number {
  return getLock(channelId).queue.length
}

export function isLocked(channelId: string): boolean {
  return getLock(channelId).lockedBy !== null
}

export function getCurrentSpeaker(channelId: string): string | null {
  return getLock(channelId).lockedBy
}

export function getLockAge(channelId: string): number | null {
  const lock = getLock(channelId)
  return lock.lockedAt ? Date.now() - lock.lockedAt : null
}

// ── Typing Indicators ──────────────────────────────────────

export function setTypingIndicator(channelId: string, agentId: string, agentName: string): void {
  TYPING.set(channelId, { agentId, agentName, startedAt: Date.now() })
}

export function clearTypingIndicator(channelId: string): void {
  TYPING.delete(channelId)
}

export function getTypingIndicator(channelId: string): TypingState | null {
  const state = TYPING.get(channelId)
  if (state && Date.now() - state.startedAt > TURN_TIMEOUT_MS) {
    TYPING.delete(channelId)
    return null
  }
  return state || null
}

export function getAllTypingIndicators(): Map<string, TypingState> {
  const now = Date.now()
  for (const [channelId, state] of TYPING) {
    if (now - state.startedAt > TURN_TIMEOUT_MS) TYPING.delete(channelId)
  }
  return new Map(TYPING)
}

// ── Metrics ────────────────────────────────────────────────

export function getTurnMetrics() {
  const locks: Record<string, { lockedBy: string | null; queueLength: number; lockAgeMs: number | null }> = {}
  for (const [channelId, lock] of LOCKS) {
    locks[channelId] = {
      lockedBy: lock.lockedBy,
      queueLength: lock.queue.length,
      lockAgeMs: lock.lockedAt ? Date.now() - lock.lockedAt : null,
    }
  }
  return {
    totalLocks: LOCKS.size,
    pendingReleases: PENDING_RELEASES.size,
    locks,
    typingIndicators: Array.from(TYPING.entries()).map(([ch, s]) => ({
      channelId: ch,
      agentId: s.agentId,
      agentName: s.agentName,
      ageMs: Date.now() - s.startedAt,
    })),
  }
}

// ── Personality System (delegates to config.ts) ──────────────

/** @deprecated Use getPersonalityModifiers from config.ts directly */
export function getPersonality(agentName: string): PersonalityTiming {
  const m = getPersonalityModifiers(agentName)
  return {
    responseSpeed: m.responseSpeed,
    typingSpeed: m.typingSpeed,
    participation: m.participation,
    minDelay: m.minDelay,
  }
}

export function calculateResponseDelay(agentName: string, priority: number): number {
  const p = getPersonality(agentName)
  const baseDelay = (11 - priority) * 2000
  const delay = baseDelay * p.responseSpeed
  // Seeded variation per agent (uses agent name hash for consistency)
  const seeded = seededRandom(agentName + priority + Date.now())
  const variation = 0.8 + seeded * 0.4
  return Math.max(p.minDelay, Math.floor(delay * variation))
}

export function calculateTypingTime(agentName: string, content: string): number {
  const p = getPersonality(agentName)
  const words = content.split(/\s+/).length
  const minutes = words / p.typingSpeed
  const ms = minutes * 60 * 1000
  return Math.max(TIMING_CONFIG.MIN_TYPING_TIME_MS, Math.min(TIMING_CONFIG.MAX_TYPING_TIME_MS, Math.floor(ms)))
}

export function shouldParticipate(agentName: string): boolean {
  const p = getPersonality(agentName)
  return Math.random() < p.participation
}

// ── Seeded PRNG ──────────────────────────────────────────────

/**
 * Gera um número pseudo-aleatório determinístico (0-1) baseado em uma seed.
 * Usado para variações de timing que precisam ser reproduzíveis.
 */
export function seededRandom(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  // Normalize to 0-1 range
  const normalized = Math.abs(hash % 10000) / 10000
  return normalized
}
