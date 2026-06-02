"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, Users, Calendar, Image } from "lucide-react"

const TEAM = [
  { name: "Maya Ferreira", role: "Diretora de Conteudo", initials: "MF", color: "#ff385c" },
  { name: "Bruno Costa", role: "Social Media", initials: "BC", color: "#2563eb" },
  { name: "Lena Souza", role: "Analista", initials: "LS", color: "#2bac76" },
  { name: "Carlos Lima", role: "Designer", initials: "CL", color: "#d97706" },
  { name: "Diego Ramos", role: "SEO", initials: "DR", color: "#dc2626" },
]

const PRICING = [
  { name: "Starter", price: "97", agents: 3, posts: "30", redes: 2 },
  { name: "Growth", price: "197", agents: 6, posts: "90", redes: 4, popular: true },
  { name: "Agency", price: "397", agents: 10, posts: "Ilimitado", redes: "Ilimitado" },
]

export default function HomePage() {
  const [pulse, setPulse] = useState(false)
  useEffect(() => { const t = setInterval(() => setPulse(p => !p), 1200); return () => clearInterval(t) }, [])

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center">
        <div className="absolute inset-0 opacity-[0.03]"><iframe src="http://localhost:3100" className="w-full h-full border-0 scale-150" /></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-radial from-white/[0.02] to-transparent pointer-events-none" />
        <div className="relative max-w-[900px] mx-auto px-8 w-full text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight tracking-tight">
              Sua agencia de marketing.<br /><span className="text-[#ff385c]">Trabalha enquanto voce dorme.</span>
            </h1>
            <p className="text-sm text-white/30 mb-8 max-w-md mx-auto">5 especialistas de IA cuidando do seu Instagram, SEO, LinkedIn e estrategia.</p>
            <div className="flex justify-center gap-3">
              <Link href="/register">
                <motion.div animate={{ scale: pulse ? 1 : 1.02 }} transition={{ duration: 1.2 }}>
                  <Button className="bg-[#ff385c] hover:bg-[#e00b41] text-white rounded-lg px-8 h-11 text-sm">Contratar equipe <ArrowRight className="w-4 h-4 ml-2" /></Button>
                </motion.div>
              </Link>
            </div>
            <p className="text-xs text-white/15 mt-4">R$97/mes · Sem contrato · Setup em 8 minutos</p>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 border-t border-white/[0.05]">
        <div className="max-w-[900px] mx-auto px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <Users className="w-5 h-5" />, title: "Voce conta sobre sua empresa", desc: "Onboarding inteligente. A gente entende seu negocio." },
              { icon: <Calendar className="w-5 h-5" />, title: "Todo dia as 9h sua equipe planeja", desc: "Daily automatica com seus agentes." },
              { icon: <Image className="w-5 h-5" />, title: "Artes publicam sozinhas", desc: "Voce aprova. O sistema publica nas redes." },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/50 mb-3">{f.icon}</div>
                <h3 className="text-sm font-semibold text-white/70 mb-1.5">{f.title}</h3>
                <p className="text-xs text-white/25 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 border-t border-white/[0.05]">
        <div className="max-w-[900px] mx-auto px-8">
          <h2 className="text-lg font-bold text-white/70 mb-6 text-center">Conheca seu time</h2>
          <div className="flex justify-center gap-8">
            {TEAM.map((a, i) => (
              <motion.div key={a.name} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="text-center">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-sm mx-auto mb-2" style={{ backgroundColor: a.color }}>{a.initials}</div>
                <h3 className="text-xs font-semibold text-white/60">{a.name}</h3>
                <p className="text-[10px] text-white/25">{a.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 border-t border-white/[0.05]">
        <div className="max-w-[900px] mx-auto px-8">
          <h2 className="text-lg font-bold text-white/70 mb-8 text-center">Menos que um almoco por dia</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {PRICING.map(p => (
              <div key={p.name} className={`p-6 rounded-xl border text-center ${p.popular ? "border-white/20 bg-white/[0.03]" : "border-white/[0.06] bg-transparent"}`}>
                <h3 className="text-sm font-semibold text-white/60 mb-1">{p.name}</h3>
                <div className="mb-4"><span className="text-2xl font-bold text-white">R${p.price}</span><span className="text-white/20 text-xs">/mes</span></div>
                <div className="text-[11px] text-white/30 space-y-1 mb-5">{p.agents} agentes · {p.posts} posts · {p.redes} redes</div>
                <Link href="/register"><Button className={`w-full h-9 text-xs rounded-lg ${p.popular ? "bg-[#ff385c] hover:bg-[#e00b41]" : "bg-white/[0.06] hover:bg-white/[0.10]"} text-white`}>Comecar</Button></Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="py-20 border-t border-white/[0.05] text-center">
        <h2 className="text-lg font-bold text-white/70 mb-4">Sua equipe esta esperando.</h2>
        <Link href="/register"><Button className="bg-[#ff385c] hover:bg-[#e00b41] text-white rounded-lg px-8 h-11 text-sm">Comecar agora <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
        <p className="text-[10px] text-white/10 mt-4">Sem cartao de credito · Cancele quando quiser</p>
      </section>
    </main>
  )
}
