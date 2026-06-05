import { prisma } from "@/lib/prisma"
import { getSupabaseSession } from "@/lib/auth/server"
import { NextRequest, NextResponse } from "next/server"
import { createDefaultAgents, createDefaultChannels } from "@/lib/agents/controller"
import { z } from "zod"

const createOrgSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
})

export async function POST(request: NextRequest) {
  console.log("[Org Create] Starting request")
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    console.log("[Org Create] No session found")
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  console.log("[Org Create] User authenticated:", session.user.id)

  try {
    const body = await request.json()
    console.log("[Org Create] Request body:", body)
    const validation = createOrgSchema.safeParse(body)

    if (!validation.success) {
      console.log("[Org Create] Validation failed:", validation.error.flatten())
      return NextResponse.json({ error: validation.error.flatten() }, { status: 400 })
    }

    const existing = await prisma.organization.findUnique({
      where: { slug: validation.data.slug },
    })
    if (existing) {
      console.log("[Org Create] Slug already exists:", validation.data.slug)
      return NextResponse.json({ error: "Slug já está em uso" }, { status: 409 })
    }

    console.log("[Org Create] Creating organization...")
    const org = await prisma.organization.create({
      data: {
        ...validation.data,
        ownerId: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            role: "owner",
          },
        },
      },
    })
    console.log("[Org Create] Organization created:", org.id)

    console.log("[Org Create] Creating office settings...")
    await prisma.officeSettings.create({
      data: {
        organizationId: org.id,
        dailyTime: "09:00",
        weeklyDay: "monday",
        weeklyTime: "10:00",
        workflowMethod: "KANBAN",
        sprintDuration: 14,
      },
    })
    console.log("[Org Create] Office settings created")

    console.log("[Org Create] Creating default channels...")
    await createDefaultChannels(org.id)
    console.log("[Org Create] Default channels created")

    console.log("[Org Create] Creating default agents...")
    await createDefaultAgents(org.id)
    console.log("[Org Create] Default agents created")

    console.log("[Org Create] Success!")
    return NextResponse.json(org, { status: 201 })
  } catch (error) {
    console.error("[Org Create Error]", error)
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error("[Org Create Error Stack]", errorStack)
    return NextResponse.json({ error: `Erro ao criar organização: ${errorMessage}` }, { status: 500 })
  }
}

export async function GET() {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const orgs = await prisma.organization.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
      agents: { where: { status: { not: "FIRED" } }, orderBy: { createdAt: "asc" } },
      officeSettings: true,
      onboarding: true,
    },
  })

  return NextResponse.json(orgs)
}

export async function PUT(request: NextRequest) {
  const session = await getSupabaseSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, ...data } = body

    const org = await prisma.organization.findFirst({
      where: { id, ownerId: session.user.id },
    })

    if (!org) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 })
    }

    const updated = await prisma.organization.update({
      where: { id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}
