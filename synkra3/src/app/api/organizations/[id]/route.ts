import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const org = await prisma.organization.findFirst({
    where: {
      id: params.id,
      members: { some: { userId: session.user.id } },
    },
    include: {
      agents: { orderBy: { createdAt: "asc" } },
      officeSettings: true,
      onboarding: true,
      meetings: { orderBy: { scheduledAt: "desc" }, take: 10 },
      channels: true,
      projects: { orderBy: { createdAt: "desc" } },
      integrations: true,
    },
  })

  if (!org) {
    return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 })
  }

  return NextResponse.json(org)
}
