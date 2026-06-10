import { NextRequest, NextResponse } from "next/server"
import { getAdminCredentials } from "@/lib/auth/admin"
import { setAdminSessionCookie } from "@/lib/auth/admin-session"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha obrigatorios" }, { status: 400 })
    }

    const admin = getAdminCredentials()

    if (email !== admin.email || password !== admin.password) {
      return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 })
    }

    await setAdminSessionCookie(admin.email)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Admin Login Error]", error)
    return NextResponse.json({ error: "Erro ao autenticar" }, { status: 500 })
  }
}
