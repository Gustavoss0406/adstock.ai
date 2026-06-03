import { NextRequest } from "next/server"
import { InstagramSlide, BRANDS } from "@/lib/images/carousel"
import type { ImageFormat } from "@/lib/images/carousel"
import { ImageResponse } from "next/og"

const SIZE: Record<ImageFormat, { w: number; h: number }> = {
  instagram_carousel: { w: 1080, h: 1350 },
  instagram_feed: { w: 1080, h: 1080 },
  instagram_story: { w: 1080, h: 1920 },
}

const SLIDES = {
  "treino": [
    { type: "hero", bg: "gradient", title: "5 Mitos Sobre\nTreino de Perna", subtitle: "O que realmente funciona" },
    { type: "content", bg: "dark", title: "Mito #1", subtitle: "Agachar pesado todo dia constrói mais músculo" },
    { type: "content", bg: "light", title: "Verdade", subtitle: "Descanso e variação são tão importantes quanto intensidade" },
    { type: "content", bg: "dark", title: "Mito #2", subtitle: "Precisa de suplemento pra ter resultado" },
    { type: "content", bg: "light", title: "Verdade", subtitle: "Alimentação balanceada > qualquer suplemento" },
    { type: "content", bg: "dark", title: "Mito #3", subtitle: "Cardio atrapalha o ganho de massa" },
    { type: "cta", bg: "gradient", title: "Gostou?", subtitle: "Salva esse carrossel e compartilha com quem treina" },
  ],
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const brand = searchParams.get("brand") || "fitlife"
  const theme = searchParams.get("theme") || "treino"
  const slide = parseInt(searchParams.get("slide") || "1")
  const format = (searchParams.get("format") || "instagram_carousel") as ImageFormat

  const slides = SLIDES[theme] || SLIDES.treino
  const s = slides[Math.min(slide - 1, slides.length - 1)]
  const colors = BRANDS[brand] || BRANDS.default
  const { w, h } = SIZE[format]

  return new ImageResponse(
    InstagramSlide({
      slide: {
        number: slide, total: slides.length,
        title: s.title, subtitle: s.subtitle,
        type: s.type, bg: s.bg,
      },
      brand: colors,
    }),
    { width: w, height: h }
  )
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const brand = body.brand || "fitlife"
  const theme = body.theme || "treino"

  const slides = SLIDES[theme] || SLIDES.treino
  return Response.json({
    success: true,
    totalSlides: slides.length,
    theme,
    brand,
    format: "instagram_carousel",
    slides: slides.map((s, i) => ({
      number: i + 1, type: s.type, bg: s.bg, title: s.title, subtitle: s.subtitle,
      url: `/api/images/generate?brand=${brand}&theme=${theme}&slide=${i + 1}`,
    })),
  })
}
