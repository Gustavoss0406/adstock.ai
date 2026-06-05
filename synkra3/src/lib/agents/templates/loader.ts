import fs from "fs"
import path from "path"

const TEMPLATES_DIR = path.join(process.cwd(), "src/lib/agents/templates")

const DELIVERY_ENFORCEMENT = `
# REGRAS OBRIGATORIAS DE COMUNICACAO

## CANAIS DE COMUNICACAO
Escolha o canal CORRETO para cada mensagem:

- #aprovações → Arte pronta, copy finalizada, conteudo aguardando aprovacao do CEO
- #alertas → Tarefa bloqueada, API fora do ar, metrica caiu, problemas criticos
- #daily-standup → Daily automatica, plano do dia, prioridades
- #estrategia → Planejamento semanal, calendario editorial, mudancas de estrategia
- #criativo → Design, artes, copy, briefings criativos
- #instagram → Posts do Instagram, trends, engajamento da plataforma
- #blog-seo → SEO, blog posts, palavras-chave, otimizacao
- #metricas → Relatorios, analises de performance, metricas
- #resultados → Conquistas, marcos alcancados, celebracoes
- #geral → APENAS o que nao se encaixa em nenhum canal acima

REGRA DE OURO: Nao coloque TUDO no #geral. Se tem canal especifico, USE ele.

## ECONOMIA DE TOKENS
Voce esta em um sistema com economia de tokens. Siga estas regras:

### PODE FALAR quando:
- COMPLETAR uma tarefa
- Ficar BLOQUEADO em uma tarefa
- Detectar CONFLITO com outro agente
- Precisar de APROVACAO do CEO
- Alertar PROBLEMA CRITICO (queda de metricas, erro tecnico)
- Responder MENC AO DIRETA (@seu_nome)

### NAO PODE FALAR (PROIBIDO):
- "Estou trabalhando em X" — ninguem precisa saber em tempo real
- "Ok", "Legal", "Valeu", "Boa", "Perfeito" — confirmacoes vazias
- "Boa sorte!", "Bora time!" — motivacao vazia
- "Qualquer coisa me chama" — obvio, desnecessario
- "Vou comecar agora" — atualize o Kanban, nao o chat
- Emojis soltos sem contexto acionavel
- Perguntas retoricas ou sociais

### REGRA DE OURO
Se nao tem nada ACIONAVEL pra dizer (algo que outra pessoa precise FAZER, APROVAR ou SABER urgentemente), NAO DIGA NADA. Trabalhe em silencio. Atualize o Kanban. Poste so o resultado.

### LIMITES
- Maximo 2 mensagens suas por conversa/thread
- Se estiver em duvida se deve falar: NAO FALE
- Em reunioes (daily), pode falar livremente

# REGRAS ABSOLUTAS DE ENTREGA

1. TODO output deve incluir "delivery_status": "completed" e "needs_ceo_approval": true
2. TODO JSON deve ter "quality_check": {"complete": true, "actionable": true, "uses_context": true}
3. Meta descriptions SEMPRE <= 160 caracteres
4. Toda entrega deve ter "next_actions" (array com proximos passos concretos)
5. Atribua tarefas a outros agentes (Carlos, Bruno, Lena, Diego) sempre que relevante
6. NUNCA diga "vou fazer", "posso fazer", "minha sugestao e". ENTREGUE o resultado final
7. Todo artefato (copy, HTML, relatorio, calendario) deve ser completo e utilizavel imediatamente
8. Use o contexto da empresa (cores, tom, metricas) em TODA entrega
9. Se receber dados numericos, calcule e use os valores (ex: queda %, crescimento)
10. Inclua SEMPRE "artifacts" como array com os entregaveis concretos produzidos`


const AGENT_TEMPLATE_MAP: Record<string, string> = {
  "Maya Ferreira": "maya-ferreira.md",
  "Bruno Costa": "bruno-costa.md",
  "Lena Souza": "lena-souza.md",
  "Carlos Lima": "carlos-lima.md",
  "Diego Ramos": "diego-ramos.md",
}

// Cache templates in memory after first read
const templateCache: Record<string, string> = {}

export function loadAgentTemplate(agentName: string): string {
  if (templateCache[agentName]) return templateCache[agentName]

  const filename = AGENT_TEMPLATE_MAP[agentName]
  if (!filename) return ""

  try {
    const filepath = path.join(TEMPLATES_DIR, filename)
    const content = fs.readFileSync(filepath, "utf-8")
    templateCache[agentName] = content
    return content
  } catch {
    return ""
  }
}

/**
 * Build a specialized prompt for an agent based on their template.
 * Truncates to ~1500 chars of the most relevant sections.
 */
export function buildSpecializedPrompt(agentName: string, taskType: string, context: string): string {
  const template = loadAgentTemplate(agentName)
  if (!template) return context

  // Extract relevant sections based on task type
  const sections = extractRelevantSections(template, taskType)

  return `${sections}

CONTEXTO ATUAL:
${context}

${DELIVERY_ENFORCEMENT}`
}

function extractRelevantSections(template: string, taskType: string): string {
  // Always include identity + personality (first ~400 chars)
  const lines = template.split("\n")
  const headerEnd = lines.findIndex(l => l.startsWith("## Sua Função") || l.startsWith("## O Que Você"))
  const personalidadeEnd = lines.findIndex((l, i) => i > 20 && l.startsWith("# ESPECIALIZAÇÃO"))

  let result = lines.slice(0, headerEnd >= 0 ? headerEnd + 20 : 60).join("\n") + "\n\n"

  // Find task-specific sections
  const taskKey = taskType.includes("copy") ? "COMO ESCREVER COPIES" :
    taskType.includes("calendar") ? "COMO CRIAR CALEND" :
    taskType.includes("design") || taskType.includes("art") ? "COMO CRIAR CARROSS" :
    taskType.includes("metric") || taskType.includes("analysis") ? "COMO ANALISAR" :
    taskType.includes("schedule") || taskType.includes("trend") ? "COMO AGENDAR" :
    taskType.includes("seo") || taskType.includes("keyword") ? "COMO FAZER PESQUISA" :
    taskType.includes("blog") ? "COMO CRIAR BLOG" :
    "FORMATO DE SAÍDA"

  // Find the section
  let sectionStart = -1
  let sectionEnd = -1

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(taskKey)) {
      sectionStart = i
      // Find next ## or # section header after this one
      for (let j = i + 1; j < lines.length; j++) {
        if (/^#{1,3}\s/.test(lines[j]) && !lines[j].startsWith("###") && j - i > 5) {
          sectionEnd = j
          break
        }
      }
      break
    }
  }

  if (sectionStart >= 0) {
    const sectionLines = lines.slice(sectionStart, sectionEnd >= 0 ? sectionEnd : sectionStart + 50)
    result += sectionLines.join("\n") + "\n\n"
  }

  // Always include rules at the end
  const rulesStart = lines.findIndex(l => l.includes("# REGRAS IMPORTANTES"))
  if (rulesStart >= 0) {
    result += lines.slice(rulesStart, rulesStart + 20).join("\n")
  }

  return result
}

/**
 * Get the full agent prompt for execution — identity + specialization + task instructions.
 */
export function getAgentExecutionPrompt(
  agentName: string,
  taskTitle: string,
  taskDescription: string,
  companyContext: string,
): string {
  const template = loadAgentTemplate(agentName)
  if (!template) {
    return `Voce e ${agentName}. Tarefa: ${taskTitle}. ${taskDescription}. Contexto: ${companyContext}. Execute a tarefa e produza o resultado no formato JSON apropriado.`
  }

  // Parse template to extract identity + how to execute
  const nameSection = template.match(/\*\*Nome:\*\* (.+)/)?.[1] || agentName
  const roleSection = template.match(/\*\*Cargo:\*\* (.+)/)?.[1] || ""

  return `${template.slice(0, 600)}

TAREFA ATUAL: ${taskTitle}
DESCRICAO: ${taskDescription || "Detalhes nao fornecidos."}

CONTEXTO DA EMPRESA:
${companyContext}

Execute a tarefa seguindo sua especializacao e formato de saida definidos acima.
Retorne o resultado em JSON quando aplicavel, ou em texto natural.
Mantenha seu tom de voz e estilo de comunicacao.
Use apenas emojis moderadamente conforme sua personalidade.

${DELIVERY_ENFORCEMENT}`
}
