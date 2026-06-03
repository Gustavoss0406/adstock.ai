import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { derivePalette, DEFAULT_BRAND } from "@/lib/images/template-engine"
import { ImageResponse } from "next/og"

function BrandedPost({ brand, title, subtitle }: { brand: any; title: string; subtitle: string }) {
  const p = derivePalette(brand.colors[0] || "#6366F1")
  const c = brand.colors[0]

  return (
    <div style={{
      width: 1080, height: 1350, display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center",
      background: "#0d0d0d", padding: "80px 72px 100px",
      fontFamily: "Inter, sans-serif", position: "relative",
    }}>
      <div style={{ position: "absolute", top: 48, left: 72, display: "flex" }}>
        <span style={{ fontSize: 18, fontWeight: 500, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}>
          {brand.name}
        </span>
      </div>
      <div style={{ position: "absolute", top: 0, left: 0, width: 8, height: "100%", background: c, display: "flex" }} />
      <h1 style={{
        fontSize: 88, fontWeight: 800, color: "#fff", textAlign: "center",
        lineHeight: 1.1, maxWidth: "80%", letterSpacing: "-0.03em", marginBottom: 32,
      }}>{title}</h1>
      <p style={{
        fontSize: 28, fontWeight: 400, color: "rgba(255,255,255,0.5)",
        textAlign: "center", maxWidth: "70%", lineHeight: 1.5, fontStyle: "italic",
      }}>{subtitle}</p>
      <div style={{
        marginTop: 64, background: c, borderRadius: 12,
        padding: "48px 64px", display: "flex", flexDirection: "column",
        alignItems: "center", width: "80%",
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.2em", textTransform: "uppercase" }}>{brand.name}</span>
        <div style={{ fontSize: 40, fontWeight: 700, color: "#fff", textAlign: "center", lineHeight: 1.2, marginTop: 16 }}>Presenca nao e frequencia. E intencao.</div>
      </div>
      <div style={{
        position: "absolute", bottom: 48, left: 72, right: 72,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 14, fontWeight: 400, color: "rgba(255,255,255,0.3)" }}>{brand.handle}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: c }}>{brand.name.split(" ")[0].charAt(0)} / 01</span>
      </div>
    </div>
  )
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get("orgId")
  const title = searchParams.get("title") || "O silencio custa caro."
  const subtitle = searchParams.get("subtitle") || "Marcas que nao comunicam com intencao deixam a interpretacao para o mercado."
  const color = searchParams.get("color")

  let brand = { ...DEFAULT_BRAND }
  if (orgId) {
    try {
      const onboarding = await prisma.onboarding.findUnique({ where: { organizationId: orgId } })
      const saved = (onboarding as any)?.metadata?.brandIdentity
      if (saved) brand = { ...DEFAULT_BRAND, ...saved }
    } catch {}
  }
  if (color) brand.colors[0] = color
  if (!brand.handle) brand.handle = "@" + brand.name.toLowerCase().replace(/\s/g, "")

  return new ImageResponse(
    BrandedPost({ brand, title, subtitle }),
    { width: 1080, height: 1350 }
  )
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { organizationId } = body
  let brand = { ...DEFAULT_BRAND }
  if (organizationId) {
    try {
      const onboarding = await prisma.onboarding.findUnique({ where: { organizationId } })
      const saved = (onboarding as any)?.metadata?.brandIdentity
      if (saved) brand = { ...DEFAULT_BRAND, ...saved }
    } catch {}
  }
  return NextResponse.json({
    success: true,
    brand: { name: brand.name, colors: brand.colors, fontStyle: brand.fontStyle },
  })
}
