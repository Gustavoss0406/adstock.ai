import { updateSession } from "@/lib/supabase/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { verifyAdminToken } from "@/lib/auth/admin-session"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login" || pathname.startsWith("/api/admin/login")) {
      return NextResponse.next()
    }

    const token = request.cookies.get("admin_session")?.value
    if (!token || !verifyAdminToken(token)) {
      const url = request.nextUrl.clone()
      url.pathname = "/admin/login"
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  }

  return updateSession(request)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/|api/worker).*)"],
}
