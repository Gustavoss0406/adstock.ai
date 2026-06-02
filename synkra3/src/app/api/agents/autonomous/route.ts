import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { chatWithSystem } from "@/lib/ai/client"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const SESSIONS_DIR = path.join(os.homedir(), ".pixel-agents", "sessions")

const ROLE_WORK_PROMPTS: Record<string, string> = {
  STRATEGIST: `Voce e Maya Ferreira, Diretora de Conteudo. Analise as tarefas pendentes e produza um plano de acao para hoje. Seja especifica: o que cada agente deve fazer, em que ordem, quais as prioridades. Responda em 3-5 frases como se estivesse falando com o time.`,
  SOCIAL_MEDIA: `Voce e Bruno Costa, Social Media. Veja as tendencias atuais e sugira 2-3 posts para hoje. Seja criativo, pense em engajamento. Responda como se estivesse dando ideias para o time.`,
  ANALYST: `Voce e Lena Souza, Analista de Metricas. Analise o cenario atual e de 2-3 recomendacoes baseadas em dados. Seja direta, use numeros hipoteticos para ilustrar.`,
  DESIGNER: `Voce e Carlos Lima, Designer. Com base nas demandas, descreva quais artes voce vai criar hoje e qual conceito visual vai usar.`,
  SEO: `Voce e Diego Ramos, Especialista SEO. Identifique 2-3 oportunidades de keywords e sugira conteudo para o blog. Seja tecnico mas acessivel.`,
}

function writeBridgeActivity(agent: any, status: string, tool: string, input: Record<string, unknown>): void {
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  const fp = path.join(SESSIONS_DIR, `synkra-${agent.id}.jsonl`)
  const callId = `sk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const lines = [
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id: callId, name: tool, input }], usage: { input_tokens: 200, output_tokens: 100 } } }),
    JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: callId }] } }),
    JSON.stringify({ type: "system", subtype: "turn_duration" }),
  ].join("\n") + "\n"
  fs.appendFileSync(fp, lines, "utf-8")
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json()
    if (!organizationId) return NextResponse.json({ error: "organizationId required" }, { status: 400 })

    const agents = await prisma.agent.findMany({
      where: { organizationId, status: { not: "FIRED" } },
    })

    const tasks = await prisma.task.findMany({
      where: { organizationId, status: { not: "DONE" } },
      orderBy: { priority: "desc" },
      take: 3,
    })

    const results: Array<{ agent: string; action: string }> = []

    for (const agent of agents) {
      const agentTasks = tasks.filter(t => t.assignedTo === agent.id || !t.assignedTo)
      const taskInfo = agentTasks.length > 0
        ? `Tarefas pendentes: ${agentTasks.map(t => t.title).join(", ")}`
        : "Nao ha tarefas pendentes."

      const workPrompt = ROLE_WORK_PROMPTS[agent.role] || ROLE_WORK_PROMPTS.STRATEGIST
      const system = `${agent.promptTemplate || workPrompt}\n\n${taskInfo}\n\nSeja natural, direto. Responda como ${agent.name} falaria em 2-4 frases.`

      try {
        // Agent "works" - generates content via AI
        const reply = await chatWithSystem(system, taskInfo, { temperature: 0.8, maxTokens: 300 })

        // Save the agent's work output as a message
        const channel = await prisma.channel.findFirst({ where: { organizationId, name: "geral" } })
        await prisma.message.create({
          data: { content: reply, agentId: agent.id, channelId: channel?.id || null },
        })

        // Write bridge activity to show in office
        const tools = ["read", "write", "grep", "webfetch", "edit", "bash", "glob"]
        const tool = tools[Math.floor(Math.random() * tools.length)]
        writeBridgeActivity(agent, reply.slice(0, 50), tool, { filePath: `work-${agent.id}.md` })

        // Claim a task if available
        if (agentTasks.length > 0) {
          await prisma.task.update({
            where: { id: agentTasks[0].id },
            data: { assignedTo: agent.id, status: "IN_PROGRESS" },
          })
        }

        // Update agent status
        await prisma.agent.update({ where: { id: agent.id }, data: { status: "WORKING" } })

        // Create agency event
        await prisma.agencyEvent.create({
          data: {
            organizationId,
            type: "agent_work",
            title: `${agent.name} trabalhou`,
            description: reply.slice(0, 200),
          },
        })

        results.push({ agent: agent.name, action: reply.slice(0, 80) + "..." })
      } catch (err) {
        console.error(`[AutoWork] Error for ${agent.name}:`, err)
        results.push({ agent: agent.name, action: "Erro ao processar" })
      }

      // Always set to ACTIVE after attempt
      await prisma.agent.update({ where: { id: agent.id }, data: { status: "ACTIVE" } })
    }

    return NextResponse.json({ worked: results.length, results })
  } catch (error) {
    return NextResponse.json({ error: "Autonomous work failed" }, { status: 500 })
  }
}
