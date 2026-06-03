import { prisma } from "@/lib/prisma"

export interface BrandIdentity {
  name: string
  handle: string
  colors: string[]
  logoBase64: string | null
  fontStyle: FontStyle
}

export type FontStyle = "editorial" | "bold" | "tech" | "luxe"

export const FONT_PAIRS: Record<FontStyle, {
  heading: string; body: string; googleFontsUrl: string; label: string; preview: string
}> = {
  editorial: {
    heading: "Playfair Display", body: "DM Sans",
    googleFontsUrl: "fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Sans:wght@300;400;500&display=swap",
    label: "Editorial Luxo", preview: "Elegante e sofisticado — perfeito para marcas premium",
  },
  bold: {
    heading: "Bebas Neue", body: "Space Mono",
    googleFontsUrl: "fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Barlow+Condensed:wght@300;400;600;800&display=swap",
    label: "Bold / Zine", preview: "Ousado e impactante — destaque em qualquer feed",
  },
  tech: {
    heading: "Syne", body: "Syne Mono",
    googleFontsUrl: "fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Syne+Mono&display=swap",
    label: "Tech / Cyber", preview: "Moderno e tecnologico — ideal para marcas digitais",
  },
  luxe: {
    heading: "Cormorant", body: "Jost",
    googleFontsUrl: "fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Jost:wght@200;300;400&display=swap",
    label: "Luxe Minimal", preview: "Classico e refinado — minimalismo com personalidade",
  },
}

export type TemplateId = "template-1" | "template-2" | "template-3" | "template-4"

const TEMPLATE_FILES: Record<TemplateId, string> = {
  "template-1": "editorial.html",
  "template-2": "bold-zine.html",
  "template-3": "tech-cyber.html",
  "template-4": "luxe-minimal.html",
}

export const DEFAULT_BRAND: BrandIdentity = {
  name: "Sua Marca", handle: "@suamarca",
  colors: ["#6366F1", "#A5B4FC"], logoBase64: null,
  fontStyle: "luxe",
}

// ── Color derivation ──────────────────────────────────────
export function derivePalette(primary: string) {
  const light = lightenHex(primary, 20)
  const dark = darkenHex(primary, 30)
  const r = parseInt(primary.slice(1, 3), 16)
  const b = parseInt(primary.slice(5, 7), 16)
  const isWarm = r > b + 30
  return {
    primary, light, dark,
    lightBg: isWarm ? "#FAF7F4" : "#F4F6FA",
    darkBg: isWarm ? "#1A1918" : "#0F172A",
    border: isWarm ? "#E8E2DB" : "#E2E6EE",
  }
}

function lightenHex(h: string, p: number) { return adjustHex(h, p) }
function darkenHex(h: string, p: number) { return adjustHex(h, -p) }
function adjustHex(hex: string, p: number): string {
  const n = parseInt(hex.slice(1), 16)
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)))
  const r = clamp(((n >> 16) & 0xFF) + 2.55 * p)
  const g = clamp(((n >> 8) & 0xFF) + 2.55 * p)
  const b = clamp((n & 0xFF) + 2.55 * p)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}

// ── Template engine: apply brand to HTML ──────────────────
export function applyBrandToTemplate(html: string, brand: BrandIdentity, content?: { title?: string; subtitle?: string; tagline?: string }): string {
  const palette = derivePalette(brand.colors[0])
  const secondary = brand.colors[1] || palette.light
  const fonts = FONT_PAIRS[brand.fontStyle]
  const initial = brand.name.charAt(0).toUpperCase()
  const gradient = `linear-gradient(135deg, ${palette.dark}, ${brand.colors[0]}, ${secondary})`

  let result = html
    .replace(/\{brand_name\}/g, brand.name)
    .replace(/\{brand_handle\}/g, brand.handle)
    .replace(/\{brand_primary\}/g, brand.colors[0])
    .replace(/\{brand_secondary\}/g, secondary)
    .replace(/\{brand_light\}/g, palette.light)
    .replace(/\{brand_dark\}/g, palette.dark)
    .replace(/\{brand_lightBg\}/g, palette.lightBg)
    .replace(/\{brand_darkBg\}/g, palette.darkBg)
    .replace(/\{brand_border\}/g, palette.border)
    .replace(/\{brand_gradient\}/g, gradient)
    .replace(/\{brand_logo\}/g, brand.logoBase64 || "")
    .replace(/\{brand_initial\}/g, initial)
    .replace(/\{google_fonts_url\}/g, `https://${fonts.googleFontsUrl}`)
    .replace(/\{heading_font\}/g, fonts.heading)
    .replace(/\{body_font\}/g, fonts.body)

  // Replace content placeholders if provided
  if (content?.title) result = result.replace(/\{content_title\}/g, content.title)
  if (content?.subtitle) result = result.replace(/\{content_subtitle\}/g, content.subtitle)  
  if (content?.tagline) result = result.replace(/\{content_tagline\}/g, content.tagline)

  return result
}

export async function loadBrandFromDb(organizationId: string): Promise<BrandIdentity> {
  try {
    // Use raw query because metadata is JSONB
    const result = await prisma.$queryRawUnsafe(
      `SELECT metadata->'brandIdentity' as brand FROM "Onboarding" WHERE "organizationId" = $1`,
      organizationId
    ) as any[]
    if (result?.[0]?.brand) {
      return { ...DEFAULT_BRAND, ...result[0].brand }
    }
  } catch {}
  return { ...DEFAULT_BRAND }
}

export async function saveBrandToDb(organizationId: string, brand: BrandIdentity): Promise<void> {
  await prisma.$queryRawUnsafe(
    `UPDATE "Onboarding" SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{brandIdentity}', $1::jsonb) WHERE "organizationId" = $2`,
    JSON.stringify(brand), organizationId
  )
}
