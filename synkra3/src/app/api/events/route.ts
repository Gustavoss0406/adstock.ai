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

  const events = await prisma.agencyEvent.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json(events)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const event = await prisma.agencyEvent.create({
      data: body,
    })
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Erro ao criar evento" }, { status: 500 })
  }
}
