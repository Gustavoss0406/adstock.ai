import { generateInstagramPostPNG, generateCarouselPNGs } from './png-generator'
import { prisma } from '@/lib/prisma'
import { canTransitionStatus } from '@/lib/orchestrator/quality-control'

export interface AttachmentGeneratorInput {
  taskId: string
  taskTitle: string
  taskDescription: string
  taskType: string
  agentName: string
  agentRole: string
  organizationName: string
  industry: string
  targetAudience: string
  output: any
  brandColors?: { primary: string; secondary: string }
}

function extractBestContent(output: any): string {
  if (!output) return ''
  if (typeof output === 'string') return output

  const candidates: Array<{ key: string; value: string }> = []

  function search(obj: any, depth: number = 0) {
    if (!obj || depth > 5) return
    if (typeof obj === 'string' && obj.length > 30) {
      candidates.push({ key: 'text', value: obj })
      return
    }
    if (Array.isArray(obj)) {
      for (const item of obj.slice(0, 3)) search(item, depth + 1)
      return
    }
    if (typeof obj !== 'object') return

    for (const [key, value] of Object.entries(obj)) {
      const isContentField = /content|caption|text|message|copy|body|description|postagem/i.test(key)
      if (typeof value === 'string' && value.length > 20) {
        candidates.push({ key: isContentField ? '🔥' + key : key, value: value })
      } else if (typeof value === 'object') {
        search(value, depth + 1)
      }
    }
  }

  search(output)

  candidates.sort((a, b) => {
    const aPriority = a.key.startsWith('🔥') ? 0 : 1
    const bPriority = b.key.startsWith('🔥') ? 0 : 1
    if (aPriority !== bPriority) return aPriority - bPriority
    return b.value.length - a.value.length
  })

  return candidates[0]?.value || ''
}

/**
 * FASE 1: Gera apenas o card HTML padronizado de entrega.
 * NÃO gera artwork/PNG — isso acontece depois da aprovação da Maya.
 */
export async function generateDeliverableCard(
  input: AttachmentGeneratorInput
): Promise<{ htmlDocument?: string }> {
  console.log(`[Deliverable Card] Task ${input.taskId}, type: ${input.taskType}`)

  const result: { htmlDocument?: string } = {}

  try {
    const content = extractBestContent(input.output)
    console.log(`[Deliverable Card] Content: ${content.length} chars`)

    const dbTask = await prisma.task.findUnique({ where: { id: input.taskId }, select: { output: true } })
    const fullOutput = (dbTask?.output as any) || (input.output as any) || {}

    const isDesigner = ['DESIGNER', 'CREATIVE', 'CRIATIVO'].includes(input.agentRole?.toUpperCase())

    const htmlDoc = renderDeliverableCard(input, content, fullOutput)
    result.htmlDocument = htmlDoc

    const currentOutput = fullOutput
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        status: 'IN_REVIEW',
        output: {
          ...currentOutput,
          htmlDocument: result.htmlDocument,
          artworkPending: isDesigner,
          generatedAt: new Date().toISOString(),
        } as any,
      },
    })

    // Create attachment record for the HTML document
    const htmlDataUrl = 'data:text/html;base64,' + Buffer.from(result.htmlDocument!, 'utf-8').toString('base64')
    await prisma.taskAttachment.create({
      data: {
        taskId: input.taskId,
        fileName: `Entrega_${input.agentName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`,
        fileUrl: htmlDataUrl,
        fileType: 'html',
        fileSize: Buffer.byteLength(result.htmlDocument!, 'utf-8'),
        mimeType: 'text/html',
      },
    })

    console.log(`[Deliverable Card] Done: html=${!!result.htmlDocument} artworkPending=${isDesigner}`)
    return result
  } catch (error) {
    console.error('[Deliverable Card] Error:', error)
    return result
  }
}

/**
 * FASE 2: Gera o artwork PNG via Vertex AI + Sharp.
 * SÓ deve ser chamada após aprovação da Maya.
 */
export async function generateArtworkExport(
  input: AttachmentGeneratorInput
): Promise<{ artworkUrl?: string; fileSize?: number }> {
  console.log(`[Artwork Export] Task ${input.taskId}, type: ${input.taskType}`)

  const result: { artworkUrl?: string; fileSize?: number } = {}

  try {
    const content = extractBestContent(input.output)

    const isVisualRole = ['DESIGNER', 'CREATIVE', 'CRIATIVO'].includes(input.agentRole?.toUpperCase())
    const isVisualType = ['social_post', 'instagram_post', 'carousel', 'carrossel', 'design', 'criativo', 'instagram_carousel'].includes(input.taskType)

    if (!isVisualRole && !isVisualType) {
      console.log(`[Artwork Export] Non-visual task → skipping artwork`)

      const transitionCheck = await canTransitionStatus(input.taskId, "DONE")
      if (!transitionCheck.allowed) {
        console.log(`[Artwork Export] Blocked: ${transitionCheck.reason}`)
        return result
      }

      await prisma.task.update({
        where: { id: input.taskId },
        data: {
          status: 'DONE',
          completedAt: new Date(),
          deliveryStatus: 'APPROVED',
          output: {
            ...((await prisma.task.findUnique({ where: { id: input.taskId }, select: { output: true } }))?.output as any || {}),
            artworkPending: false,
            artworkSkipped: true,
          } as any,
        },
      })

      return result
    }

    console.log(`[Artwork Export] Visual task → generating artwork via Vertex AI`)

    if (input.taskType === 'carousel' || input.taskType === 'carrossel') {
      let slides = input.output?.slides && Array.isArray(input.output.slides) ? input.output.slides : null
      if (!slides && input.output?.raw) {
        try { const parsed = JSON.parse(input.output.raw); if (parsed.slides) slides = parsed.slides } catch {}
      }
      if (!slides) {
        const text = content || input.taskDescription || input.taskTitle
        const parts = text.split(/\.\s+|\n\n+/).filter((p: string) => p.length > 20)
        slides = parts.slice(0, 5).map((p: string, i: number) => ({
          number: i + 1,
          type: ['Hero', 'Problema', 'Solução', 'Diferencial', 'CTA'][i] || 'Slide',
          content: p,
        }))
      }
      if (slides?.length) {
        const pngs = await generateCarouselPNGs(input.taskId, input.taskTitle, slides, input.organizationName, 'adstock', input.brandColors, input.industry, input.targetAudience)
        result.artworkUrl = pngs[0]?.dataUrl
        result.fileSize = pngs[0]?.fileSize
      }
    } else {
      const png = await generateInstagramPostPNG(
        input.taskId, input.taskTitle, content,
        input.organizationName, 'adstock', input.brandColors,
        input.industry, input.targetAudience,
      )
      result.artworkUrl = png.dataUrl
      result.fileSize = png.fileSize
    }

    const currentOutput = (await prisma.task.findUnique({ where: { id: input.taskId }, select: { output: true } }))?.output as any || {}

    // Clear artworkPending before guard check (this IS the artwork export)
    if (currentOutput.artworkPending && result.artworkUrl) {
      await prisma.task.update({
        where: { id: input.taskId },
        data: { output: { ...currentOutput, artworkPending: false } as any },
      })
    }

    const transitionCheck = await canTransitionStatus(input.taskId, "DONE")
    if (!transitionCheck.allowed) {
      console.log(`[Artwork Export] Blocked: ${transitionCheck.reason}`)
      return result
    }

    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        status: 'DONE',
        completedAt: new Date(),
        deliveryStatus: 'APPROVED',
        output: {
          ...currentOutput,
          artworkUrl: result.artworkUrl || currentOutput.artworkUrl,
          artworkPending: false,
          artworkExported: true,
          artworkExportedAt: new Date().toISOString(),
        } as any,
      },
    })

    // Create attachment record for the PNG artwork
    if (result.artworkUrl) {
      await prisma.taskAttachment.create({
        data: {
          taskId: input.taskId,
          fileName: `Arte_${input.agentName.replace(/\s+/g, '_')}_${input.taskTitle.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.png`,
          fileUrl: result.artworkUrl,
          fileType: 'png',
          fileSize: result.fileSize || 0,
          mimeType: 'image/png',
        },
      })
    }

    console.log(`[Artwork Export] Done: artworkUrl=${!!result.artworkUrl} size=${result.fileSize || 0}`)
    return result
  } catch (error) {
    console.error('[Artwork Export] Error:', error)
    return result
  }
}

/**
 * Função de compatibilidade — gera card HTML + artwork juntos.
 * Mantida para compatibilidade com código existente.
 * Prefira usar generateDeliverableCard() + generateArtworkExport() separadamente.
 */
export async function generateAttachments(
  input: AttachmentGeneratorInput
): Promise<{ artworkUrl?: string; htmlDocument?: string }> {
  console.log(`[Attachment Gen] Task ${input.taskId}, type: ${input.taskType}`)

  const result: { artworkUrl?: string; htmlDocument?: string } = {}

  try {
    // FASE 1: HTML card
    const card = await generateDeliverableCard(input)
    result.htmlDocument = card.htmlDocument

    // FASE 2: Artwork (só para tasks visuais)
    const artwork = await generateArtworkExport(input)
    result.artworkUrl = artwork.artworkUrl

    return result
  } catch (error) {
    console.error('[Attachment Gen] Error:', error)
    return result
  }
}

/**
 * Renderiza o card HTML padronizado de entrega.
 * Documento completo com resumo executivo, conteúdo, estratégia, decisões e próximos passos.
 */
function renderDeliverableCard(input: AttachmentGeneratorInput, content: string, output: any): string {
  const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const d = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })
  const t = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const strategy = (output.strategy || output.estrategia || '')
  const decisions: string[] = Array.isArray(output.decisions) ? output.decisions : Array.isArray(output.decisoes) ? output.decisoes : []
  const nextSteps = output.nextSteps || output.proximosPassos || ''
  const goals = output.goals || output.objetivos || ''
  const notes = output.notes || output.observacoes || ''

  const roleLabels: Record<string, string> = {
    DESIGNER: 'DESIGNER',
    STRATEGIST: 'ESTRATÉGIA',
    SOCIAL_MEDIA: 'SOCIAL MEDIA',
    ANALYST: 'ANÁLISE DE DADOS',
    SEO: 'SEO',
    MEDIA_BUYER: 'MÍDIA',
    COMMUNITY_MANAGER: 'COMUNIDADE',
    COPYWRITER: 'COPYWRITING',
  }

  const roleLabel = roleLabels[input.agentRole?.toUpperCase()] || input.agentRole || 'MARKETING'

  const deliverables: string[] = []

  if (input.taskType === 'carousel' || input.taskType === 'carrossel') {
    deliverables.push('Carrossel de slides com estrutura completa (Hero → Problema → Solução → Features → Detalhes → Como fazer → CTA)')
    if (output.slides && Array.isArray(output.slides)) {
      for (const s of output.slides) {
        deliverables.push(`Slide ${s.number}: ${s.type || '—'} — ${(s.description || s.content || '').substring(0, 80)}`)
      }
    }
  } else if (input.taskType === 'design' || input.agentRole?.toUpperCase() === 'DESIGNER') {
    deliverables.push('Briefing visual completo com paleta de cores, tipografia e conceito')
    deliverables.push('Estrutura de slides e descrições visuais detalhadas')
    deliverables.push('Diretrizes de aplicação da identidade visual')
    if (output.visualConcept) deliverables.push(`Conceito: ${output.visualConcept}`)
  } else if (input.agentRole?.toUpperCase() === 'SEO') {
    deliverables.push('Auditoria SEO on-page completa')
    deliverables.push('Checklist de otimizações (title tags, meta descriptions, headings)')
    deliverables.push('Pesquisa de palavras-chave com recomendações')
    if (Array.isArray(output.priorityKeywords)) deliverables.push(`${output.priorityKeywords.length} keywords analisadas`)
  } else if (input.agentRole?.toUpperCase() === 'STRATEGIST') {
    deliverables.push('Calendário editorial completo')
    deliverables.push('Copies em 3 variações (emocional, direta, interativa)')
    deliverables.push('Briefings de pauta com objetivos e público-alvo')
  } else {
    deliverables.push('Documento de entrega completo')
    if (content && content.length > 20) deliverables.push('Conteúdo principal produzido')
  }

  const summary = strategy || `Entrega desenvolvida para ${input.organizationName}, atuante no setor ${input.industry}, com foco no público ${input.targetAudience}.`

  const objectiveLines: string[] = []
  if (goals && typeof goals === 'string') {
    for (const g of goals.split('\n').filter(Boolean)) objectiveLines.push(`  <li>${esc(g)}</li>`)
  } else if (Array.isArray(goals)) {
    for (const g of goals) objectiveLines.push(`  <li>${esc(String(g))}</li>`)
  } else {
    objectiveLines.push(`  <li>Fortalecer o posicionamento da marca no setor ${esc(input.industry)}</li>`)
    objectiveLines.push(`  <li>Aumentar o alcance digital junto ao público ${esc(input.targetAudience)}</li>`)
    objectiveLines.push(`  <li>Melhorar o engajamento e apoiar ações comerciais</li>`)
  }

  const nextStepLines: string[] = []
  if (nextSteps && typeof nextSteps === 'string') {
    for (const ns of nextSteps.split('\n').filter(Boolean)) nextStepLines.push(`  <li>${esc(ns)}</li>`)
  } else if (Array.isArray(nextSteps)) {
    for (const ns of nextSteps) nextStepLines.push(`  <li>${esc(String(ns))}</li>`)
  } else {
    nextStepLines.push('  <li>Acompanhamento de métricas de performance</li>')
    nextStepLines.push('  <li>Otimização contínua com base nos resultados</li>')
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Entrega — ${esc(input.taskTitle)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@400;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: #fff;
    color: #1a1a2e;
    line-height: 1.7;
    max-width: 800px;
    margin: 0 auto;
    padding: 48px 40px 60px;
  }

  .header {
    border-bottom: 3px solid #1a1a2e;
    padding-bottom: 24px;
    margin-bottom: 32px;
  }

  .header .label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #666;
    margin-bottom: 8px;
  }

  .header h1 {
    font-family: 'Merriweather', Georgia, serif;
    font-size: 26px;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 6px;
    line-height: 1.3;
  }

  .header .subtitle {
    font-size: 14px;
    color: #666;
    font-weight: 400;
  }

  .header .meta {
    margin-top: 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    font-size: 12px;
    color: #888;
  }

  .header .meta span { white-space: nowrap; }

  .section {
    margin-top: 32px;
  }

  .section h2 {
    font-family: 'Merriweather', Georgia, serif;
    font-size: 18px;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e0e0e0;
  }

  .section p {
    font-size: 14px;
    color: #333;
    margin-bottom: 8px;
  }

  .section ul {
    list-style: none;
    padding: 0;
  }

  .section ul li {
    font-size: 14px;
    color: #333;
    padding: 4px 0 4px 20px;
    position: relative;
  }

  .section ul li::before {
    content: '•';
    position: absolute;
    left: 0;
    color: #1a1a2e;
    font-weight: 700;
  }

  .section ol {
    padding-left: 20px;
  }

  .section ol li {
    font-size: 14px;
    color: #333;
    padding: 2px 0;
  }

  .content-block {
    background: #f8f9fa;
    border-left: 3px solid #1a1a2e;
    padding: 16px 20px;
    margin: 12px 0;
    font-size: 14px;
    color: #444;
    white-space: pre-wrap;
    line-height: 1.8;
  }

  .decisions-block {
    background: #fafafa;
    border: 1px solid #eee;
    padding: 16px 20px;
    margin: 12px 0;
    font-size: 13px;
    color: #555;
  }

  .decisions-block strong {
    color: #1a1a2e;
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    display: block;
    margin-bottom: 10px;
  }

  .decisions-block ol li {
    padding: 4px 0;
    font-size: 13px;
  }

  .footer {
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
    font-size: 12px;
    color: #999;
  }

  .footer .sig {
    font-family: 'Merriweather', Georgia, serif;
    font-size: 16px;
    color: #555;
    margin-bottom: 2px;
  }

  @media (max-width: 600px) {
    body { padding: 24px 20px 40px; }
    .header h1 { font-size: 22px; }
    .header .meta { flex-direction: column; gap: 4px; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="label">ENTREGA DE MARKETING — ${esc(roleLabel)}</div>
  <h1>${esc(input.taskTitle)}</h1>
  <p class="subtitle">Documento de entrega — apresentação das peças desenvolvidas, diretrizes e resultados esperados.</p>
  <div class="meta">
    <span>🏢 ${esc(input.organizationName)}</span>
    <span>👤 ${esc(input.agentName)}</span>
    <span>📅 ${d}</span>
    <span>🏭 ${esc(input.industry)}</span>
  </div>
</div>

<div class="section">
  <h2>Resumo Executivo</h2>
  <p>${esc(summary)}</p>
</div>

<div class="section">
  <h2>Entregas Realizadas</h2>
  <ul>
    ${deliverables.map(item => `<li>${esc(item)}</li>`).join('\n    ')}
  </ul>
</div>

${content && content.length > 30 ? `
<div class="section">
  <h2>Conteúdo Produzido</h2>
  <div class="content-block">${esc(content)}</div>
</div>` : ''}

<div class="section">
  <h2>Objetivos</h2>
  <ol>
${objectiveLines.join('\n')}
  </ol>
</div>

${decisions.length > 0 ? `
<div class="section">
  <h2>Decisões Técnicas</h2>
  <div class="decisions-block">
    <strong>Decisões tomadas durante o desenvolvimento</strong>
    <ol>
      ${decisions.map(d => `<li>${esc(d)}</li>`).join('\n      ')}
    </ol>
  </div>
</div>` : ''}

<div class="section">
  <h2>Próximos Passos</h2>
  <ul>
${nextStepLines.join('\n')}
  </ul>
</div>

<div class="section">
  <h2>Anexos e Observações</h2>
  <p>Espaço reservado para inserção de links, mockups, métricas e observações adicionais.</p>
  <p style="margin-top:6px;font-size:12px;color:#999;">
    📎 Documento gerado em ${d} às ${t} · ${esc(input.agentName)} · ${esc(input.organizationName)}
    ${notes ? `<br>📝 ${esc(notes)}` : ''}
  </p>
</div>

<div class="footer">
  <div class="sig">${esc(input.agentName)}</div>
  ${esc(input.agentRole)} · ${esc(input.organizationName)}
</div>

</body></html>`
}
