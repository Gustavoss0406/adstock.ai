import { prisma } from "@/lib/prisma"
import { getSupabaseSession } from "@/lib/auth/server"
import { NextRequest, NextResponse } from "next/server"
import { runMeeting } from "@/lib/agents/controller"

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const result = await runMeeting(params.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[Meeting Run Error]", error)
    return NextResponse.json({ error: "Erro ao executar reunião" }, { status: 500 })
  }
}
