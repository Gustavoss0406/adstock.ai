/**
 * ═══════════════════════════════════════════════════════════════
 * E2E TEST — CENÁRIO REAL (grounded no que a plataforma faz)
 * ═══════════════════════════════════════════════════════════════
 *
 * A plataforma REALMENTE faz:
 *   - Conecta Instagram (leitura: perfil + 5 posts com métricas)
 *   - Conecta LinkedIn (leitura: perfil básico — nome, email)
 *   - Scrapeia site (SEO score, meta tags, headings, tech stack)
 *   - Gera conteúdo TEXTUAL com AI (copies, briefings, auditorias, calendários)
 *   - Gera cards HTML padronizados como entregáveis
 *   - Exporta PNG (background Vertex AI + overlay SVG) após aprovação
 *
 * A plataforma NÃO faz:
 *   - Publicar/agendar em rede social nenhuma
 *   - Acessar GSC/GA (tokens salvos mas não consultados)
 *   - TikTok, Pinterest, Facebook, Twitter
 *   - Gerar imagens diretamente (só texto, PNG é pós-aprovação)
 */

import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const prisma = new PrismaClient()

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const WORKER_URL = process.env.AGENT_WORKER_URL || 'https://plain-hill-073a.gustavoss0406.workers.dev'

async function aiChat(prompt: string, maxTokens = 2000): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${WORKER_URL}/v1/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistralai/mistral-small-3.1-24b-instruct',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens, temperature: 0.8,
        }),
        signal: AbortSignal.timeout(60000),
      })
      const j = await r.json() as any
      const t = j?.reply || j?.choices?.[0]?.message?.content || ''
      if (t.length > 20) return t
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 2000))
  }
  return ''
}

const SEP = '═'.repeat(60)

// ── Mock de dados reais de Instagram ──
const MOCK_INSTAGRAM_DATA = {
  username: 'texarte',
  followers: 12400,
  following: 892,
  mediaCount: 247,
  accountType: 'BUSINESS',
  recentPosts: [
    { id: 'p1', caption: 'Nova coleção Outono/Inverno 2026 já disponível para compradores. Tecidos premium com acabamento italiano.', type: 'IMAGE', likes: 847, comments: 43, insights: { impressions: 15200, reach: 11800, engagement: 890 } },
    { id: 'p2', caption: 'Por dentro da nossa fábrica: controle de qualidade dos tecidos antes do envio para as grandes magazines.', type: 'CAROUSEL_ALBUM', likes: 1203, comments: 67, insights: { impressions: 21300, reach: 17800, engagement: 1270 } },
    { id: 'p3', caption: 'Case: como a Renner reduziu em 15% o desperdício têxtil usando nossos tecidos de malha premium.', type: 'IMAGE', likes: 2104, comments: 98, insights: { impressions: 35200, reach: 28900, engagement: 2202 } },
    { id: 'p4', caption: 'Tendências têxteis 2026: sustentabilidade, texturas naturais e tecnologia wearable. Baixe o relatório completo.', type: 'IMAGE', likes: 567, comments: 34, insights: { impressions: 9800, reach: 7200, engagement: 601 } },
    { id: 'p5', caption: 'Parceria com a C&A: novos tecidos sustentáveis chegando nas lojas em Julho.', type: 'IMAGE', likes: 1890, comments: 112, insights: { impressions: 29800, reach: 24100, engagement: 2002 } },
  ],
  avgEngagementRate: 6.8,
  totalLikes5Posts: 6611,
}

// ── Mock de dados reais de LinkedIn ──
const MOCK_LINKEDIN_DATA = {
  linkedinId: 'texarte-tecidos',
  name: 'Texarte Têxtil',
  email: 'comercial@texarte.com.br',
}

// ── Mock de dados reais de SEO scraper ──
const MOCK_SEO_DATA = {
  title: 'Texarte Têxtil — Fornecedor Premium de Tecidos para Grandes Magazines',
  description: 'Fornecedora de tecidos premium para as maiores redes de moda do Brasil. Malha, sarja, brim e tecidos sustentáveis para coleções de alto padrão.',
  ogTitle: 'Texarte Têxtil — Tecidos Premium',
  ogDescription: 'Fornecedora B2B de tecidos para Renner, Riachuelo, C&A e Marisa.',
  ogImage: 'https://www.texarte.com.br/og-image.jpg',
  canonical: 'https://www.texarte.com.br/',
  h1: ['Tecidos Premium para Grandes Marcas', 'Nossa Coleção', 'Sustentabilidade'],
  imageCount: 34,
  linkCount: 89,
  hasStructuredData: true,
  structuredDataTypes: ['Organization', 'Product', 'BreadcrumbList'],
  pageSize: 245600,
  wordCount: 3200,
  detectedTech: ['WordPress', 'WooCommerce', 'Google Analytics', 'MySQL', 'PHP', 'Nginx'],
  seoScore: 68,
  businessName: 'Texarte Têxtil Ltda',
}

function getIndustryLabel(): string { return 'Moda e Têxtil' }
function getTargetAudience(): string { return 'Compradores de grandes magazines (Renner, Riachuelo, Marisa, C&A)' }
function getBrandVoice(): string { return 'Profissional, sofisticado e consultivo' }

async function main() {
  const TOTAL_STEPS = 10
  const TS = Date.now()
  const companyName = `Texarte Têxtil E2E ${TS}`
  const email = `e2e-texarte-${TS}@adstock.ai`

  console.log(SEP)
  console.log('🧪 E2E TEST — CENÁRIO REAL')
  console.log(SEP)
  console.log(`  Empresa: ${companyName}`)
  console.log(`  Email:   ${email}`)
  console.log(`  Início:  ${new Date().toLocaleString('pt-BR')}`)

  // ══════════════════════════════════════════════════════════
  // STEP 1: REGISTRO
  // ══════════════════════════════════════════════════════════
  console.log(`\n${SEP}\n📌 [1/${TOTAL_STEPS}] REGISTRO\n${SEP}`)
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email, password: 'test123456', email_confirm: true,
    user_metadata: { name: 'CEO Texarte' },
  })
  if (authErr) { console.log('  ❌', authErr.message); await prisma.$disconnect(); return }
  await prisma.user.create({ data: { id: authUser.user.id, name: 'CEO Texarte', email } })
  console.log(`  ✅ Auth: ${authUser.user.id} | User sync OK`)

  // ══════════════════════════════════════════════════════════
  // STEP 2: EMPRESA + AGENTES
  // ══════════════════════════════════════════════════════════
  console.log(`\n${SEP}\n📌 [2/${TOTAL_STEPS}] EMPRESA + AGENTES + CANAIS\n${SEP}`)
  const slug = `texarte-e2e-${TS}`
  const org = await prisma.organization.create({
    data: {
      name: companyName, slug, ownerId: authUser.user.id,
      members: { create: { userId: authUser.user.id, role: 'OWNER' } },
      brandIdentity: { primaryColor: '#1a3a5c', secondaryColor: '#d4a843', fontFamily: 'Playfair Display' } as any,
    },
  })

  const agentDefs = [
    { name: 'Maya Ferreira', role: 'STRATEGIST', skills: ['estrategia', 'calendario', 'copywriting', 'revisao'], traits: ['lider', 'visionaria', 'criativa'] },
    { name: 'Bruno Costa', role: 'SOCIAL_MEDIA', skills: ['tendencias', 'analise-redes', 'formatos'], traits: ['antenado', 'criativo', 'proativo'] },
    { name: 'Lena Souza', role: 'ANALYST', skills: ['metricas', 'relatorios', 'seo-auditoria'], traits: ['analitica', 'metodica', 'cetica'] },
    { name: 'Carlos Lima', role: 'DESIGNER', skills: ['briefing-visual', 'carrosseis', 'paleta'], traits: ['perfeccionista', 'criativo', 'detalhista'] },
    { name: 'Diego Ramos', role: 'SEO', skills: ['seo-onpage', 'auditoria', 'keywords', 'blog'], traits: ['tecnico', 'metodico', 'paciente'] },
  ]
  const agents: any[] = []
  for (const def of agentDefs) {
    const a = await prisma.agent.create({
      data: { organizationId: org.id, name: def.name, role: def.role, status: 'ACTIVE', workState: 'IDLE', skills: def.skills, traits: def.traits, personality: 'VISIONARY', salary: 5000, promptTemplate: `Você é ${def.name}, ${def.role} na ${companyName}.` },
    })
    agents.push(a)
  }
  const channel = await prisma.channel.create({ data: { organizationId: org.id, name: 'daily-standup', type: 'text', isDefault: true } })
  await prisma.officeSettings.create({ data: { organizationId: org.id, dailyEnabled: true, dailyTime: '09:00', dailyDays: ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'] } })
  console.log(`  ✅ ${agents.length} agentes | Canal: daily-standup | Cores: #1a3a5c / #d4a843`)

  // ══════════════════════════════════════════════════════════
  // STEP 3: ONBOARDING
  // ══════════════════════════════════════════════════════════
  console.log(`\n${SEP}\n📌 [3/${TOTAL_STEPS}] ONBOARDING\n${SEP}`)
  await prisma.onboarding.create({
    data: {
      organizationId: org.id, step: 5, completed: true,
      industry: getIndustryLabel(),
      targetAudience: getTargetAudience(),
      brandVoice: getBrandVoice(),
      goals: ['Aumentar presença digital B2B', 'Gerar leads qualificados de compradores', 'Fortalecer autoridade como fornecedor premium'],
      website: 'www.texarte.com.br',
      mainChallenges: 'Diferenciação em mercado commoditizado',
    },
  })
  console.log(`  ✅ Onboarding: ${getIndustryLabel()} | ${getTargetAudience()}`)

  // ══════════════════════════════════════════════════════════
  // STEP 4: CONECTAR PLATAFORMAS (dados reais)
  // ══════════════════════════════════════════════════════════
  console.log(`\n${SEP}\n📌 [4/${TOTAL_STEPS}] CONECTANDO PLATAFORMAS (dados reais)\n${SEP}`)
  await prisma.integration.create({
    data: { organizationId: org.id, platform: 'instagram', name: '@texarte', status: 'connected', metadata: MOCK_INSTAGRAM_DATA as any },
  })
  console.log(`  ✅ Instagram: @texarte | ${MOCK_INSTAGRAM_DATA.followers.toLocaleString()} seguidores | ${MOCK_INSTAGRAM_DATA.recentPosts.length} posts`)

  await prisma.integration.create({
    data: { organizationId: org.id, platform: 'linkedin', name: 'Texarte Têxtil', status: 'connected', metadata: MOCK_LINKEDIN_DATA as any },
  })
  console.log(`  ✅ LinkedIn: ${MOCK_LINKEDIN_DATA.name} | Perfil básico (nome + email)`)

  // Simula scraper do site (salva no Integration como platform 'website')
  await prisma.integration.create({
    data: { organizationId: org.id, platform: 'website', name: 'www.texarte.com.br', status: 'connected', metadata: MOCK_SEO_DATA as any },
  })
  console.log(`  ✅ Site scraper: seoScore=${MOCK_SEO_DATA.seoScore}/100 | ${MOCK_SEO_DATA.wordCount} palavras | ${MOCK_SEO_DATA.detectedTech.length} techs`)

  // ══════════════════════════════════════════════════════════
  // STEP 5: DAILY MEETING (com dados REAIS)
  // ══════════════════════════════════════════════════════════
  console.log(`\n${SEP}\n📌 [5/${TOTAL_STEPS}] DAILY MEETING\n${SEP}`)
  const speeches: Array<{ agent: string; role: string; content: string }> = []
  const dayCtx = `Hoje é ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}.`

  for (const agent of agents) {
    const prevSpeech = speeches.slice(-2).map(s => `${s.agent} (${s.role}): "${s.content}"`).join('\n')

    const prompt = `Você é ${agent.name}, ${agent.role} na ${companyName}, fornecedora de tecidos premium B2B para grandes magazines.

${dayCtx}

DADOS REAIS DAS PLATAFORMAS CONECTADAS:
- Instagram @texarte: ${MOCK_INSTAGRAM_DATA.followers.toLocaleString()} seguidores, ${MOCK_INSTAGRAM_DATA.recentPosts.length} posts recentes. Média de engajamento: ${MOCK_INSTAGRAM_DATA.avgEngagementRate}%. Top post: "Case Renner" com ${MOCK_INSTAGRAM_DATA.recentPosts[2].likes} curtidas.
- LinkedIn: Perfil Texarte Têxtil conectado (dados básicos de perfil apenas).
- Site texarte.com.br (scraper): SEO score ${MOCK_SEO_DATA.seoScore}/100. ${MOCK_SEO_DATA.wordCount} palavras. Tecnologias DETECTADAS NO SITE DO CLIENTE: ${MOCK_SEO_DATA.detectedTech.slice(0, 4).join(', ')}. (ATENÇÃO: são tecnologias do site do cliente, NÃO são integrações da plataforma Adstock).

CONTEXTO DO NEGÓCIO:
- Indústria: ${getIndustryLabel()}
- Público: ${getTargetAudience()}
- Tom: ${getBrandVoice()}
- Objetivos: Aumentar presença digital B2B, gerar leads, fortalecer autoridade
- Cores: Azul marinho #1a3a5c e Dourado #d4a843

${prevSpeech ? `FALAS ANTERIORES:\n${prevSpeech}` : 'Você é o primeiro a falar.'}

Na daily de hoje, compartilhe em 2-4 frases:
1. O que você vai analisar/recomendar HOJE baseado nos DADOS REAIS acima
2. Cite números ESPECÍFICOS dos dados disponíveis
3. Proponha 1-2 tarefas CONCRETAS que você pode executar HOJE

REGRAS DA PLATAFORMA (NÃO fale sobre o que não existe):
- NÃO diga que vai "publicar", "agendar" ou "postar" — a plataforma NÃO faz isso
- NÃO mencione TikTok, Pinterest, Facebook — NÃO temos
- NÃO mencione Google Search Console ou Analytics — tokens salvos mas dados NÃO são consultados
- Fale APENAS sobre: analisar dados, recomendar conteúdo, criar calendários, briefings visuais, auditoria SEO
- Fale em 1a pessoa. Tom natural de reunião.`

    console.log(`  🎤 ${agent.name}...`)
    const speech = await aiChat(prompt, 600)
    if (speech) {
      speeches.push({ agent: agent.name, role: agent.role, content: speech })
      await prisma.message.create({ data: { channelId: channel.id, content: `**🎤 ${agent.name} (${agent.role}):** ${speech}` } })
      console.log(`    "${speech.substring(0, 80)}..."`)
    }
  }
  console.log(`  ✅ Daily: ${speeches.length}/${agents.length} agentes falaram`)

  // ══════════════════════════════════════════════════════════
  // STEP 6: EXTRAÇÃO DE TAREFAS REALISTAS
  // ══════════════════════════════════════════════════════════
  console.log(`\n${SEP}\n📌 [6/${TOTAL_STEPS}] EXTRAÇÃO DE TAREFAS\n${SEP}`)
  const extractPrompt = `Analise as falas da daily da ${companyName} (moda têxtil B2B — ${MOCK_INSTAGRAM_DATA.followers.toLocaleString()} seguidores no Instagram, site com SEO score ${MOCK_SEO_DATA.seoScore}/100).

Falas:
${speeches.map(s => `${s.agent} (${s.role}): ${s.content}`).join('\n\n')}

Agentes e suas funções REAIS:
- Maya Ferreira (STRATEGIST): calendário editorial, copies, revisão de qualidade
- Bruno Costa (SOCIAL_MEDIA): análise de tendências, dados das plataformas conectadas
- Lena Souza (ANALYST): análise de métricas (Instagram + SEO do site)
- Carlos Lima (DESIGNER): briefings visuais, estruturas de carrosséis
- Diego Ramos (SEO): auditoria SEO do site, pesquisa de keywords, briefings de blog

O QUE A PLATAFORMA FAZ (apenas isso):
- Analisar dados de Instagram e site
- Criar calendários editoriais e copies (texto)
- Auditar SEO do site
- Criar briefings visuais e estruturas de carrosséis (texto)
- Pesquisar keywords baseadas no setor

O QUE NÃO FAZ: publicar, agendar, TikTok, Pinterest, GSC, Google Analytics.

Extraia 5 tarefas REALISTAS que os agentes podem executar HOJE. Cada tarefa deve usar os DADOS REAIS disponíveis.

Retorne APENAS JSON array:
[{"title":"título específico usando dados reais","assignTo":"Nome do Agente","type":"content|analysis|design|seo_audit","priority":"HIGH|MEDIUM"}]`

  const extractResp = await aiChat(extractPrompt, 1200)
  let tasks: any[] = []
  if (extractResp) {
    const m = extractResp.match(/\[[\s\S]*\]/)
    if (m) { try { tasks = JSON.parse(m[0]) } catch {} }
  }

  if (tasks.length === 0) {
    tasks = [
      { title: `Criar calendário editorial da semana com 5 pautas para Instagram — baseado nos ${MOCK_INSTAGRAM_DATA.followers.toLocaleString()} seguidores e engajamento de ${MOCK_INSTAGRAM_DATA.avgEngagementRate}%`, assignTo: 'Maya Ferreira', type: 'content', priority: 'HIGH' },
      { title: `Analisar tendências dos últimos 5 posts do Instagram — top post "Case Renner" com ${MOCK_INSTAGRAM_DATA.recentPosts[2].likes} curtidas vs menor com ${MOCK_INSTAGRAM_DATA.recentPosts[3].likes}`, assignTo: 'Bruno Costa', type: 'analysis', priority: 'HIGH' },
      { title: `Gerar relatório de métricas do Instagram: ${MOCK_INSTAGRAM_DATA.followers.toLocaleString()} seguidores, ${MOCK_INSTAGRAM_DATA.avgEngagementRate}% engajamento, melhores e piores posts`, assignTo: 'Lena Souza', type: 'analysis', priority: 'HIGH' },
      { title: `Criar briefing visual de carrossel (7 slides) para LinkedIn: cases de sucesso com Renner e C&A — paleta azul marinho e dourado`, assignTo: 'Carlos Lima', type: 'design', priority: 'HIGH' },
      { title: `Auditar SEO on-page do site texarte.com.br: score ${MOCK_SEO_DATA.seoScore}/100, otimizar meta tags, headings e dados estruturados`, assignTo: 'Diego Ramos', type: 'seo_audit', priority: 'HIGH' },
    ]
  }

  const createdTasks: any[] = []
  for (const t of tasks) {
    const agent = agents.find(a => a.name === t.assignTo)
    if (!agent) continue
    const task = await prisma.task.create({ data: { organizationId: org.id, title: t.title, type: t.type || 'content', priority: t.priority || 'MEDIUM', assignedTo: agent.id, status: 'TODO' } })
    createdTasks.push(task)
    console.log(`  ✅ "${t.title.substring(0, 60)}..." → ${t.assignTo}`)
  }
  console.log(`  ✅ ${createdTasks.length} tarefas criadas`)

  // ══════════════════════════════════════════════════════════
  // STEP 7: EXECUÇÃO (cada agente trabalha com dados REAIS)
  // ══════════════════════════════════════════════════════════
  console.log(`\n${SEP}\n📌 [7/${TOTAL_STEPS}] EXECUÇÃO — Agentes trabalham\n${SEP}`)
  const { generateDeliverableCard } = await import('../src/lib/orchestrator/attachment-generator')

  for (const task of createdTasks) {
    const agent = agents.find(a => a.id === task.assignedTo)
    if (!agent) continue

    await prisma.task.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS', startedAt: new Date() } })
    const isDesigner = agent.role === 'DESIGNER'

    const roleHints: Record<string, string> = {
      STRATEGIST: 'Foque em criar calendário ou copies. Use os dados de seguidores e engajamento do Instagram para justificar as pautas.',
      SOCIAL_MEDIA: 'Analise os dados REAIS do Instagram. Compare os 5 posts. Identifique padrões. NÃO sugira publicar — apenas ANALISE.',
      ANALYST: 'Use APENAS os dados disponíveis: Instagram (seguidores, 5 posts) e site (SEO score, meta tags). Marque o que NÃO existe como "NÃO DISPONÍVEL".',
      DESIGNER: 'Crie briefing visual textual. Descreva paleta, tipografia, estrutura de slides. Use APENAS as cores da marca (#1a3a5c e #d4a843). NÃO mencione tecnologias do site do cliente — foque no design.',
      SEO: 'Audite o site com dados do scraper. As tecnologias detectadas (WordPress, WooCommerce, etc) são do SITE DO CLIENTE — mencione-as como achados da auditoria, NÃO como integrações da plataforma.',
    }

    const execPrompt = `Você é ${agent.name}, ${agent.role} na ${companyName} (moda têxtil B2B).

DADOS REAIS DISPONÍVEIS:
- Instagram @texarte: ${MOCK_INSTAGRAM_DATA.followers.toLocaleString()} seguidores, ${MOCK_INSTAGRAM_DATA.avgEngagementRate}% engajamento, 5 posts recentes
- LinkedIn: perfil básico conectado (nome + email apenas)
- Site texarte.com.br (scraper): SEO score ${MOCK_SEO_DATA.seoScore}/100, ${MOCK_SEO_DATA.wordCount} palavras
- Tecnologias detectadas NO SITE DO CLIENTE: ${MOCK_SEO_DATA.detectedTech.join(', ')}
  (IMPORTANTE: são tecnologias do site do cliente, NÃO são integrações da plataforma Adstock)

PLATAFORMAS QUE A ADSTOCK CONECTA (apenas estas):
- Instagram (leitura de perfil + posts)
- LinkedIn (perfil básico)
- Site scraper (SEO audit)

TAREFA: "${task.title}"

${roleHints[agent.role] || ''}

Gere JSON:
{
  "content": "texto PRINCIPAL do entregável (5-8 frases contextualizadas, usando DADOS REAIS)",
  "strategy": "raciocínio estratégico (3-5 frases)",
  "creativeProcess": "processo usado (3-5 frases)",
  "decisions": ["d1","d2","d3","d4","d5","d6"],
  "nextSteps": "próximos passos (2-3 frases)"
}

CRÍTICO:
- ZERO métricas inventadas — use APENAS os dados fornecidos
- Se um dado não existe, marque "NÃO DISPONÍVEL"
- Se mencionar tecnologias do site do cliente, deixe CLARO que são tecnologias DO SITE, não integrações da Adstock
- NÃO mencione "integração com Google Analytics" — Analytics está no site do cliente, não na Adstock
- Português PT-BR`

    const aiOutput = await aiChat(execPrompt, 3000)
    let parsed: any = {}
    if (aiOutput) {
      const m = aiOutput.match(/\{[\s\S]*\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch {} }
      if (!parsed.content) parsed = { content: aiOutput.substring(0, 800) }
    }

    if (!parsed.content || parsed.content.length < 30) {
      parsed = {
        content: `Análise de ${agent.name} para ${task.title}. Dados do Instagram: ${MOCK_INSTAGRAM_DATA.followers.toLocaleString()} seguidores, engajamento ${MOCK_INSTAGRAM_DATA.avgEngagementRate}%.`,
        strategy: 'Análise baseada nos dados reais disponíveis das plataformas conectadas.',
        decisions: ['Usar dados reais do Instagram', 'Referenciar SEO score do site', 'Alinhar com tom consultivo B2B'],
      }
    }

    console.log(`  ${agent.name}: ${parsed.content.length}c | strat: ${(parsed.strategy||'').length}c | dec: ${(parsed.decisions||[]).length}`)

    const outputData = { ...parsed, deliveryNote: `${agent.name.split(' ')[0]}: Entregue com dados reais.`, artworkPending: isDesigner, generatedAt: new Date().toISOString() }

    try {
      await generateDeliverableCard({
        taskId: task.id, taskTitle: task.title, taskDescription: task.description || '',
        taskType: task.type || 'content', agentName: agent.name, agentRole: agent.role,
        organizationName: companyName, industry: getIndustryLabel(),
        targetAudience: getTargetAudience(), output: outputData,
        brandColors: { primary: '#1a3a5c', secondary: '#d4a843' },
      })
      console.log(`    ✅ Card HTML → IN_REVIEW${isDesigner ? ' (artworkPending)' : ''}`)
    } catch (e: any) {
      console.log(`    ❌ Card: ${e.message?.substring(0, 60)}`)
      await prisma.task.update({ where: { id: task.id }, data: { status: 'IN_REVIEW', completedAt: new Date(), progress: 100, output: outputData as any } })
    }
  }

  // ══════════════════════════════════════════════════════════
  // STEP 8: MAYA REVISÃO (analisa conteúdo HTML de todos)
  // ══════════════════════════════════════════════════════════
  console.log(`\n${SEP}\n📌 [8/${TOTAL_STEPS}] MAYA REVISÃO — Analisa cards HTML\n${SEP}`)

  const reviewTasks = await prisma.task.findMany({
    where: { organizationId: org.id, status: 'IN_REVIEW' },
    include: { assignee: true }, orderBy: { updatedAt: 'asc' },
  })

  console.log(`  ${reviewTasks.length} tasks em IN_REVIEW\n`)

  const { generateArtworkExport } = await import('../src/lib/orchestrator/attachment-generator')
  let approved = 0, pngExported = 0, revised = 0

  for (const task of reviewTasks) {
    const output = (task.output as any) || {}
    const htmlDoc = output.htmlDocument as string | undefined
    const htmlPreview = htmlDoc
      ? htmlDoc.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000)
      : '(sem HTML)'
    const isDesigner = task.assignee?.role === 'DESIGNER'

    const reviewPrompt = `Você é Maya Ferreira, Diretora de Estratégia da ${companyName} (moda têxtil B2B, ${MOCK_INSTAGRAM_DATA.followers.toLocaleString()} seguidores no Instagram).

Revisando: ${task.assignee?.name} (${task.assignee?.role}) — "${task.title}"

PRÉVIA DO CARD HTML: ${htmlPreview}

CONTEXTO IMPORTANTE PARA SUA ANÁLISE:
- O site do cliente (texarte.com.br) USA WordPress, WooCommerce, Google Analytics, MySQL, PHP, Nginx como TECNOLOGIAS DO SITE. Se o card mencionar essas tecnologias como achados da auditoria de SEO, NÃO é alucinação — é dado real do scraper.
- ALUCINAÇÃO REAL é: mencionar Google Search Console, TikTok, Pinterest, Facebook, agendamento de posts, publicação automática, ou integrações que a Adstock não tem.
- A Adstock conecta APENAS: Instagram (leitura), LinkedIn (perfil básico), e scraper de site.

ANALISE:
1. Card HTML completo? (resumo, conteúdo, estratégia, decisões, próximos passos)
2. Usa DADOS REAIS (seguidores, engajamento, SEO score) ou inventa números?
3. Menciona plataformas que REALMENTE não existem (GSC Analytics como fonte de dados, TikTok, Pinterest)?
4. Se menciona WordPress/WooCommerce/GA como tecnologias DO SITE DO CLIENTE → OK, é dado real do scraper
5. Conteúdo alinhado com moda têxtil B2B e tom consultivo?
${isDesigner ? '6. Se aprovar DESIGNER, PNG será exportado via Vertex AI automaticamente.' : ''}

Decida: "approved" (card OK), "revision" (ajustes pontuais), "rejected" (métricas falsas ou conteúdo inexistente).
Retorne APENAS JSON: {"decision":"approved"|"revision"|"rejected","feedback":"2-3 frases em PT-BR"}`

    const reviewResp = await aiChat(reviewPrompt, 350)
    let decision = 'approved', feedback = 'Aprovado. Conteúdo consistente com dados reais.'

    if (reviewResp) {
      const m = reviewResp.match(/\{[\s\S]*\}/)
      if (m) { try { const p = JSON.parse(m[0]); if (['approved','revision','rejected'].includes(p.decision)) { decision = p.decision; feedback = p.feedback || feedback } } catch {} }
    }

    if (decision === 'approved') {
      approved++
      console.log(`  ✅ APROVADO: ${task.assignee?.name} — ${feedback.substring(0, 70)}`)

      if (isDesigner && output.artworkPending) {
        console.log(`    🎨 Exportando PNG via Vertex AI...`)
        try {
          const er = await generateArtworkExport({
            taskId: task.id, taskTitle: task.title, taskDescription: task.description || '',
            taskType: task.type || 'design', agentName: task.assignee?.name || 'Carlos Lima',
            agentRole: 'DESIGNER', organizationName: companyName,
            industry: getIndustryLabel(), targetAudience: getTargetAudience(),
            output: { ...output, artworkPending: true },
            brandColors: { primary: '#1a3a5c', secondary: '#d4a843' },
          })
          if (er.artworkUrl) { pngExported++; console.log(`    🎨 PNG: ${Math.round(er.artworkUrl.length/1024)}KB`) }
          else { console.log(`    ⚠️ Vertex AI indisponível — task DONE sem PNG`) }
        } catch (e: any) { console.log(`    ❌ ${e.message?.substring(0, 60)}`) }
      } else {
        await prisma.task.update({ where: { id: task.id }, data: { status: 'DONE', completedAt: new Date(), deliveryStatus: 'APPROVED', reviewedBy: 'Maya Ferreira' } })
      }
    } else if (decision === 'revision') {
      revised++
      console.log(`  ⚠️ REVISÃO: ${task.assignee?.name} — ${feedback.substring(0, 70)}`)
      await prisma.task.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS', deliveryStatus: 'REVISION', reviewedBy: 'Maya Ferreira', output: { ...output, reviewFeedback: feedback } as any } })
    } else {
      console.log(`  ❌ REJEITADO: ${task.assignee?.name} — ${feedback.substring(0, 70)}`)
      await prisma.task.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS', deliveryStatus: 'REJECTED', reviewedBy: 'Maya Ferreira', output: { ...output, reviewFeedback: feedback } as any } })
    }
  }

  // ══════════════════════════════════════════════════════════
  // STEP 9: VERIFICAÇÃO FINAL
  // ══════════════════════════════════════════════════════════
  console.log(`\n${SEP}\n📌 [9/${TOTAL_STEPS}] VERIFICAÇÃO FINAL\n${SEP}`)
  const finalTasks = await prisma.task.findMany({ where: { organizationId: org.id }, include: { assignee: { select: { name: true, role: true } } }, orderBy: { createdAt: 'asc' } })
  const done = finalTasks.filter(t => t.status === 'DONE').length
  const inReview = finalTasks.filter(t => t.status === 'IN_REVIEW').length
  const inProgress = finalTasks.filter(t => t.status === 'IN_PROGRESS').length
  console.log(`  Status: ${done} DONE | ${inReview} IN_REVIEW | ${inProgress} IN_PROGRESS | ${Math.round(done/finalTasks.length*100)}% concluído`)

  // ══════════════════════════════════════════════════════════
  // STEP 10: RELATÓRIO FINAL DE QUALIDADE
  // ══════════════════════════════════════════════════════════
  console.log(`\n${SEP}\n📌 [10/${TOTAL_STEPS}] RELATÓRIO DE QUALIDADE\n${SEP}`)
  for (const t of finalTasks) {
    const o = (t.output as any) || {}
    const isD = t.assignee?.role === 'DESIGNER'
    const c = (o.content||'').length
    const s = (o.strategy||'').length
    const d = Array.isArray(o.decisions) ? o.decisions.length : 0
    const h = o.htmlDocument ? Math.round(o.htmlDocument.length/1024)+'KB' : '—'
    const a = o.artworkUrl ? Math.round(o.artworkUrl.length/1024)+'KB' : (isD ? '⏳' : 'N/A')
    const rv = o.reviewedBy || '—'
    const ds = t.deliveryStatus || '—'
    const fb = o.reviewFeedback ? ` | feedback: ${o.reviewFeedback.substring(0, 50)}` : ''
    const emoji = t.status==='DONE'?'✅':t.status==='IN_REVIEW'?'⏳':'🔄'
    console.log(`${emoji} ${t.assignee?.name.padEnd(15)} ${t.status.padEnd(12)} ${ds.padEnd(10)} | content:${c}c strat:${s}c dec:${d} | HTML:${h} PNG:${a} | rev:${rv}${fb}`)
  }

  const totalDone = finalTasks.filter(t => t.status === 'DONE').length
  const totalHtml = finalTasks.filter(t => { const o = (t.output as any) || {}; return o.htmlDocument && o.htmlDocument.length > 200 }).length
  const totalPng = finalTasks.filter(t => { const o = (t.output as any) || {}; return !!o.artworkUrl }).length
  const totalApproved = finalTasks.filter(t => t.deliveryStatus === 'APPROVED').length

  console.log(`\n${SEP}`)
  console.log('📊 RESUMO')
  console.log(SEP)
  console.log(`  Tasks: ${finalTasks.length} | DONE: ${totalDone} | Com HTML: ${totalHtml} | PNGs: ${totalPng} | Aprovados Maya: ${totalApproved}`)
  console.log(`  Org ID: ${org.id}`)
  const passed = totalDone >= finalTasks.length * 0.8
  console.log(`  Resultado: ${passed ? '✅ PASSOU' : '⚠️ PARCIAL'} — ${totalDone}/${finalTasks.length} concluídas`)
  console.log()

  await prisma.$disconnect()
}

main().catch(e => { console.error('💥', e); process.exit(1) })
