/**
 * Server-side auth helpers for Supabase.
 * Replaces getServerSession() + authOptions from next-auth.
 */
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { prisma } from "@/lib/prisma"

type SessionUser = { id: string; name: string | null; email: string; image?: string | null }

export type AuthSession = {
  user: SessionUser
} | null

export async function getSupabaseSession(): Promise<AuthSession> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {}, // read-only in server context
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  // Find or create the corresponding User in our public schema
  let dbUser = await prisma.user.findUnique({
    where: { email: user.email },
  })

  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        id: user.id,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split("@")[0],
        email: user.email,
        image: user.user_metadata?.avatar_url || null,
      },
    })
  }

  return {
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email!,
      image: dbUser.image,
    },
  }
}

export async function requireAuth() {
  const session = await getSupabaseSession()
  if (!session) throw new Error("Unauthorized")
  return session
}
