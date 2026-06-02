import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const publicPaths = [
  "/",
  "/login",
  "/register",
  "/api/auth",
  "/api/register",
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/api/worker")) {
    return NextResponse.next()
  }

  const token = await getToken({ req: request })

  if (!token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
}
