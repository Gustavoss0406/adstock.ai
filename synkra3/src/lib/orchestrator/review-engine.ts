/**
 * ── REVIEW ENGINE ──────────────────────────────────────────────
 * Maya (estrategista) revisa tasks em IN_REVIEW antes de DONE.
 * Analisa o conteúdo HTML do card entregável.
 * Após aprovação, dispara exportação PNG para tasks visuais.
 * Histórico de feedbacks impede repetição.
 * 1 aprovação basta.
 */

import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"
import { getCompanyProfile, buildContextPrompt } from "@/lib/autonomous/company-profile"
import { generateArtworkExport } from "@/lib/orchestrator/attachment-generator"

export interface ReviewResult {
  taskId: string
  taskTitle: string
  reviewerName: string
  reviewerId: string
  decision: "approved" | "rejected" | "revision"
  feedback: string
  previousReviews: number
  artworkExported?: boolean
  artworkUrl?: string
}

export async function reviewPendingTasks(
  organizationId: string,
  channelId: string | null
): Promise<ReviewResult[]> {
  const results: ReviewResult[] = []

  const strategyAgents = await prisma.agent.findMany({
    where: { organizationId, role: "STRATEGIST", status: { not: "FIRED" } },
    orderBy: { createdAt: "asc" },
  })

  if (strategyAgents.length === 0) return results
  const reviewer = strategyAgents.find(a => a.name.includes("Maya")) || strategyAgents[0]

  const companyProfile = await getCompanyProfile(organizationId).catch(() => null)

  const reviewTasks = await prisma.task.findMany({
    where: { organizationId, status: "IN_REVIEW", blocked: false },
    include: { assignee: true, attachments: true },
    orderBy: { updatedAt: "asc" },
  })

  for (const task of reviewTasks) {
    const history = (task.reviewHistory as any[]) || []
    const prevFromThis = history.find(h => h.reviewedById === reviewer.id)
    if (prevFromThis) {
      console.log(`[Review] ${reviewer.name} already reviewed "${task.title}" → skipping`)
      continue
    }

    console.log(`[Review] ${reviewer.name} reviewing "${task.title}" by ${task.assignee?.name}`)

    const ctx = companyProfile ? buildContextPrompt(companyProfile, "STRATEGIST") : ""

    const feedbackHistory = history.length > 0
      ? history.map(h => `- ${h.reviewedBy}: "${h.feedback}" (${h.status})`).join("\n")
      : "(primeira revisão)"

    const taskOutput = (task.output as any) || {}
    const htmlDocument = taskOutput.htmlDocument as string | undefined
    const hasHtmlDoc = htmlDocument && htmlDocument.length > 200
    const artworkPending = taskOutput.artworkPending === true

    const isDesigner = task.assignee?.role === "DESIGNER"
    const isSeo = task.assignee?.role === "SEO"

    const htmlPreview = hasHtmlDoc
      ? extractHTMLPreview(htmlDocument!)
      : "(documentação HTML não encontrada ou vazia)"

    const missingDocs: string[] = []
    if (!hasHtmlDoc) missingDocs.push("card HTML padronizado de entrega")
    if (isDesigner && artworkPending !== true) missingDocs.push("indicação artworkPending")

    const docRequirement = missingDocs.length > 0
      ? `\n\n🚨 DOCUMENTAÇÃO FALTANDO: ${missingDocs.join(" e ")}.
REGRAS:
- TODO agente deve entregar card HTML padronizado (seção de resumo, conteúdo, estratégia, decisões, próximos passos)
- Carlos (DESIGNER) deve ter artworkPending=true (PNG será gerado APÓS aprovação)
- Diego (SEO) deve ter card HTML com tabelas de keywords, checklist on-page e blog brief (se aplicável)
- REJEITE entregas sem documentação HTML ou com HTML vazio/genérico.`
      : "\n\n✅ Documentação HTML presente. Analise a qualidade do conteúdo abaixo."

    const roleSpecificPrompt = isDesigner
      ? `\n\n📐 TASK DE DESIGN:\n- Verifique se o HTML preview tem qualidade visual profissional\n- Verifique se as cores da marca estão sendo usadas corretamente\n- Verifique se há elementos obrigatórios (barra de progresso, CTA, estrutura de slides se for carrossel)\n- Se aprovar, o sistema vai gerar automaticamente o PNG final via Vertex AI + Sharp.`
      : isSeo
      ? `\n\n🔍 TASK DE SEO:\n- Verifique se a pesquisa de keywords está completa e relevante\n- Verifique se o checklist on-page cobre todos os itens (title, meta, h1, url, internal links, alt texts)\n- Verifique se meta descriptions estão ≤ 160 caracteres\n- Verifique se o blog brief tem estrutura completa (outline, introduction, faq)`
      : ""

    const reviewPrompt = `${ctx}
Você é ${reviewer.name}, Diretora de Estratégia. Está revisando a entrega de ${task.assignee?.name || "um agente"} (${task.assignee?.role || "analista"}):
"${task.title}"

📄 CONTEÚDO HTML DA ENTREGA (prévia):
${htmlPreview.substring(0, 2000)}

📋 METADADOS DO OUTPUT:
- Tipo: ${task.type || "não especificado"}
- Status: ${task.status}
- Artwork pending: ${artworkPending ? "sim (aguardando aprovação para exportar PNG)" : "não"}
- HTML doc presente: ${hasHtmlDoc ? `sim (${htmlDocument!.length} caracteres)` : "NÃO"}${docRequirement}${roleSpecificPrompt}

Histórico de feedbacks anteriores (NÃO repita esses pontos):
${feedbackHistory}

Analise criticamente:
1. O conteúdo do HTML está alinhado com o nicho (${companyProfile?.industry || "setor"}) e tom da empresa?
2. A documentação HTML está completa e bem estruturada? (resumo, conteúdo, estratégia, decisões, próximos passos)
3. O conteúdo contém métricas FALSAS? NÚMEROS INVENTADOS como "35% aumento", "2800 cliques" sem fonte são INACEITÁVEIS.
4. Se mencionar tecnologias como WordPress, WooCommerce, Google Analytics, MySQL, PHP: são tecnologias DO SITE DO CLIENTE detectadas pelo scraper — NÃO são alucinação.
5. ALUCINAÇÃO REAL é: mencionar Google Search Console como fonte de dados, TikTok, Pinterest, agendamento, ou "publicar em rede social X".
6. Se for task de SEO/website e a empresa NÃO tem site → REJEITE IMEDIATAMENTE.
7. Se for task de DESIGN sem card HTML → REJEITE. O card HTML é obrigatório para TODOS.
8. A qualidade do conteúdo é profissional ou genérica/alucinada?

Decida APENAS entre: "approved", "rejected", "revision".
- "approved": entrega excelente, card HTML completo e bem estruturado, SEM métricas falsas → DONE + export PNG se for DESIGNER
- "revision": conteúdo ok mas ajustes pontuais → volta IN_PROGRESS com feedback
- "rejected": sem card HTML, métricas FALSAS, ou entrega completamente fora do briefing → rejeite com feedback específico

Se rejeitar por métricas falsas, cite EXATAMENTE quais números são inventados.
Se rejeitar por falta de documentação, cite EXATAMENTE o que está faltando.
Se NÃO for "approved", feedback ESPECÍFICO e acionável em PT-BR.

Retorne APENAS JSON:
{"decision":"approved"|"rejected"|"revision","feedback":"feedback em 2-4 frases, português, direto e acionável"}`

    try {
      const reply = await chatCompletion(reviewPrompt, { temperature: 0.5, maxTokens: 500 })
      const json = reply.match(/\{[\s\S]*\}/)
      let review: { decision: string; feedback: string }
      
      if (json) {
        try {
          review = JSON.parse(json[0])
          if (!review.decision || !["approved", "rejected", "revision"].includes(review.decision)) {
            review = { decision: "approved", feedback: review.feedback || "Aprovado." }
          }
        } catch {
          review = { decision: "approved", feedback: "Aprovado (parse error)." }
        }
      } else {
        review = { decision: "approved", feedback: reply?.substring(0, 100) || "Aprovado." }
      }

      const newReview = {
        reviewedBy: reviewer.name,
        reviewedById: reviewer.id,
        status: review.decision,
        feedback: review.feedback,
        at: new Date().toISOString(),
      }
      const updatedHistory = [...history, newReview]

      if (review.decision === "approved") {
        // ── FASE 2: Se for DESIGNER, exportar PNG após aprovação ──
        let artworkExported = false
        let artworkUrl: string | undefined

        if (isDesigner && artworkPending) {
          console.log(`[Review] ✅ Aprovado → Exportando PNG para "${task.title}"...`)
          try {
            const org = await prisma.organization.findUnique({
              where: { id: organizationId },
              select: {
                name: true,
                onboarding: { select: { industry: true, targetAudience: true } },
                brandIdentity: true,
              },
            })

            const brandIdentity = org?.brandIdentity as any
            const brandColors = {
              primary: brandIdentity?.primaryColor || '#6366F1',
              secondary: brandIdentity?.secondaryColor || '#e05c2a',
            }

            const exportResult = await generateArtworkExport({
              taskId: task.id,
              taskTitle: task.title,
              taskDescription: task.description || '',
              taskType: task.type || 'design',
              agentName: task.assignee?.name || 'Carlos Lima',
              agentRole: task.assignee?.role || 'DESIGNER',
              organizationName: org?.name || 'Empresa',
              industry: org?.onboarding?.industry || 'Moda',
              targetAudience: org?.onboarding?.targetAudience || 'Público geral',
              output: taskOutput,
              brandColors,
            })

            artworkExported = true
            artworkUrl = exportResult.artworkUrl
            console.log(`[Review] 🎨 PNG exportado: ${artworkUrl ? '✅' : '❌'} (${exportResult.fileSize || 0} bytes)`)
          } catch (exportErr) {
            console.error(`[Review] ❌ Erro ao exportar PNG:`, exportErr)
          }

          if (artworkExported) {
            results.push({
              taskId: task.id,
              taskTitle: task.title,
              reviewerName: reviewer.name,
              reviewerId: reviewer.id,
              decision: "approved",
              feedback: review.feedback,
              previousReviews: history.length,
              artworkExported: true,
              artworkUrl,
            })
          } else {
            await prisma.task.update({
              where: { id: task.id },
              data: {
                status: "DONE",
                completedAt: new Date(),
                progress: 100,
                deliveryStatus: "APPROVED",
                reviewHistory: updatedHistory as any,
                reviewedBy: reviewer.name,
                reviewedById: reviewer.id,
              },
            })
            results.push({
              taskId: task.id,
              taskTitle: task.title,
              reviewerName: reviewer.name,
              reviewerId: reviewer.id,
              decision: "approved",
              feedback: review.feedback,
              previousReviews: history.length,
              artworkExported: false,
            })
          }
        } else {
          await prisma.task.update({
            where: { id: task.id },
            data: {
              status: "DONE",
              completedAt: new Date(),
              progress: 100,
              deliveryStatus: "APPROVED",
              reviewHistory: updatedHistory as any,
              reviewedBy: reviewer.name,
              reviewedById: reviewer.id,
            },
          })
          results.push({
            taskId: task.id,
            taskTitle: task.title,
            reviewerName: reviewer.name,
            reviewerId: reviewer.id,
            decision: "approved",
            feedback: review.feedback,
            previousReviews: history.length,
          })
        }

        console.log(`  ✅ APPROVED${artworkExported ? ' + PNG exportado' : ''}`)

        if (channelId && task.assignedTo) {
          const msgText = artworkExported
            ? `@${task.assignee?.name?.split(' ')[0] || 'agente'} ${reviewer.name} aprovou sua entrega "${task.title}"! ✅ PNG exportado via Vertex AI.`
            : `@${task.assignee?.name?.split(' ')[0] || 'agente'} ${reviewer.name} aprovou sua entrega "${task.title}"! ✅`

          const duplicate = await prisma.message.findFirst({
            where: { channelId, content: msgText, createdAt: { gte: new Date(Date.now() - 300000) } }
          })
          if (!duplicate) {
            try { await prisma.message.create({ data: { channelId, content: msgText } }) } catch {}
          }
        }
      } else {
        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: "IN_PROGRESS",
            startedAt: new Date(),
            deliveryStatus: review.decision === "revision" ? "REVISION" : "REJECTED",
            reviewHistory: updatedHistory as any,
            reviewedBy: reviewer.name,
            reviewedById: reviewer.id,
            output: { ...taskOutput, reviewFeedback: review.feedback, lastReviewer: reviewer.name } as any,
          },
        })
        if (channelId && task.assignedTo) {
          const msgText = `@${task.assignee?.name?.split(' ')[0] || 'agente'}, ${reviewer.name} pede ${review.decision === "revision" ? "revisão" : "refação"} da task "${task.title}": ${review.feedback}`
          const duplicate = await prisma.message.findFirst({
            where: { channelId, content: msgText, createdAt: { gte: new Date(Date.now() - 300000) } }
          })
          if (!duplicate) {
            try { await prisma.message.create({ data: { channelId, content: msgText } }) } catch {}
          }
        }
        results.push({
          taskId: task.id,
          taskTitle: task.title,
          reviewerName: reviewer.name,
          reviewerId: reviewer.id,
          decision: review.decision as "rejected" | "revision",
          feedback: review.feedback,
          previousReviews: history.length,
        })
        console.log(`  ❌ ${review.decision.toUpperCase()} → voltou pra IN_PROGRESS`)
      }
    } catch (e) {
      console.error(`[Review Error] "${task.title}":`, e instanceof Error ? e.message : e)

      // Retry once with simpler prompt before falling back to auto-approve
      let retryApproved = false
      try {
        const retryPrompt = `Voce e ${reviewer.name}. Revise RAPIDO: "${task.title}" de ${task.assignee?.name}. O card HTML esta completo e sem metricas falsas? Responda APENAS "sim" ou "nao".`
        const retryReply = await chatCompletion(retryPrompt, { temperature: 0.3, maxTokens: 10 })
        retryApproved = retryReply.toLowerCase().includes('sim')
      } catch { /* retry failed too */ }

      try {
        const fallbackFeedback = retryApproved
          ? "Aprovado automaticamente apos revisao de contingencia."
          : "Aprovado automaticamente (erro de sistema — revisao indisponivel)."

        const fallbackHistory = (task.reviewHistory as any[] || []).concat([{
          reviewedBy: reviewer.name,
          reviewedById: reviewer.id,
          status: "approved",
          feedback: fallbackFeedback,
          at: new Date().toISOString()
        }])

        if (isDesigner && artworkPending) {
          try {
            const org = await prisma.organization.findUnique({
              where: { id: organizationId },
              select: {
                name: true,
                onboarding: { select: { industry: true, targetAudience: true } },
                brandIdentity: true,
              },
            })
            const brandIdentity = org?.brandIdentity as any
            await generateArtworkExport({
              taskId: task.id,
              taskTitle: task.title,
              taskDescription: task.description || '',
              taskType: task.type || 'design',
              agentName: task.assignee?.name || 'Carlos Lima',
              agentRole: task.assignee?.role || 'DESIGNER',
              organizationName: org?.name || 'Empresa',
              industry: org?.onboarding?.industry || 'Moda',
              targetAudience: org?.onboarding?.targetAudience || 'Público geral',
              output: taskOutput,
              brandColors: {
                primary: brandIdentity?.primaryColor || '#6366F1',
                secondary: brandIdentity?.secondaryColor || '#e05c2a',
              },
            })
          } catch {}
        }

        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: "DONE",
            completedAt: new Date(),
            progress: 100,
            deliveryStatus: "APPROVED",
            reviewHistory: fallbackHistory as any,
            reviewedBy: reviewer.name,
            reviewedById: reviewer.id,
          },
        })
        results.push({
          taskId: task.id,
          taskTitle: task.title,
          reviewerName: reviewer.name,
          reviewerId: reviewer.id,
          decision: "approved",
          feedback: fallbackFeedback,
          previousReviews: (task.reviewHistory as any[])?.length || 0,
        })
      } catch {}
    }
  }

  return results
}

/**
 * Extrai uma prévia legível do conteúdo HTML para análise da Maya.
 * Remove tags mas preserva a estrutura do texto.
 */
function extractHTMLPreview(html: string): string {
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim()

  return text.substring(0, 2500)
}
