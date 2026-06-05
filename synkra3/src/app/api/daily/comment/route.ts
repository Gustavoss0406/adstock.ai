import { NextRequest, NextResponse } from "next/server"
import { getSupabaseSession } from "@/lib/auth/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/daily/comment
 * Body: { organizationId, message, replyToMessageId? }
 *
 * Permite que o usuário (CEO) comente durante ou após a daily.
 * Posta a mensagem no canal #daily-standup como usuário.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSupabaseSession()
    const { organizationId, message, replyToMessageId } = await request.json()

    if (!organizationId || !message) {
      return NextResponse.json({ error: "organizationId and message required" }, { status: 400 })
    }

    // Find daily-standup channel
    const channel = await prisma.channel.findFirst({
      where: { organizationId, name: "daily-standup" },
    })

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 })
    }

    // Create user message
    const msg = await prisma.message.create({
      data: {
        content: message,
        channelId: channel.id,
        userId: session?.user?.id || null,
        metadata: {
          type: "daily_comment",
          dailyDate: new Date().toISOString().slice(0, 10),
          replyToMessageId: replyToMessageId || null,
        },
      },
    })

    // If replying to a specific message, save as reply context
    if (replyToMessageId) {
      await prisma.message.update({
        where: { id: replyToMessageId },
        data: {
          metadata: {
            // Merge existing metadata or create new
            replied: true,
            repliedAt: new Date().toISOString(),
          },
        },
      })
    }

    // Create agency event for tracking
    await prisma.agencyEvent.create({
      data: {
        organizationId,
        type: "daily_comment",
        title: "CEO comentou na daily",
        description: message.slice(0, 200),
        metadata: {
          messageId: msg.id,
          replyToMessageId: replyToMessageId || null,
        },
      },
    } as any)

    return NextResponse.json({
      success: true,
      messageId: msg.id,
      content: message,
    })
  } catch (error) {
    console.error("[Daily Comment Error]", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
