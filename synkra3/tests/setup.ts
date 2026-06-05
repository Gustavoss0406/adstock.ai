/**
 * ── TEST SETUP ────────────────────────────────────────────
 *
 * Mocks globais para todos os testes.
 * Prisma é mockado para não bater no banco real durante testes.
 */

import { vi } from "vitest"

// ── Prisma Mock ──────────────────────────────────────────
const mockPrisma = {
  agent: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  task: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  message: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  channel: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  officeSettings: {
    findUnique: vi.fn(),
  },
  organization: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  agencyEvent: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
  orchestrationLog: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  agentAction: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

// ── AI Client Mock ───────────────────────────────────────
vi.mock("@/lib/ai/client", () => ({
  chatCompletion: vi.fn().mockResolvedValue("Mock AI response"),
  chatWithSystem: vi.fn().mockResolvedValue("Mock AI response"),
  chatWithMessages: vi.fn().mockResolvedValue("Mock AI response"),
  generateAgentResponse: vi.fn().mockResolvedValue("Mock agent response"),
}))

// ── Turn management mock ─────────────────────────────────
vi.mock("@/lib/orchestrator/turns", () => ({
  requestTurn: vi.fn().mockReturnValue({ acquired: true, position: 0 }),
  releaseTurn: vi.fn(),
  setTypingIndicator: vi.fn(),
  clearTypingIndicator: vi.fn(),
  calculateTypingTime: vi.fn().mockReturnValue(50),
  getPersonality: vi.fn().mockReturnValue({}),
  getTurnMetrics: vi.fn().mockReturnValue({}),
}))

// ── Export mock prisma for test use ──────────────────────
export { mockPrisma }
