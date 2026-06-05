// ── Brand Identity ──────────────────────────────────────
export interface BrandIdentity {
  name: string
  handle: string
  primaryColor: string
  secondaryColor: string
  fontFamily: string
  fontStyle: FontStyle
  colors: string[]
  logo: string
  logoBase64: string | null
  tone: string
}

export type TemplateId = "instagram_carousel" | "instagram_feed" | "instagram_story" | "default" | "template-1" | "template-2" | "template-3" | "template-4"

export type FontStyle = "modern" | "classic" | "minimal" | "bold" | "luxe"

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  instagram_carousel: "Carrossel Instagram",
  instagram_feed: "Feed Instagram",
  instagram_story: "Story Instagram",
  default: "Padrão",
  "template-1": "Editorial",
  "template-2": "Bold Zine",
  "template-3": "Tech Cyber",
  "template-4": "Luxe Minimal",
}

export const DEFAULT_BRAND: BrandIdentity = {
  name: "Default",
  handle: "@default",
  primaryColor: "#6366F1",
  secondaryColor: "#18181B",
  fontFamily: "Inter",
  fontStyle: "modern",
  colors: ["#6366F1", "#18181B", "#FAFAFA"],
  logo: "",
  logoBase64: null,
  tone: "professional",
}

// ── Font Pairs ──────────────────────────────────────────
export const FONT_PAIRS: Record<FontStyle, { label: string; preview: string; heading: string; body: string; googleFontsUrl: string }> = {
  modern: { label: "Moderna", preview: "Inter 400/600/700", heading: "Inter", body: "Inter", googleFontsUrl: "fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" },
  classic: { label: "Clássica", preview: "Playfair Display + Lato", heading: "Playfair Display", body: "Lato", googleFontsUrl: "fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Lato:wght@400;700&display=swap" },
  minimal: { label: "Minimalista", preview: "DM Sans 400/500/700", heading: "DM Sans", body: "DM Sans", googleFontsUrl: "fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" },
  bold: { label: "Impactante", preview: "Montserrat + Open Sans", heading: "Montserrat", body: "Open Sans", googleFontsUrl: "fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Open+Sans:wght@400;600&display=swap" },
  luxe: { label: "Luxo", preview: "Cormorant Garamond + Inter", heading: "Cormorant Garamond", body: "Inter", googleFontsUrl: "fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Inter:wght@400;500&display=swap" },
}

// ── Derive Palette ──────────────────────────────────────
export function derivePalette(primaryColor: string): Record<string, string> {
  return {
    primary: primaryColor,
    secondary: "#18181B",
    light: "#FAFAFA",
    dark: "#09090B",
    accent: primaryColor + "80",
  }
}

// ── Load Brand From DB ──────────────────────────────────
export async function loadBrandFromDb(orgId: string): Promise<BrandIdentity | null> {
  try {
    const { prisma } = await import("@/lib/prisma")
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    })
    if (!org) return null
    return {
      name: org.name,
      handle: "@" + org.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
      primaryColor: "#6366F1",
      secondaryColor: "#18181B",
      fontFamily: "Inter",
      fontStyle: "modern",
      colors: ["#6366F1", "#18181B", "#FAFAFA"],
      logo: "",
      logoBase64: null,
      tone: "professional",
    }
  } catch {
    return null
  }
}

// ── Apply Brand To Template ─────────────────────────────
export function applyBrandToTemplate(templateHtml: string, brand: BrandIdentity): string {
  const palette = derivePalette(brand.colors[0])
  const fonts = FONT_PAIRS[brand.fontStyle]
  return templateHtml
    .replace(/{{primary}}/g, palette.primary)
    .replace(/{{secondary}}/g, palette.secondary)
    .replace(/{{headingFont}}/g, fonts.heading)
    .replace(/{{bodyFont}}/g, fonts.body)
    .replace(/{{brandName}}/g, brand.name)
    .replace(/{{brandHandle}}/g, brand.handle)
}
