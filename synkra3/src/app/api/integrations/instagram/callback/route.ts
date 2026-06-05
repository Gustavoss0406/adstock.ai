import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const error = request.nextUrl.searchParams.get("error")
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.adstock.ai"

  if (error) {
    return NextResponse.redirect(`${baseUrl}/?error=instagram_auth_failed`)
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
  }

  try {
    const { orgId, returnTo } = JSON.parse(Buffer.from(state, "base64").toString())
    const redirectPath = returnTo === "/onboarding" ? `/onboarding?connected=instagram` : `/workspace/${orgId}?connected=instagram`

    const redirectUri = `${baseUrl}/api/integrations/instagram/callback`

    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID!,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    })

    const tokens = await tokenRes.json()

    if (!tokenRes.ok) {
      console.error("[Instagram OAuth] Token error:", tokens)
      return NextResponse.redirect(`${baseUrl}/?error=instagram_token_failed`)
    }

    const shortLivedToken = tokens.access_token
    const userId = tokens.user_id

    const longLivedRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET!}&access_token=${shortLivedToken}`
    )
    const longLivedData = await longLivedRes.json()
    const accessToken = longLivedData.access_token || shortLivedToken
    const expiresAt = longLivedData.expires_in ? new Date(Date.now() + longLivedData.expires_in * 1000) : null

    const existing = await prisma.integration.findUnique({
      where: { organizationId_platform: { organizationId: orgId, platform: "instagram" } },
    })

    const metadata = { instagramUserId: userId }

    if (existing) {
      await prisma.integration.update({
        where: { id: existing.id },
        data: {
          accessToken,
          refreshToken: longLivedData.refresh_token || existing.refreshToken,
          tokenExpiresAt: expiresAt,
          status: "connected",
          metadata,
        },
      })
    } else {
      await prisma.integration.create({
        data: {
          organizationId: orgId,
          platform: "instagram",
          name: "Instagram Business",
          accessToken,
          refreshToken: longLivedData.refresh_token,
          tokenExpiresAt: expiresAt,
          status: "connected",
          metadata,
        },
      })
    }

    return NextResponse.redirect(`${baseUrl}${redirectPath}`)
  } catch (err) {
    console.error("[Instagram OAuth] Error:", err)
    return NextResponse.redirect(`${baseUrl}/?error=instagram_callback_failed`)
  }
}
