import { createDecipheriv } from "crypto"

function getAdminKey(): Buffer {
  const keyB64 = process.env.ADMIN_ENCRYPTION_KEY
  if (!keyB64) throw new Error("ADMIN_ENCRYPTION_KEY not set in environment")
  return Buffer.from(keyB64, "base64")
}

export function decryptAdminValue(encrypted: string): string {
  const key = getAdminKey()
  const parts = encrypted.split(":")
  if (parts.length !== 3) throw new Error("Invalid encrypted admin value format")

  const [ivB64, encryptedB64, tagB64] = parts
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")

  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, "base64")),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}

export function getAdminCredentials() {
  const email = process.env.ADMIN_EMAIL
  const encryptedName = process.env.ADMIN_ENCRYPTED_NAME
  const encryptedPassword = process.env.ADMIN_ENCRYPTED_PASSWORD
  const role = process.env.ADMIN_ROLE

  if (!email || !encryptedName || !encryptedPassword) {
    throw new Error("Admin credentials not configured in environment")
  }

  return {
    email,
    name: decryptAdminValue(encryptedName),
    password: decryptAdminValue(encryptedPassword),
    role: role || "admin",
  }
}
