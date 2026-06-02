/**
 * ── BRIDGE WORK ACTIVITY ───────────────────────────────────
 *
 * Escreve JSONL com contexto REAL de trabalho no pixel office.
 * Substitui atividades aleatórias por eventos baseados em tasks reais.
 *
 * Usado pelo executor (start_task, complete_task, report_progress)
 * para mostrar agentes trabalhando de verdade no escritório.
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

function generateLine(tool: string, status: string, input: Record<string, unknown>): string {
  const callId = `sk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const lines = [
    JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", id: callId, name: tool, input },
        ],
        usage: { input_tokens: 300, output_tokens: 150 },
      },
    }),
    JSON.stringify({
      type: "user",
      message: { content: [{ type: "tool_result", tool_use_id: callId }] },
    }),
    JSON.stringify({ type: "system", subtype: "turn_duration" }),
  ].join("\n") + "\n"
  return lines
}

/**
 * Escreve atividade REAL de trabalho para um agente no pixel office.
 * Usa o título real da task em vez de atividades aleatórias.
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

    // Create session file if it doesn't exist
    if (!fs.existsSync(fp)) {
      const startLine = JSON.stringify({
        type: "user",
        message: {
          content: [{ type: "text", text: `${agentName} chegou no escritorio.` }],
        },
      }) + "\n"
      fs.writeFileSync(fp, startLine + generateLine(tool, status, { taskTitle }), "utf-8")
      return
    }

    // Append work activity with real task context
    const input = { taskTitle, action: status }
    const line = generateLine(tool, status, input)
    const thought = Math.random() > 0.5
      ? JSON.stringify({
          type: "assistant",
          message: {
            content: [{ type: "text", text: `${agentName}: ${status} — "${taskTitle}"...` }],
          },
        }) + "\n"
      : ""

    fs.appendFileSync(fp, thought + line, "utf-8")
  } catch {
    // Bridge failure never breaks work execution
  }
}

/**
 * TOOL per task type — maps task types to realistic tool invocations.
 */
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
