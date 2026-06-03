/**
 * ── AgencyOS Image Generator (ohimg adapter) ─────────────────
 *
 * Usa ohimg + Satori para gerar imagens reais:
 * - Instagram carrosséis (1080×1350, 4:5)
 * - Open Graph / thumbnails (1200×630)
 * - Stories (1080×1920, 9:16)
 *
 * Zero dependências externas — Satori + Resvg são nativos do Next.js.
 */

import { ImageResponse } from "next/og"
import { OhImgBaseTemplate, type OhImgBaseTemplateProps } from "./ohimg/template"

// ── Image presets ─────────────────────────────────────────
export type ImageFormat = "instagram_carousel" | "instagram_story" | "og_image" | "instagram_feed"

const DIMENSIONS: Record<ImageFormat, { width: number; height: number }> = {
  instagram_carousel: { width: 1080, height: 1350 }, // 4:5
  instagram_story: { width: 1080, height: 1920 },     // 9:16
  og_image: { width: 1200, height: 630 },              // 1.91:1
  instagram_feed: { width: 1080, height: 1080 },       // 1:1
}

// ── Brand presets ─────────────────────────────────────────
export interface BrandPreset {
  name: string
  primaryColor: string
  secondaryColor: string
  fontFamily?: string
  gradientDirection?: string
  patternType?: "dots" | "grid" | "none"
}

export const BRAND_PRESETS: Record<string, BrandPreset> = {
  fitlife: {
    name: "FitLife Academia",
    primaryColor: "#FF6B35",
    secondaryColor: "#FF8E53",
    gradientDirection: "to bottom right",
    patternType: "dots",
  },
  default: {
    name: "Agencia",
    primaryColor: "#6366F1",
    secondaryColor: "#A5B4FC",
    gradientDirection: "to bottom",
    patternType: "grid",
  },
}

// ── Carousel slide generator ──────────────────────────────
export interface CarouselSlide {
  number: number
  type: "hero" | "problem" | "solution" | "feature" | "cta"
  title?: string
  content?: string
  hook?: string
  background?: "light" | "dark" | "gradient"
}

export interface CarouselRequest {
  brand: string
  theme: string
  slides: CarouselSlide[]
  format?: ImageFormat
}

export function buildCarouselProps(
  request: CarouselRequest,
): OhImgBaseTemplateProps[] {
  const brand = BRAND_PRESETS[request.brand] || BRAND_PRESETS.default
  const format = request.format || "instagram_carousel"

  return request.slides.map((slide, idx) => {
    const isDark = slide.background === "dark"
    const isGradient = slide.background === "gradient"
    const totalSlides = request.slides.length
    const progress = Math.round(((idx + 1) / totalSlides) * 100)
    const isLast = idx === totalSlides - 1

    const props: OhImgBaseTemplateProps = {
      content: {
        title: slide.hook || slide.title || "",
        subTitle: slide.type === "cta"
          ? `Siga @${brand.name.toLowerCase().replace(/\s/g, "")}`
          : slide.content?.slice(0, 120) || "",
        tags: [`Slide ${idx + 1}/${totalSlides}`, isLast ? "CTA" : "→ swipe"],
        website: brand.name,
      },
      gradient: {
        startColor: brand.primaryColor,
        endColor: brand.secondaryColor,
        opacity: isGradient ? 0.95 : 0.85,
        direction: brand.gradientDirection as any,
      },
      pattern: brand.patternType && brand.patternType !== "none"
        ? {
            type: brand.patternType,
            color: isDark ? "#fff" : brand.secondaryColor,
            opacity: isDark ? 0.08 : 0.12,
            size: 4,
          }
        : undefined,
      layout: {
        title: isDark
          ? "text-5xl font-bold text-white leading-tight"
          : "text-5xl font-bold text-gray-900 leading-tight",
        subTitle: isDark
          ? "text-2xl text-gray-300 leading-relaxed"
          : "text-2xl text-gray-600 leading-relaxed",
        tag: isDark
          ? "text-sm text-gray-400 bg-white/10 rounded-full px-4 py-1"
          : "text-sm text-gray-500 bg-black/5 rounded-full px-4 py-1",
        website: isDark
          ? "text-sm text-gray-400"
          : "text-sm text-gray-500",
      },
    }

    return props
  })
}

// ── Generate a single image ───────────────────────────────
export async function generateImage(
  props: OhImgBaseTemplateProps,
  format: ImageFormat = "og_image",
): Promise<Response> {
  const { width, height } = DIMENSIONS[format]

  return new ImageResponse(OhImgBaseTemplate(props), {
    width,
    height,
  })
}

// ── Generate an Instagram carousel (returns all slides) ──
export async function generateCarousel(request: CarouselRequest): Promise<Response[]> {
  const slides = buildCarouselProps(request)
  const format = request.format || "instagram_carousel"

  return Promise.all(
    slides.map(slide => generateImage(slide, format))
  )
}

// ── Generate a simple branded image (quick single image) ──
export async function generateBrandedImage(opts: {
  brand?: string
  title: string
  subtitle?: string
  format?: ImageFormat
}): Promise<Response> {
  const brand = BRAND_PRESETS[opts.brand || "default"]

  const props: OhImgBaseTemplateProps = {
    content: {
      title: opts.title,
      subTitle: opts.subtitle || "",
      website: brand.name,
    },
    gradient: {
      startColor: brand.primaryColor,
      endColor: brand.secondaryColor,
      opacity: 0.9,
      direction: brand.gradientDirection as any,
    },
    pattern: {
      type: brand.patternType || "dots",
      color: "#ffffff",
      opacity: 0.1,
      size: 4,
    },
  }

  return generateImage(props, opts.format || "og_image")
}
