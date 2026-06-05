import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/workspace"

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no-code", request.url))
  }

  // Create a response we can modify (for cookie setting)
  let response = NextResponse.redirect(new URL(next, request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, sameSite: "lax" }),
          )
        },
      },
    },
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data?.user) {
    console.error("[OAuth Error]", error)
    return NextResponse.redirect(new URL("/login?error=auth", request.url))
  }

  const supabaseUser = data.user

  // Sync user to our public.User table
  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: supabaseUser.email! },
    })

    if (!existingUser) {
      await prisma.user.create({
        data: {
          id: supabaseUser.id,
          name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split("@")[0] || "User",
          email: supabaseUser.email!,
          image: supabaseUser.user_metadata?.avatar_url || null,
        },
      })
    }
  } catch (err) {
    console.error("[OAuth Sync Error]", err)
    // Non-blocking: user can still proceed even if sync fails
  }

  return response
}
