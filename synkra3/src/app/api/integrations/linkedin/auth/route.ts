import { NextRequest, NextResponse } from "next/server"
import { getSupabaseSession } from "@/lib/auth/server"

export async function GET(request: NextRequest) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  const returnTo = request.nextUrl.searchParams.get("returnTo") || ""
  if (!orgId) {
    return NextResponse.json({ error: "orgId é obrigatório" }, { status: 400 })
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID
  const redirectUri = `${process.env.NEXTAUTH_URL || "https://www.adstock.ai"}/api/integrations/linkedin/callback`
  const state = Buffer.from(JSON.stringify({ orgId, userId: session.user.id, returnTo })).toString("base64")

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "r_liteprofile r_emailaddress",
    state,
  })

  return NextResponse.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`)
}
