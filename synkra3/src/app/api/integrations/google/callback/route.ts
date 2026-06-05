import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const error = request.nextUrl.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL || "https://www.adstock.ai"}/?error=google_auth_failed`)
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
  }

  try {
    const { orgId } = JSON.parse(Buffer.from(state, "base64").toString())

    const redirectUri = `${process.env.NEXTAUTH_URL || "https://www.adstock.ai"}/api/integrations/google/callback`

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    const tokens = await tokenRes.json()

    if (!tokenRes.ok) {
      console.error("[Google OAuth] Token error:", tokens)
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL || "https://www.adstock.ai"}/?error=google_token_failed`)
    }

    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null

    const existing = await prisma.integration.findUnique({
      where: { organizationId_platform: { organizationId: orgId, platform: "google" } },
    })

    if (existing) {
      await prisma.integration.update({
        where: { id: existing.id },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || existing.refreshToken,
          tokenExpiresAt: expiresAt,
          status: "connected",
        },
      })
    } else {
      await prisma.integration.create({
        data: {
          organizationId: orgId,
          platform: "google",
          name: "Google Search Console",
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: expiresAt,
          status: "connected",
        },
      })
    }

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL || "https://www.adstock.ai"}/workspace/${orgId}?connected=google`)
  } catch (err) {
    console.error("[Google OAuth] Error:", err)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL || "https://www.adstock.ai"}/?error=google_callback_failed`)
  }
}
