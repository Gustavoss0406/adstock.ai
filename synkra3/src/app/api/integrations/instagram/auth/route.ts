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

  const clientId = process.env.INSTAGRAM_CLIENT_ID
  const redirectUri = `${process.env.NEXTAUTH_URL || "https://www.adstock.ai"}/api/integrations/instagram/callback`
  const state = Buffer.from(JSON.stringify({ orgId, userId: session.user.id, returnTo })).toString("base64")

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_insights",
    state,
  })

  return NextResponse.redirect(`https://www.instagram.com/oauth/authorize?${params}`)
}
