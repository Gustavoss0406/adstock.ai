/**
 * ── BRIDGE WORK ACTIVITY ───────────────────────────────────
 *
 * Escreve JSONL com contexto REAL de trabalho no pixel office.
 * Agora com eventos ricos: estados, speech bubbles e animacoes.
 */

import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const SESSIONS_DIR = path.join(os.homedir(), ".pixel-agents", "sessions")

function ensureDir(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  }
}

function appendToAgent(agentId: string, lines: string): void {
  ensureDir()
  const fp = path.join(SESSIONS_DIR, `synkra-${agentId}.jsonl`)
  if (!fs.existsSync(fp)) {
    fs.writeFileSync(fp, "", "utf-8")
  }
  fs.appendFileSync(fp, lines, "utf-8")
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
 * Escreve um evento rico de comportamento no JSONL do agente.
 * Isso faz o boneco no pixel office reagir visualmente.
 */
export function writeAgentEvent(event: AgentEvent): void {
  try {
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

    appendToAgent(event.agentId, lines.map(l => l + "\n").join(""))
  } catch {
    // Bridge failure never breaks execution
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

