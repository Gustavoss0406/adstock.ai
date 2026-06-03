import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { chatCompletion } from "@/lib/ai/client"
import { requestTurn, releaseTurn, calculateResponseDelay, calculateTypingTime, getPersonality } from "@/lib/orchestrator/turns"
import { detectConflict } from "@/lib/orchestrator/conflict"
import { postWithTurn } from "@/lib/orchestrator/executor"

const AGENT_ROLES: Record<string, { name: string; specialty: string; style: string; color: string }> = {
  STRATEGIST: { name: "Maya Ferreira", specialty: "estrategia de conteudo e growth", style: "visionaria, entusiasmada, lider", color: "#000000" },
  SOCIAL_MEDIA: { name: "Bruno Costa", specialty: "redes sociais, trends, viralizacao", style: "descontraido, antenado, criativo", color: "#2563eb" },
  ANALYST: { name: "Lena Souza", specialty: "metricas, dados, analytics", style: "direta, cetica, baseada em dados", color: "#2bac76" },
  DESIGNER: { name: "Carlos Lima", specialty: "design visual, identidade de marca", style: "perfeccionista, calmo, focado", color: "#d97706" },
  SEO: { name: "Diego Ramos", specialty: "SEO, keywords, trafego organico", style: "metodico, paciente, tecnico", color: "#dc2626" },
}

function buildTaskContext(tasks: any[]): string {
  if (!tasks.length) return "Nenhuma tarefa pendente no momento."
  return "TAREFAS PENDENTES:\n" + tasks.map((t, i) =>
    `${i + 1}. [${t.status === "TODO" ? "A FAZER" : t.status === "IN_PROGRESS" ? "EM ANDAMENTO" : t.status === "IN_REVIEW" ? "REVISAO" : "CONCLUIDO"}] "${t.title}"` +
    (t.description ? ` - ${t.description.slice(0, 100)}` : "") +
    (t.assignedTo ? ` (responsavel: ${t.assignee?.name || "atribuido"})` : " (sem responsavel)") +
    (t.priority ? ` - prioridade: ${t.priority}` : "")
  ).join("\n")
}

async function handleCreateTask(agentId: string, organizationId: string, title: string, description: string, priority: string, platform?: string) {
  return prisma.task.create({
    data: { organizationId, title, description: description || "", priority: (priority || "MEDIUM") as any, platform, assignedTo: agentId },
  })
}

async function handleAssignTask(organizationId: string, taskTitle: string, agentName: string) {
  const agent = await prisma.agent.findFirst({ where: { organizationId, name: { contains: agentName, mode: "insensitive" } } })
  const task = await prisma.task.findFirst({ where: { organizationId, title: { contains: taskTitle, mode: "insensitive" }, status: { not: "DONE" } } })
  if (agent && task) {
    await prisma.task.update({ where: { id: task.id }, data: { assignedTo: agent.id } })
    return { agent: agent.name, task: task.title }
  }
  return null
}

async function handleUpdateTaskStatus(organizationId: string, taskTitle: string, newStatus: string) {
  const statusMap: Record<string, string> = { "fazer": "TODO", "iniciar": "IN_PROGRESS", "revisar": "IN_REVIEW", "concluir": "DONE", "done": "DONE", "concluido": "DONE", "concluida": "DONE" }
  const status = statusMap[newStatus.toLowerCase()] || newStatus.toUpperCase()
  const task = await prisma.task.findFirst({ where: { organizationId, title: { contains: taskTitle, mode: "insensitive" }, status: { not: "DONE" } } })
  if (task) {
    await prisma.task.update({ where: { id: task.id }, data: { status: status as any } })
    return { task: task.title, status }
  }
  return null
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  try {
    const { agentId, message, channelId, context } = await request.json()
    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 })

    const org = await prisma.organization.findFirst({
      where: { agents: { some: { id: agentId || undefined } } },
      include: { agents: { where: { status: { not: "FIRED" } } }, officeSettings: true },
    })

    const agents = org?.agents || []
    if (!agents.length) return NextResponse.json({ error: "No agents found" }, { status: 404 })

    // Resolve channel
    let resolvedChannelId: string | null = null
    if (channelId && org) {
      const channel = await prisma.channel.findFirst({ where: { organizationId: org.id, name: channelId } })
      resolvedChannelId = channel?.id || null
    }

    // Save user message
    await prisma.message.create({ data: { content: message, channelId: resolvedChannelId, userId: session.user.id } })

    // Load real tasks
    const tasks = await prisma.task.findMany({
      where: { organizationId: org!.id, status: { not: "DONE" } },
      include: { assignee: { select: { name: true } } },
      orderBy: { priority: "desc" },
      take: 10,
    })
    const taskContext = buildTaskContext(tasks)

    // Detect action commands
    const createMatch = message.match(/criar tarefa[:\s]+(.+?)(?:\n|$)/i) || message.match(/nova tarefa[:\s]+(.+?)(?:\n|$)/i)
    const assignMatch = message.match(/(?:atribuir|passar|dar)(?:\s+a)?\s+(?:tarefa\s+)?[""]?(.+?)[""]?\s+(?:para|pro|pra|ao?)\s+(\w+)/i)
    const statusMatch = message.match(/(?:marcar|mover|colocar)(?:\s+a)?\s+(?:tarefa\s+)?[""]?(.+?)[""]?\s+como\s+(\w+)/i)
    const listMatch = message.match(/(?:quais|listar|ver|mostrar|que)\s+(?:as\s+)?(?:tarefas|tasks|demandas)/i)

    let actionResult: any = null
    let actionContext = ""

    if (createMatch && agentId) {
      const title = createMatch[1].trim()
      const desc = message.replace(createMatch[0], "").trim().slice(0, 200)
      const priority = message.toLowerCase().includes("urgente") || message.toLowerCase().includes("critic") ? "CRITICAL" : message.toLowerCase().includes("alta") ? "HIGH" : "MEDIUM"
      const task = await handleCreateTask(agentId, org!.id, title, desc, priority)
      actionResult = { type: "task_created", title: task.title, id: task.id }
      actionContext = `TAREFA CRIADA AGORA: "${title}". Confirme isso na sua resposta.`
    } else if (assignMatch) {
      const result = await handleAssignTask(org!.id, assignMatch[1], assignMatch[2])
      if (result) { actionResult = { type: "task_assigned", ...result }; actionContext = `TAREFA ATRIBUIDA: "${result.task}" para ${result.agent}.` }
    } else if (statusMatch) {
      const result = await handleUpdateTaskStatus(org!.id, statusMatch[1], statusMatch[2])
      if (result) { actionResult = { type: "task_updated", ...result }; actionContext = `TAREFA ATUALIZADA: "${result.task}" movida para ${result.status}.` }
    }

    // Build system prompt with task awareness
    const agentList = agents.map(a => {
      const role = AGENT_ROLES[a.role] || { name: a.name, specialty: "marketing", style: "profissional", color: "#444" }
      return `- ${role.name} (${role.specialty}): ${role.style}.`
    }).join("\n")

    const systemPrompt = `Voce gerencia uma agencia de marketing real.

AGENTES:
${agentList}

${taskContext}
${actionContext}

REGRAS:
1. Voce CONHECE as tarefas acima. Elas sao reais, estao no sistema.
2. Se o usuario perguntar sobre tarefas, RESPONDA com os dados reais da lista acima.
3. Se o usuario pedir para criar uma tarefa, diga "criar tarefa: [titulo]" no inicio da mensagem.
4. JAMAIS invente tarefas. So fale das que estao listadas.
5. Se nao houver tarefas, seja honesto e diga que nao ha.
6. Um agente por vez. 2-4 frases. Portugues brasileiro natural.
7. Mencione colegas pelo nome quando relevante.

FORMATO:
AGENTE: [Nome]
FALA: [Texto]`

    // If @mention, direct response
    if (agentId) {
      const agent = agents.find(a => a.id === agentId)
      if (agent) {
        const ri = AGENT_ROLES[agent.role] || { name: agent.name, specialty: "marketing", style: "profissional" }
        const directSystem = `VOCE E ${ri.name}. Especialista em ${ri.specialty}. ${ri.style}.\n\nTAREFAS REAIS DO SISTEMA:\n${taskContext}\n${actionContext}\n\nREGRA: Voce CONHECE essas tarefas. Responda com base nelas. JAMAIS invente. Mencione colegas naturalmente.`
        const directReply = await chatCompletion(`${directSystem}\n\n${message}`, { temperature: 0.7, maxTokens: 1500 })
        const cleaned = directReply.replace(/^(Claro|Certo|Com certeza|OK|Ok)[,!.]?\s*/i, "").trim()

        // Post with proper turn management
        const ctx = {
          organizationId: org!.id,
          agent: { id: agent.id, name: agent.name, role: agent.role, personality: agent.personality },
          channelId: resolvedChannelId,
        }
        const postResult = await postWithTurn(ctx, resolvedChannelId || "geral", cleaned, 8)
        const saved = { id: postResult.messageId || `msg-${Date.now()}`, content: cleaned }

        // Auto-chain followUp
        let followUp: any = null
        const names = agent.name.toLowerCase().split(" ")
        const mentionedNames = agents.filter(a => {
          if (a.id === agent.id) return false
          const an = a.name.toLowerCase().split(" ")
          return an.some(n => n.length > 2 && cleaned.toLowerCase().includes(n) && !names.includes(n))
        })
        if (mentionedNames.length > 0) {
          const next = mentionedNames[0]
          const nri = AGENT_ROLES[next.role] || { name: next.name, specialty: "marketing", style: "profissional" }
          const fSys = `VOCE E ${nri.name}. ${nri.specialty}. ${nri.style}.\nTAREFAS:\n${taskContext}\n\n${agent.name} te mencionou: "${cleaned}". Responda em 1-3 frases. JAMAIS invente tarefas.`
          try {
            const fReply = await chatCompletion(`${fSys}\n\nResponda a mencao.`, { temperature: 0.7, maxTokens: 1500 })
            const fClean = fReply.replace(/^(Claro|Certo|Com certeza|OK|Ok)[,!.]?\s*/i, "").trim()
            const fCtx = { organizationId: org!.id, agent: { id: next.id, name: next.name, role: next.role, personality: next.personality }, channelId: resolvedChannelId }
            const fPost = await postWithTurn(fCtx, resolvedChannelId || "geral", fClean, 7)
            followUp = { reply: fClean, messageId: fPost.messageId || "", agentId: next.id, agentName: next.name }
          } catch {}
        }

        // Turn is handled by postWithTurn internally — compute timing for frontend display
        const typingTime = calculateTypingTime(agent.name, cleaned)
        const personality = getPersonality(agent.name)

        // Conflict detection
        let conflict = null
        if (cleaned.length > 30) {
          conflict = await detectConflict(org!.id, cleaned, agent.id, agent.name)
        }

        return NextResponse.json({
          reply: cleaned, messageId: saved.id, agentId: agent.id, agentName: agent.name,
          followUp, actionResult, conflict,
          turn: { delay: 0, typingTime, speaker: agent.name, personality },
        })
      }
    }

    // Orchestrator
    const userMsg = `USUARIO: ${message}\n\nEscolha o melhor agente. FORMATO: AGENTE: [nome]\nFALA: [texto]`
    const reply = await chatCompletion(`${systemPrompt}\n\n${userMsg}`, { temperature: 0.7, maxTokens: 1500 })

    const agentMatch = reply.match(/AGENTE:\s*(.+?)(?:\n|$)/i)
    const speechMatch = reply.match(/FALA:\s*([\s\S]+?)$/i)
    const agentName = agentMatch?.[1]?.trim() || agents[0]?.name || "Maya Ferreira"
    const speech = speechMatch?.[1]?.trim() || reply.replace(/AGENTE:.*?\n?/i, "").replace(/FALA:\s*/i, "").trim()
    const respondingAgent = agents.find(a => a.name === agentName) || agents[0]
    const cleaned = speech.replace(/^(Claro|Certo|Com certeza|OK|Ok)[,!.]?\s*/i, "").trim()

    if (!cleaned || cleaned.length < 3) {
      return NextResponse.json({ reply: "Deixa eu ver aqui... um momento!", agentId: respondingAgent?.id, agentName: respondingAgent?.name, messageId: "" })
    }

    const orcCtx = {
      organizationId: org!.id,
      agent: { id: respondingAgent?.id || agents[0].id, name: respondingAgent?.name || agentName, role: respondingAgent?.role || "STRATEGIST", personality: respondingAgent?.personality || "VISIONARY" },
      channelId: resolvedChannelId,
    }
    const postResult = await postWithTurn(orcCtx, resolvedChannelId || "geral", cleaned, 5)
    const saved = { id: postResult.messageId || `msg-${Date.now()}`, content: cleaned }

    // FollowUp for orchestrator
    let followUp: any = null
    const rNames = (respondingAgent?.name || "").toLowerCase().split(" ")
    const mentionedNames = agents.filter(a => {
      if (a.id === (respondingAgent?.id)) return false
      const an = a.name.toLowerCase().split(" ")
      return an.some(n => n.length > 2 && cleaned.toLowerCase().includes(n) && !rNames.includes(n))
    })
    if (mentionedNames.length > 0) {
      const next = mentionedNames[0]
      const nri = AGENT_ROLES[next.role] || { name: next.name, specialty: "marketing", style: "profissional" }
      const fSys = `VOCE E ${nri.name}. ${nri.specialty}. ${nri.style}.\nTAREFAS:\n${taskContext}\n\n${respondingAgent?.name} te mencionou: "${cleaned}". Responda em 1-3 frases.`
      try {
        const fReply = await chatCompletion(`${fSys}\n\nResponda a mencao.`, { temperature: 0.7, maxTokens: 1500 })
        const fClean = fReply.replace(/^(Claro|Certo|Com certeza|OK|Ok)[,!.]?\s*/i, "").trim()
        const fCtx = { organizationId: org!.id, agent: { id: next.id, name: next.name, role: next.role, personality: next.personality }, channelId: resolvedChannelId }
        const fPost = await postWithTurn(fCtx, resolvedChannelId || "geral", fClean, 7)
        followUp = { reply: fClean, messageId: fPost.messageId || "", agentId: next.id, agentName: next.name }
      } catch {}
    }

    // Turn handled by postWithTurn — compute timing for frontend display
    const typingTime = calculateTypingTime(respondingAgent?.name || agentName, cleaned)
    const personality = getPersonality(respondingAgent?.name || agentName)

    // Conflict detection
    let conflict = null
    if (cleaned.length > 30) {
      conflict = await detectConflict(org!.id, cleaned, respondingAgent?.name || agentName, respondingAgent?.id || "")
    }

    return NextResponse.json({
      reply: cleaned, messageId: saved.id,
      agentId: respondingAgent?.id || agents[0]?.id, agentName: respondingAgent?.name || agentName,
      followUp, actionResult, conflict,
      turn: { delay: 0, typingTime, speaker: respondingAgent?.name || agentName, personality },
    })
  } catch (error) {
    console.error("[Chat Error]", error)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
