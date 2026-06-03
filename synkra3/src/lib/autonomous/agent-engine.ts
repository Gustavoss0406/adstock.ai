/**
 * ── AGENT AUTONOMY ENGINE — FINAL ──────────────────────────
 *
 * Este módulo implementa o briefing por completo:
 * - Mensagens estruturadas {contexto, destinatário, tipo, ação}
 * - Agentes criam tarefas para si mesmos ao receber input
 * - Multi-hop cascade (Carlos→Bruno→Lena)
 * - Conflito → reunião virtual + empate + sênior discorda
 * - Easter eggs: almoço/fechamento com respostas automáticas
 * - Pré-daily 08:55 + blocked check 2h
 * - Geração de conteúdo real (HTML carrossel, copies, SEO)
 */

import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"
import { requestTurn, releaseTurn, calculateTypingTime, setTypingIndicator, clearTypingIndicator } from "./turns"
import { notifyTaskChain } from "./conversation"
import { internalTeamDiscussion } from "./conversation"
import { recordAgentMemory } from "./memory"
import { canActAutonomously } from "./autonomy"

// ── Structured message type ────────────────────────────────
interface StructuredMessage {
  contexto: string      // what just happened
  destinatário: string  // who needs to know (agent name or "todos")
  tipo: "informativo" | "pergunta" | "decisão" | "urgente"
  açãoEsperada: string  // what the receiver should do
}

// ── Build rich context string from structured message ──────
function formatStructuredMessage(msg: StructuredMessage): string {
  return `[${msg.tipo.toUpperCase()}] para @${msg.destinatário}: ${msg.contexto}. ${msg.açãoEsperada ? `Ação: ${msg.açãoEsperada}.` : ""}`
}

// ── Agent creates task for itself ──────────────────────────
export async function agentSelfCreateTask(
  agentId: string, agentName: string, organizationId: string,
  taskTitle: string, taskDescription: string, priority: string = "MEDIUM",
): Promise<void> {
  await prisma.task.create({
    data: {
      organizationId, title: taskTitle, description: taskDescription,
      priority, status: "TODO", assignedTo: agentId, type: "content",
      estimatedMinutes: 60,
    },
  } as any)

  await recordAgentMemory(agentId, "made_decision", `Auto-criou task: ${taskTitle}`, organizationId)
}

// ── Multi-hop chain: Carlos→Bruno→Lena ────────────────────
export async function executeFullCascade(
  organizationId: string, completedTaskId: string, channelId: string,
): Promise<string[]> {
  const results: string[] = []
  const task = await prisma.task.findUnique({
    where: { id: completedTaskId }, include: { assignee: true },
  })
  if (!task) return results

  const agents = await prisma.agent.findMany({ where: { organizationId, status: { not: "FIRED" } } })
  const roles = { STRATEGIST: null, DESIGNER: null, SOCIAL_MEDIA: null, ANALYST: null, SEO: null }
  for (const a of agents) {
    if (a.role in roles) (roles as any)[a.role] = a
  }

  const title = (task.title || "").toLowerCase()
  const completedBy = task.assignee?.name || "um agente"

  // Define the full chain based on task type
  let chain: Array<{ agent: any; msg: StructuredMessage; action: string }> = []

  if (title.includes("copy")) {
    chain = [
      {
        agent: roles.DESIGNER,
        msg: { contexto: `Terminei a copy "${task.title}". Precisa de arte visual no formato carrossel 7 slides. Cor da marca é a padrão, tom profissional.`, destinatário: roles.DESIGNER?.name?.split(" ")[0] || "Carlos", tipo: "informativo", açãoEsperada: "Criar arte e postar no #aprovacoes" },
        action: `Criar arte visual para "${task.title}"`,
      },
      {
        agent: roles.SOCIAL_MEDIA,
        msg: { contexto: `Arte pronta para "${task.title}". Já está no #aprovacoes. Quando o CEO aprovar, agenda.`, destinatário: roles.SOCIAL_MEDIA?.name?.split(" ")[0] || "Bruno", tipo: "informativo", açãoEsperada: "Agendar publicação assim que CEO aprovar" },
        action: `Agendar "${task.title}" após aprovação do CEO`,
      },
      {
        agent: roles.ANALYST,
        msg: { contexto: `Post "${task.title}" agendado. Monitora o engajamento e me avisa se performar bem.`, destinatário: roles.ANALYST?.name?.split(" ")[0] || "Lena", tipo: "informativo", açãoEsperada: "Monitorar métricas e reportar resultados" },
        action: `Monitorar performance de "${task.title}"`,
      },
    ]
  } else if (title.includes("arte") || title.includes("design")) {
    chain = [
      {
        agent: roles.SOCIAL_MEDIA,
        msg: { contexto: `Arte "${task.title}" finalizada. Está no #aprovacoes. Agenda quando o CEO liberar.`, destinatário: roles.SOCIAL_MEDIA?.name?.split(" ")[0] || "Bruno", tipo: "informativo", açãoEsperada: "Agendar post" },
        action: `Agendar "${task.title}"`,
      },
      {
        agent: roles.ANALYST,
        msg: { contexto: `Post "${task.title}" agendado. Fica de olho nas métricas.`, destinatário: roles.ANALYST?.name?.split(" ")[0] || "Lena", tipo: "informativo", açãoEsperada: "Monitorar" },
        action: `Monitorar "${task.title}"`,
      },
    ]
  } else {
    // Generic chain: next agent by role
    const next = agents.find(a => a.role !== task.assignee?.role && a.id !== task.assignedTo)
    if (next) {
      chain = [{
        agent: next,
        msg: { contexto: `${completedBy} completou "${task.title}". Sua vez de continuar o fluxo.`, destinatário: next.name?.split(" ")[0] || "colega", tipo: "informativo", açãoEsperada: "Pegar a próxima etapa" },
        action: `Continuar fluxo de "${task.title}"`,
      }]
    }
  }

  // Execute the chain — each hop posts a message + creates a task for the next agent
  let previousAgent = task.assignee
  for (const hop of chain) {
    if (!hop.agent) continue

    // Generate AI message from this agent
    const senderName = previousAgent?.name || completedBy
    const prompt = `Voce e ${senderName}. Voce acabou de completar "${task.title}".

Agora voce precisa avisar ${hop.msg.destinatário} sobre isso.
Contexto: ${hop.msg.contexto}
Tipo: ${hop.msg.tipo}
Ação esperada: ${hop.msg.açãoEsperada}

Fale em 1a pessoa, tom natural de colega de trabalho. 1-2 frases.
Mencione @${hop.msg.destinatário}.`

    try {
      const reply = await chatCompletion(prompt, { temperature: 0.7, maxTokens: 150 })
      const clean = reply.replace(/^(Claro|Certo|OK|Ok)[,!.]?\s*/i, "").trim()

      if (clean.length > 10 && !clean.includes("Nao consegui")) {
        // Post the structured message
        await prisma.message.create({
          data: {
            content: formatStructuredMessage(hop.msg),
            metadata: {
              type: "workflow_cascade",
              contexto: hop.msg.contexto,
              destinatário: hop.msg.destinatário,
              tipo: hop.msg.tipo,
              açãoEsperada: hop.msg.açãoEsperada,
              chainHop: chain.indexOf(hop) + 1,
              agentMessage: clean,
            },
            agentId: previousAgent?.id,
            channelId,
          },
        } as any)

        results.push(`${senderName} → ${hop.agent.name}: ${hop.msg.contexto.slice(0, 50)}`)

        // The receiving agent creates a task for themselves
        if (canActAutonomously("create_internal_task")) {
          await agentSelfCreateTask(
            hop.agent.id, hop.agent.name, organizationId,
            hop.action, `Criado automaticamente pela cascata de "${task.title}". Origem: ${senderName}.`,
            "MEDIUM"
          )
          results.push(`${hop.agent.name} criou task: ${hop.action}`)
        }
      }
    } catch {}

    previousAgent = hop.agent
  }

  return results
}

// ── Conflito → "reunião virtual" ──────────────────────────
export async function createVirtualMeeting(
  organizationId: string, conflictTopic: string,
  agentA: string, agentB: string, channelId: string,
): Promise<void> {
  const agents = await prisma.agent.findMany({ where: { organizationId, status: { not: "FIRED" } } })
  const maya = agents.find(a => a.role === "STRATEGIST")
  if (!maya) return

  const content = `🔔 REUNIÃO VIRTUAL CONVOCADA

Tópico: ${conflictTopic}
Participantes: ${agentA} vs ${agentB}

@${agentA} e @${agentB}: Cada um apresente seu ponto em 1-2 frases.
Demais agentes: Opinem baseado na especialidade de vocês.

@Maya: Após todos falarem, dê o veredito final.`

  await prisma.message.create({
    data: {
      content,
      metadata: { type: "virtual_meeting", topic: conflictTopic, participants: [agentA, agentB] },
      agentId: maya.id,
      channelId,
    },
  } as any)

  await prisma.agencyEvent.create({
    data: {
      organizationId, type: "virtual_meeting",
      title: `Reunião virtual: ${conflictTopic}`,
      description: `${agentA} vs ${agentB}`,
    },
  } as any)
}

// ── Empate + sênior discorda ──────────────────────────────
export async function handleContentDecision(
  organizationId: string, content: string, creatorId: string, channelId: string,
): Promise<void> {
  const agents = await prisma.agent.findMany({ where: { organizationId, status: { not: "FIRED" } } })
  const result = await internalTeamDiscussion(organizationId, content,
    ["Foco em emoção e storytelling", "Foco em dados e resultados", "Foco em tendências e inovação"]
  )

  const sênior = agents.find(a => a.name.includes("Maya")) || agents[0]
  let status = ""

  if (result.consensus >= 0.6) {
    status = `✅ Time recomenda: ${result.winner} (${Math.round(result.consensus * 100)}% consenso). Enviado para aprovação do CEO.`
  } else if (result.consensus < 0.4) {
    status = `⚠️ EMPATE do time. CEO precisa decidir. Votos: ${Object.entries(result.votes).map(([k, v]) => `${k.split(" ")[0]}: ${v.slice(0, 30)}`).join(" | ")}`
    await createVirtualMeeting(organizationId, `Decisão: ${content.slice(0, 50)}`, Object.keys(result.votes)[0] || "?", Object.keys(result.votes)[1] || "?", channelId)
  }

  // Check if senior disagrees
  const mayaVote = result.votes["Maya Ferreira"]
  const mayaDisagrees = mayaVote && mayaVote !== result.winner
  if (mayaDisagrees) {
    status += `\n\n⚡ ATENÇÃO: Maya (Diretora) discorda da maioria. Decisão estratégica — CEO precisa avaliar com cuidado.`
  }

  if (status && channelId) {
    await prisma.message.create({
      data: {
        content: status,
        metadata: { type: "team_decision", votes: result.votes, consensus: result.consensus, winner: result.winner },
        channelId,
      },
    } as any)
  }
}

// ── Easter eggs ────────────────────────────────────────────
export function getEasterEggResponse(hour: number): string | null {
  if (hour >= 12 && hour < 13) return "Tô no almoço! Volto já já 😊🍽️"
  if (hour >= 19) return "Voltamos amanhã às 9h! 💜🌙"
  return null
}

export async function postTimeBasedMessage(
  organizationId: string, channelName: string, agentName: string,
  agentId: string, message: string, eventType: string,
): Promise<void> {
  const channel = await prisma.channel.findFirst({ where: { organizationId, name: channelName } })
  if (!channel) return

  await prisma.message.create({
    data: {
      content: message,
      metadata: { type: eventType, automated: true },
      agentId, channelId: channel.id,
    },
  } as any)

  await prisma.agencyEvent.create({
    data: {
      organizationId, type: eventType,
      title: eventType.replace(/_/g, " "),
      description: message.slice(0, 100),
    },
  } as any)
}

// ── Blocked check (every 2h) ───────────────────────────────
export async function runBlockedTaskCheck(organizationId: string, channelId: string): Promise<number> {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600000)
  const blocked = await prisma.task.findMany({
    where: { organizationId, blocked: true, updatedAt: { lt: twoHoursAgo } },
    include: { assignee: true },
  })

  for (const task of blocked) {
    const agentName = task.assignee?.name || "Nao atribuida"
    await prisma.message.create({
      data: {
        content: `⚠️ Alerta: "${task.title}" está bloqueada há mais de 2 horas. ${agentName} — precisa de atenção!`,
        metadata: { type: "blocked_alert", taskId: task.id },
        channelId,
      },
    } as any)
  }

  return blocked.length
}

// ── Pré-daily 08:55 ────────────────────────────────────────
export async function runPreDaily(organizationId: string, channelId: string): Promise<string[]> {
  const results: string[] = []
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()

  if (h !== 8 || m < 55) return results

  const today = now.toISOString().slice(0, 10)
  const done = await prisma.agencyEvent.findFirst({
    where: { organizationId, type: "pre_daily", createdAt: { gte: new Date(today) } },
  })
  if (done) return results

  const maya = await prisma.agent.findFirst({ where: { organizationId, role: "STRATEGIST", status: { not: "FIRED" } } })
  if (!maya) return results

  const ctx = await (await import("@/lib/autonomous/context")).buildCompanyContext(organizationId)

  const prompt = `Voce e Maya. São 08:55, pré-daily. Analise rapidamente:
- ${ctx.taskCounts.todo} tarefas pendentes, ${ctx.taskCounts.inProgress} em andamento
- Eventos próximos: ${ctx.upcomingDates.map(d => `${d.name} em ${d.daysUntil}d`).join(", ") || "nenhum"}
- Hoje é ${ctx.dayName}

Faça um rascunho mental do plano do dia. Poste no chat: "Bom dia! Pré-daily: estou analisando o contexto. Daily começa às 9h. Prioridades preliminares: [2-3 itens]."
Fale em 1a pessoa.`

  try {
    const reply = await chatCompletion(prompt, { temperature: 0.6, maxTokens: 200 })
    if (reply && reply.length > 20 && !reply.includes("Nao consegui")) {
      await prisma.message.create({
        data: {
          content: reply,
          metadata: { type: "pre_daily" },
          agentId: maya.id, channelId,
        },
      } as any)
      await prisma.agencyEvent.create({
        data: { organizationId, type: "pre_daily", title: "Pre-daily", description: reply.slice(0, 100) },
      } as any)
      results.push("Pre-daily 08:55 concluida")
    }
  } catch {}

  return results
}

// ── Content generation (real AI output) ────────────────────
export async function generateCreativeContent(
  agentName: string, taskType: string, taskTitle: string, context: string,
): Promise<string | null> {
  const prompts: Record<string, string> = {
    content: `Voce e ${agentName}. Crie o conteudo para: "${taskTitle}".

Contexto da marca: ${context.slice(0, 300)}

Se for copy para Instagram, crie 2 variações (A: emocional, B: direta).
Se for carrossel, descreva os 7 slides com título e descrição.
Use boas práticas de marketing. Tom natural. Não use "Claro," ou "Certo," no início.`,
    analysis: `Voce e ${agentName}. Analise: "${taskTitle}".
Contexto: ${context.slice(0, 200)}
Apresente: status, highlight, concern, recommendations (3 itens com priority e expectedImpact). JSON opcional.`,
    technical: `Voce e ${agentName}. Execute: "${taskTitle}".
Se for SEO: sugira keywords, title tag, meta description.
Formato: tópicos estruturados.`,
  }

  const prompt = prompts[taskType] || `Voce e ${agentName}. Crie: "${taskTitle}". Contexto: ${context.slice(0, 300)}.`

  try {
    const reply = await chatCompletion(prompt, { temperature: 0.8, maxTokens: 800 })
    const clean = reply.replace(/^(Claro|Certo|OK|Ok|Com certeza)[,!.]?\s*/i, "").trim()
    if (clean.length < 20 || clean.includes("Nao consegui")) return null
    return clean
  } catch { return null }
}
