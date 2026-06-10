import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"

const COOKIE_NAME = "admin_session"
const SESSION_DURATION = 8 * 60 * 60 * 1000 // 8 hours

interface AdminPayload {
  email: string
  iat: number
  exp: number
}

function getSecret(): Buffer {
  const key = process.env.ADMIN_ENCRYPTION_KEY
  if (!key) throw new Error("ADMIN_ENCRYPTION_KEY not set")
  return Buffer.from(key, "base64")
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlDecode(str: string): Buffer {
  str = str.replace(/-/g, "+").replace(/_/g, "/")
  while (str.length % 4) str += "="
  return Buffer.from(str, "base64")
}

function sign(payload: string): string {
  const secret = getSecret()
  const hmac = createHmac("sha256", secret)
  hmac.update(payload)
  return hmac.digest("base64url")
}

export function createAdminToken(email: string): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: AdminPayload = {
    email,
    iat: now,
    exp: now + Math.floor(SESSION_DURATION / 1000),
  }
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)))
  const signature = sign(payloadB64)
  return `${payloadB64}.${signature}`
}

export function verifyAdminToken(token: string): AdminPayload | null {
  try {
    const [payloadB64, signature] = token.split(".")
    if (!payloadB64 || !signature) return null

    const expectedSig = sign(payloadB64)
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expectedSig)

    if (sigBuf.length !== expBuf.length) return null
    if (!timingSafeEqual(sigBuf, expBuf)) return null

    const payload: AdminPayload = JSON.parse(base64UrlDecode(payloadB64).toString())

    if (Date.now() / 1000 > payload.exp) return null
    if (!payload.email) return null

    return payload
  } catch {
    return null
  }
}

export async function setAdminSessionCookie(email: string) {
  const token = createAdminToken(email)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION / 1000,
  })
}

export async function getAdminSession(): Promise<AdminPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    return verifyAdminToken(token)
  } catch {
    return null
  }
}

export async function clearAdminSession() {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}
