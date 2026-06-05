import { prisma } from "@/lib/prisma"
import { buildCompanyContext } from "./context"
import { chatCompletion } from "@/lib/ai/client"

export async function maintainBacklog(organizationId: string): Promise<{ created: number; ideas: string[] }> {
  // Hard cap: never exceed 15 total non-DONE tasks
  const activeCount = await prisma.task.count({
    where: { organizationId, status: { not: "DONE" } },
  })
  if (activeCount >= 15) return { created: 0, ideas: [] }

  const ctx = await buildCompanyContext(organizationId)
  const ideas: string[] = []
  let created = 0

  // Only run if backlog is low
  const minBacklog = 5
  if (ctx.backlogSize >= minBacklog) return { created, ideas }

  const needed = minBacklog - ctx.backlogSize

  const prompt = `Voce e Maya, diretora de conteudo. O backlog da agencia ${ctx.industry || "marketing"} tem apenas ${ctx.backlogSize} tarefas. Precisamos de ${needed} novas ideias.

Contexto:
- Setor: ${ctx.industry || "marketing digital"}
- Desafio principal: ${ctx.mainChallenge || "crescimento"}
- Objetivos: ${(ctx.goals || ["engajamento"]).join(", ")}
- Plataformas conectadas: ${ctx.connectedPlatforms.join(", ") || "nenhuma"}

Gere ${needed} ideias de tarefas acionaveis. Cada ideia deve ter titulo com 20-80 caracteres.

Retorne APENAS o array JSON de strings: ["ideia 1", "ideia 2", ...]`

  try {
    const reply = await chatCompletion(prompt, {
      temperature: 0.8,
      maxTokens: 500,
    })

    const jsonMatch = reply.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed)) {
        for (const title of parsed.slice(0, needed)) {
          const cleanTitle = (typeof title === "string" ? title : String(title || "")).trim()
          if (cleanTitle.length < 15 || cleanTitle.length > 100) continue
          if (/nao consegui|dificuldades tecnicas/i.test(cleanTitle)) continue

          const exists = await prisma.task.findFirst({
            where: { organizationId, title: cleanTitle, createdAt: { gte: new Date(Date.now() - 86400000 * 7) } },
          })
          if (exists) continue

          await prisma.task.create({
            data: {
              organizationId,
              title: cleanTitle,
              type: "content",
              priority: "LOW",
              status: "TODO",
              estimatedMinutes: 60,
              description: "Ideia gerada automaticamente pela Maya para o backlog.",
            },
          } as any)
          ideas.push(cleanTitle)
          created++
        }
      }
    }
  } catch {}

  return { created, ideas }
}
