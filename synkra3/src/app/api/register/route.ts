import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = registerSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados invalidos", details: validation.error.flatten() },
        { status: 400 },
      )
    }

    const { name, email, password } = validation.data

    // Check if user already exists in our table
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "Email ja cadastrado" }, { status: 409 })
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm in dev
      user_metadata: { name },
    })

    if (authError) {
      // Handle Supabase Auth errors
      if (authError.message?.includes("already registered")) {
        return NextResponse.json({ error: "Email ja cadastrado" }, { status: 409 })
      }
      console.error("[Register Supabase Error]", authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Create user in our public schema
    const user = await prisma.user.create({
      data: {
        id: authData.user.id, // sync with Supabase UID
        name,
        email,
      },
    })

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
    })
  } catch (error) {
    console.error("[Register Error]", error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: "Erro ao criar conta", detail: msg }, { status: 500 })
  }
}
