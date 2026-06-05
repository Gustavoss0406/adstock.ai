import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check public paths BEFORE any Supabase API call
  const publicPaths = ["/login", "/register", "/api/auth", "/api/register", "/auth/callback"]
  const isPublic = pathname === "/"
    || publicPaths.some((p) => pathname.startsWith(p))
    || pathname.startsWith("/_next")
    || pathname.startsWith("/public")
    || pathname.startsWith("/api/worker")
    || pathname.startsWith("/api/office")
    || pathname.startsWith("/api/agents/bridge")
    || pathname.startsWith("/api/routine/check")
    || pathname.startsWith("/api/system/heartbeat-cron")

  if (isPublic) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

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
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(url)
    }
  } catch {
    // Supabase unreachable — redirect to login for safety
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
