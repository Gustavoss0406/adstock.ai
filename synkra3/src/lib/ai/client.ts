import { AGENT_WORKER_URL, DEFAULT_MODEL, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS } from "./config"

export interface OpenAIMessage { role: "system" | "user" | "assistant"; content: string }
export type ChatOptions = { temperature?: number; maxTokens?: number; model?: string; onProgress?: (phrase: string) => void }
export type AgentPersona = { name: string; role: string; personality?: string; prompt: string }
export type ConversationTurn = { agent: string; message: string }

interface AIResponse { reply: string | null; usage?: { total_tokens: number } }

export async function chatWithMessages(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, options?: ChatOptions): Promise<string> {
  try {
    const response = await fetch(AGENT_WORKER_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, temperature: options?.temperature ?? DEFAULT_TEMPERATURE, maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS }),
    })
    if (!response.ok) {
      const errBody = await response.text().catch(() => "")
      throw new Error(`Worker ${response.status}: ${errBody.slice(0, 300)}`)
    }
    const data: AIResponse = await response.json()
    return data.reply || "Nao consegui processar."
  } catch (error) { throw error }
}

export async function chatCompletion(message: string, options?: ChatOptions): Promise<string> {
  try {
    const response = await fetch(AGENT_WORKER_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, temperature: options?.temperature ?? DEFAULT_TEMPERATURE, maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS }),
    })
    if (!response.ok) {
      const errBody = await response.text().catch(() => "")
      const detail = errBody.slice(0, 300)
      console.error(`[AI] Worker returned ${response.status}: ${detail}`)
      throw new Error(`Worker ${response.status}: ${detail || "no details"}`)
    }
    const data: AIResponse = await response.json()
    return data.reply || "Nao consegui processar."
  } catch (error) { throw error }
}

export async function chatWithSystem(systemPrompt: string, userMessage: string, options?: ChatOptions): Promise<string> {
  const msg = `[SYSTEM]\n${systemPrompt}\n\n[USER]\n${userMessage}`
  return chatCompletion(msg, options)
}

export async function conversationCompletion(messages: OpenAIMessage[], options?: ChatOptions): Promise<string> {
  const systemMsgs = messages.filter(m => m.role === "system")
  const userMsgs = messages.filter(m => m.role === "user")
  const assistantMsgs = messages.filter(m => m.role === "assistant")

  // Build a single message string with [SYSTEM] and [USER] markers
  // The worker splits on these markers to create proper system/user roles
  let flat = ""

  if (systemMsgs.length > 0) {
    flat += "[SYSTEM]\n" + systemMsgs.map(m => m.content).join("\n\n") + "\n\n"
  }

  // Include recent conversation as context inside the user message
  const recentHistory = [...assistantMsgs.slice(-3), ...userMsgs.slice(-2)]
  const contextParts: string[] = []
  for (const m of recentHistory) {
    contextParts.push(m.role === "assistant" ? `[Voce respondeu antes]: ${m.content.slice(0, 200)}` : `[Usuario perguntou]: ${m.content.slice(0, 200)}`)
  }

  const lastUserMsg = userMsgs[userMsgs.length - 1]?.content || ""
  const userContent = contextParts.length > 0
    ? `HISTORICO RECENTE:\n${contextParts.join("\n")}\n\nMENSAGEM ATUAL DO USUARIO:\n${lastUserMsg}`
    : lastUserMsg

  flat += `[USER]\n${userContent}`

  return chatCompletion(flat.trim(), options)
}

export async function generateAgentResponse(agent: AgentPersona, context: string, userMessage: string, options?: ChatOptions): Promise<string> {
  const system = `${agent.prompt}\n\nContexto: ${context}`
  return chatWithSystem(system, userMessage, options)
}

export async function multiAgentConversation(agents: AgentPersona[], topic: string, context?: string): Promise<ConversationTurn[]> {
  const turns: ConversationTurn[] = []
  let history = `Contexto: ${context || ""}\nTopico: ${topic}\n\n`
  for (const agent of agents) {
    const prompt = `${history}\nVoce e ${agent.name}, ${agent.role}.\n${agent.prompt}\n\nCom base na conversa acima, qual sua contribuicao?`
    try {
      const reply = await chatCompletion(prompt, { temperature: 0.8 })
      turns.push({ agent: agent.name, message: reply })
      history += `\n${agent.name}: ${reply}\n`
    } catch {
      turns.push({ agent: agent.name, message: "Estou processando..." })
    }
  }
  return turns
}
