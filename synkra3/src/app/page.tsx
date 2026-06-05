"use client"

import Link from "next/link"
import Image from "next/image"
import { useRef, useState } from "react"
import { motion, useInView } from "framer-motion"
import { Rocket, ChevronRight, Check, ArrowUpRight, Download } from "lucide-react"

/* ─── Agent data ─── */
const AGENTS = [
  { name: "Maya", role: "Diretora de Conteudo", photo: "/characters/Maya.png" },
  { name: "Bruno", role: "Social Media", photo: "/characters/Bruno.png" },
  { name: "Lena", role: "Analista de Metricas", photo: "/characters/Lena.png" },
  { name: "Carlos", role: "Designer", photo: "/characters/Carlos.png" },
  { name: "Diego", role: "Especialista em SEO", photo: "/characters/Diego.png" },
]

/* ─── Integrations ─── */
const INTEGRATIONS = [
  { name: "Instagram", desc: "Crie e agende posts, stories e reels com legendas otimizadas por IA.", gradient: "linear-gradient(127deg, rgba(32,35,91,0.7) 22%, rgba(7,9,33,0.7) 82%)", color: "#E1306C" },
  { name: "LinkedIn", desc: "Posts profissionais e artigos de autoridade com IA de growth B2B.", gradient: "radial-gradient(ellipse 94% 78% at 50% 30%, rgba(0,119,181,0.7) 0%, rgba(13,16,35,0.42) 100%)", color: "#0A66C2" },
  { name: "TikTok", desc: "Videos virais com trends e musicas do momento. Engajamento organico.", gradient: "radial-gradient(ellipse 30% 40% at 52% 37%, #111 0%, #000 100%)", color: "#fff" },
  { name: "Pinterest", desc: "Pins otimizados com IA para trafego organico de longo prazo.", gradient: "radial-gradient(ellipse 94% 78% at 50% 30%, rgba(189,8,28,0.7) 0%, rgba(15,9,38,0.4) 100%)", color: "#E60023" },
]

/* ─── Helpers ─── */

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 0.61, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  )
}

function SectionHead({ white, gray }: { white: string; gray: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xl font-medium text-white tracking-[0.2px]">{white}</span>
      <span className="text-xl font-medium text-[#6A6B6C] tracking-[0.2px]">{gray}</span>
    </div>
  )
}

function SectionHeadLeft({ white, gray1, gray2 }: { white: string; gray1: string; gray2?: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-xl font-medium text-white tracking-[0.2px]">{white}</span>
      <span className="text-xl font-medium text-[#6A6B6C] tracking-[0.2px]">{gray1}</span>
      {gray2 && <span className="text-xl font-medium text-[#6A6B6C] tracking-[0.2px]">{gray2}</span>}
    </div>
  )
}

function CtaButton({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link href={href}
      className="inline-flex items-center gap-2 min-h-[36px] px-3 py-[9.5px] rounded-lg bg-[#E6E6E6] hover:bg-white transition-colors"
      style={{ boxShadow: "0px 1px 0.4px white inset, 0px -1px 0.4px rgba(0,0,0,0.2) inset, 0px 0px 14px rgba(255,255,255,0.19), 0px 0px 0px 2px rgba(0,0,0,0.5)" }}>
      <Rocket className="w-4 h-4 text-[#2F3031]" />
      <span className="text-sm font-medium text-[#2F3031] leading-4 tracking-[0.2px]">{children}</span>
    </Link>
  )
}

function Stars({ count = 80 }: { count?: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const size = Math.random() > 0.85 ? 2 : 1
        const blue = Math.random() > 0.92
        return (
          <div key={i} className="absolute rounded-full bg-white"
            style={{
              width: size + "px", height: size + "px",
              left: Math.random() * 100 + "%", top: Math.random() * 100 + "%",
              opacity: Math.random() * 0.3 + 0.08,
              ...(blue ? { boxShadow: "0px 0px 2px 1px rgba(50,145,255,0.25), 0px 0px 1px 1px rgba(50,145,255,0.8)" } : {})
            }} />
        )
      })}
    </div>
  )
}

function KeyBlock({ children, wide, highlight, className = "" }: { children: React.ReactNode; wide?: boolean; highlight?: boolean; className?: string }) {
  return (
    <div className={`rounded-[11px] flex flex-col justify-center items-center overflow-hidden ${wide ? "min-w-[167px]" : "w-[110px]"} h-[110px] ${highlight ? "opacity-100" : "opacity-20"} ${className}`}
      style={{
        background: "radial-gradient(ellipse 75% 75% at 50% 91.9%, #121212 0%, #0D0D0D 100%)",
        boxShadow: "0px 1px 1px 1px rgba(255,255,255,0.2) inset, 0px 2px 1px 1px rgba(0,0,0,0.25) inset, 0px 0px 0.5px 1px black, 0px 1.5px 0.5px 2.5px rgba(0,0,0,0.4)"
      }}>
      {children}
    </div>
  )
}

/* Brand icon SVGs */
function BrandIcon({ name, className = "" }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    "Instagram": (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
    "LinkedIn": (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    "TikTok": (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
      </svg>
    ),
    "Pinterest": (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/>
      </svg>
    ),
  }
  return <>{icons[name] ?? <span className="text-2xl font-bold">{name[0]}</span>}</>
}

/* ─── PAGE ─── */

export default function HomePage() {
  const [activeTab, setActiveTab] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <main className="bg-[#07080A] text-white font-['Inter',system-ui,sans-serif] antialiased selection:bg-white/20">

      {/* ═══ HEADER / NAVBAR ═══ */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#07080A]/80 backdrop-blur-xl">
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2.5">
              <Rocket className="w-5 h-5 text-[#FF6363]" />
              <span className="text-[15px] font-semibold text-white tracking-tight">ADSTOCK</span>
            </Link>
          </div>

          {/* Desktop nav - centered */}
          <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            <a href="#como-funciona" className="text-[13px] font-medium text-white/60 hover:text-white transition-colors">Como funciona</a>
            <a href="#agentes" className="text-[13px] font-medium text-white/60 hover:text-white transition-colors">Agentes</a>
            <a href="#precos" className="text-[13px] font-medium text-white/60 hover:text-white transition-colors">Precos</a>
          </nav>

          {/* Secondary actions */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden md:flex items-center gap-3">
              <Link href="/login" className="text-[13px] font-medium text-white/60 hover:text-white transition-colors">Entrar</Link>
              <Link href="/register"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#E6E6E6] hover:bg-white transition-colors">
                <Download className="w-4 h-4 text-[#1A1A1A]" />
                <span className="text-[13px] font-medium text-[#1A1A1A]">Comecar agora</span>
              </Link>
            </div>

            {/* Mobile sign in */}
            <Link href="/login" className="md:hidden text-[13px] font-medium text-white/60 hover:text-white transition-colors mr-1">Entrar</Link>

            {/* Hamburger */}
            <button className="md:hidden flex flex-col gap-[5px] p-1.5" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
              <div className={`w-[18px] h-px bg-white/70 transition-transform ${menuOpen ? "rotate-45 translate-y-[6px]" : ""}`} />
              <div className={`w-[18px] h-px bg-white/70 transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
              <div className={`w-[18px] h-px bg-white/70 transition-transform ${menuOpen ? "-rotate-45 -translate-y-[6px]" : ""}`} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#07080A]/95 backdrop-blur-xl">
            <div className="px-6 py-4 flex flex-col gap-4">
              <a href="#como-funciona" className="text-[13px] font-medium text-white/60" onClick={() => setMenuOpen(false)}>Como funciona</a>
              <a href="#agentes" className="text-[13px] font-medium text-white/60" onClick={() => setMenuOpen(false)}>Agentes</a>
              <a href="#precos" className="text-[13px] font-medium text-white/60" onClick={() => setMenuOpen(false)}>Precos</a>
              <div className="pt-3 border-t border-white/[0.06]">
                <Link href="/register" onClick={() => setMenuOpen(false)}
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-[#E6E6E6] hover:bg-white transition-colors w-full">
                  <Download className="w-4 h-4 text-[#1A1A1A]" />
                  <span className="text-[13px] font-medium text-[#1A1A1A]">Comecar agora</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ─── HERO ─── */}
      <section className="relative w-full flex flex-col items-center overflow-hidden" style={{ minHeight: "943px" }}>
        {/* Hero background image + overlays */}
        <div className="absolute inset-0 max-w-[1200px] mx-auto overflow-hidden">
          <Image
            src="/hero-bg.png"
            alt=""
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(7,8,10,0.13) 0%, rgba(7,8,10,0.13) 90%, #07080A 100%), linear-gradient(270deg, rgba(7,8,10,0) 0%, #07080A 100%), linear-gradient(90deg, rgba(7,8,10,0) 0%, #07080A 100%)" }} />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-[818px] mx-auto px-4 flex flex-col items-center text-center" style={{ paddingTop: "369px", paddingBottom: "212px", gap: "32px" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="max-w-[540px]">
            <h1 className="text-[64px] font-semibold text-white leading-[70.4px]"
              style={{ textShadow: "0px 4px 4px rgba(0,0,0,0.15)" }}>
              Sua agencia de<br />marketing autonomo.
            </h1>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
            <p className="text-lg text-white/80 tracking-[0.2px] leading-relaxed"
              style={{ textShadow: "0px 4px 4px rgba(0,0,0,0.25)" }}>
              Agentes de IA que trabalham 24/7 no seu marketing.
            </p>
            <p className="text-lg text-white/80 tracking-[0.2px] leading-relaxed"
              style={{ textShadow: "0px 4px 4px rgba(0,0,0,0.25)" }}>
              Criar artes, analisar metricas, publicar posts — tudo autonomo.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col items-center gap-[15.4px]">
            <CtaButton href="/register">Comecar agora</CtaButton>
            <div className="flex items-center gap-6 text-xs text-[#9C9C9D] font-mono tracking-[0.2px]">
              <span>Sem contrato</span>
              <span className="relative pl-[12px]"><span className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-2.5 bg-[#9C9C9D]" />Cancele quando quiser</span>
              <span className="relative pl-[12px]"><span className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-2.5 bg-[#9C9C9D]" />Setup em 8 min</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.45 }}
            className="pt-10">
            <div className="inline-flex rounded-full p-px bg-[#452324] shadow-[0_0_20px_rgba(245,48,107,0.1)]">
              <div className="flex items-center gap-[13px] h-[30px] px-3 rounded-full bg-[#130D0E]">
                <span className="text-sm font-medium text-white tracking-[0.2px]">IA Avancada</span>
                <span className="text-sm text-[#434345] -ml-[9px]">|</span>
                <span className="text-sm font-medium text-[#9C9C9D] tracking-[0.2px] flex items-center gap-1">
                  5 agentes <ChevronRight className="w-4 h-4 text-[#9C9C9D]" />
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── SECTION 2 · AGENT SHOWCASE ─── */}
      <section id="agentes" className="relative py-28 overflow-hidden">
        <Stars />
        <div className="max-w-[1204px] mx-auto px-6 relative">
          <div className="absolute left-1/2 -translate-x-1/2 top-[-60px] w-[1344px] h-[860px] opacity-40"
            style={{
              background: "radial-gradient(ellipse 40% 147% at 50% 46.2%, rgba(255,117,117,0.2) 5%, rgba(154,170,255,0.11) 60%, rgba(255,194,194,0) 100%)",
              filter: "blur(10px)"
            }} />

          <FadeUp className="text-center mb-16">
            <SectionHead white="Resultados, nao planilhas." gray="Cinco agentes. Uma plataforma." />
          </FadeUp>

          <FadeUp delay={0.1}>
            <div className="relative mx-auto max-w-[1204px]">
              <div className="absolute -inset-[1px] rounded-[19px] bg-[radial-gradient(ellipse_86%_50%_at_51%_5%,rgba(255,148,148,0.11)_0%,rgba(222,226,255,0.08)_46%,rgba(241,242,255,0.02)_100%)]" />
              <div className="relative rounded-[19px] bg-black/40 backdrop-blur-sm border border-white/[0.08] shadow-[0_0.5px_0_1px_rgba(255,255,255,0.3)_inset,0_0_40px_20px_rgba(255,255,255,0.03)] p-[9px]">
                <div className="rounded-[12px] bg-[#07080A] border border-white/[0.08] shadow-[0_0.5px_0_1px_rgba(255,255,255,0.1)_inset,0_0_2px_rgba(255,255,255,0.19)] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center">
                        <ChevronRight className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm text-white/40">Seu escritorio virtual</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 rounded-md border border-white/10 text-xs text-white/50 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-white/10" />
                        5 agentes
                      </div>
                      <div className="px-3 py-1.5 rounded-md border border-white/10 text-xs text-white flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        Online
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-[475px]">
                    {/* Left sidebar — agent list with photos */}
                    <div className="hidden md:flex flex-col w-[280px] border-r border-white/[0.08] p-4 gap-0.5">
                      <span className="text-[13px] font-semibold text-white/40 px-2 mb-1.5">Hoje</span>
                      {AGENTS.map((a, i) => (
                        <div key={a.name} className={`flex items-center gap-2.5 rounded-md px-2 py-2.5 text-[13px] cursor-pointer ${i === 0 ? "bg-white/[0.08] text-white" : "text-white/50 hover:bg-white/[0.04]"} transition-colors`}>
                          <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-white/10">
                            <Image src={a.photo} alt={a.name} width={20} height={20} className="object-cover" />
                          </div>
                          <div>
                            <div className="font-medium leading-tight">{a.name}</div>
                            <div className="text-[11px] text-white/30">{a.role}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Center — metrics */}
                    <div className="flex-1 p-6 flex items-center justify-center">
                      <div className="grid grid-cols-2 gap-4 max-w-[400px] w-full">
                        {[
                          { label: "Posts no mes", value: "87", sub: "+12% vs mes anterior" },
                          { label: "Engajamento", value: "34.2k", sub: "+8% esta semana" },
                          { label: "Seguidores", value: "12.4k", sub: "+23% organicos" },
                          { label: "Aprovacao", value: "94%", sub: "98% automatizada" },
                        ].map((m) => (
                          <div key={m.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                            <div className="text-[11px] text-white/30 mb-0.5">{m.label}</div>
                            <div className="text-2xl font-semibold tracking-tight">{m.value}</div>
                            <div className="text-[11px] text-green-400/50 mt-0.5">{m.sub}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right — activity */}
                    <div className="hidden xl:flex flex-col w-[220px] border-l border-white/[0.08] p-4 gap-4">
                      <span className="text-[13px] font-semibold text-white/40">Atividade recente</span>
                      {[
                        { time: "09:00", text: "Maya iniciou o dia" },
                        { time: "09:15", text: "Carlos criou artes" },
                        { time: "10:30", text: "Bruno agendou posts" },
                        { time: "11:00", text: "Lena gerou relatorio" },
                      ].map((a) => (
                        <div key={a.time} className="flex gap-3 text-xs">
                          <span className="text-white/20 font-mono min-w-[36px] mt-0.5">{a.time}</span>
                          <span className="text-white/40">{a.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-3.5 py-3 border-t border-white/[0.08] bg-black/10">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center">
                        <Rocket className="w-3.5 h-3.5 text-white/60" />
                      </div>
                      <span className="text-xs font-semibold text-white/60">Adstock</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-medium text-white/60 flex items-center gap-2">
                        Aprovar posts
                        <span className="px-1.5 py-1 rounded bg-white/10 text-[11px] font-semibold text-white/60 uppercase tracking-[0.8px]">↵</span>
                      </span>
                      <div className="w-0.5 h-3 bg-white/10 rounded-sm" />
                      <span className="text-[13px] font-medium text-white/60 flex items-center gap-2">
                        Acoes
                        <span className="flex gap-0.5">
                          <span className="px-1.5 py-1 rounded bg-white/10 text-[11px] font-semibold text-white/60 uppercase tracking-[0.8px]">⌘</span>
                          <span className="px-1.5 py-1 rounded bg-white/10 text-[11px] font-semibold text-white/60 uppercase tracking-[0.8px]">K</span>
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.2} className="text-center mt-14">
            <p className="text-base font-medium max-w-[467px] mx-auto leading-relaxed">
              <span className="text-white">Lembrar de tudo.</span>{" "}
              <span className="text-[#6A6B6C]">
                Nao perca mais prazos. Seus agentes organizam, criam e publicam — voce so aprova os posts.
              </span>
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ─── SECTION 3 · KEYBOARD FEATURE BLOCKS ─── */}
      <section id="como-funciona" className="relative py-28 overflow-hidden border-t border-white/[0.04]">
        <div className="max-w-[1204px] mx-auto px-6 flex flex-col lg:flex-row items-center justify-center gap-[205px]">
          {/* Left text + CTA */}
          <div className="w-full max-w-[320px] flex flex-col items-start gap-12 py-[282px]">
            <div className="flex flex-col gap-0">
              <span className="text-xl font-medium text-white tracking-[0.2px]">Nao e sobre economizar tempo.</span>
              <span className="text-xl font-medium text-[#6A6B6C] tracking-[0.2px]">E sobre nunca mais se</span>
              <span className="text-xl font-medium text-[#6A6B6C] tracking-[0.2px]">preocupar com marketing.</span>
            </div>
            <CtaButton href="/register">Comecar agora</CtaButton>
          </div>

          {/* Right — keyboard blocks, blended background */}
          <div className="relative flex-1 max-w-[679px] py-12">
            {/* Gradient glow that blends with #07080A */}
            <div className="absolute inset-0"
              style={{
                background: "radial-gradient(ellipse 95% 70% at 17% 48%, rgba(120,120,120,0.12) 17%, rgba(7,8,10,0) 84%)"
              }} />

            <div className="relative flex flex-col gap-3">
              {/* Row 1 — F-keys */}
              <div className="flex gap-3 justify-center">
                <KeyBlock wide><span className="text-2xl font-medium text-white">esc</span></KeyBlock>
                <KeyBlock>F1</KeyBlock>
                <KeyBlock>F2</KeyBlock>
                <KeyBlock>F3</KeyBlock>
                <KeyBlock>F4</KeyBlock>
              </div>

              {/* Row 2 — numbers */}
              <div className="flex gap-3 justify-center">
                <KeyBlock><span className="text-3xl">!</span><span className="text-3xl">1</span></KeyBlock>
                <KeyBlock><span className="text-2xl">@</span><span className="text-3xl">2</span></KeyBlock>
                <KeyBlock><span className="text-2xl">#</span><span className="text-3xl">3</span></KeyBlock>
                <KeyBlock><span className="text-2xl">$</span><span className="text-3xl">4</span></KeyBlock>
              </div>

              {/* Row 3 — features highlighted */}
              <div className="flex gap-3 justify-center">
                <KeyBlock wide><span /></KeyBlock>
                <KeyBlock highlight className="min-w-[178px]">
                  <div className="flex flex-col items-start px-4">
                    <span className="text-base font-bold text-white">Rapido.</span>
                    <span className="text-base font-medium text-[#9C9C9D]">Resultados em<br />horas.</span>
                  </div>
                </KeyBlock>
                <KeyBlock highlight className="min-w-[208px]">
                  <div className="flex flex-col items-start px-4">
                    <span className="text-base font-bold text-white">Autonomo.</span>
                    <span className="text-base font-medium text-[#9C9C9D]">Agentes 24h.</span>
                  </div>
                </KeyBlock>
                <KeyBlock><span /></KeyBlock>
              </div>

              {/* Row 4 — more features */}
              <div className="flex gap-3 justify-center">
                <KeyBlock highlight className="min-w-[208px]">
                  <div className="flex flex-col items-start px-4">
                    <span className="text-base font-bold text-white">Integrado.</span>
                    <span className="text-base font-medium text-[#9C9C9D]">Instagram, TikTok, LinkedIn.</span>
                  </div>
                </KeyBlock>
                <KeyBlock highlight className="min-w-[178px]">
                  <div className="flex flex-col items-start px-4">
                    <span className="text-base font-bold text-white">Inteligente.</span>
                    <span className="text-base font-medium text-[#9C9C9D]">IA que aprende.</span>
                  </div>
                </KeyBlock>
                <KeyBlock>E</KeyBlock>
              </div>

              {/* Row 5 */}
              <div className="flex gap-3 justify-center">
                <KeyBlock wide><span /></KeyBlock>
                <KeyBlock><span /></KeyBlock>
                <KeyBlock><span /></KeyBlock>
                <KeyBlock wide className="min-w-[138px]"><span /></KeyBlock>
                <KeyBlock wide className="min-w-[598px]"><span /></KeyBlock>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 4 · INTEGRATIONS ─── */}
      <section className="relative py-28 overflow-hidden border-t border-white/[0.04]">
        <div className="max-w-[1252px] mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 mb-16">
            <SectionHeadLeft white="Tem um agente para isso." gray1="Use seus canais favoritos sem" gray2="precisar abrir nenhum app." />

            {/* Tab pills */}
            <div className="flex items-center rounded-full bg-gradient-to-br from-[#111214] to-[#0C0D0F] border border-white/[0.06] py-2 px-[21px] gap-6 shadow-[0.25px_1.25px_0_0.75px_rgba(255,255,255,0.1)_inset]">
              {["Instagram", "LinkedIn", "TikTok", "Pinterest"].map((tab, i) => (
                <button key={tab} onClick={() => setActiveTab(i)}
                  className={`text-sm font-medium tracking-[0.2px] transition-colors ${activeTab === i ? "text-white" : "text-[#6A6B6C] hover:text-white"}`}>
                  {tab}
                </button>
              ))}
              <div className="w-[107px] h-[46px] rounded-full bg-[radial-gradient(ellipse_51%_92%_at_51%_8%,#5A5A5A_0%,#1A1A1A_100%)] absolute"
                style={{ left: `${9 + activeTab * 110}px`, top: 9, transition: "left 0.3s ease" }} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {INTEGRATIONS.map((ext, i) => (
              <FadeUp key={ext.name} delay={i * 0.08}>
                <div className="rounded-[20px] overflow-hidden border border-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset,0_0_40px_20px_rgba(7,13,79,0.05),0_0_20px_3px_rgba(7,13,79,0.05),0_1px_0_rgba(255,255,255,0.1)_inset]"
                  style={{ background: ext.gradient }}>
                  <div className="p-6 flex flex-col gap-6">
                    <div className="flex items-center gap-3">
                      <div className="w-[52px] h-[52px] rounded-xl bg-white/[0.05] flex items-center justify-center">
                        <BrandIcon name={ext.name} className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <span className="text-lg text-white">{ext.name}</span>
                      </div>
                      <Link href="/register" className="w-9 h-9 rounded-lg bg-gradient-to-b from-white/[0.03] to-white/[0.1] border border-white/25 flex items-center justify-center shadow-[0_-1px_0_rgba(0,0,0,0.2)_inset] hover:scale-105 transition-transform">
                        <ChevronRight className="w-4 h-4 text-[#E6E6E6]" />
                      </Link>
                    </div>
                    <p className="text-base font-medium text-white leading-relaxed min-h-[80px]">{ext.desc}</p>
                    <div className="h-px bg-white/[0.05]" />
                  </div>
                  <div className="h-36 bg-black/10 flex items-center justify-center">
                    <BrandIcon name={ext.name} className="w-10 h-10 text-white/15" />
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>

          <div className="flex items-center justify-between mt-12">
            <Link href="/register" className="text-base font-medium text-[#9C9C9D] tracking-[0.3px] flex items-center gap-1 hover:text-white transition-colors">
              Explore todas as integracoes <ChevronRight className="w-4 h-4" />
            </Link>
            <div className="flex gap-3">
              <button className="w-[58px] h-[58px] rounded-full bg-gradient-to-br from-[#111214] to-[#0C0D0F] border border-white/[0.06] flex items-center justify-center shadow-[0.25px_1.25px_0_0.75px_rgba(255,255,255,0.1)_inset]">
                <ChevronRight className="w-4 h-4 text-[#6A6B6C] rotate-180" />
              </button>
              <button className="w-[58px] h-[58px] rounded-full bg-gradient-to-br from-[#111214] to-[#0C0D0F] border border-white/[0.06] flex items-center justify-center shadow-[0.25px_1.25px_0_0.75px_rgba(255,255,255,0.1)_inset]">
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 5 · AI ─── */}
      <section className="relative py-28 overflow-hidden border-t border-white/[0.04]">
        <div className="max-w-[1204px] mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center gap-0 h-[46px] mb-12"
              style={{ background: "radial-gradient(ellipse 13.65% 50% at 50% 50%, rgba(245,48,107,0.1) 0%, rgba(255,103,167,0) 100%)" }}>
              <div className="w-[272px] h-0.5 bg-gradient-to-r from-transparent via-[#452324]/30 to-transparent" />
              <span className="text-sm font-medium text-[#FF6363] tracking-[0.2px] px-3">IA</span>
              <div className="w-[272px] h-0.5 bg-gradient-to-r from-transparent via-[#452324]/30 to-transparent" />
            </div>
            <SectionHead white="Seu marketing ficou inteligente." gray="IA onde ela faz mais diferenca — no seu negocio." />
          </div>

          <FadeUp>
            <div className="relative mx-auto max-w-[1066px]">
              <div className="rounded-2xl p-[9px]"
                style={{
                  background: "radial-gradient(ellipse 86% 50% at 51% 5%, rgba(255,148,148,0.11) 0%, rgba(222,226,255,0.08) 46%, rgba(241,242,255,0.02) 100%), rgba(0,0,0,0.44)",
                  boxShadow: "0px 0.5px 0px 1px rgba(255,255,255,0.3) inset, 0px 0px 40px 20px rgba(255,255,255,0.03)",
                }}>
                <div className="rounded-xl bg-gradient-to-b from-[#0C0D0F] via-[#0C0D0F] to-[#07080A] border border-white/[0.08] shadow-[0_0.5px_0_1px_rgba(255,255,255,0.1)_inset] overflow-hidden">
                  <div className="border-b border-white/[0.08] px-4 py-4">
                    <div className="relative flex items-center">
                      <span className="text-base text-white">Qual a melhor estrategia para meu Instagram?</span>
                      <div className="absolute left-[143px] top-0 w-0.5 h-[18px] rounded-sm border border-white/60" />
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="rounded-lg bg-white/[0.05] border border-white/[0.1] p-[17px] flex flex-col gap-6">
                      <p className="text-xs font-medium text-white/40 text-center">Planos e precos para clinica odontologica?</p>
                      <div className="flex flex-col gap-[21px]">
                        <p className="text-[13px] text-white leading-5 tracking-[0.1px]">Para sua clinica odontologica, recomendo:</p>
                        <div>
                          <p className="text-[13px] text-white leading-5 tracking-[0.1px]">
                            1. Posts educativos 3x/semana — dicas de saude bucal<br />
                            2. Stories diarios mostrando resultados reais<br />
                            3. Reels com antes/depois de procedimentos<br />
                            4. Depoimentos de pacientes satisfeitos
                          </p>
                        </div>
                        <p className="text-[13px] text-white leading-5 tracking-[0.1px]">Essa estrategia gera em media 2.3x mais engajamento para clinicas.</p>
                        <p className="text-xs font-medium text-white/40">Referencias</p>
                        <div className="flex gap-1.5">
                          <span className="h-5 px-1.5 bg-white/20 rounded text-[13px] text-white flex items-center gap-1.5">
                            <span className="w-5 h-5 bg-white/20 rounded flex items-center justify-center text-[13px]">1</span>
                            adstock.com/cases
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeUp>

          <div className="flex justify-center items-center gap-2 my-8">
            {[0, 1, 2].map((i) => (
              <div key={i}
                className={`h-0.5 rounded-full ${i === 0 ? "w-[92px] bg-gradient-to-r from-[#452324] via-[#ECA5A7] to-[#452324]" : "w-[46px] bg-[#452324]"}`} />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 mt-12">
            {[
              { title: "Estrategia em tempo real.", desc: "Agentes analisam resultados e ajustam a estrategia automaticamente para maximizar performance." },
              { title: "Sempre ligado.", desc: "IA que aprende com cada post, cada metrica, cada interacao — melhorando a cada dia." },
              { title: "Assistente de marketing.", desc: "Crie briefings, aprove artes e responda duvidas — tudo por chat com IA contextual." },
            ].map((item, i) => (
              <FadeUp key={item.title} delay={i * 0.1} className={i > 0 ? "opacity-50" : ""}>
                <div className="flex flex-col gap-0">
                  <span className="text-base font-medium text-white leading-relaxed">{item.title}</span>
                  <span className={`text-base font-medium leading-relaxed ${i > 0 ? "text-[#434345]" : "text-[#6A6B6C]"}`}>
                    {item.desc}
                  </span>
                </div>
              </FadeUp>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 mt-12">
            <Link href="/register" className="flex items-center gap-3 group">
              <div className="w-6 h-6 rounded-full bg-white/[0.05] flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-white/30 group-hover:text-white transition-colors" />
              </div>
              <span className="text-base font-medium text-white tracking-[0.3px] flex items-center gap-1 group-hover:opacity-80 transition-opacity">
                Criar conta <ChevronRight className="w-4 h-4 text-white" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── SECTION 6 · PRICING ─── */}
      <section id="precos" className="relative py-28 border-t border-white/[0.04] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <SectionHead white="Menos que um almoco por dia." gray="Sem contrato. Cancele quando quiser." />
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { name: "Starter", price: "97", agents: "3 agentes", posts: "30 posts/mes", redes: "2 redes", popular: false, cta: "Comecar" },
              { name: "Growth", price: "197", agents: "6 agentes", posts: "90 posts/mes", redes: "4 redes", popular: true, cta: "Comecar" },
              { name: "Agency", price: "397", agents: "10 agentes", posts: "Ilimitado", redes: "Ilimitado", popular: false, cta: "Comecar" },
            ].map((p, i) => (
              <FadeUp key={p.name} delay={i * 0.08}>
                <div className={`relative rounded-2xl p-8 transition-all ${
                  p.popular
                    ? "bg-white/[0.03] border border-white/[0.12] ring-1 ring-white/[0.06]"
                    : "bg-white/[0.01] border border-white/[0.04] hover:border-white/[0.08]"
                }`}>
                  {p.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                      Mais popular
                    </div>
                  )}
                  <h4 className="text-lg font-semibold mb-1">{p.name}</h4>
                  <div className="mt-6 mb-8">
                    <span className="text-5xl font-semibold tracking-tight">R${p.price}</span>
                    <span className="text-sm text-white/30 ml-1">/mes</span>
                  </div>
                  <ul className="space-y-4 text-sm text-white/40 mb-8">
                    <li className="flex items-center gap-3"><Check className="w-4 h-4 text-white/30" />{p.agents}</li>
                    <li className="flex items-center gap-3"><Check className="w-4 h-4 text-white/30" />{p.posts}</li>
                    <li className="flex items-center gap-3"><Check className="w-4 h-4 text-white/30" />{p.redes}</li>
                  </ul>
                  <Link href="/register"
                    className={`block text-center rounded-full py-3 text-sm font-semibold transition-all ${
                      p.popular ? "bg-white text-black hover:bg-neutral-200 active:scale-95" : "bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] active:scale-95"
                    }`}>
                    {p.cta}
                  </Link>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.04] py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <Rocket className="w-4 h-4 text-white/60" />
                <span className="text-sm font-semibold">ADSTOCK</span>
              </Link>
              <p className="text-sm text-white/20 max-w-xs">Sua agencia autonoma de marketing operada por IA.</p>
            </div>
            {[
              { t: "Produto", l: ["Como funciona", "Agentes", "Precos", "Comecar"] },
              { t: "Empresa", l: ["Sobre", "Blog", "Contato"] },
              { t: "Legal", l: ["Termos", "Privacidade"] },
            ].map((c) => (
              <div key={c.t}>
                <h4 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-4">{c.t}</h4>
                <ul className="space-y-3">
                  {c.l.map((l) => <li key={l}><a href="#" className="text-sm text-white/20 hover:text-white/40 transition-colors">{l}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/[0.04] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/15">© 2025 Adstock. Todos os direitos reservados.</p>
            <p className="text-xs text-white/10">Feito com IA no Brasil</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
