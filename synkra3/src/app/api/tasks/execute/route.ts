import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { chatCompletion } from "@/lib/ai/client"
import { getAgentExecutionPrompt } from "@/lib/agents/templates/loader"
import { buildTaskPrompt, validateTaskOutput } from "@/lib/autonomous/execution"
import { buildCompanyContext } from "@/lib/autonomous/context"
import { analyzeApprovalPatterns } from "@/lib/autonomous/learning"

export const maxDuration = 90

export async function POST(request: NextRequest) {
  try {
    const { organizationId, taskId, agentId, taskType, description } = await request.json()
    if (!organizationId) return NextResponse.json({ error: "organizationId required" }, { status: 400 })

    // Load the task + agent
    const [task, ctx] = await Promise.all([
      taskId ? prisma.task.findUnique({ where: { id: taskId }, include: { assignee: true } }) : null,
      buildCompanyContext(organizationId),
    ])
    const agent = agentId
      ? await prisma.agent.findUnique({ where: { id: agentId } })
      : task?.assignee || null

    if (!agent) return NextResponse.json({ error: "No agent found" }, { status: 404 })

    const taskTitle = task?.title || description || "Tarefa generica"
    const taskDesc = task?.description || description || ""
    const taskTypeName = taskType || (task as any)?.type || "generic"

    // Build approval history
    const patterns = await analyzeApprovalPatterns(organizationId)
    const approvalCtx = {
      approved: [],
      rejected: patterns.commonRejects?.filter(Boolean) as string[] || [],
      approvalRate: patterns.approvalRate,
    }

    const taskCtx = {
      companyId: organizationId,
      company: {
        name: (await prisma.organization.findUnique({ where: { id: organizationId } }))?.name || "Agencia",
        industry: ctx.industry,
        brandVoice: (await prisma.onboarding.findUnique({ where: { organizationId } }))?.brandVoice || undefined,
        audience: ctx.targetAudience,
        goals: ctx.goals,
      },
      approvalHistory: approvalCtx,
      calendar: {
        dayName: ctx.dayName,
        today: ctx.today,
        upcomingDates: ctx.upcomingDates.map(d => `${d.name} (${d.daysUntil}d)`).join(", "),
      },
    }

    // Build the prompt
    const prompt = buildTaskPrompt(taskTypeName, taskTitle, taskCtx)

    // Load agent template and execute
    const fullPrompt = getAgentExecutionPrompt(
      agent.name,
      taskTitle,
      taskDesc,
      prompt,
    )

    const rawOutput = await chatCompletion(fullPrompt, {
      temperature: taskTypeName === "analyze_metrics" ? 0.3 : 0.8,
      maxTokens: taskTypeName === "create_blog_post" ? 3000 : 1500,
    })

    // Validate output
    let output: any
    try {
      output = validateTaskOutput(taskTypeName, rawOutput)
    } catch (valErr) {
      // If validation fails, return raw output as-is
      output = { raw: rawOutput, format: "text", validationError: String(valErr) }
    }

    // Update task with output
    if (task?.id) {
      await prisma.task.update({
        where: { id: task.id },
        data: { output: output as any, status: "IN_REVIEW" },
      } as any)
    }

    // Post to chat
    const channel = await prisma.channel.findFirst({
      where: { organizationId, name: "aprovacoes" },
    })
    if (!channel) {
      await prisma.channel.create({
        data: { organizationId, name: "aprovacoes", description: "Conteudo para aprovacao" },
      })
    }
    const approvalChannel = await prisma.channel.findFirst({
      where: { organizationId, name: "aprovacoes" },
    })

    if (approvalChannel) {
      const variants = output?.variants
        ? output.variants.map((v: any) => `**${v.name}**\n${v.copy}`).join("\n\n---\n\n")
        : JSON.stringify(output).slice(0, 500)

      await prisma.message.create({
        data: {
          content: `${agent.name} completou: **${taskTitle}**\n\n${variants}`,
          metadata: {
            type: "task_completed",
            taskId: task?.id,
            taskType: taskTypeName,
            needsApproval: true,
            output: JSON.stringify(output).slice(0, 1000),
          },
          agentId: agent.id,
          channelId: approvalChannel.id,
        },
      } as any)
    }

    return NextResponse.json({
      success: true,
      agent: agent.name,
      task: taskTitle,
      output,
      message: `${agent.name} completou a tarefa. Resultado postado em #aprovacoes.`,
    })
  } catch (error) {
    console.error("[TaskExecute Error]", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
