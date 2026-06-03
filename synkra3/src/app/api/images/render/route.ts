import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { derivePalette, DEFAULT_BRAND, FONT_PAIRS, type BrandIdentity, type FontStyle } from "@/lib/images/template-engine"
import { ImageResponse } from "next/og"

// ── Satori-compatible Instagram post template ──────────────
function BrandedPost({ brand, title, subtitle }: { brand: BrandIdentity; title: string; subtitle: string }) {
  const palette = derivePalette(brand.colors[0])
  const secondary = brand.colors[1] || palette.light

  return (
    <div style={{
      width: 1080, height: 1350, display: "flex", flexDirection: "column",
      justifyContent: "flex-end", alignItems: "center",
      background: palette.darkBg, padding: "0 72px",
      position: "relative", fontFamily: "'Inter', sans-serif",
    }}>
      {/* Background accent circles */}
      <div style={{
        position: "absolute", top: -180, right: -120, width: 680, height: 680,
        borderRadius: "50%", background: `${brand.colors[0]}10`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -100, left: -100, width: 580, height: 580,
        borderRadius: "50%", background: `${secondary}08`,
        pointerEvents: "none",
      }} />

      {/* Side stripe with brand color */}
      <div style={{
        position: "absolute", top: 0, left: 0, width: 8, height: "100%",
        background: brand.colors[0],
      }} />

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 52, left: 72, right: 72,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 13, fontWeight: 200, letterSpacing: "0.38em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
          {brand.name}
        </span>
        <span style={{ fontSize: 11, fontWeight: 300, letterSpacing: "0.22em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
          Vol. I
        </span>
      </div>

      {/* Divider */}
      <div style={{
        position: "absolute", top: 96, left: 72, right: 72, height: 1,
        background: "rgba(255,255,255,0.06)",
      }} />

      {/* Category label */}
      <div style={{
        position: "absolute", top: 120, left: 72, display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{ width: 28, height: 1, background: brand.colors[0] }} />
        <span style={{ fontSize: 11, fontWeight: 300, letterSpacing: "0.26em", color: brand.colors[0], textTransform: "uppercase" }}>
          Branding &amp; Estrategia
        </span>
      </div>

      {/* Headline */}
      <div style={{
        position: "absolute", top: 168, left: 72, right: 72,
      }}>
        <h1 style={{
          fontFamily: "'Playfair Display', serif", fontSize: 96, fontWeight: 300,
          lineHeight: 0.92, letterSpacing: "-0.03em", color: "#faf9f7",
        }}>
          {title}
        </h1>
      </div>

      {/* Divider */}
      <div style={{
        position: "absolute", top: 475, left: 72, right: 72, display: "flex",
        alignItems: "center", gap: 20,
      }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
        <span style={{ fontSize: 12, fontWeight: 300, letterSpacing: "0.22em", color: "rgba(255,255,255,0.25)" }}>§ 01</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
      </div>

      {/* Subtitle / lead */}
      <div style={{
        position: "absolute", top: 505, left: 72, right: 160,
      }}>
        <p style={{
          fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 400,
          fontStyle: "italic", lineHeight: 1.45, color: "rgba(255,255,255,0.55)",
          letterSpacing: "-0.01em",
        }}>
          {subtitle}
        </p>
      </div>

      {/* Brand color block */}
      <div style={{
        position: "absolute", top: 616, left: 72, right: 72,
        background: brand.colors[0], padding: "40px 52px",
      }}>
        <span style={{ fontSize: 10, fontWeight: 200, letterSpacing: "0.32em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 18 }}>
          Ponto central
        </span>
        <div style={{
          fontSize: 48, fontWeight: 300, lineHeight: 0.96, letterSpacing: "-0.02em",
          color: "#fff", marginTop: 10,
        }}>
          Presenca nao e frequencia.<br />E <em style={{ fontStyle: "italic" }}>intencao.</em>
        </div>
        <div style={{ fontSize: 10, fontWeight: 200, letterSpacing: "0.22em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginTop: 24 }}>
          — Principio de posicionamento
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        position: "absolute", bottom: 160, left: 72, right: 72,
        display: "flex", gap: 24,
      }}>
        {[
          { num: "73%", label: "Decisao", desc: "das compras sao influenciadas pela percepcao de marca" },
          { num: "5×", label: "Impacto", desc: "mais retorno em marcas com identidade consistente" },
          { num: "0.3s", label: "Janela", desc: "e o tempo para causar uma impressao" },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, padding: "0 20px 0 0",
            borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}>
            <div style={{ fontSize: 44, fontWeight: 300, lineHeight: 1, color: "#faf9f7", letterSpacing: "-0.03em", marginBottom: 6 }}>
              {s.num}
            </div>
            <div style={{ fontSize: 10, fontWeight: 200, letterSpacing: "0.22em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 8 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.55, color: "rgba(255,255,255,0.35)" }}>
              {s.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        position: "absolute", bottom: 62, left: 72, right: 72,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, fontWeight: 200, letterSpacing: "0.22em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
          {brand.handle}
        </span>
        <span style={{ fontSize: 11, fontWeight: 300, letterSpacing: "0.22em", color: brand.colors[0], textTransform: "uppercase", display: "flex", alignItems: "center", gap: 10 }}>
          Salvar
        </span>
        <span style={{ fontSize: 14, fontWeight: 300, letterSpacing: "0.14em", color: "rgba(255,255,255,0.15)" }}>
          {brand.name.split(" ")[0].charAt(0)} / 01
        </span>
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

  return new ImageResponse(
    BrandedPost({ brand, title, subtitle }),
    { width: 1080, height: 1350 }
  )
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { organizationId, title, subtitle } = body

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
    message: "Render API pronto. Use GET com ?color=HEX para testar.",
  })
}

// Load template HTML file
function loadTemplate(id: TemplateId, brand: BrandIdentity): string {
  try {
    let html = ""

    if (id === "carousel") {
      html = generateCarouselSlide(brand, 1, 7, "Hero — Sua marca em destaque")
    } else {
      const fileMap: Record<string, string> = {
        "template-1": "editorial.html",
        "template-2": "bold-zine.html",
        "template-3": "tech-cyber.html",
        "template-4": "luxe-minimal.html",
      }
      const file = path.join(TEMPLATES_DIR, fileMap[id] || "luxe-minimal.html")
      if (fs.existsSync(file)) {
        html = fs.readFileSync(file, "utf-8")
      } else {
        html = generateCarouselSlide(brand, 1, 1, brand.name)
      }
    }

    return applyBrandToTemplate(html, brand)
  } catch {
    return generateFallbackHtml(brand)
  }
}

function generateCarouselSlide(brand: BrandIdentity, num: number, total: number, title: string): string {
  const palette = derivePalette(brand.colors[0])
  const fonts = FONT_PAIRS[brand.fontStyle]
  const bg = num % 2 === 1 ? palette.lightBg : palette.darkBg
  const textColor = num % 2 === 1 ? "#111118" : "#FFFFFF"
  const mutedColor = num % 2 === 1 ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)"

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<link href="${fonts.googleFontsUrl}" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  .slide{width:1080px;height:1350px;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:80px 72px;position:relative;font-family:'${fonts.body}',sans-serif;background:${bg};}
  .progress{position:absolute;bottom:0;left:0;right:0;height:4px;display:flex;background:${num%2===1?'rgba(0,0,0,0.05)':'rgba(255,255,255,0.08)'};}
  .progress-fill{height:100%;width:${Math.round((num/total)*100)}%;background:${palette.primary};border-radius:0 2px 2px 0;}
  .counter{position:absolute;bottom:24px;right:56px;font-size:16px;color:${mutedColor};display:flex;align-items:center;gap:8px;}
  .brand{position:absolute;top:48px;left:72px;font-size:16px;font-weight:500;color:${mutedColor};letter-spacing:0.05em;}
  h1{font-family:'${fonts.heading}',serif;font-size:68px;font-weight:800;color:${textColor};text-align:center;line-height:1.15;max-width:85%;letter-spacing:-0.02em;}
  .sub{font-size:26px;color:${mutedColor};margin-top:24px;text-align:center;max-width:70%;line-height:1.4;}
  .cta-btn{margin-top:56px;padding:18px 48px;border-radius:40px;background:${palette.primary};color:#fff;font-size:22px;font-weight:700;font-family:'${fonts.body}',sans-serif;}
</style></head><body>
<div class="slide">
  <div class="brand">${brand.name}</div>
  <h1>${title}</h1>
  ${num === total ? '<div class="cta-btn">Seguir ' + brand.name + '</div>' : ''}
  <div class="progress"><div class="progress-fill"></div></div>
  <div class="counter">${num}/${total}</div>
</div></body></html>`
}

function generateFallbackHtml(brand: BrandIdentity): string {
  return generateCarouselSlide(brand, 1, 1, brand.name)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const templateId = (searchParams.get("template") || "template-4") as TemplateId
  const orgId = searchParams.get("orgId")
  const title = searchParams.get("title") || ""
  const subtitle = searchParams.get("subtitle") || ""

  // Load brand from DB or use default
  let brand = { ...DEFAULT_BRAND }
  if (orgId) {
    const onboarding = await prisma.onboarding.findUnique({ where: { organizationId: orgId } })
    const saved = (onboarding as any)?.metadata?.brandIdentity
    if (saved) brand = { ...DEFAULT_BRAND, ...saved }
  }

  // Override with query params if present
  if (searchParams.get("color")) brand.colors[0] = searchParams.get("color")!
  if (searchParams.get("font")) brand.fontStyle = searchParams.get("font") as FontStyle

  const html = loadTemplate(templateId, brand)

  return new ImageResponse(
    <div dangerouslySetInnerHTML={{ __html: html }} />,
    { width: 1080, height: 1350 }
  )
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { organizationId, templateId, title, subtitle } = body

  let brand = { ...DEFAULT_BRAND }
  if (organizationId) {
    const onboarding = await prisma.onboarding.findUnique({ where: { organizationId } })
    const saved = (onboarding as any)?.metadata?.brandIdentity
    if (saved) brand = { ...DEFAULT_BRAND, ...saved }
  }

  const html = loadTemplate(templateId || "template-4", brand)

  // Return URLs for the slides
  const slides = []
  for (let i = 1; i <= 5; i++) {
    slides.push({
      number: i,
      url: `/api/images/render?template=carousel&orgId=${organizationId}&title=${encodeURIComponent(title || brand.name + " - Slide " + i)}&slide=${i}`,
    })
  }

  return NextResponse.json({
    success: true,
    brand: { name: brand.name, colors: brand.colors, fontStyle: brand.fontStyle },
    template: templateId || "template-4",
    slides,
    message: "Render pronto.",
  })
}
