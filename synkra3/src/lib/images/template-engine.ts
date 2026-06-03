export interface BrandIdentity {
  name: string
  handle: string
  colors: string[]        // ["#FF6B35", "#FF8E53"]
  logoBase64: string | null
  fontStyle: FontStyle
}

export type FontStyle = "editorial" | "bold" | "tech" | "luxe"

export const FONT_PAIRS: Record<FontStyle, { heading: string; body: string; googleFontsUrl: string; label: string; preview: string }> = {
  editorial: {
    heading: "Playfair Display",
    body: "DM Sans",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Sans:wght@300;400;500&display=swap",
    label: "Editorial Luxo",
    preview: "Elegante e sofisticado — perfeito para marcas premium",
  },
  bold: {
    heading: "Bebas Neue",
    body: "Space Mono",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Barlow+Condensed:wght@300;400;600;800&display=swap",
    label: "Bold / Zine",
    preview: "Ousado e impactante — destaque em qualquer feed",
  },
  tech: {
    heading: "Syne",
    body: "Syne Mono",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Syne+Mono&display=swap",
    label: "Tech / Cyber",
    preview: "Moderno e tecnológico — ideal para marcas digitais",
  },
  luxe: {
    heading: "Cormorant",
    body: "Jost",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Jost:wght@200;300;400&display=swap",
    label: "Luxe Minimal",
    preview: "Clássico e refinado — minimalismo com personalidade",
  },
}

export type TemplateId = "template-1" | "template-2" | "template-3" | "template-4" | "carousel"

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  "template-1": "Editorial Luxo — Dark bg, grid, amber accent",
  "template-2": "Bold/Zine — Cream bg, geométrico, vermelho",
  "template-3": "Tech/Cyber — Dark, scanlines, lime green",
  "template-4": "Luxe Minimal — White, coral block, serifas",
  "carousel": "Carrossel — 7 slides 4:5, progress bar",
}

// ── Color derivation ──────────────────────────────────────
export function derivePalette(primary: string): {
  primary: string
  light: string
  dark: string
  lightBg: string
  darkBg: string
  border: string
  gradient: string
} {
  // Simple lighten/darken via hex math
  const light = lightenHex(primary, 20)
  const dark = darkenHex(primary, 30)

  // Warm vs cool detection (simple)
  const r = parseInt(primary.slice(1, 3), 16)
  const g = parseInt(primary.slice(3, 5), 16)
  const b = parseInt(primary.slice(5, 7), 16)
  const isWarm = r > b + 30

  return {
    primary,
    light,
    dark,
    lightBg: isWarm ? "#FAF7F4" : "#F4F6FA",
    darkBg: isWarm ? "#1A1918" : "#0F172A",
    border: isWarm ? "#E8E2DB" : "#E2E6EE",
    gradient: `linear-gradient(165deg, ${dark}, ${primary}, ${light})`,
  }
}

function lightenHex(hex: string, percent: number): string {
  return adjustHex(hex, percent)
}

function darkenHex(hex: string, percent: number): string {
  return adjustHex(hex, -percent)
}

function adjustHex(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) + Math.round(2.55 * percent)))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + Math.round(2.55 * percent)))
  const b = Math.min(255, Math.max(0, (num & 0xFF) + Math.round(2.55 * percent)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}

// ── Template placeholder replacement ──────────────────────
export function applyBrandToTemplate(html: string, brand: BrandIdentity): string {
  const palette = derivePalette(brand.colors[0])
  const fonts = FONT_PAIRS[brand.fontStyle]
  const secondary = brand.colors[1] || palette.light

  return html
    // Brand identity
    .replace(/\{brand_name\}/g, brand.name)
    .replace(/\{brand_handle\}/g, brand.handle)
    .replace(/\{brand_primary\}/g, palette.primary)
    .replace(/\{brand_secondary\}/g, secondary)
    .replace(/\{brand_light\}/g, palette.light)
    .replace(/\{brand_dark\}/g, palette.dark)
    .replace(/\{brand_lightBg\}/g, palette.lightBg)
    .replace(/\{brand_darkBg\}/g, palette.darkBg)
    .replace(/\{brand_border\}/g, palette.border)
    .replace(/\{brand_gradient\}/g, palette.gradient)
    // Logo
    .replace(/\{brand_logo\}/g, brand.logoBase64 || "")
    .replace(/\{brand_initial\}/g, brand.name.charAt(0).toUpperCase())
    // Fonts
    .replace(/\{google_fonts_url\}/g, fonts.googleFontsUrl)
    .replace(/\{heading_font\}/g, fonts.heading)
    .replace(/\{body_font\}/g, fonts.body)
}

// ── Default brand (used before user sets branding) ────────
export const DEFAULT_BRAND: BrandIdentity = {
  name: "Sua Marca",
  handle: "@suamarca",
  colors: ["#6366F1", "#A5B4FC"],
  logoBase64: null,
  fontStyle: "editorial",
}
