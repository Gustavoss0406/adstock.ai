"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Crown, Pen, BarChart3, Image, Search, Check, Play, Calendar, Users, MessageSquare, Rocket, Sparkles, Plus } from "lucide-react"

const AGENTS = [
  { icon: Crown, name: "Maya Ferreira", role: "Diretora de Conteudo" },
  { icon: Pen, name: "Bruno Costa", role: "Social Media" },
  { icon: BarChart3, name: "Lena Souza", role: "Analista de Metricas" },
  { icon: Image, name: "Carlos Lima", role: "Designer" },
  { icon: Search, name: "Diego Ramos", role: "Especialista em SEO" },
]

const PRICING = [
  { name: "Starter", price: "R$97", agents: "3", posts: "30/mes", redes: "2", popular: false },
  { name: "Growth", price: "R$197", agents: "6", posts: "90/mes", redes: "4", popular: true },
  { name: "Agency", price: "R$397", agents: "10", posts: "Ilimitado", redes: "Ilimitado", popular: false },
]

const STEPS = [
  { icon: MessageSquare, title: "1. Voce conta sobre seu negocio", desc: "Onboarding em 8 minutos. A gente entende seu segmento, tom de voz, publico e objetivos." },
  { icon: Calendar, title: "2. Todo dia as 9h, sua equipe planeja", desc: "Daily automatica com 5 agentes. Maya distribui tarefas, Carlos cria artes, Bruno agenda." },
  { icon: BarChart3, title: "3. Voce aprova. O sistema publica.", desc: "Receba as artes para aprovacao. Deu ok? O sistema publica no melhor horario. Nao gostou? Pede revisao." },
]

const FAQ = [
  { q: "Preciso saber de marketing?", a: "Nao. Voce fala sobre seu negocio no onboarding e os agentes cuidam de tudo — estrategia, criacao, publicacao." },
  { q: "Os agentes publicam sozinhos?", a: "As artes sao enviadas para sua aprovacao. Voce aprova ou pede revisao em um clique. Depois de aprovado, o sistema publica no melhor horario." },
  { q: "Posso cancelar a qualquer momento?", a: "Sim. Sem contrato, sem multa. Cancele quando quiser." },
  { q: "Funciona para qualquer segmento?", a: "Sim. A IA se adapta ao seu segmento, tom de voz e publico durante o onboarding. Moda, saude, tech, alimentacao — todos funcionam." },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050505] text-neutral-300 antialiased selection:bg-amber-500/30 selection:text-white overflow-x-hidden relative">
      {/* Ambient glow */}
      <div className="absolute w-[600px] h-[600px] bg-amber-900/20 rounded-full blur-[100px] -top-[200px] -left-[200px] z-0 pointer-events-none" />
      <div className="absolute w-[800px] h-[800px] bg-neutral-900/40 rounded-full blur-[100px] top-[20%] -right-[300px] z-0 pointer-events-none" />

      {/* ══════ HEADER ══════ */}
      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[calc(100%-3rem)] sm:max-w-max">
        <div className="flex items-center justify-between rounded-full bg-white/[0.03] border border-white/10 px-4 py-2.5 sm:px-6 backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity whitespace-nowrap">
            <Rocket className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-medium tracking-tight text-white">ADSTOCK</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-neutral-400 whitespace-nowrap px-6">
            <a href="#como-funciona" className="hover:text-white transition-colors">Como funciona</a>
            <a href="#agentes" className="hover:text-white transition-colors">Agentes</a>
            <a href="#resultados" className="hover:text-white transition-colors">Resultados</a>
            <a href="#precos" className="hover:text-white transition-colors">Precos</a>
          </nav>
          <div className="flex items-center gap-3 pl-2 sm:pl-0">
            <Link href="/login" className="hidden sm:block text-xs font-medium text-neutral-300 hover:text-white transition-all">Login</Link>
            <Link href="/register" className="inline-flex items-center justify-center rounded-full bg-white text-black px-4 py-1.5 text-xs font-medium transition-all hover:bg-neutral-200 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              Comecar agora
            </Link>
          </div>
        </div>
      </header>

      {/* ══════ HERO ══════ */}
      <section className="pt-40 pb-24 relative z-10 mx-auto max-w-7xl px-6 text-center flex flex-col items-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          5 agentes de IA. 24 horas. Zero esforco.
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, delay: 0.1 }}
          className="max-w-4xl text-5xl md:text-7xl font-medium tracking-tight text-white leading-[1.1]">
          Marketing que<br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-600 bg-clip-text text-transparent animate-pulse">
            trabalha enquanto voce dorme.
          </span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-6 max-w-2xl text-sm md:text-base text-neutral-400 leading-relaxed font-light">
          Uma agencia completa de marketing operada por IA. Eles fazem reuniao, criam artes, analisam metricas, publicam posts — sozinhos. Voce so aprova.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link href="/register"
            className="relative inline-flex items-center justify-center overflow-hidden rounded-full border border-white/10 px-6 py-3 text-xs font-medium text-white transition-all hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(251,191,36,0.2)] hover:-translate-y-0.5 active:scale-95"
            style={{ background: "radial-gradient(65.28% 65.28% at 50% 100%, rgba(251,191,36,0.4) 0%, rgba(251,191,36,0) 100%), linear-gradient(0deg, #171717, #171717)" }}>
            Contratar minha equipe
            <ArrowRight className="w-4 h-4 ml-2 text-amber-400" />
          </Link>
          <a href="#como-funciona"
            className="group relative inline-flex items-center justify-center rounded-full px-6 py-3 text-xs font-medium text-neutral-300 transition-all hover:text-white hover:bg-white/5 active:scale-95">
            <Play className="w-4 h-4 mr-2 group-hover:text-amber-400 transition-colors" />
            Ver como funciona
          </a>
        </motion.div>

        {/* Hero Mockup — Agent Office */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.5 }}
          className="mt-20 w-full max-w-6xl relative">
          <div className="absolute inset-0 bg-amber-500/10 blur-[100px] rounded-full scale-75 transform -translate-y-10" />
          <div className="relative z-10 rounded-2xl overflow-hidden border border-white/[0.06] shadow-2xl shadow-black/80 ring-1 ring-white/5 hover:scale-[1.01] transition-transform duration-700"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)", backdropFilter: "blur(24px)" }}>

            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 bg-black/40">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-white/20" />
                  <div className="h-2 w-2 rounded-full bg-white/20" />
                  <div className="h-2 w-2 rounded-full bg-white/20" />
                </div>
                <div className="hidden sm:flex items-center gap-2 rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-neutral-400 border border-white/5">
                  <Calendar className="w-3 h-3" />
                  Daily · 09:00
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 border border-amber-500/20">
                <Users className="w-3 h-3" />
                5 agentes online
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[450px] bg-gradient-to-br from-[#0a0a0a] to-[#050505]">
              {/* Agents sidebar */}
              <div className="hidden lg:block lg:col-span-3 border-r border-white/[0.06] p-4">
                <p className="text-xs font-medium text-neutral-500 mb-3 uppercase">Seu time</p>
                <ul className="space-y-1.5 text-xs text-neutral-400">
                  <li className="flex items-center gap-2 rounded-md bg-amber-500/10 text-amber-200 px-2 py-1.5 border border-amber-500/20"><Crown className="w-3 h-3" /> Maya Ferreira</li>
                  <li className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5 transition-colors ml-4"><Pen className="w-3 h-3" /> Bruno Costa</li>
                  <li className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5 transition-colors ml-4"><BarChart3 className="w-3 h-3" /> Lena Souza</li>
                  <li className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5 transition-colors ml-4"><Image className="w-3 h-3" /> Carlos Lima</li>
                  <li className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5 transition-colors ml-4"><Search className="w-3 h-3" /> Diego Ramos</li>
                </ul>
              </div>

              {/* Center — chat preview */}
              <div className="lg:col-span-6 relative flex items-center justify-center p-8 overflow-hidden">
                <div className="relative w-48 h-48 animate-float">
                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-600/40 to-transparent rounded-full blur-2xl" />
                  <div className="absolute inset-4 rounded-3xl border border-white/20 bg-gradient-to-b from-white/10 to-transparent backdrop-blur-xl flex items-center justify-center shadow-2xl transform -rotate-6 hover:rotate-0 transition-transform duration-1000">
                    <div className="p-4 flex flex-col items-center text-center transform rotate-6 hover:rotate-0 transition-transform duration-1000">
                      <MessageSquare className="w-8 h-8 text-amber-300 mb-2" />
                      <p className="text-[10px] text-neutral-300 font-medium leading-relaxed">Bom dia, time!<br />Prioridades de hoje:<br />calendario +<br />campanha + SEO</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kanban panel */}
              <div className="hidden lg:block lg:col-span-3 border-l border-white/[0.06] p-4 bg-black/20">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.06]">
                  <span className="text-xs font-medium text-neutral-500 uppercase">Kanban</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="bg-white/5 border border-white/5 rounded px-3 py-2"><span className="text-amber-200">TODO</span><p className="text-neutral-400 mt-1">Post motivacional</p></div>
                  <div className="bg-white/5 border border-white/5 rounded px-3 py-2"><span className="text-neutral-300">IN PROGRESS</span><p className="text-neutral-400 mt-1">Carrossel Dia do Cliente</p></div>
                  <div className="bg-white/5 border border-white/5 rounded px-3 py-2"><span className="text-neutral-500">DONE</span><p className="text-neutral-500 mt-1 line-through">Relatorio semanal</p></div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ══════ COMO FUNCIONA ══════ */}
      <section id="como-funciona" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-white">
            Sua agencia em <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-600 bg-clip-text text-transparent">3 passos</span>
          </h2>
          <p className="mt-4 text-neutral-400 text-sm">Setup em 8 minutos. Operacao 100% automatica.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.6 }}
              className="group rounded-2xl p-8 text-center border border-white/[0.06] hover:scale-[1.02] transition-transform duration-500 cursor-default"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", backdropFilter: "blur(24px)" }}>
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                <s.icon className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">{s.title}</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════ AGENTES ══════ */}
      <section id="agentes" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-white">
            Seu time de <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-600 bg-clip-text text-transparent">especialistas</span>
          </h2>
          <p className="mt-4 text-neutral-400 text-sm">5 agentes de IA, cada um especialista em uma area. Eles trabalham juntos, 24 horas por dia.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
          {AGENTS.map((a, i) => (
            <motion.div key={a.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.5 }}
              className="group rounded-2xl p-6 text-center border border-white/[0.06] hover:scale-105 transition-transform duration-500 cursor-default"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", backdropFilter: "blur(24px)" }}>
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                <a.icon className="w-5 h-5 text-amber-400" />
              </div>
              <h4 className="text-sm font-medium text-white">{a.name}</h4>
              <p className="text-xs text-neutral-400 mt-1">{a.role}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════ RESULTADOS ══════ */}
      <section id="resultados" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-white">
            Resultados <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-600 bg-clip-text text-transparent">reais</span>
          </h2>
          <p className="mt-4 text-neutral-400 text-sm">O que nossos clientes estao conquistando com a agencia autonoma.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { stat: "+340%", label: "Alcance no Instagram", desc: "Posts diarios com conteudo relevante, publicados no melhor horario. Engajamento consistente." },
            { stat: "8min", label: "Setup completo", desc: "Do onboarding a primeira publicacao em menos de 10 minutos. Zero configuracao tecnica." },
            { stat: "90%", label: "Taxa de aprovacao", desc: "Conteudo alinhado com a identidade da marca. A IA aprende com cada feedback do CEO." },
          ].map((r, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.6 }}
              className="rounded-2xl p-8 border border-white/[0.06] cursor-default"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", backdropFilter: "blur(24px)" }}>
              <div className="text-4xl font-medium text-white mb-3">{r.stat}</div>
              <div className="text-xs text-neutral-400 uppercase tracking-wider mb-4">{r.label}</div>
              <p className="text-xs text-neutral-500 leading-relaxed">{r.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════ PRECOS ══════ */}
      <section id="precos" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-white">
            Menos que um almoco <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-600 bg-clip-text text-transparent">por dia</span>
          </h2>
          <p className="mt-4 text-neutral-400 text-sm">Sem contrato. Cancele quando quiser.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {PRICING.map((p, i) => (
            <motion.div key={p.name} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.6 }}
              className={`relative rounded-2xl p-8 ${p.popular ? "border border-amber-500/30 bg-amber-500/5" : "border border-white/[0.04]"}`}
              style={!p.popular ? { background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", backdropFilter: "blur(24px)" } : {}}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-semibold px-3 py-0.5 rounded-full uppercase">Mais popular</div>
              )}
              <h4 className="text-lg font-medium text-white mb-1">{p.name}</h4>
              <div className="mt-4 mb-6"><span className="text-4xl font-medium text-white">{p.price}</span><span className="text-xs text-neutral-500">/mes</span></div>
              <ul className="space-y-2 text-xs text-neutral-400 mb-8">
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-amber-400" />{p.agents} agentes</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-amber-400" />{p.posts} posts</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-amber-400" />{p.redes} redes sociais</li>
              </ul>
              <Link href="/register" className={`block text-center rounded-full py-2.5 text-xs font-medium transition-all ${p.popular ? "bg-amber-500 text-black font-semibold hover:bg-amber-400" : "bg-white/5 border border-white/10 text-white hover:bg-white/10"}`}>
                Comecar
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-white">
            Perguntas <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-600 bg-clip-text text-transparent">frequentes</span>
          </h2>
        </div>
        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <details key={i} className="group cursor-pointer rounded-2xl p-5 border border-white/[0.06]"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", backdropFilter: "blur(24px)" }}>
              <summary className="flex items-center justify-between text-sm font-medium text-white marker:hidden">
                <span>{item.q}</span>
                <Plus className="w-5 h-5 text-neutral-400 transition-transform duration-300 group-open:rotate-45" />
              </summary>
              <p className="mt-4 text-xs text-neutral-400 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="relative z-10 border-t border-white/[0.06] py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Rocket className="w-4 h-4 text-amber-400" />
            Adstock © 2025 — Sua agencia autonoma de marketing
          </div>
          <div className="flex items-center gap-6 text-xs text-neutral-500">
            <a href="#" className="hover:text-neutral-300 transition-colors">Termos</a>
            <a href="#" className="hover:text-neutral-300 transition-colors">Privacidade</a>
            <a href="#" className="hover:text-neutral-300 transition-colors">Contato</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
