import { NextRequest, NextResponse } from "next/server"
import { buildCarouselProps, generateImage } from "@/lib/images/generator"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const brand = searchParams.get("brand") || "default"
    const title = searchParams.get("title") || "AgencyOS"
    const subtitle = searchParams.get("subtitle") || ""
    const format = (searchParams.get("format") as any) || "og_image"

    const { generateBrandedImage } = await import("@/lib/images/generator")
    const response = await generateBrandedImage({ brand, title, subtitle, format })
    return response
  } catch (error) {
    console.error("[ImageGen Error]", error)
    return new Response("Image generation failed", { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, brand, theme, slides: slideCount } = body

    // Build carousel slides from theme
    const DEFAULT_SLIDES = [
      { number: 1, type: "hero" as const, hook: theme || "Post do Dia", background: "gradient" as const },
      { number: 2, type: "problem" as const, title: theme || "Tema", content: "Descubra o que esta por tras.", background: "dark" as const },
      { number: 3, type: "solution" as const, title: "A Solucao", content: "Veja como resolver de forma simples.", background: "light" as const },
      { number: 4, type: "feature" as const, title: "Beneficios", content: "Resultados comprovados.", background: "dark" as const },
      { number: 5, type: "cta" as const, content: "Siga para mais dicas!", background: "gradient" as const },
    ]

    const slides = DEFAULT_SLIDES.slice(0, Math.min(slideCount || 5, 7))

    const carouselProps = buildCarouselProps({
      brand: brand || "default",
      theme: theme || "AgencyOS",
      slides,
    })

    return NextResponse.json({
      success: true,
      totalSlides: carouselProps.length,
      theme,
      brand: brand || "default",
      format: "instagram_carousel",
      message: `Carrossel gerado: ${carouselProps.length} slides prontos para renderizacao.`,
    })
  } catch (error) {
    console.error("[Carousel Error]", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
