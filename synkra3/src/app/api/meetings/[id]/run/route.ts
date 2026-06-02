import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { runMeeting } from "@/lib/agents/controller"

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
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
