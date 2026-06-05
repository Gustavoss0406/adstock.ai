import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { writeAgentEvent } from "@/lib/orchestrator/bridgeWork"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const SESSIONS_DIR = path.join(os.homedir(), ".pixel-agents", "sessions")

const ROLE_ACTIVITIES: Record<string, Array<{ tool: string; status: string; input: Record<string, unknown> }>> = {
  STRATEGIST: [
    { tool: "read", status: "Analisando mercado", input: { filePath: "market-research.md" } },
    { tool: "write", status: "Escrevendo estrategia", input: { filePath: "growth-strategy.md" } },
    { tool: "glob", status: "Buscando benchmarks", input: { pattern: "**/*.csv" } },
    { tool: "webfetch", status: "Analisando tendencias", input: { url: "https://trends.google.com" } },
  ],
  DESIGNER: [
    { tool: "read", status: "Buscando referencias visuais", input: { filePath: "moodboard.png" } },
    { tool: "write", status: "Criando arte", input: { filePath: "instagram-post.png" } },
    { tool: "edit", status: "Ajustando layout", input: { filePath: "brand-kit.ai" } },
  ],
  ANALYST: [
    { tool: "bash", status: "Rodando analise de dados", input: { command: "python analyze_metrics.py" } },
    { tool: "read", status: "Lendo relatorio GSC", input: { filePath: "gsc-report.csv" } },
    { tool: "webfetch", status: "Buscando dados de mercado", input: { url: "https://trends.google.com" } },
    { tool: "write", status: "Gerando relatorio", input: { filePath: "weekly-report.md" } },
  ],
  SOCIAL_MEDIA: [
    { tool: "read", status: "Monitorando feeds", input: { filePath: "instagram-feed.json" } },
    { tool: "write", status: "Agendando post", input: { filePath: "content-calendar.md" } },
    { tool: "webfetch", status: "Analisando trends", input: { url: "https://tiktok.com/trending" } },
    { tool: "grep", status: "Buscando hashtags", input: { pattern: "viral.*2025" } },
  ],
  SEO: [
    { tool: "bash", status: "Rodando keyword research", input: { command: "node seo-research.js" } },
    { tool: "read", status: "Analisando SERP", input: { filePath: "serp-analysis.json" } },
    { tool: "write", status: "Escrevendo conteudo SEO", input: { filePath: "blog-post.md" } },
    { tool: "webfetch", status: "Verificando backlinks", input: { url: "https://ahrefs.com" } },
  ],
  MEDIA_BUYER: [
    { tool: "bash", status: "Otimizando campanhas", input: { command: "node optimize-ads.js" } },
    { tool: "read", status: "Analisando ROAS", input: { filePath: "ad-metrics.csv" } },
  ],
  COMMUNITY_MANAGER: [
    { tool: "read", status: "Lendo comentarios", input: { filePath: "community-feed.json" } },
    { tool: "write", status: "Respondendo seguidores", input: { filePath: "replies.txt" } },
  ],
  CREATIVE_DIRECTOR: [
    { tool: "read", status: "Revisando artes do time", input: { filePath: "design-review.png" } },
    { tool: "write", status: "Aprovando campanha", input: { filePath: "campaign-approval.md" } },
  ],
}

function generateLine(tool: string, status: string, input: Record<string, unknown>): string {
  const callId = `sk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  return [
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id: callId, name: tool, input }], usage: { input_tokens: 300, output_tokens: 150 } } }),
    JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: callId }] } }),
    JSON.stringify({ type: "system", subtype: "turn_duration" }),
  ].join("\n") + "\n"
}

function buildAgentJsonl(agent: any): string {
  const activities = ROLE_ACTIVITIES[agent.role] || ROLE_ACTIVITIES.ANALYST
  const lines: string[] = []

  lines.push(JSON.stringify({ type: "user", message: { content: [{ type: "text", text: `${agent.name} chegou no escritorio.` }] } }))

  for (let c = 0; c < 2; c++) {
    const shuffled = [...activities].sort(() => Math.random() - 0.5)
    for (const act of shuffled) {
      lines.push(generateLine(act.tool, act.status, act.input))
    }
    if (c < 1) {
      lines.push(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: `${agent.name} esta processando informacoes e planejando os proximos passos...` }] } }))
    }
  }

  // Easter egg: coffee break at random interval
  lines.push(JSON.stringify({ type: "user", message: { content: [{ type: "text", text: `${agent.name} foi ate a copa pegar um cafe.` }] } }))
  lines.push(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Hora do cafezinho... ninguem e de ferro." }] } }))

  return lines.join("")
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId, action, agentId } = await request.json()

    if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true })

    if (action === "init") {
      const agents = await prisma.agent.findMany({
        where: { organizationId, status: { not: "FIRED" } },
      })

      for (const agent of agents) {
        const fp = path.join(SESSIONS_DIR, `synkra-${agent.id}.jsonl`)
        fs.writeFileSync(fp, buildAgentJsonl(agent), "utf-8")
      }
      return NextResponse.json({ initialized: agents.length, agents: agents.map(a => a.name) })
    }

    if (action === "pulse" && agentId) {
      const agent = await prisma.agent.findUnique({ where: { id: agentId } })
      if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

      const activities = ROLE_ACTIVITIES[agent.role] || ROLE_ACTIVITIES.ANALYST
      const act = activities[Math.floor(Math.random() * activities.length)]
      const fp = path.join(SESSIONS_DIR, `synkra-${agent.id}.jsonl`)

      if (!fs.existsSync(fp)) {
        fs.writeFileSync(fp, buildAgentJsonl(agent), "utf-8")
      } else {
        const line = generateLine(act.tool, act.status, act.input)
        const thought = Math.random() > 0.5 ? JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: `${agent.name}: ${act.status.toLowerCase()}...` }] } }) + "\n" : ""
        fs.appendFileSync(fp, thought + line, "utf-8")
      }
      return NextResponse.json({ pulsed: true, agent: agent.name, activity: act.status })
    }

    if (action === "remove" && agentId) {
      const fp = path.join(SESSIONS_DIR, `synkra-${agentId}.jsonl`)
      try { fs.unlinkSync(fp) } catch { /* gone */ }
      return NextResponse.json({ removed: true })
    }

    if (action === "event" && agentId) {
      const { eventType, taskTitle, speechBubble, emote, tool } = await request.json()
      const agent = await prisma.agent.findUnique({ where: { id: agentId } })
      if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

      writeAgentEvent({
        agentId,
        agentName: agent.name,
        eventType: eventType || "task_completed",
        taskTitle,
        speechBubble,
        emote,
        tool,
      })
      return NextResponse.json({ ok: true, agent: agent.name, eventType })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown" }, { status: 500 })
  }
}
