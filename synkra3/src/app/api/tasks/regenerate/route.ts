import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"

export async function POST(request: NextRequest) {
  try {
    const { taskId, orgId } = await request.json()
    if (!taskId && !orgId) {
      return NextResponse.json({ error: "taskId or orgId required" }, { status: 400 })
    }

    const tasks = taskId
      ? [await prisma.task.findUnique({ where: { id: taskId } })].filter(Boolean)
      : await prisma.task.findMany({
          where: {
            organizationId: orgId,
            status: "DONE",
          },
        })

    let count = 0
    for (const task of tasks) {
      if (!task) continue
      const existingOutput = task.output as any
      if (existingOutput?.content && existingOutput.content !== task.description && existingOutput.content !== task.title) {
        continue // already has real content
      }

      const agent = task.assignedTo
        ? await prisma.agent.findUnique({ where: { id: task.assignedTo } })
        : null

      const prompt = `Voce e ${agent?.name || "um agente"} (${agent?.role || "marketing"}) em uma agencia de marketing digital.
Acabou de concluir uma tarefa e precisa registrar o entregavel produzido.

TITULO DA TAREFA: ${task.title}
DESCRICAO: ${task.description || "N/A"}
TIPO: ${task.type || "content"}

Gere o conteudo do entregavel que voce produziu para esta tarefa.
Seja especifico, realista e profissional. Escreva em portugues.
Nao se apresente — va direto ao conteudo produzido.

Retorne APENAS um JSON object com:
- "content": o texto completo do entregavel (minimo 3 frases especificas)
- "title": um titulo opcional para o entregavel`

      const reply = await chatCompletion(prompt, { temperature: 0.7, maxTokens: 2000 })

      let content = reply
      let title: string | undefined
      try {
        const jsonMatch = reply.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.content) {
            content = parsed.content
            title = parsed.title
          }
        }
      } catch {}

      const outputData: any = { content }
      if (title) outputData.title = title
      if (task.type === "content" || task.type === "campaign") {
        outputData.deliverableImage = null
        outputData.imageDescription = "Imagem do entregavel gerada pelo agente."
      }

      await prisma.task.update({
        where: { id: task.id },
        data: { output: outputData as any },
      })
      count++
    }

    return NextResponse.json({ success: true, regenerated: count })
  } catch (error) {
    console.error("[Regenerate Error]", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
