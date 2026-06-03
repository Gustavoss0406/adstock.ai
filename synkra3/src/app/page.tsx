"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

const TEAM = [
  { name: "Maya Ferreira", role: "Diretora de Conteudo" },
  { name: "Bruno Costa", role: "Social Media" },
  { name: "Lena Souza", role: "Analista de Metricas" },
  { name: "Carlos Lima", role: "Designer" },
  { name: "Diego Ramos", role: "SEO" },
]

const PRICING = [
  { name: "Starter", price: "97", agents: 3, posts: "30/mes", redes: 2 },
  { name: "Growth", price: "197", agents: 6, posts: "90/mes", redes: 4, featured: true },
  { name: "Agency", price: "397", agents: 10, posts: "Ilimitado", redes: "Ilimitado" },
]

const LOGOS = ["Instagram", "LinkedIn", "Pinterest", "Google", "Blog"]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-black body-text">
      {/* ── NAV ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white border-b border-[#EBEBEB]">
        <div className="max-w-[1400px] mx-auto px-8 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">Adstock</Link>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm text-[#666] hover:text-black transition-colors">Login</Link>
            <Link href="/register" className="bg-black text-white text-sm font-semibold px-5 py-2 transition-colors hover:bg-[#1A1A1A]">Comecar</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-48 pb-32">
        <div className="max-w-[900px] mx-auto px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}>
            <h1 className="display-text text-display-xl md:text-[72px] mb-8 max-w-3xl mx-auto">
              Sua agencia de marketing.<br />Autonoma.
            </h1>
            <p className="text-body-lg text-[#666] mb-12 max-w-lg mx-auto">
              5 especialistas de IA trabalham enquanto voce dorme. Instagram, SEO, LinkedIn — tudo planejado, criado e publicado sem voce levantar um dedo.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/register" className="bg-black text-white font-semibold px-8 py-4 text-base inline-flex items-center gap-2 transition-colors hover:bg-[#1A1A1A]">
                Contratar equipe <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/login" className="border border-[#CCC] text-black font-semibold px-8 py-4 text-base transition-colors hover:bg-[#F5F5F5]">
                Ja tenho conta
              </Link>
            </div>
            <p className="text-sm text-[#666] mt-6">R$97/mes · Sem contrato · Setup em 8 minutos</p>
          </motion.div>
        </div>
      </section>

      {/* ── LOGOS ── */}
      <section className="py-16 border-t border-[#EBEBEB]">
        <div className="max-w-[900px] mx-auto px-8">
          <p className="text-xs text-[#999] text-center mb-8 uppercase tracking-[0.2em]">Publica em todas as redes</p>
          <div className="flex justify-center gap-12">
            {LOGOS.map(l => (
              <span key={l} className="text-lg font-bold text-[#CCC]">{l}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-section border-t border-[#EBEBEB]">
        <div className="max-w-[1100px] mx-auto px-8">
          <h2 className="display-text text-display-md mb-16 text-center">Como funciona</h2>
          <div className="grid md:grid-cols-3 gap-16">
            {[
              { step: "01", title: "Voce conta sobre seu negocio", desc: "Onboarding em 8 minutos. A gente entende seu segmento, tom de voz e objetivos — tudo que a equipe precisa pra comecar." },
              { step: "02", title: "Todo dia as 9h, sua equipe planeja", desc: "Daily automatica com 5 especialistas. Maya distribui tarefas, Carlos cria as artes, Bruno agenda, Lena analisa metricas." },
              { step: "03", title: "Voce aprova. O sistema publica.", desc: "Receba as artes para aprovacao. Deu ok? O sistema publica no melhor horario. Nao gostou? Pede revisao em um clique." },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}>
                <div className="text-sm text-[#CCC] mb-4 font-bold">{f.step}</div>
                <h3 className="text-title-lg mb-3">{f.title}</h3>
                <p className="text-[#666] text-body-md leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TEAM ── */}
      <section className="py-section border-t border-[#EBEBEB] bg-[#F5F5F5]">
        <div className="max-w-[1100px] mx-auto px-8">
          <h2 className="display-text text-display-md mb-16 text-center">Seu time de especialistas</h2>
          <div className="flex justify-center gap-12">
            {TEAM.map((a, i) => (
              <motion.div key={a.name} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="text-center">
                <div className="w-20 h-20 bg-black flex items-center justify-center text-white font-bold text-sm mx-auto mb-4">
                  {a.name.split(" ").map(n => n[0]).join("")}
                </div>
                <h3 className="text-sm font-semibold">{a.name.split(" ")[0]}</h3>
                <p className="text-xs text-[#666] mt-1">{a.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCREENSHOT ── */}
      <section className="py-section border-t border-[#EBEBEB]">
        <div className="max-w-[1100px] mx-auto px-8 text-center">
          <h2 className="display-text text-display-md mb-6">Seu escritorio virtual</h2>
          <p className="text-[#666] text-body-lg mb-12 max-w-lg mx-auto">
            Acompanhe tudo em tempo real. Agentes trabalhando, metricas atualizadas, chat ao vivo.
          </p>
          <div className="bg-[#F5F5F5] border border-[#EBEBEB] p-4 max-w-[900px] mx-auto">
            <div className="bg-[#1A1A1A] aspect-[16/10] flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="flex gap-3 justify-center">
                  {TEAM.map((a, i) => (
                    <div key={i} className="w-12 h-12 bg-white flex items-center justify-center text-black text-[10px] font-bold">
                      {a.name[0]}
                    </div>
                  ))}
                </div>
                <p className="text-editor-muted text-sm">Daily · 09:00 · 5 agentes online</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-section border-t border-[#EBEBEB] bg-[#F5F5F5]">
        <div className="max-w-[1100px] mx-auto px-8">
          <h2 className="display-text text-display-md mb-6 text-center">Menos que um almoco por dia</h2>
          <p className="text-[#666] text-body-lg text-center mb-16">Sem contrato. Cancele quando quiser.</p>
          <div className="grid md:grid-cols-3 gap-6 max-w-[900px] mx-auto">
            {PRICING.map(p => (
              <div key={p.name} className={`p-10 border bg-white ${p.featured ? "border-black shadow-elevated" : "border-[#EBEBEB]"}`}>
                <h3 className="text-title-sm mb-4">{p.name}</h3>
                <div className="mb-6">
                  <span className="display-text text-display-md">R${p.price}</span>
                  <span className="text-[#666] text-sm">/mes</span>
                </div>
                <div className="text-sm text-[#666] space-y-2 mb-8">
                  <p>{p.agents} agentes</p>
                  <p>{p.posts} posts</p>
                  <p>{p.redes} redes sociais</p>
                </div>
                <Link href="/register" className={`block text-center py-3 text-sm font-semibold transition-colors ${p.featured ? "bg-black text-white hover:bg-[#1A1A1A]" : "border border-black text-black hover:bg-black hover:text-white"}`}>
                  Comecar
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-section border-t border-[#EBEBEB]">
        <div className="max-w-[600px] mx-auto px-8 text-center">
          <h2 className="display-text text-display-md mb-6">Sua equipe esta esperando.</h2>
          <p className="text-[#666] text-body-lg mb-10">Setup em 8 minutos. Comece agora.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-black text-white font-semibold px-10 py-5 text-base transition-colors hover:bg-[#1A1A1A]">
            Criar minha agencia <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-[#999] mt-6">Sem cartao de credito · Cancele quando quiser</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-16 border-t border-[#EBEBEB]">
        <div className="max-w-[1100px] mx-auto px-8 flex justify-between items-center text-sm text-[#666]">
          <span>Adstock © 2025</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-black transition-colors">Termos</a>
            <a href="#" className="hover:text-black transition-colors">Privacidade</a>
            <a href="#" className="hover:text-black transition-colors">Contato</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
