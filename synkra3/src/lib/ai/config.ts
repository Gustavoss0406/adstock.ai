export const AGENT_WORKER_URL = "https://plain-hill-073a.gustavoss0406.workers.dev/"

export const DEFAULT_MODEL = "deepseek-v4-pro"
export const DEFAULT_TEMPERATURE = 0.7
export const DEFAULT_MAX_TOKENS = 2000

// Pixel Office — hosted on Render (or localhost for dev)
// Change to your Render URL after deploy, e.g.: https://pixel-office.onrender.com
export const PIXEL_OFFICE_URL = process.env.NEXT_PUBLIC_PIXEL_OFFICE_URL || "http://localhost:3100"

export const RATE_LIMIT = {
  maxRequestsPerMinute: 30,
  maxTokensPerRequest: 8192,
}

export const AGENT_THINKING_PHRASES = [
  "Analisando o contexto...",
  "Buscando referências...",
  "Processando informações...",
  "Consultando base de conhecimento...",
  "Estruturando pensamentos...",
  "Avaliando opções estratégicas...",
  "Calculando métricas relevantes...",
  "Gerando insights criativos...",
  "Validando dados de mercado...",
  "Otimizando a abordagem...",
  "Revisando guidelines da marca...",
  "Comparando com benchmarks...",
  "Simulando cenários possíveis...",
  "Refinando a mensagem...",
  "Preparando a entrega...",
]

export function getRandomThinkingPhrase(): string {
  return AGENT_THINKING_PHRASES[Math.floor(Math.random() * AGENT_THINKING_PHRASES.length)]
}
