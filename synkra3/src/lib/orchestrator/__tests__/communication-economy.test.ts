/**
 * ── BATERIA 2: ECONOMIA DE TOKENS ─────────────────────────
 *
 * 10 testes validando que:
 * - Confirmacoes vazias sao bloqueadas
 * - Threads tem limite de turnos
 * - Progresso so atualiza Kanban
 * - Daily tem limite de mensagens
 * - Emojis sozinhos sao spam
 * - "Vou comecar" e bloqueado
 * - Sistema de warnings/mute funciona
 * - Verbosidade SILENT bloqueia tudo exceto critico
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { selectBestChannel } from "@/lib/channels/channel-selector"
import { detectAndHandleSpam } from "@/lib/orchestrator/spam-detection"
import type { VerbosityLevel, CommunicationState } from "@prisma/client"
import { mockPrisma } from "../../../../tests/setup"

// ── Helper: mock agent state ─────────────────────────────
function mockAgent(overrides: Partial<{
  communicationState: CommunicationState
  spamCount: number
  mutedUntil: Date | null
}> = {}) {
  mockPrisma.agent.findUnique.mockResolvedValue({
    communicationState: overrides.communicationState || "SILENT",
    spamCount: overrides.spamCount ?? 0,
    mutedUntil: overrides.mutedUntil ?? null,
  })
  mockPrisma.agent.update.mockResolvedValue({})
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.agent.findUnique.mockResolvedValue(null)
  mockPrisma.agent.update.mockResolvedValue({})
})

// ═══════════════════════════════════════════════════════
describe("Economia de Tokens", () => {

  // ── Test 1: Confirmacoes vazias bloqueadas ──────────
  describe("Loop-01: Confirmacoes vazias", () => {

    const spamMessages = [
      { content: "Ok", desc: "confirmacao curta" },
      { content: "Legal!", desc: "entusiasmo vazio" },
      { content: "Valeu", desc: "agradecimento sem contexto" },
      { content: "Boa!", desc: "elogio vazio" },
      { content: "Perfeito", desc: "confirmacao vazia" },
      { content: "👍", desc: "emoji sozinho" },
      { content: "💜", desc: "emoji coracao" },
      { content: "Bora time!", desc: "motivacao vazia" },
      { content: "Qualquer coisa me chama", desc: "oferta generica" },
      { content: "Estou a disposicao", desc: "oferta generica" },
      { content: "Bom dia pessoal!", desc: "saudacao vazia" },
    ]

    for (const msg of spamMessages) {
      test(`"${msg.content}" → SPAM (${msg.desc})`, async () => {
        mockAgent({ spamCount: 0 })

        const result = await detectAndHandleSpam("test-agent", msg.content, "post_message")
        expect(result.blocked).toBe(true)
      })
    }
  })

  // ── Test 2: Thread com limite de 2 turnos ──────────
  describe("Loop-02: Limite de turnos em thread", () => {

    test("2 turnos por agente em uma thread", async () => {
      // Simula que já existem 2 mensagens do agente na thread
      mockPrisma.message.count.mockResolvedValue(2)

      const { shouldAgentSpeak } = await import("@/lib/orchestrator/communication-rules")
      mockAgent({ communicationState: "ACTIVE" })
      mockPrisma.officeSettings.findUnique.mockResolvedValue({ verbosityLevel: "BALANCED" })

      const result = await shouldAgentSpeak("post_message", {
        verbosityLevel: "BALANCED",
        agentId: "agent-1",
        organizationId: "org-1",
        threadId: "thread_123",
        content: "Mais uma mensagem na thread",
      })

      expect(result.allowed).toBe(false)
    })

    test("CEOs e alertas ignoram limite de turnos", async () => {
      mockPrisma.message.count.mockResolvedValue(5)

      const { shouldAgentSpeak } = await import("@/lib/orchestrator/communication-rules")
      mockAgent({ communicationState: "ACTIVE" })
      mockPrisma.officeSettings.findUnique.mockResolvedValue({ verbosityLevel: "BALANCED" })

      const ceoResult = await shouldAgentSpeak("ceo_message", {
        verbosityLevel: "BALANCED",
        agentId: "agent-1",
        organizationId: "org-1",
        threadId: "thread_123",
        content: "Sim, chefe!",
      })
      expect(ceoResult.allowed).toBe(true)

      const alertResult = await shouldAgentSpeak("alert_critical", {
        verbosityLevel: "BALANCED",
        agentId: "agent-1",
        organizationId: "org-1",
        threadId: "thread_123",
        content: "Critico!",
      })
      expect(alertResult.allowed).toBe(true)
    })
  })

  // ── Test 3: Progresso silencioso ───────────────────
  describe("Loop-03: Progresso nao gera mensagem", () => {

    test("task_progress bloqueado no modo SILENT", async () => {
      const { shouldAgentSpeak } = await import("@/lib/orchestrator/communication-rules")
      mockAgent({ communicationState: "SILENT" })
      mockPrisma.officeSettings.findUnique.mockResolvedValue({ verbosityLevel: "BALANCED" })

      const result = await shouldAgentSpeak("task_progress", {
        verbosityLevel: "BALANCED",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Progresso: 50%",
      })
      expect(result.allowed).toBe(false)
    })

    test("task_completed permitido mesmo em SILENT", async () => {
      const { shouldAgentSpeak } = await import("@/lib/orchestrator/communication-rules")
      mockAgent({ communicationState: "SILENT" })
      mockPrisma.officeSettings.findUnique.mockResolvedValue({ verbosityLevel: "BALANCED" })

      const result = await shouldAgentSpeak("task_completed", {
        verbosityLevel: "BALANCED",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Conclui: Arte pronta.",
      })
      expect(result.allowed).toBe(true)
    })

    test("report_progress e task_started bloqueados no BALANCED", async () => {
      const { shouldAgentSpeak } = await import("@/lib/orchestrator/communication-rules")
      mockAgent({ communicationState: "ACTIVE" })
      mockPrisma.officeSettings.findUnique.mockResolvedValue({ verbosityLevel: "BALANCED" })

      const progressResult = await shouldAgentSpeak("report_progress", {
        verbosityLevel: "BALANCED",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Progresso: indo bem.",
      })
      expect(progressResult.allowed).toBe(false)

      const startResult = await shouldAgentSpeak("task_started", {
        verbosityLevel: "BALANCED",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Comecando task.",
      })
      expect(startResult.allowed).toBe(false)
    })
  })

  // ── Test 4: Daily com limite ───────────────────────
  describe("Loop-04: Limite de mensagens na daily", () => {

    test("MEETING permite ate 5 mensagens em 5 min", async () => {
      const { shouldAgentSpeak } = await import("@/lib/orchestrator/communication-rules")
      mockAgent({ communicationState: "MEETING" })
      mockPrisma.officeSettings.findUnique.mockResolvedValue({ verbosityLevel: "BALANCED" })
      mockPrisma.message.count.mockResolvedValue(3)

      const result = await shouldAgentSpeak("meeting_speech", {
        verbosityLevel: "BALANCED",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Fala na daily",
      })
      expect(result.allowed).toBe(true)
    })

    test("MEETING bloqueia apos 5 mensagens em 5 min", async () => {
      const { shouldAgentSpeak } = await import("@/lib/orchestrator/communication-rules")
      mockAgent({ communicationState: "MEETING" })
      mockPrisma.officeSettings.findUnique.mockResolvedValue({ verbosityLevel: "BALANCED" })
      mockPrisma.message.count.mockResolvedValue(5)

      const result = await shouldAgentSpeak("meeting_speech", {
        verbosityLevel: "BALANCED",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Sexta mensagem na daily",
      })
      expect(result.allowed).toBe(false)
    })
  })

  // ── Test 5: Emoji spam ─────────────────────────────
  describe("Loop-05: Emoji sozinho e bloqueado", () => {

    const emojiMessages = [
      "👍", "💜", "🔥", "😊", "👏", "🎉", "✨", "🚀", "💪", "🙌", "♥️", "🫶",
      "👍👍", "💜🔥", "😊👍",
    ]

    for (const msg of emojiMessages) {
      test(`"${msg}" → SPAM`, async () => {
        mockAgent({ spamCount: 0 })
        const result = await detectAndHandleSpam("test-agent", msg, "post_message")
        expect(result.blocked).toBe(true)
      })
    }
  })

  // ── Test 6: "Vou comecar" bloqueado ────────────────
  describe("Loop-06: Aviso de inicio bloqueado", () => {

    const startMessages = [
      "Vou comecar o calendario",
      "Vou iniciar a arte agora",
      "Vou fazer a analise",
      "Deixa comigo",
      "Pode deixar que eu faco",
      "Estou trabalhando no design",
      "Continuo trabalhando na copia",
      "Seguimos no desenvolvimento",
    ]

    for (const msg of startMessages) {
      test(`"${msg}" → SPAM`, async () => {
        mockAgent({ spamCount: 0 })
        const result = await detectAndHandleSpam("test-agent", msg, "post_message")
        expect(result.blocked).toBe(true)
      })
    }
  })

  // ── Test 7: Checkpoint digest ──────────────────────
  describe("Loop-07: Checkpoint 17h", () => {

    test("daily_checkpoint permitido no MINIMAL", async () => {
      const { shouldAgentSpeak } = await import("@/lib/orchestrator/communication-rules")
      mockAgent({ communicationState: "ACTIVE" })
      mockPrisma.officeSettings.findUnique.mockResolvedValue({ verbosityLevel: "MINIMAL" })

      const result = await shouldAgentSpeak("daily_checkpoint", {
        verbosityLevel: "MINIMAL",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Resumo do dia.",
      })
      expect(result.allowed).toBe(true)
    })

    test("daily_checkpoint bloqueado no SILENT", async () => {
      const { shouldAgentSpeak } = await import("@/lib/orchestrator/communication-rules")
      mockAgent({ communicationState: "ACTIVE" })
      mockPrisma.officeSettings.findUnique.mockResolvedValue({ verbosityLevel: "SILENT" })

      const result = await shouldAgentSpeak("daily_checkpoint", {
        verbosityLevel: "SILENT",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Resumo do dia.",
      })
      expect(result.allowed).toBe(false)
    })
  })

  // ── Test 8: Sistema de warnings (3 strikes) ────────
  describe("Loop-08: 3 strikes = mute", () => {

    test("Strike 1 e 2: bloqueado + aviso", async () => {
      mockAgent({ spamCount: 0 })

      const result1 = await detectAndHandleSpam("test-agent", "Ok", "post_message")
      expect(result1.blocked).toBe(true)
      expect(result1.warningLevel).toBe(1)

      mockAgent({ spamCount: 1 })
      const result2 = await detectAndHandleSpam("test-agent", "Legal", "post_message")
      expect(result2.blocked).toBe(true)
      expect(result2.warningLevel).toBe(2)
    })

    test("Strike 3: mute 1h", async () => {
      mockAgent({ spamCount: 2 })

      const result = await detectAndHandleSpam("test-agent", "Valeu", "post_message")
      expect(result.blocked).toBe(true)
      expect(result.warningLevel).toBe(3)
      // Verifica que o agente foi mutado
      expect(mockPrisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ communicationState: "MUTED" }),
        }),
      )
    })
  })

  // ── Test 9: Silent mode ────────────────────────────
  describe("Loop-09: Modo SILENT", () => {

    test("SILENT so permite eventos criticos", async () => {
      const { shouldAgentSpeak } = await import("@/lib/orchestrator/communication-rules")
      mockAgent({ communicationState: "SILENT" })
      mockPrisma.officeSettings.findUnique.mockResolvedValue({ verbosityLevel: "SILENT" })

      const normal = await shouldAgentSpeak("task_completed", {
        verbosityLevel: "SILENT",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Terminei.",
      })
      expect(normal.allowed).toBe(false)

      const critical = await shouldAgentSpeak("alert_critical", {
        verbosityLevel: "SILENT",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Erro critico!",
      })
      expect(critical.allowed).toBe(true)

      const blocked = await shouldAgentSpeak("task_blocked", {
        verbosityLevel: "SILENT",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Bloqueado.",
      })
      expect(blocked.allowed).toBe(true)
    })
  })

  // ── Test 10: VERBOSE permite tudo ──────────────────
  describe("Loop-10: Modo VERBOSE", () => {

    test("VERBOSE permite task_started e report_progress", async () => {
      const { shouldAgentSpeak } = await import("@/lib/orchestrator/communication-rules")
      mockAgent({ communicationState: "SILENT" })
      mockPrisma.officeSettings.findUnique.mockResolvedValue({ verbosityLevel: "VERBOSE" })

      const startResult = await shouldAgentSpeak("task_started", {
        verbosityLevel: "VERBOSE",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Comecando.",
      })
      expect(startResult.allowed).toBe(true)

      const progressResult = await shouldAgentSpeak("report_progress", {
        verbosityLevel: "VERBOSE",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Progresso.",
      })
      expect(progressResult.allowed).toBe(true)

      const ackResult = await shouldAgentSpeak("acknowledge_task", {
        verbosityLevel: "VERBOSE",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Vi a tarefa.",
      })
      expect(ackResult.allowed).toBe(true)
    })
  })

  // ── Extra: MUTED bloqueia tudo ─────────────────────
  describe("Agente MUTED", () => {

    test("MUTED bloqueia ate eventos criticos", async () => {
      const { shouldAgentSpeak } = await import("@/lib/orchestrator/communication-rules")
      mockAgent({ communicationState: "MUTED", mutedUntil: new Date(Date.now() + 3600000) })
      mockPrisma.officeSettings.findUnique.mockResolvedValue({ verbosityLevel: "BALANCED" })

      const result = await shouldAgentSpeak("alert_critical", {
        verbosityLevel: "BALANCED",
        agentId: "agent-1",
        organizationId: "org-1",
        content: "Critico!",
      })
      expect(result.allowed).toBe(false)
    })
  })
})
