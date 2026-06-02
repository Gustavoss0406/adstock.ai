/**
 * Adstock Agent Bridge — makes Adstock database agents appear as animated
 * pixel characters inside the Pixel Agents virtual office.
 *
 * Pixel Agents detects agent sessions by watching JSONL transcript files in
 * ~/.pixel-agents/sessions/. Normally these come from real OpenCode CLI sessions.
 *
 * This bridge creates simulated JSONL transcripts for each Adstock agent,
 * making them appear as characters that walk around the office.
 */

import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import type { Agent } from "@prisma/client"

const SESSIONS_DIR = path.join(os.homedir(), ".pixel-agents", "sessions")

interface AdstockAgentSim {
  id: string
  name: string
  role: string
  status: string
  sessionId: string
}

const ROLE_ACTIVITIES: Record<string, Array<{ tool: string; status: string; input: Record<string, unknown> }>> = {
  STRATEGIST: [
    { tool: "read", status: "Analisando mercado", input: { filePath: "market-research.md" } },
    { tool: "write", status: "Escrevendo estratégia", input: { filePath: "growth-strategy.md" } },
    { tool: "glob", status: "Buscando benchmarks", input: { pattern: "**/*.csv" } },
  ],
  DESIGNER: [
    { tool: "read", status: "Buscando referências visuais", input: { filePath: "design-references.png" } },
    { tool: "write", status: "Criando arte", input: { filePath: "instagram-post.png" } },
    { tool: "edit", status: "Ajustando layout", input: { filePath: "brand-kit.ai" } },
  ],
  COPYWRITER: [
    { tool: "read", status: "Lendo brief criativo", input: { filePath: "creative-brief.md" } },
    { tool: "write", status: "Escrevendo copy", input: { filePath: "instagram-caption.txt" } },
    { tool: "grep", status: "Pesquisando keywords", input: { pattern: "marketing.*digital" } },
  ],
  ANALYST: [
    { tool: "bash", status: "Rodando análise de dados", input: { command: "python analyze_metrics.py" } },
    { tool: "read", status: "Lendo relatório GSC", input: { filePath: "gsc-report.csv" } },
    { tool: "webfetch", status: "Buscando dados de mercado", input: { url: "https://trends.google.com" } },
  ],
  SOCIAL_MEDIA: [
    { tool: "read", status: "Monitorando feeds", input: { filePath: "instagram-feed.json" } },
    { tool: "write", status: "Agendando post", input: { filePath: "content-calendar.md" } },
    { tool: "webfetch", status: "Analisando trends", input: { url: "https://tiktok.com/trending" } },
  ],
  SEO: [
    { tool: "bash", status: "Rodando keyword research", input: { command: "node seo-research.js" } },
    { tool: "read", status: "Analisando SERP", input: { filePath: "serp-analysis.json" } },
    { tool: "write", status: "Escrevendo conteúdo SEO", input: { filePath: "blog-post.md" } },
  ],
  MEDIA_BUYER: [
    { tool: "bash", status: "Otimizando campanhas", input: { command: "node optimize-ads.js" } },
    { tool: "read", status: "Analisando ROAS", input: { filePath: "ad-metrics.csv" } },
    { tool: "write", status: "Criando relatório de ads", input: { filePath: "ads-report.md" } },
  ],
  COMMUNITY_MANAGER: [
    { tool: "read", status: "Lendo comentários", input: { filePath: "community-feed.json" } },
    { tool: "write", status: "Respondendo seguidores", input: { filePath: "replies.txt" } },
    { tool: "webfetch", status: "Monitorando menções", input: { url: "https://socialmention.com" } },
  ],
  CREATIVE_DIRECTOR: [
    { tool: "read", status: "Revisando artes do time", input: { filePath: "design-review.png" } },
    { tool: "write", status: "Aprovando campanha", input: { filePath: "campaign-approval.md" } },
    { tool: "edit", status: "Ajustando brand guidelines", input: { filePath: "brand-guide.md" } },
  ],
  TRAFFIC_MANAGER: [
    { tool: "bash", status: "Analisando tráfego", input: { command: "node traffic-analysis.js" } },
    { tool: "read", status: "Revisando landing pages", input: { filePath: "landing-pages.csv" } },
    { tool: "write", status: "Otimizando funil", input: { filePath: "funnel-report.md" } },
  ],
}

function generateJsonlLine(tool: string, status: string, input: Record<string, unknown>): string {
  const callId = `adstock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const toolUse = JSON.stringify({
    type: "assistant",
    message: {
      content: [{ type: "tool_use", id: callId, name: tool, input }],
      usage: { input_tokens: 500, output_tokens: 200 },
    },
  })
  const toolResult = JSON.stringify({
    type: "user",
    message: { content: [{ type: "tool_result", tool_use_id: callId, content: status }] },
  })
  const turnEnd = JSON.stringify({ type: "system", subtype: "turn_duration" })
  return `${toolUse}\n${toolResult}\n${turnEnd}\n`
}

export function createAgentJsonl(agent: Agent): string {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  }

  const sessionId = `adstock-${agent.id}`
  const jsonlPath = path.join(SESSIONS_DIR, `${sessionId}.jsonl`)

  const activities = ROLE_ACTIVITIES[agent.role] || ROLE_ACTIVITIES.ANALYST

  const lines: string[] = []

  // Initial wake-up message
  lines.push(JSON.stringify({
    type: "user",
    message: { content: [{ type: "text", text: `${agent.name} chegou no escritório.` }] },
  }))

  // Generate multiple cycles of tool activity
  for (let cycle = 0; cycle < 2; cycle++) {
    const shuffled = [...activities].sort(() => Math.random() - 0.5)
    for (const activity of shuffled) {
      lines.push(generateJsonlLine(activity.tool, activity.status, activity.input))
    }
    // Reasoning between cycles
    lines.push(JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "text", text: `${agent.name} está processando e planejando os próximos passos...` }],
      },
    }))
  }

  // Agent mood based on status
  if (agent.status === "WORKING") {
    lines.push(JSON.stringify({
      type: "user",
      message: { content: [{ type: "text", text: `${agent.name} está focado trabalhando.` }] },
    }))
    const extraActivity = activities[0]
    lines.push(generateJsonlLine(extraActivity.tool, extraActivity.status, extraActivity.input))
  }

  fs.writeFileSync(jsonlPath, lines.join("\n") + "\n", "utf-8")
  return jsonlPath
}

export function updateAgentActivity(agent: Agent): void {
  if (!fs.existsSync(SESSIONS_DIR)) return

  const sessionId = `adstock-${agent.id}`
  const jsonlPath = path.join(SESSIONS_DIR, `${sessionId}.jsonl`)

  if (!fs.existsSync(jsonlPath)) {
    createAgentJsonl(agent)
    return
  }

  const activities = ROLE_ACTIVITIES[agent.role] || ROLE_ACTIVITIES.ANALYST
  const activity = activities[Math.floor(Math.random() * activities.length)]

  const line = generateJsonlLine(activity.tool, activity.status, activity.input)

  // Add thinking/reasoning between activities sometimes
  const shouldAddReasoning = Math.random() > 0.5
  let append = line
  if (shouldAddReasoning) {
    const thoughts = ["analisando dados mais recentes...", "comparando com resultados anteriores...", "validando informações...", "preparando próximos passos..."]
    const thought = thoughts[Math.floor(Math.random() * thoughts.length)]
    append = `${JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: thought }] } })}\n${line}`
  }

  fs.appendFileSync(jsonlPath, append, "utf-8")
}

export function removeAgentJsonl(agentId: string): void {
  const sessionId = `adstock-${agentId}`
  const jsonlPath = path.join(SESSIONS_DIR, `${sessionId}.jsonl`)
  try { fs.unlinkSync(jsonlPath) } catch { /* already gone */ }
}
