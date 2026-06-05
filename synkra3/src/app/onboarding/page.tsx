"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/useAuth"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { ArrowRight, ArrowLeft, Loader2, CheckCircle2, Search, Sparkles } from "lucide-react"
import { toast } from "sonner"

const TOTAL = 8

const INDUSTRIES = ["Moda","Alimentos","Tech","Saude","Imoveis","Educacao","Beleza","E-commerce"]
const INDUSTRY_ICONS: Record<string, string> = { Moda:"S", Alimentos:"A", Tech:"T", Saude:"H", Imoveis:"I", Educacao:"E", Beleza:"B", "E-commerce":"C" }

const CHALLENGES = [
  { id: "no-idea", label: "Nao sei o que postar" },
  { id: "no-time", label: "Nao tenho tempo" },
  { id: "no-metrics", label: "Nao sei se funciona" },
  { id: "tried", label: "Ja tentei, nao vejo resultado" },
  { id: "scale", label: "Quero escalar" },
]

const NETWORKS = ["Instagram", "LinkedIn", "Pinterest", "Blog"]

const AGENTS = [
  { name: "Maya", color: "#000000", steps: [0,4], img: "/agents/Maya.png" },
  { name: "Bruno", color: "#000000", steps: [1,3], img: "/agents/Bruno.png" },
  { name: "Lena", color: "#000000", steps: [2], img: "/agents/Lena.png" },
  { name: "Carlos", color: "#000000", steps: [6], img: "/agents/Carlos.png" },
  { name: "Diego", color: "#000000", steps: [5], img: "/agents/Diego.png" },
]

function getAgent(step: number) { return AGENTS.find(a => a.steps.includes(step)) }

export default function OnboardingPage() {
  const router = useRouter()
  const { user: session, loading: authLoading } = useAuth()
  const [step, setStep] = useState(0)
  const [orgId, setOrgId] = useState("")
  const [loading, setLoading] = useState(false)
  const [companyName, setCompanyName] = useState("")
  const [industry, setIndustry] = useState("")
  const [challenge, setChallenge] = useState("")
  const [networks, setNetworks] = useState<string[]>([])
  const [whatYouSell, setWhatYouSell] = useState("")
  const [idealCustomer, setIdealCustomer] = useState("")
  const [brandTone, setBrandTone] = useState("")
  const [website, setWebsite] = useState("")
  const [goals, setGoals] = useState("")
  const [competitors, setCompetitors] = useState("")
  const [scanning, setScanning] = useState(false)
  const [scanSteps, setScanSteps] = useState<number[]>([])
  const [scanDone, setScanDone] = useState(false)
  const [dailyTime, setDailyTime] = useState("09:00")
  const [weeklyDay, setWeeklyDay] = useState("monday")
  const [workMode, setWorkMode] = useState("KANBAN")
  const [showFinal, setShowFinal] = useState(false)
  const [finalLoading, setFinalLoading] = useState(false)
  const [finalReady, setFinalReady] = useState(false)
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([])

  useEffect(() => { if (!authLoading && !session) router.push("/login") }, [authLoading, session, router])

  useEffect(() => {
    const savedOrgId = localStorage.getItem("onboarding_orgId")
    const savedStep = localStorage.getItem("onboarding_step")
    if (savedOrgId) {
      setOrgId(savedOrgId)
      if (savedStep) {
        const stepNum = parseInt(savedStep, 10)
        if (stepNum > 0 && stepNum < TOTAL) {
          setStep(stepNum)
        }
      }
    }
  }, [])

  const createOrg = async () => {
    if (!companyName) return; setLoading(true)
    try {
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString(36)
      const res = await fetch("/api/organizations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: companyName, slug, description: `Agencia da ${companyName}` }) })
      if (!res.ok) throw new Error("Erro")
      const org = await res.json(); setOrgId(org.id); setStep(1)
      localStorage.setItem("onboarding_orgId", org.id)
    } catch (err: any) { toast.error("Erro ao criar agencia") }
    finally { setLoading(false) }
  }

  const saveStep = async (ns: number) => {
    if (!orgId) return
    const data: any = { step: ns }
    if (ns >= 2) data.industry = industry
    if (ns >= 3) data.mainChallenges = challenge
    if (ns >= 4) data.currentTools = networks
    if (ns >= 5) { data.brandVoice = brandTone; data.targetAudience = idealCustomer; data.goals = goals ? goals.split(",").map((g: string) => g.trim()) : [] }
    if (ns >= 6) { data.website = website; data.competitors = competitors }
    await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: orgId, ...data }) })
    localStorage.setItem("onboarding_step", ns.toString())
  }

  useEffect(() => {
    if (step === 6 && orgId) {
      const params = new URLSearchParams(window.location.search)
      const connected = params.get("connected")
      if (connected) {
        setConnectedIntegrations(prev => prev.includes(connected) ? prev : [...prev, connected])
        params.delete("connected")
        const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname
        window.history.replaceState({}, "", newUrl)
      }
      fetch(`/api/integrations?orgId=${orgId}`)
        .then(r => r.json())
        .then(integrations => {
          if (Array.isArray(integrations)) {
            setConnectedIntegrations(integrations.map((i: any) => i.platform))
          }
        })
        .catch(() => {})
    }
  }, [step, orgId])

  const next = async () => {
    if (step === TOTAL - 1) {
      setShowFinal(true)
      setLoading(true)
      await saveStep(step + 1)
      if (orgId && workMode) {
        await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: orgId, workflowMethod: workMode, dailyTime }) })
      }
      await fetch("/api/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: orgId, completed: true }) })
      localStorage.setItem("onboarding_just_completed", orgId)
      setLoading(false)
      setFinalLoading(true)
      // Animate the "creating" steps
      setTimeout(() => setFinalReady(true), 2500)
      return
    }
    await saveStep(step + 1); setStep(step + 1)
  }

  const enterOffice = () => {
    localStorage.removeItem("onboarding_orgId")
    localStorage.removeItem("onboarding_step")
    router.push(`/workspace/${orgId}`)
  }

  const scanSite = async () => {
    if (!website || scanning) return; setScanning(true); setScanSteps([])
    const siteSteps = ["Acessando...", "Identificando...", "Mapeando...", "Extraindo..."]
    for (let i = 0; i < siteSteps.length; i++) { await new Promise(r => setTimeout(r, 500 + Math.random() * 300)); setScanSteps(prev => [...prev, i]) }
    try {
      const res = await fetch("/api/scrape", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: website }) })
      if (res.ok) { const data = await res.json(); if (data.title && !whatYouSell) setWhatYouSell(data.title); if (data.description && !idealCustomer) setIdealCustomer(data.description) }
    } catch {}
    setScanDone(true); setScanning(false)
  }

  const agent = getAgent(step)

  // ── Final screen: "Sua agência está pronta!" ──
  if (showFinal) {
    return (
      <div className="min-h-screen bg-editor-bg flex items-center justify-center p-4">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-8 max-w-[380px]"
          >
            {!finalReady ? (
              <div className="space-y-6">
                <div className="relative w-14 h-14 mx-auto">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-xl border-2 border-white/[0.04] border-t-primary/60"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-editor-ink">Criando sua agencia...</p>
                  <p className="text-[11px] text-editor-muted/60">Contratando agentes, organizando escritorio, preparando a primeira daily</p>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="space-y-6"
              >
                <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary/80" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-xl font-bold text-editor-ink">
                    Sua agencia esta pronta!
                  </h2>
                  <p className="text-[12px] text-editor-muted max-w-[280px] mx-auto leading-relaxed">
                    {companyName} foi criada com 5 agentes especializados.
                    Eles ja estao no escritorio te esperando para a primeira daily.
                  </p>
                </div>

                {/* Agent preview */}
                <div className="grid grid-cols-5 gap-2 pt-2">
                  {AGENTS.map((a) => (
                    <div key={a.name} className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 rounded-xl ring-1 ring-white/[0.06] overflow-hidden">
                        {a.img ? <img src={a.img} className="w-full h-full object-cover" alt={a.name} /> :
                        <div className="w-full h-full rounded-xl flex items-center justify-center text-editor-ink text-[10px] font-bold bg-white/[0.04]">{a.name[0]}</div>}
                      </div>
                      <span className="text-[8px] text-editor-muted">{a.name}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2">
                  <p className="text-[12px] text-editor-ink/70">
                    Vou reunir o time agora para a primeira daily.
                  </p>
                  <p className="text-[11px] text-editor-muted">
                    Voce precisa estar presente para alinhar tudo com eles.
                  </p>
                  <button
                    onClick={enterOffice}
                    className="mt-3 px-8 py-2.5 rounded-xl bg-primary/80 backdrop-blur-sm border border-primary/30 hover:bg-primary text-primary-foreground text-sm font-medium transition-all active:scale-[0.97]"
                  >
                    Entrar no escritorio →
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-editor-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-[0.02]"><iframe src="http://localhost:3100" className="w-full h-full border-0 pointer-events-none" /></div>

      <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-[440px]">
        <div className="flex items-center gap-1.5 mb-6">
          {Array.from({ length: TOTAL }).map((_, i) => (<div key={i} className={cn("w-1.5 h-1.5 rounded-pill transition-all", i <= step ? "bg-white/40" : "bg-white/[0.06]")} />))}
        </div>

        <div className="bg-editor-surface border border-editor-border  p-6 shadow-[0_0_40px_rgba(255,255,255,0.015)]">
          {agent && (
            <div className="flex items-end gap-2 mb-4">
              {agent.img ? (
                <img src={agent.img} className="w-8 h-8  object-cover flex-shrink-0" alt={agent.name} />
              ) : (
                <div className="w-7 h-7 rounded flex items-center justify-center text-black text-[10px] font-bold" style={{ backgroundColor: agent.color + "30" }}>{agent.name[0]}</div>
              )}
              <div className="bg-white/[0.03] border border-editor-border  rounded-bl-sm px-3 py-2 max-w-[300px]">
                <p className="text-[11px] font-semibold text-editor-ink">{agent.name}</p>
                <p className="text-[11px] text-editor-muted">
                  {step === 0 && "Primeiro: me conta o nome da sua empresa!"}
                  {step === 1 && `E o que a ${companyName || "empresa"} faz?`}
                  {step === 2 && "Qual o maior problema?"}
                  {step === 3 && "Onde voce esta hoje?"}
                  {step === 4 && "Agora preciso entender sua marca."}
                  {step === 5 && "Se tiver site, me manda a URL."}
                  {step === 6 && "Quanto mais conectado, melhor."}
                  {step === 7 && "Como voce quer que a gente trabalhe?"}
                </p>
              </div>
            </div>
          )}

          {step === 0 && (
            <input className="w-full bg-transparent border-0 border-b border-editor-border py-2 text-lg font-semibold text-editor-ink placeholder-white/10 focus:outline-none focus:border-white/20" placeholder="Nome da sua empresa" value={companyName} onChange={e => setCompanyName(e.target.value)} autoFocus />
          )}

          {step === 1 && (
            <div className="grid grid-cols-4 gap-1.5">
              {INDUSTRIES.map(ind => (
                <button key={ind} onClick={() => setIndustry(ind)} className={cn("p-2  border text-[11px] text-center transition-all", industry === ind ? "border-white/20 bg-white/[0.04] text-editor-ink" : "border-editor-border bg-transparent text-editor-muted hover:border-editor-border")}>{ind}</button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-1">
              {CHALLENGES.map(ch => (
                <button key={ch.id} onClick={() => setChallenge(ch.id)} className={cn("w-full text-left p-2.5  border text-[11px] transition-all", challenge === ch.id ? "border-white/15 bg-white/[0.03] text-editor-ink" : "border-editor-border bg-transparent text-editor-muted hover:border-editor-border")}>{ch.label}</button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-wrap gap-1.5">
              {NETWORKS.map(nw => { const sel = networks.includes(nw); return (
                <button key={nw} onClick={() => setNetworks(prev => prev.includes(nw) ? prev.filter(n => n !== nw) : [...prev, nw])} className={cn("px-3 py-1.5  border text-[11px] transition-all", sel ? "border-white/20 bg-white/[0.04] text-editor-ink" : "border-editor-border bg-transparent text-editor-muted hover:border-editor-border")}>{nw}</button>
              )})}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <label className="text-[10px] text-editor-muted block mb-1">O que voce vende?</label>
                <input className="w-full bg-white/[0.02] border border-editor-border  px-3 py-2 text-xs text-editor-ink placeholder-white/10 focus:outline-none focus:border-white/15" placeholder="Ex: Roupas femininas artesanais..." value={whatYouSell} onChange={e => setWhatYouSell(e.target.value)} />
              </motion.div>
              <AnimatePresence>
                {whatYouSell && (
                  <motion.div initial={{ opacity: 0, y: 12, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }} transition={{ duration: 0.25 }}>
                    <label className="text-[10px] text-editor-muted block mb-1">Cliente ideal</label>
                    <input className="w-full bg-white/[0.02] border border-editor-border  px-3 py-2 text-xs text-editor-ink placeholder-white/10 focus:outline-none focus:border-white/15" placeholder="Ex: Mulheres 25-40..." value={idealCustomer} onChange={e => setIdealCustomer(e.target.value)} />
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {idealCustomer && (
                  <motion.div initial={{ opacity: 0, y: 12, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }} transition={{ duration: 0.25 }}>
                    <label className="text-[10px] text-editor-muted block mb-1">Tom da marca</label>
                    <input className="w-full bg-white/[0.02] border border-editor-border  px-3 py-2 text-xs text-editor-ink placeholder-white/10 focus:outline-none focus:border-white/15" placeholder='Ex: "descontraido e proximo"' value={brandTone} onChange={e => setBrandTone(e.target.value)} />
                  </motion.div>
                )}
                {brandTone && (
                  <motion.div initial={{ opacity: 0, y: 12, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }} transition={{ duration: 0.25 }}>
                    <label className="text-[10px] text-editor-muted block mb-1">Objetivos (separados por virgula)</label>
                    <input className="w-full bg-white/[0.02] border border-editor-border  px-3 py-2 text-xs text-editor-ink placeholder-white/10 focus:outline-none focus:border-white/15" placeholder="Ex: aumentar vendas, fidelizar clientes, lancar produto" value={goals} onChange={e => setGoals(e.target.value)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input className="flex-1 bg-white/[0.02] border border-editor-border  px-3 py-2 text-xs text-editor-ink placeholder-white/10 focus:outline-none focus:border-white/15" placeholder="https://seusite.com" value={website} onChange={e => setWebsite(e.target.value)} />
                <button onClick={scanSite} disabled={!website || scanning || scanDone} className={cn("px-3 py-2  text-[11px] font-medium transition-all", scanDone ? "bg-white/[0.04] text-editor-muted" : scanning ? "bg-white/[0.02] text-editor-muted" : "bg-white/[0.05] text-editor-muted hover:bg-white/[0.08]")}>
                  {scanDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Ler"}
                </button>
              </div>
              {scanning && (
                <div className="space-y-1">
                  {["Acessando...", "Identificando...", "Mapeando...", "Extraindo..."].map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">{scanSteps.includes(i) ? <CheckCircle2 className="w-3 h-3 text-editor-muted" /> : i === scanSteps.length ? <Loader2 className="w-3 h-3 text-editor-muted animate-spin" /> : <div className="w-3 h-3 rounded-pill border border-editor-border" />}<span className={scanSteps.includes(i) ? "text-editor-muted" : i === scanSteps.length ? "text-editor-muted" : "text-editor-muted"}>{s}</span></div>
                  ))}
                </div>
              )}
              <button onClick={() => { setScanDone(true); next() }} className="text-editor-muted text-[10px] hover:text-editor-muted">Nao tenho site — pular</button>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <label className="text-[10px] text-editor-muted block mb-1 mt-3">Concorrentes (opcional)</label>
                <input className="w-full bg-white/[0.02] border border-editor-border  px-3 py-2 text-xs text-editor-ink placeholder-white/10 focus:outline-none focus:border-white/15" placeholder="Ex: concorrente1.com.br, concorrente2.com.br" value={competitors} onChange={e => setCompetitors(e.target.value)} />
              </motion.div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <p className="text-[10px] text-editor-muted mb-2">Conecte pelo menos uma plataforma para continuar:</p>
              {[
                { name: "Instagram", platform: "instagram" },
                { name: "Google Search Console", platform: "google" },
                { name: "LinkedIn", platform: "linkedin" },
                { name: "Canva", platform: "canva" },
              ].map(int => {
                const isConnected = connectedIntegrations.includes(int.platform)
                return (
                  <div key={int.platform} className="flex items-center justify-between p-2.5 border border-editor-border">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-editor-muted">{int.name}</span>
                      {isConnected && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                    </div>
                    <button
                      onClick={() => {
                        if (int.platform === "canva") {
                          toast.info("Canva sera configurado depois")
                          return
                        }
                        window.location.href = `/api/integrations/${int.platform}/auth?orgId=${orgId}&returnTo=/onboarding`
                      }}
                      disabled={isConnected}
                      className={cn(
                        "px-3 py-1 rounded border text-[10px] transition-colors",
                        isConnected
                          ? "border-green-500/30 text-green-500/70 bg-green-500/5 cursor-default"
                          : "border-editor-border text-editor-muted hover:bg-white/[0.03]"
                      )}
                    >
                      {isConnected ? "Conectado" : "Conectar"}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between"><span className="text-[11px] text-editor-muted">Daily</span><select className="bg-white/[0.02] border border-editor-border rounded px-2 py-1 text-[11px] text-editor-muted" value={dailyTime} onChange={e => setDailyTime(e.target.value)}>{["07:00","08:00","09:00","10:00"].map(t => <option key={t}>{t}</option>)}</select></div>
              <div className="flex items-center justify-between"><span className="text-[11px] text-editor-muted">Weekly</span><select className="bg-white/[0.02] border border-editor-border rounded px-2 py-1 text-[11px] text-editor-muted" value={weeklyDay} onChange={e => setWeeklyDay(e.target.value)}>{[{v:"monday",l:"Segunda"},{v:"tuesday",l:"Terca"}].map(d => <option key={d.v} value={d.v}>{d.l}</option>)}</select></div>
              <div>
                <span className="text-[11px] text-editor-muted block mb-1">Metodo</span>
                {[{v:"KANBAN",l:"Kanban"},{v:"SPRINTS",l:"Sprints"}].map(m => (
                  <button key={m.v} onClick={() => setWorkMode(m.v)} className={cn("w-full text-left p-2 rounded border text-[11px] mt-1", workMode === m.v ? "border-white/15 bg-white/[0.03] text-editor-muted" : "border-editor-border text-editor-muted")}>{m.l}</button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-editor-border">
            {step > 0 ? <button onClick={() => setStep(step - 1)} className="text-editor-muted hover:text-editor-muted text-[11px] flex items-center gap-1"><ArrowLeft className="w-3 h-3" />Voltar</button> : <div />}
            <button
              onClick={step === 0 ? createOrg : next}
              disabled={loading || (step === 0 && !companyName) || (step === 6 && connectedIntegrations.length === 0)}
              className={cn(
                "px-6 py-2 text-[11px] font-medium transition-all flex items-center gap-2",
                (step === TOTAL - 1 || step === 0) ? "bg-white/10 text-editor-ink hover:bg-white/15" : "bg-white/[0.04] text-editor-muted hover:bg-white/[0.08]",
                (loading || (step === 0 && !companyName) || (step === 6 && connectedIntegrations.length === 0)) && "opacity-30 cursor-not-allowed"
              )}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {step === 0 ? "Comecar" : step === TOTAL - 1 ? "Criar agencia" : "Proximo"}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
