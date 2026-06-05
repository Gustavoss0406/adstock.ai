import type { CSSProperties, ReactElement } from "react"

export type ImageFormat = "instagram_carousel" | "instagram_feed" | "instagram_story"

type SlideProps = {
  slide: {
    number: number
    total: number
    title: string
    subtitle?: string
    type: string
    bg: string
  }
  brand: Record<string, string>
}

export const BRANDS: Record<string, Record<string, string>> = {
  default: { primary: "#6366F1", light: "#F5F5F5", dark: "#18181B" },
  fitlife: { primary: "#10B981", light: "#F0FDF4", dark: "#0F172A" },
  texarte: { primary: "#6366F1", light: "#FAFAFA", dark: "#09090B" },
  benner: { primary: "#3B82F6", light: "#EFF6FF", dark: "#0F172A" },
}

export function InstagramSlide({ slide, brand }: SlideProps): ReactElement {
  const fg = brand.primary || "#6366F1"
  const bg = slide.bg === "dark" ? (brand.dark || "#18181B") : slide.bg === "light" ? (brand.light || "#F5F5F5") : fg

  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: slide.bg === "gradient"
          ? `linear-gradient(135deg, ${fg}, ${fg}88)`
          : bg,
        color: slide.bg === "light" ? (brand.dark || "#18181B") : "#FFFFFF",
        fontFamily: "Inter",
        padding: "60px",
        textAlign: "center",
      } as CSSProperties,
      children: [
        {
          type: "div",
          props: {
            style: { fontSize: "36px", fontWeight: 700, marginBottom: "12px", lineHeight: 1.2 } as CSSProperties,
            children: slide.title,
          },
        },
        slide.subtitle ? {
          type: "div",
          props: {
            style: { fontSize: "18px", opacity: 0.7 } as CSSProperties,
            children: slide.subtitle,
          },
        } : null,
        {
          type: "div",
          props: {
            style: { position: "absolute", bottom: "30px", fontSize: "12px", opacity: 0.4 } as CSSProperties,
            children: `${slide.number}/${slide.total}`,
          },
        },
      ].filter(Boolean),
    },
  } as unknown as ReactElement
}
