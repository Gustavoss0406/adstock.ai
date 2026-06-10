import { cookies } from "next/headers"

const COOKIE_NAME = "admin_session"
const SESSION_DURATION = 8 * 60 * 60 * 1000

interface AdminPayload {
  email: string
  iat: number
  exp: number
}

function base64UrlEncode(buf: Buffer | Uint8Array): string {
  const b64 = Buffer.from(buf).toString("base64")
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlDecode(str: string): Buffer {
  str = str.replace(/-/g, "+").replace(/_/g, "/")
  while (str.length % 4) str += "="
  return Buffer.from(str, "base64")
}

async function getKey(secret: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

async function sign(payload: string): Promise<string> {
  const keyB64 = process.env.ADMIN_ENCRYPTION_KEY
  if (!keyB64) throw new Error("ADMIN_ENCRYPTION_KEY not set")
  const secret = new Uint8Array(Buffer.from(keyB64, "base64"))
  const key = await getKey(secret)
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  return base64UrlEncode(new Uint8Array(sig))
}

export async function createAdminToken(email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: AdminPayload = {
    email,
    iat: now,
    exp: now + Math.floor(SESSION_DURATION / 1000),
  }
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)))
  const signature = await sign(payloadB64)
  return `${payloadB64}.${signature}`
}

export async function verifyAdminToken(token: string): Promise<AdminPayload | null> {
  try {
    const dotIdx = token.indexOf(".")
    if (dotIdx === -1) return null
    const payloadB64 = token.substring(0, dotIdx)
    const signature = token.substring(dotIdx + 1)
    if (!payloadB64 || !signature) return null

    const keyB64 = process.env.ADMIN_ENCRYPTION_KEY
    if (!keyB64) return null
    const secret = new Uint8Array(Buffer.from(keyB64, "base64"))
    const key = await getKey(secret)

    const sigBytes = base64UrlDecode(signature)
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(payloadB64),
    )

    if (!valid) return null

    const payload: AdminPayload = JSON.parse(base64UrlDecode(payloadB64).toString())

    if (Date.now() / 1000 > payload.exp) return null
    if (!payload.email) return null

    return payload
  } catch {
    return null
  }
}

export async function setAdminSessionCookie(email: string) {
  const token = await createAdminToken(email)
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
