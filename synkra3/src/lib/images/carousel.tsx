import { ImageResponse } from "next/og"

type SlideData = {
  number: number
  total: number
  title: string
  subtitle?: string
  type: "hero" | "content" | "cta"
  bg: "gradient" | "dark" | "light"
}

type BrandColors = { primary: string; secondary: string; name: string }

// ── Brand registry ───────────────────────────────────────
const BRANDS: Record<string, BrandColors> = {
  fitlife: { primary: "#FF6B35", secondary: "#FF8E53", name: "FitLife Academia" },
  default: { primary: "#6366F1", secondary: "#A5B4FC", name: "Agencia" },
}

// ── Instagram Carousel Template ──────────────────────────
function InstagramSlide({ slide, brand }: { slide: SlideData; brand: BrandColors }) {
  const { primary, secondary } = brand
  const isGradient = slide.bg === "gradient"
  const isDark = slide.bg === "dark"
  const progress = Math.round((slide.number / slide.total) * 100)

  // Background
  const bgStyle = isGradient
    ? { background: `linear-gradient(135deg, ${primary}, ${secondary})` }
    : isDark
    ? { background: "#111118" }
    : { background: "#FAFAF9" }

  // Text colors
  const textColor = isGradient || isDark ? "#FFFFFF" : "#111118"
  const mutedColor = isGradient || isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)"
  const tagBg = isGradient || isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)"

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: slide.type === "hero" || slide.type === "cta" ? "center" : "flex-end",
        alignItems: "center",
        padding: "80px 60px",
        position: "relative",
        fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif",
        ...bgStyle,
      }}
    >
      {/* Progress bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 4, display: "flex",
        background: isDark || isGradient ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
      }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          background: isGradient ? "rgba(255,255,255,0.3)" : primary,
          borderRadius: "0 2px 2px 0",
        }} />
      </div>

      {/* Slide counter */}
      <div style={{
        position: "absolute", bottom: 24, right: 40, display: "flex", alignItems: "center",
        fontSize: 16, color: mutedColor,
      }}>
        <span>{slide.number}/{slide.total}</span>
        {slide.number < slide.total && (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={mutedColor} strokeWidth="2" style={{ marginLeft: 8 }}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
      </div>

      {/* Slide counter */}
      <div style={{
        position: "absolute", bottom: 24, right: 40,
        fontSize: 16, color: mutedColor,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span>{slide.number}/{slide.total}</span>
        {slide.number < slide.total && (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={mutedColor} strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
      </div>

      {/* Type badge */}
      {slide.type !== "hero" && (
        <div style={{
          display: "flex", gap: 8, marginBottom: 32,
        }}>
          <span style={{
            padding: "6px 16px", borderRadius: 20, fontSize: 14,
            background: tagBg, color: textColor, fontWeight: 500,
          }}>
            {slide.type === "cta" ? "CTA" : `Slide ${slide.number}`}
          </span>
        </div>
      )}

      {/* Main title */}
      <h1 style={{
        fontSize: slide.type === "hero" ? 72 : 56,
        fontWeight: 800,
        color: textColor,
        textAlign: "center",
        lineHeight: 1.15,
        maxWidth: "85%",
        letterSpacing: "-0.02em",
        marginBottom: slide.subtitle ? 24 : 0,
      }}>
        {slide.title}
      </h1>

      {/* Subtitle */}
      {slide.subtitle && (
        <p style={{
          fontSize: 28,
          color: mutedColor,
          textAlign: "center",
          maxWidth: "75%",
          lineHeight: 1.4,
          fontWeight: 400,
        }}>
          {slide.subtitle}
        </p>
      )}

      {/* Brand at top */}
      <div style={{
        position: "absolute", top: 40, left: 60,
        fontSize: 18, color: mutedColor, fontWeight: 500,
        letterSpacing: "0.05em",
      }}>
        {brand.name}
      </div>

      {/* CTA button for last slide */}
      {slide.type === "cta" && (
        <div style={{
          marginTop: 48,
          padding: "18px 48px",
          borderRadius: 40,
          background: isGradient ? "rgba(255,255,255,0.2)" : primary,
          color: "#FFFFFF",
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}>
          Seguir {brand.name}
        </div>
      )}
    </div>
  )
}

// ── Public API ───────────────────────────────────────────
export type ImageFormat = "instagram_carousel" | "instagram_feed" | "instagram_story"

const SIZE: Record<ImageFormat, { w: number; h: number }> = {
  instagram_carousel: { w: 1080, h: 1350 },
  instagram_feed: { w: 1080, h: 1080 },
  instagram_story: { w: 1080, h: 1920 },
}

export function generateCarouselImage(slides: SlideData[], brand: string, format: ImageFormat = "instagram_carousel"): Response {
  const { w, h } = SIZE[format]
  const colors = BRANDS[brand] || BRANDS.default

  return new ImageResponse(
    InstagramSlide({ slide: slides[0], brand: colors }),
    { width: w, height: h }
  )
}

export function generateSingleSlide(slide: SlideData, brand: string, format: ImageFormat = "instagram_carousel"): Response {
  const { w, h } = SIZE[format]
  const colors = BRANDS[brand] || BRANDS.default

  return new ImageResponse(
    InstagramSlide({ slide, brand: colors }),
    { width: w, height: h }
  )
}

export { BRANDS, InstagramSlide }
