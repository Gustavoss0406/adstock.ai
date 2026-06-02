import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { runDaily, shouldRunDailyToday, isHolidayToday } from "@/lib/agents/daily"

export const maxDuration = 300 // 5min for parallel daily processing

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key")
  if (apiKey !== process.env.ROUTINE_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const orgs = await prisma.organization.findMany({
      where: { officeSettings: { dailyTime: { not: "" }, dailyEnabled: true } },
      include: { officeSettings: true },
    })

    // Filter orgs that should run now
    const orgsToRun: Array<{ id: string; name: string }> = []
    const skipped: Array<{ id: string; name: string; reason: string }> = []

    const now = new Date()

    for (const org of orgs) {
      const settings = org.officeSettings
      if (!settings || !settings.dailyTime) continue

      const [dh, dm] = settings.dailyTime.split(":").map(Number)
      if (isNaN(dh) || isNaN(dm)) continue

      const timezone = settings.timezone || "America/Sao_Paulo"

      let localHour: number
      let localMinute: number
      try {
        const localStr = now.toLocaleString("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false })
        const [lh, lm] = localStr.split(":").map(Number)
        localHour = lh
        localMinute = lm
      } catch {
        localHour = now.getHours()
        localMinute = now.getMinutes()
      }

      const currentMins = localHour * 60 + localMinute
      const dailyMins = dh * 60 + dm
      const triggerMins = dailyMins - 2
      if (currentMins < triggerMins || currentMins >= dailyMins + 5) continue

      if (settings.lastDailyAt) {
        const lastDailyLocal = new Date(settings.lastDailyAt).toLocaleDateString("pt-BR", { timeZone: timezone })
        const todayLocal = now.toLocaleDateString("pt-BR", { timeZone: timezone })
        if (lastDailyLocal === todayLocal) continue
      }

      const shouldRun = shouldRunDailyToday({
        dailyEnabled: settings.dailyEnabled,
        dailyDays: settings.dailyDays || [],
        timezone,
      })

      if (!shouldRun.shouldRun) {
        skipped.push({ id: org.id, name: org.name, reason: shouldRun.reason || "desconhecido" })
        continue
      }

      orgsToRun.push({ id: org.id, name: org.name })
    }

    // ── Parallel execution with concurrency limit ─────────
    const CONCURRENCY_LIMIT = 3
    const results: Array<{ id: string; name: string; summary: string }> = []
    const errors: Array<{ id: string; name: string; error: string }> = []

    for (let i = 0; i < orgsToRun.length; i += CONCURRENCY_LIMIT) {
      const batch = orgsToRun.slice(i, i + CONCURRENCY_LIMIT)
      const batchResults = await Promise.allSettled(
        batch.map(async (org) => {
          const result = await runDaily(org.id)
          return { id: org.id, name: org.name, summary: result.summary }
        }),
      )

      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          results.push(r.value)
        } else {
          const org = batch.find((o) =>
            r.reason?.message?.includes(o.id),
          ) || batch[0]
          console.error(`[Check] Daily failed for ${org?.name}:`, r.reason)
          errors.push({
            id: org?.id || "unknown",
            name: org?.name || "unknown",
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          })
        }
      }
    }

    return NextResponse.json({
      ran: results.length,
      skipped: skipped.length,
      errors: errors.length,
      orgs: results.map(r => ({ id: r.id, name: r.name })),
      skippedOrgs: skipped.map(s => ({ id: s.id, name: s.name, reason: s.reason })),
      errorOrgs: errors.map(e => ({ id: e.id, name: e.name })),
    })
  } catch (error) {
    console.error("[Daily Check Error]", error)
    return NextResponse.json({ error: "Check failed" }, { status: 500 })
  }
}
