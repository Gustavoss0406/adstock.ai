import { prisma } from "@/lib/prisma"
import { getSupabaseSession } from "@/lib/auth/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId é obrigatório" }, { status: 400 })
  }

  const settings = await prisma.officeSettings.findUnique({
    where: { organizationId: orgId },
  })

  return NextResponse.json(settings)
}

export async function PUT(request: NextRequest) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { organizationId, ...data } = body

    const settings = await prisma.officeSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error("[Settings Error]", error)
    return NextResponse.json({ error: "Erro ao atualizar configurações" }, { status: 500 })
  }
}
