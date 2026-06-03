import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { applyBrandToTemplate, derivePalette, DEFAULT_BRAND, FONT_PAIRS, type BrandIdentity, type FontStyle, type TemplateId } from "@/lib/images/template-engine"
import { ImageResponse } from "next/og"
import fs from "fs"
import path from "path"

const TEMPLATES_DIR = path.join(process.cwd(), "src/lib/images/templates")

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
