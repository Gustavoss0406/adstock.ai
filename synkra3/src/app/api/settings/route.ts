import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
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
  const session = await getServerSession(authOptions)
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
