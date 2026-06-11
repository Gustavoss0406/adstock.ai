import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { generateBackgroundImage } from '@/lib/ai/vertex-ai'

const W = 1080
const H = 1450

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function wrap(s: string, maxChars: number): string[] {
  const words = s.split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const test = current ? current + ' ' + w : w
    if (test.length > maxChars && current) { lines.push(current); current = w }
    else current = test
  }
  if (current) lines.push(current)
  return lines
}

function pickHighlightWords(title: string, count: number = 2): string[] {
  const words = title.replace(/[.,!?;:]/g, '').split(/\s+/)
  const stopWords = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'em', 'no', 'na', 'nos', 'nas', 'para', 'com', 'um', 'uma', 'que', 'se', 'por', 'ao', 'à'])
  const candidates = words.filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()))
  const picked: string[] = []
  for (const w of candidates) {
    if (picked.length >= count) break
    if (!picked.some(p => p.toLowerCase() === w.toLowerCase())) picked.push(w)
  }
  return picked
}

function buildSVGOverlay(title: string, subtitle: string, kicker: string, cta: string, url: string, accentColor: string): string {
  const titleLines = wrap(title, 16).slice(0, 2)
  const subtitleLines = wrap(subtitle, 42).slice(0, 2)
  const highlights = pickHighlightWords(title, 2)

  function colorizeTitle(line: string): string {
    let result = esc(line)
    for (const hw of highlights) {
      const regex = new RegExp(`\\b(${hw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi')
      result = result.replace(regex, `<tspan fill="${accentColor}">$1</tspan>`)
    }
    return result
  }

  const uY = H - 95
  const cY = uY - 108
  const sY = cY - 104
  const tY = sY - 141
  const kY = tY - 130

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="black" stop-opacity="0"/>
    <stop offset="22%" stop-color="black" stop-opacity="0.20"/>
    <stop offset="40%" stop-color="black" stop-opacity="0.55"/>
    <stop offset="65%" stop-color="black" stop-opacity="1"/>
    <stop offset="100%" stop-color="black" stop-opacity="1"/>
  </linearGradient>
  <filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="black" flood-opacity="0.4"/></filter>
  <filter id="ctaGlow"><feDropShadow dx="0" dy="10" stdDeviation="20" flood-color="black" flood-opacity="0.25"/></filter>
</defs>
<rect x="0" y="0" width="${W}" height="${H}" fill="url(#fade)"/>
<rect x="${(W - 240) / 2}" y="${kY}" width="240" height="44" rx="22" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
<text x="${W / 2}" y="${kY + 30}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="22" font-weight="600" fill="rgba(255,255,255,0.92)" letter-spacing="2">${esc(kicker.toUpperCase())}</text>
${titleLines.map((line, i) => `<text x="${W / 2}" y="${tY + i * 83}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="76" font-weight="800" fill="white" letter-spacing="-2" filter="url(#shadow)">${colorizeTitle(line)}</text>`).join('\n')}
${subtitleLines.map((line, i) => `<text x="${W / 2}" y="${sY + i * 50}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="34" font-weight="400" fill="rgba(255,255,255,0.88)" letter-spacing="0">${esc(line)}</text>`).join('\n')}
<rect x="${(W - 340) / 2}" y="${cY}" width="340" height="64" rx="32" fill="white" filter="url(#ctaGlow)"/>
<text x="${W / 2 + 115}" y="${cY + 42}" text-anchor="end" font-family="Inter, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#111">${esc(cta)}</text>
<circle cx="${W / 2 + 145}" cy="${cY + 32}" r="17" fill="${accentColor}"/>
<text x="${W / 2 + 145}" y="${cY + 39}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="18" font-weight="700" fill="white">→</text>
<text x="${W / 2}" y="${uY}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="20" font-weight="400" fill="rgba(255,255,255,0.55)" letter-spacing="1">${esc(url.toUpperCase())}</text>
</svg>`
}

function toDataUrl(buffer: Buffer): string {
  return 'data:image/png;base64,' + buffer.toString('base64')
}

export async function generateInstagramPostPNG(
  taskId: string, title: string, content: string,
  brandName: string, handle: string = 'adstock',
  brandColors?: { primary: string; secondary: string },
  industry?: string, audience?: string
): Promise<{ dataUrl: string; fileSize: number }> {
  const cleanTitle = title.replace(/^(Post Instagram|Instagram Post|Criar post|Criar arte)[:]\s*/i, '').trim()
  const accent = brandColors?.primary || '#6366F1'
  const kickerWords = cleanTitle.split(/\s+/).slice(0, 2).join(' ')
  const kicker = kickerWords.length > 3 ? kickerWords : (industry || 'Destaque').substring(0, 18)
  const cta = 'Ver Agora'

  const bg = await generateBackgroundImage(cleanTitle, content.substring(0, 300), industry || 'Moda', audience || 'Público geral', brandColors)

  const subtitle = content.length > 120 ? content.substring(0, 110) + '...' : content
  const url = (handle || 'adstock.ai').replace('@', '')
  const svg = buildSVGOverlay(cleanTitle, subtitle, kicker, cta, url, accent)

  const composite = await sharp(bg).resize(W, H, { fit: 'cover', position: 'center' })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png({ quality: 60, compressionLevel: 9 }).toBuffer()

  return { dataUrl: toDataUrl(composite), fileSize: composite.length }
}

export async function generateCarouselPNGs(
  taskId: string, title: string, slides: Array<{ number: number; type: string; content: string }>,
  brandName: string, handle: string = 'adstock',
  brandColors?: { primary: string; secondary: string },
  industry?: string, audience?: string
): Promise<Array<{ dataUrl: string; fileSize: number }>> {
  const results: Array<{ dataUrl: string; fileSize: number }> = []
  const accent = brandColors?.primary || '#6366F1'

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const slideTitle = slide.type === 'Hero' ? title : slide.type
    const isHero = i === 0
    const kicker = isHero ? (industry || 'Destaque').substring(0, 18) : `Slide ${slide.number}/${slides.length}`
    const cta = isHero ? 'Ver Agora' : 'Próximo →'

    const bg = await generateBackgroundImage(slideTitle, slide.content.substring(0, 300), industry || 'Moda', audience || 'Público geral', brandColors)
    const sub = slide.content.length > 120 ? slide.content.substring(0, 110) + '...' : slide.content
    const svg = buildSVGOverlay(slideTitle, sub, kicker, cta, handle.replace('@', ''), accent)
    const composite = await sharp(bg).resize(W, H, { fit: 'cover', position: 'center' })
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer()
    results.push({ dataUrl: toDataUrl(composite), fileSize: composite.length })
  }
  return results
}
