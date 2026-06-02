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

  const onboarding = await prisma.onboarding.findUnique({
    where: { organizationId: orgId },
  })

  return NextResponse.json(onboarding || { step: 0, completed: false })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { organizationId, step, ...data } = body

    const onboarding = await prisma.onboarding.upsert({
      where: { organizationId },
      create: {
        organizationId,
        step: step || 0,
        ...data,
      },
      update: {
        step: step || 0,
        ...data,
      },
    })

    return NextResponse.json(onboarding)
  } catch (error) {
    console.error("[Onboarding Error]", error)
    return NextResponse.json({ error: "Erro ao salvar onboarding" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { organizationId, completed } = body

    const onboarding = await prisma.onboarding.update({
      where: { organizationId },
      data: { completed },
    })

    return NextResponse.json(onboarding)
  } catch (error) {
    return NextResponse.json({ error: "Erro ao finalizar onboarding" }, { status: 500 })
  }
}
