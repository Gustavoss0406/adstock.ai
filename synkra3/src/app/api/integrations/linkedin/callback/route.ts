import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const error = request.nextUrl.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL || "https://www.adstock.ai"}/?error=linkedin_auth_failed`)
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
  }

  try {
    const { orgId } = JSON.parse(Buffer.from(state, "base64").toString())

    const redirectUri = `${process.env.NEXTAUTH_URL || "https://www.adstock.ai"}/api/integrations/linkedin/callback`

    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        redirect_uri: redirectUri,
      }),
    })

    const tokens = await tokenRes.json()

    if (!tokenRes.ok) {
      console.error("[LinkedIn OAuth] Token error:", tokens)
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL || "https://www.adstock.ai"}/?error=linkedin_token_failed`)
    }

    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null

    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json()

    const existing = await prisma.integration.findUnique({
      where: { organizationId_platform: { organizationId: orgId, platform: "linkedin" } },
    })

    const metadata = {
      linkedinId: profile.sub,
      name: profile.name,
      email: profile.email,
    }

    if (existing) {
      await prisma.integration.update({
        where: { id: existing.id },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || existing.refreshToken,
          tokenExpiresAt: expiresAt,
          status: "connected",
          metadata,
        },
      })
    } else {
      await prisma.integration.create({
        data: {
          organizationId: orgId,
          platform: "linkedin",
          name: profile.name || "LinkedIn",
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: expiresAt,
          status: "connected",
          metadata,
        },
      })
    }

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL || "https://www.adstock.ai"}/workspace/${orgId}?connected=linkedin`)
  } catch (err) {
    console.error("[LinkedIn OAuth] Error:", err)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL || "https://www.adstock.ai"}/?error=linkedin_callback_failed`)
  }
}
