import { createClient } from "@supabase/supabase-js"
import { randomBytes, createCipheriv } from "crypto"
import * as fs from "fs"
import * as path from "path"

const ENV_PATH = path.resolve(process.cwd(), ".env")

function loadEnv(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf-8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  }
}

loadEnv(ENV_PATH)
const ADMIN_EMAIL = "admin@adstock.com.br"
const ADMIN_NAME = "Admin Adstock"

function generateKey(): Buffer {
  return randomBytes(32)
}

function encrypt(text: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`
}

function generatePassword(length = 24): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_-"
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("ERRO: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar no .env atual")
    process.exit(1)
  }

  console.log("📦 Gerando chave AES-256-GCM...")
  const aesKey = generateKey()
  const aesKeyB64 = aesKey.toString("base64")

  console.log("🔐 Gerando senha forte...")
  const password = generatePassword()

  console.log(`👤 Criando usuario admin (${ADMIN_EMAIL}) no Supabase...`)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { name: ADMIN_NAME, role: "admin" },
  })

  if (authError) {
    if (authError.message?.includes("already registered")) {
      console.log("⚠️  Usuario ja existe no Supabase Auth. Seguindo com a criptografia...")
    } else {
      console.error("❌ Erro ao criar usuario no Supabase:", authError)
      process.exit(1)
    }
  } else {
    console.log(`✅ Usuario criado no Supabase Auth: ${authData.user.id}`)
  }

  console.log("🔒 Criptografando nome e senha...")
  const encryptedName = encrypt(ADMIN_NAME, aesKey)
  const encryptedPassword = encrypt(password, aesKey)

  const envContent = fs.readFileSync(ENV_PATH, "utf-8")
  const newLines = [
    ``,
    `# Admin credentials (encrypted with AES-256-GCM)`,
    `ADMIN_ENCRYPTION_KEY="${aesKeyB64}"`,
    `ADMIN_EMAIL="${ADMIN_EMAIL}"`,
    `ADMIN_ENCRYPTED_NAME="${encryptedName}"`,
    `ADMIN_ENCRYPTED_PASSWORD="${encryptedPassword}"`,
    `ADMIN_ROLE="admin"`,
    ``,
  ]

  const updated = envContent.trimEnd() + "\n" + newLines.join("\n")
  fs.writeFileSync(ENV_PATH, updated)

  console.log("✅ .env atualizado com:")
  console.log(`   ADMIN_ENCRYPTION_KEY (base64, 32 bytes)`)
  console.log(`   ADMIN_EMAIL="${ADMIN_EMAIL}"`)
  console.log(`   ADMIN_ENCRYPTED_NAME`)
  console.log(`   ADMIN_ENCRYPTED_PASSWORD`)
  console.log(`   ADMIN_ROLE="admin"`)
  console.log(`\n🔑 Senha (guarde em local seguro): ${password}`)
}

main().catch(console.error)
