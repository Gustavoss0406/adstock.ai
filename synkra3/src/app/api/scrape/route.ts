import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL required" }, { status: 400 })
    }

    const normalized = url.startsWith("http") ? url : `https://${url}`
    const response = await fetch(normalized, {
      headers: { "User-Agent": "AdstockBot/1.0" },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Site could not be reached" }, { status: 502 })
    }

    const html = await response.text()

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i)
      || html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"/i)

    return NextResponse.json({
      title: titleMatch?.[1]?.trim() || null,
      description: descMatch?.[1]?.trim() || null,
      url: normalized,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch site" }, { status: 500 })
  }
}
