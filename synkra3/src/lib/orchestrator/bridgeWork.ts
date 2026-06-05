/**
 * ── BRIDGE WORK ACTIVITY ───────────────────────────────────
 *
 * Envia eventos para o pixel office via API HTTP (Render).
 * Agora com eventos ricos: estados, speech bubbles e animacoes.
 * Tambem escreve JSONL local como fallback.
 */

import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const SESSIONS_DIR = path.join(os.homedir(), ".pixel-agents", "sessions")

/** URL do pixel office no Render — sobe via iframe no workspace */
const PIXEL_OFFICE_URL = process.env.PIXEL_OFFICE_URL || "https://adstock-ai.onrender.com"

// ─────────────────────────────────────────────────────────────
// HTTP Bridge: envia agentes direto pra API do pixel office
// ─────────────────────────────────────────────────────────────

let agentIndex = 0
const agentIdMap = new Map<string, number>()
const agentMetaMap: Record<number, { palette?: number; hueShift?: number; name?: string }> = {}
const folderNamesMap: Record<number, string> = {}

async function pushAgentsToOffice(): Promise<void> {
  if (agentIdMap.size === 0) return
  try {
    const agents = Array.from(agentIdMap.values())
    await fetch(`${PIXEL_OFFICE_URL}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agents, agentMeta: agentMetaMap, folderNames: folderNamesMap }),
    })
  } catch {
    // Pixel office offline — nothing to do
  }
}

export function registerPixelAgent(agentId: string, agentName: string): void {
  if (agentIdMap.has(agentId)) return
  agentIndex++
  const numId = agentIndex
  agentIdMap.set(agentId, numId)
  const palette = (agentIndex - 1) % 6
  agentMetaMap[numId] = { palette, hueShift: agentIndex > 6 ? ((agentIndex % 6) * 45 + 45) : 0, name: agentName }
  folderNamesMap[numId] = agentName
  pushAgentsToOffice().catch(() => {})
}

export function unregisterPixelAgent(agentId: string): void {
  const numId = agentIdMap.get(agentId)
  if (numId) {
    agentIdMap.delete(agentId)
    delete agentMetaMap[numId]
    delete folderNamesMap[numId]
    pushAgentsToOffice().catch(() => {})
  }
}

// ─────────────────────────────────────────────────────────────
// Local JSONL (fallback + compatibilidade)
// ─────────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  }
}

function generateLine(tool: string, status: string, input: Record<string, unknown>): string {
  const callId = `sk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  return [
    JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", id: callId, name: tool, input }],
        usage: { input_tokens: 300, output_tokens: 150 },
      },
    }),
    JSON.stringify({
      type: "user",
      message: { content: [{ type: "tool_result", tool_use_id: callId }] },
    }),
    JSON.stringify({ type: "system", subtype: "turn_duration" }),
  ].join("\n") + "\n"
}

/**
 * Escreve atividade REAL de trabalho com contexto da task.
 */
export function writeBridgeWorkActivity(
  agentId: string,
  agentName: string,
  taskTitle: string,
  tool: string,
  status: string,
): void {
  try {
    ensureDir()
    const fp = path.join(SESSIONS_DIR, `synkra-${agentId}.jsonl`)

    if (!fs.existsSync(fp)) {
      const startLine = JSON.stringify({
        type: "user",
        message: { content: [{ type: "text", text: `${agentName} chegou no escritorio.` }] },
      }) + "\n"
      fs.writeFileSync(fp, startLine + generateLine(tool, status, { taskTitle }), "utf-8")
      return
    }

    const input = { taskTitle, action: status }
    const line = generateLine(tool, status, input)
    const thought = Math.random() > 0.5
      ? JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: `${agentName}: ${status} — "${taskTitle}"...` }] },
        }) + "\n"
      : ""

    fs.appendFileSync(fp, thought + line, "utf-8")
  } catch {
    // Bridge failure never breaks work execution
  }
}

// ─────────────────────────────────────────────────────────────
// Eventos ricos de comportamento
// ─────────────────────────────────────────────────────────────

export interface AgentEvent {
  agentId: string
  agentName: string
  eventType: "task_completed" | "task_started" | "task_blocked" | "celebrating" | "sad" | "thinking" | "approval_needed" | "deep_work" | "coffee_break" | "leaving" | "arriving"
  taskTitle?: string
  speechBubble?: string
  emote?: string
  tool?: string
}

/**
 * Escreve um evento rico de comportamento (local + push agents).
 */
export function writeAgentEvent(event: AgentEvent): void {
  // Ensure agent is registered in the office
  registerPixelAgent(event.agentId, event.agentName)

  try {
    ensureDir()
    const fp = path.join(SESSIONS_DIR, `synkra-${event.agentId}.jsonl`)
    const lines: string[] = []

    // State change announcement
    lines.push(JSON.stringify({
      type: "system",
      subtype: "agent_state",
      agentId: event.agentId,
      state: event.eventType,
      taskTitle: event.taskTitle,
      speechBubble: event.speechBubble,
      emote: event.emote,
    }))

    // Tool activity if applicable
    if (event.tool) {
      const input = { taskTitle: event.taskTitle || "task" }
      const callId = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      lines.push(JSON.stringify({
        type: "assistant",
        message: {
          content: [{ type: "tool_use", id: callId, name: event.tool, input }],
          usage: { input_tokens: 200, output_tokens: 80 },
        },
      }))
      lines.push(JSON.stringify({
        type: "user",
        message: { content: [{ type: "tool_result", tool_use_id: callId }] },
      }))
    }

    // Speech bubble as assistant text
    if (event.speechBubble) {
      lines.push(JSON.stringify({
        type: "assistant",
        message: {
          content: [{ type: "text", text: `${event.agentName}: ${event.speechBubble}` }],
        },
      }))
    }

    // Turn end
    lines.push(JSON.stringify({ type: "system", subtype: "turn_duration" }))

    if (!fs.existsSync(fp)) {
      fs.writeFileSync(fp, "", "utf-8")
    }
    fs.appendFileSync(fp, lines.map(l => l + "\n").join(""), "utf-8")
  } catch {
    // Bridge failure never breaks execution
  }
}

// ─────────────────────────────────────────────────────────────
// Init: push all agents to pixel office
// ─────────────────────────────────────────────────────────────

export async function initPixelOffice(organizationId: string, agents: Array<{ id: string; name: string; role: string }>): Promise<void> {
  agentIdMap.clear()
  agentIndex = 0
  for (const key of Object.keys(agentMetaMap)) delete agentMetaMap[Number(key)]
  for (const key of Object.keys(folderNamesMap)) delete folderNamesMap[Number(key)]

  for (const agent of agents) {
    registerPixelAgent(agent.id, agent.name)
  }
}

// ─────────────────────────────────────────────────────────────
// Tool mapping
// ─────────────────────────────────────────────────────────────

const TASK_TOOLS: Record<string, string[]> = {
  content: ["write", "edit", "read"],
  analysis: ["bash", "read", "grep"],
  technical: ["bash", "read", "edit"],
  campaign: ["write", "read", "webfetch"],
  default: ["write", "read"],
}

export function getToolForTask(taskType: string): string {
  const tools = TASK_TOOLS[taskType] || TASK_TOOLS.default
  return tools[Math.floor(Math.random() * tools.length)]
}
