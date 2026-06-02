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

  const integrations = await prisma.integration.findMany({
    where: { organizationId: orgId },
  })

  return NextResponse.json(integrations)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { organizationId, platform, name, accessToken, refreshToken } = body

    const existing = await prisma.integration.findUnique({
      where: { organizationId_platform: { organizationId, platform } },
    })

    if (existing) {
      const updated = await prisma.integration.update({
        where: { id: existing.id },
        data: { accessToken, refreshToken, status: "connected" },
      })
      return NextResponse.json(updated)
    }

    const integration = await prisma.integration.create({
      data: {
        organizationId,
        platform,
        name: name || platform,
        accessToken,
        refreshToken,
        status: "connected",
      },
    })

    return NextResponse.json(integration, { status: 201 })
  } catch (error) {
    console.error("[Integration Error]", error)
    return NextResponse.json({ error: "Erro ao conectar integração" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id é obrigatório" }, { status: 400 })
  }

  await prisma.integration.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
