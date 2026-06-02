import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/daily/skip
 * Body: { organizationId, reason? }
 *
 * Pula a daily de hoje, marcando lastDailyAt para evitar re-trigger.
 * Útil quando o usuário quer pausar por viagem, feriado, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, reason = "Pausada pelo usuario" } = await request.json()
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId required" }, { status: 400 })
    }

    const settings = await prisma.officeSettings.findUnique({
      where: { organizationId },
    })

    if (!settings) {
      return NextResponse.json({ error: "Settings not found" }, { status: 404 })
    }

    // Mark as "already ran today" to prevent cron from triggering
    await prisma.officeSettings.update({
      where: { organizationId },
      data: { lastDailyAt: new Date() },
    })

    // Create agency event for tracking
    await prisma.agencyEvent.create({
      data: {
        organizationId,
        type: "daily_skipped",
        title: "Daily pulada",
        description: reason,
        metadata: { skippedAt: new Date().toISOString(), reason },
      },
    } as any)

    // Post skip message in daily-standup channel
    const channel = await prisma.channel.findFirst({
      where: { organizationId, name: "daily-standup" },
    })
    if (channel) {
      await prisma.message.create({
        data: {
          content: `📅 Daily de hoje foi pausada.\n\nMotivo: ${reason}\n\nSeu time esta aguardando. Quer reativar?\n\nUse o botao "Daily" na sidebar para iniciar manualmente.`,
          channelId: channel.id,
          metadata: { type: "daily_skipped", reason },
        },
      })
    }

    return NextResponse.json({
      skipped: true,
      reason,
      message: "Daily marcada como pulada. O time nao vai se reunir automaticamente hoje.",
    })
  } catch (error) {
    console.error("[Daily Skip Error]", error)
    return NextResponse.json({ error: "Failed to skip daily" }, { status: 500 })
  }
}
