import { NextRequest, NextResponse } from "next/server"
import { loadAndApplyTemplate, loadBrandFromDb, DEFAULT_BRAND, derivePalette, FONT_PAIRS, type BrandIdentity, type TemplateId } from "@/lib/images/template-engine"

// ── Generate carousel HTML (7 slides, 4:5, with progress bar) ──
function generateCarouselHtml(brand: BrandIdentity, slides: Array<{ title: string; subtitle: string; type: string }>): string {
  const palette = derivePalette(brand.colors[0])
  const secondary = brand.colors[1] || palette.light
  const fonts = FONT_PAIRS[brand.fontStyle]
  const total = slides.length

  const slidesHtml = slides.map((s, i) => {
    const isLight = i % 2 === 0
    const bgColor = i === 0 || i === total - 1
      ? palette.darkBg
      : isLight ? palette.lightBg : palette.darkBg
    const textColor = i === 0 || i === total - 1 || !isLight ? "#fff" : "#111"
    const mutedColor = i === 0 || i === total - 1 || !isLight ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)"
    const progress = Math.round(((i + 1) / total) * 100)
    const isLast = i === total - 1

    return `
    <div style="width:420px;height:525px;flex-shrink:0;position:relative;display:flex;flex-direction:column;justify-content:${i===0||isLast?'center':'flex-end'};align-items:center;padding:36px 28px 52px;background:${bgColor};font-family:'${fonts.body}',sans-serif;">
      <div style="position:absolute;top:16px;left:28px;font-size:11px;font-weight:500;color:${mutedColor};letter-spacing:0.05em;">${brand.name}</div>
      <h2 style="font-family:'${fonts.heading}',${fonts.heading.includes('Cormorant')||fonts.heading.includes('Playfair')?'serif':'sans-serif'};font-size:${i===0?32:24}px;font-weight:${i===0?800:700};color:${textColor};text-align:center;line-height:1.15;max-width:90%;letter-spacing:-0.02em;margin-bottom:${s.subtitle?'16px':'0'};">${s.title}</h2>
      ${s.subtitle ? `<p style="font-size:14px;color:${mutedColor};text-align:center;max-width:85%;line-height:1.4;">${s.subtitle}</p>` : ""}
      ${isLast ? `<div style="margin-top:24px;padding:12px 32px;border-radius:24px;background:${brand.colors[0]};color:#fff;font-size:14px;font-weight:700;">Seguir ${brand.name}</div>` : ""}
      <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:${isLight?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.1)'};"><div style="height:100%;width:${progress}%;background:${brand.colors[0]};border-radius:0 2px 2px 0;"></div></div>
      <div style="position:absolute;bottom:12px;right:20px;font-size:10px;color:${mutedColor};">${i+1}/${total}${!isLast?' →':''}</div>
    </div>`
  }).join("")

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://${fonts.googleFontsUrl}" rel="stylesheet"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    .ig-frame{width:420px;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,0.15)}
    .ig-header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#fff}
    .ig-avatar{width:36px;height:36px;border-radius:50%;background:${brand.colors[0]};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px}
    .ig-handle{font-size:13px;font-weight:600;color:#111;font-family:Inter,sans-serif}
    .ig-sub{font-size:11px;color:#888}
    .carousel-viewport{width:420px;height:525px;overflow:hidden;position:relative}
    .carousel-track{display:flex;transition:transform 0.3s ease;width:${total*420}px}
    .ig-dots{display:flex;justify-content:center;gap:6px;padding:10px 0}
    .ig-dot{width:6px;height:6px;border-radius:50%;background:#ccc}
    .ig-dot.active{background:${brand.colors[0]}}
    .ig-actions{display:flex;justify-content:space-between;padding:8px 16px}
    .ig-actions svg{width:22px;height:22px;color:#111}
    .ig-caption{padding:8px 16px 12px;font-family:Inter,sans-serif;font-size:13px;color:#111}
  </style></head><body style="display:flex;justify-content:center;padding:20px;background:#f0f0f0">
  <div class="ig-frame">
    <div class="ig-header"><div class="ig-avatar">${brand.name.charAt(0)}</div><div><div class="ig-handle">${brand.handle}</div><div class="ig-sub">Patrocinado</div></div></div>
    <div class="carousel-viewport"><div class="carousel-track">${slidesHtml}</div></div>
    <div class="ig-dots">${slides.map((_,i)=>`<div class="ig-dot${i===0?' active':''}"></div>`).join("")}</div>
    <div class="ig-actions">
      <div style="display:flex;gap:12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 21 12 17 5 21 5 3 12 3 19 3 19 21"/></svg>
    </div>
    <div class="ig-caption"><strong>${brand.handle}</strong> ${slides[0]?.title || ""}</div>
  </div>
  <script>
    let current=0,total=${total};const track=document.querySelector('.carousel-track'),dots=document.querySelectorAll('.ig-dot');
    track.addEventListener('click',()=>{current=(current+1)%total;track.style.transform='translateX(-'+current*420+'px)';dots.forEach((d,i)=>d.classList.toggle('active',i===current))});
    let startX=0;track.addEventListener('touchstart',e=>{startX=e.touches[0].clientX});
    track.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-startX;if(dx<-50&&current<total-1)current++;else if(dx>50&&current>0)current--;track.style.transform='translateX(-'+current*420+'px)';dots.forEach((d,i)=>d.classList.toggle('active',i===current))});
  </script></body></html>`
}

// ── API Routes ────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get("orgId")
  const templateId = (searchParams.get("template") || "template-4") as TemplateId
  const format = searchParams.get("format") || "html"

  const brand = orgId ? await loadBrandFromDb(orgId) : { ...DEFAULT_BRAND }
  if (searchParams.get("color")) brand.colors[0] = searchParams.get("color")!

  if (templateId === "carousel" as any) {
    const title = searchParams.get("title") || brand.name
    const slides = [
      { title, subtitle: "Descubra mais nos slides a seguir", type: "hero" },
      { title: "O Problema", subtitle: "O que esta impedindo seu crescimento", type: "content" },
      { title: "A Solucao", subtitle: "Como resolvemos isso de forma simples", type: "content" },
      { title: "Os Beneficios", subtitle: "Resultados reais para o seu negocio", type: "content" },
      { title: "Pronto para comecar?", subtitle: `Siga ${brand.handle} para mais conteudos`, type: "cta" },
    ]
    const html = generateCarouselHtml(brand, slides)
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
  }

  const html = loadAndApplyTemplate(templateId, brand)
  if (!html) return NextResponse.json({ error: "Template not found" }, { status: 404 })

  // Return HTML for preview, JSON for metadata
  if (format === "json") {
    return NextResponse.json({
      success: true,
      template: templateId,
      brand: { name: brand.name, colors: brand.colors, fontStyle: brand.fontStyle },
      htmlLength: html.length,
    })
  }

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { organizationId } = body

  const brand = organizationId ? await loadBrandFromDb(organizationId) : { ...DEFAULT_BRAND }

  return NextResponse.json({
    success: true,
    brand: { name: brand.name, colors: brand.colors, fontStyle: brand.fontStyle },
    templates: ["template-1", "template-2", "template-3", "template-4", "carousel"],
    message: "Use GET /api/images/render?template=X&orgId=Y para preview HTML.",
  })
}
