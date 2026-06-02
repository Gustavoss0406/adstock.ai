"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { ArrowRight, ArrowLeft, Loader2, CheckCircle2, Search } from "lucide-react"
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
  { name: "Maya", color: "#ff385c", steps: [0,4], img: "/agents/Maya.png" },
  { name: "Bruno", color: "#2563eb", steps: [1,3], img: "/agents/Bruno.png" },
  { name: "Lena", color: "#2bac76", steps: [2], img: "/agents/Lena.png" },
  { name: "Carlos", color: "#d97706", steps: [6], img: "/agents/Carlos.png" },
  { name: "Diego", color: "#dc2626", steps: [5], img: "/agents/Diego.png" },
]

function getAgent(step: number) { return AGENTS.find(a => a.steps.includes(step)) }

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
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
  const [scanning, setScanning] = useState(false)
  const [scanSteps, setScanSteps] = useState<number[]>([])
  const [scanDone, setScanDone] = useState(false)
  const [dailyTime, setDailyTime] = useState("09:00")
  const [weeklyDay, setWeeklyDay] = useState("monday")
  const [workMode, setWorkMode] = useState("KANBAN")

  useEffect(() => { if (status === "unauthenticated") router.push("/login") }, [status, router])

  const createOrg = async () => {
    if (!companyName) return; setLoading(true)
    try {
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString(36)
      const res = await fetch("/api/organizations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: companyName, slug, description: `Agencia da ${companyName}` }) })
      if (!res.ok) throw new Error("Erro")
      const org = await res.json(); setOrgId(org.id); setStep(1)
    } catch (err: any) { toast.error("Erro ao criar agencia") }
    finally { setLoading(false) }
  }

  const saveStep = async (ns: number) => {
    if (!orgId) return
    const data: any = { step: ns }
    if (ns >= 2) data.industry = industry
    if (ns >= 3) data.mainChallenges = challenge
    if (ns >= 4) data.currentTools = networks
    if (ns >= 5) { data.brandVoice = brandTone; data.targetAudience = idealCustomer }
    if (ns >= 6) data.website = website
    await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: orgId, ...data }) })
  }

  const next = async () => {
    if (step === TOTAL - 1) {
      setLoading(true)
      await saveStep(step + 1)
      // Save methodology preference to officeSettings
      if (orgId && workMode) {
        await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: orgId, workflowMethod: workMode, dailyTime }) })
      }
      await fetch("/api/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: orgId, completed: true }) })
      toast.success("Pronto!")
      setTimeout(() => router.push(`/workspace/${orgId}`), 500)
      return
    }
    await saveStep(step + 1); setStep(step + 1)
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

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-[0.02]"><iframe src="http://localhost:3100" className="w-full h-full border-0 pointer-events-none" /></div>

      <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-[440px]">
        <div className="flex items-center gap-1.5 mb-6">
          {Array.from({ length: TOTAL }).map((_, i) => (<div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all", i <= step ? "bg-white/40" : "bg-white/[0.06]")} />))}
        </div>

        <div className="bg-[#111] border border-white/[0.04] rounded-xl p-6 shadow-[0_0_40px_rgba(255,255,255,0.015)]">
          {agent && (
            <div className="flex items-end gap-2 mb-4">
              {agent.img ? (
                <img src={agent.img} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" alt={agent.name} />
              ) : (
                <div className="w-7 h-7 rounded flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: agent.color + "30" }}>{agent.name[0]}</div>
              )}
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg rounded-bl-sm px-3 py-2 max-w-[300px]">
                <p className="text-[11px] font-semibold text-white/60">{agent.name}</p>
                <p className="text-[11px] text-white/30">
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
            <input className="w-full bg-transparent border-0 border-b border-white/[0.08] py-2 text-lg font-semibold text-white/80 placeholder-white/10 focus:outline-none focus:border-white/20" placeholder="Nome da sua empresa" value={companyName} onChange={e => setCompanyName(e.target.value)} autoFocus />
          )}

          {step === 1 && (
            <div className="grid grid-cols-4 gap-1.5">
              {INDUSTRIES.map(ind => (
                <button key={ind} onClick={() => setIndustry(ind)} className={cn("p-2 rounded-lg border text-[11px] text-center transition-all", industry === ind ? "border-white/20 bg-white/[0.04] text-white/70" : "border-white/[0.04] bg-transparent text-white/30 hover:border-white/[0.08]")}>{ind}</button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-1">
              {CHALLENGES.map(ch => (
                <button key={ch.id} onClick={() => setChallenge(ch.id)} className={cn("w-full text-left p-2.5 rounded-lg border text-[11px] transition-all", challenge === ch.id ? "border-white/15 bg-white/[0.03] text-white/60" : "border-white/[0.04] bg-transparent text-white/25 hover:border-white/[0.08]")}>{ch.label}</button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-wrap gap-1.5">
              {NETWORKS.map(nw => { const sel = networks.includes(nw); return (
                <button key={nw} onClick={() => setNetworks(prev => prev.includes(nw) ? prev.filter(n => n !== nw) : [...prev, nw])} className={cn("px-3 py-1.5 rounded-lg border text-[11px] transition-all", sel ? "border-white/20 bg-white/[0.04] text-white/60" : "border-white/[0.04] bg-transparent text-white/25 hover:border-white/[0.08]")}>{nw}</button>
              )})}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <label className="text-[10px] text-white/20 block mb-1">O que voce vende?</label>
                <input className="w-full bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2 text-xs text-white/60 placeholder-white/10 focus:outline-none focus:border-white/15" placeholder="Ex: Roupas femininas artesanais..." value={whatYouSell} onChange={e => setWhatYouSell(e.target.value)} />
              </motion.div>
              <AnimatePresence>
                {whatYouSell && (
                  <motion.div initial={{ opacity: 0, y: 12, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }} transition={{ duration: 0.25 }}>
                    <label className="text-[10px] text-white/20 block mb-1">Cliente ideal</label>
                    <input className="w-full bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2 text-xs text-white/60 placeholder-white/10 focus:outline-none focus:border-white/15" placeholder="Ex: Mulheres 25-40..." value={idealCustomer} onChange={e => setIdealCustomer(e.target.value)} />
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {idealCustomer && (
                  <motion.div initial={{ opacity: 0, y: 12, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }} transition={{ duration: 0.25 }}>
                    <label className="text-[10px] text-white/20 block mb-1">Tom da marca</label>
                    <input className="w-full bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2 text-xs text-white/60 placeholder-white/10 focus:outline-none focus:border-white/15" placeholder='Ex: "descontraido e proximo"' value={brandTone} onChange={e => setBrandTone(e.target.value)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2 text-xs text-white/60 placeholder-white/10 focus:outline-none focus:border-white/15" placeholder="https://seusite.com" value={website} onChange={e => setWebsite(e.target.value)} />
                <button onClick={scanSite} disabled={!website || scanning || scanDone} className={cn("px-3 py-2 rounded-lg text-[11px] font-medium transition-all", scanDone ? "bg-white/[0.04] text-white/30" : scanning ? "bg-white/[0.02] text-white/10" : "bg-white/[0.05] text-white/50 hover:bg-white/[0.08]")}>
                  {scanDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Ler"}
                </button>
              </div>
              {scanning && (
                <div className="space-y-1">
                  {["Acessando...", "Identificando...", "Mapeando...", "Extraindo..."].map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">{scanSteps.includes(i) ? <CheckCircle2 className="w-3 h-3 text-white/20" /> : i === scanSteps.length ? <Loader2 className="w-3 h-3 text-white/30 animate-spin" /> : <div className="w-3 h-3 rounded-full border border-white/[0.06]" />}<span className={scanSteps.includes(i) ? "text-white/20" : i === scanSteps.length ? "text-white/40" : "text-white/10"}>{s}</span></div>
                  ))}
                </div>
              )}
              <button onClick={() => { setScanDone(true); next() }} className="text-white/10 text-[10px] hover:text-white/25">Nao tenho site — pular</button>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-2">
              {["Instagram","Google Search Console","LinkedIn","Canva"].map(int => (
                <div key={int} className="flex items-center justify-between p-2.5 rounded-lg border border-white/[0.04]">
                  <span className="text-[11px] text-white/40">{int}</span>
                  <button className="px-3 py-1 rounded border border-white/[0.06] text-[10px] text-white/20 hover:bg-white/[0.03]">Conectar</button>
                </div>
              ))}
              <button onClick={next} className="text-white/10 text-[10px] hover:text-white/25 block mx-auto mt-3">Fazer depois</button>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between"><span className="text-[11px] text-white/30">Daily</span><select className="bg-white/[0.02] border border-white/[0.05] rounded px-2 py-1 text-[11px] text-white/50" value={dailyTime} onChange={e => setDailyTime(e.target.value)}>{["07:00","08:00","09:00","10:00"].map(t => <option key={t}>{t}</option>)}</select></div>
              <div className="flex items-center justify-between"><span className="text-[11px] text-white/30">Weekly</span><select className="bg-white/[0.02] border border-white/[0.05] rounded px-2 py-1 text-[11px] text-white/50" value={weeklyDay} onChange={e => setWeeklyDay(e.target.value)}>{[{v:"monday",l:"Segunda"},{v:"tuesday",l:"Terca"}].map(d => <option key={d.v} value={d.v}>{d.l}</option>)}</select></div>
              <div>
                <span className="text-[11px] text-white/30 block mb-1">Metodo</span>
                {[{v:"KANBAN",l:"Kanban"},{v:"SPRINTS",l:"Sprints"}].map(m => (
                  <button key={m.v} onClick={() => setWorkMode(m.v)} className={cn("w-full text-left p-2 rounded border text-[11px] mt-1", workMode === m.v ? "border-white/15 bg-white/[0.03] text-white/50" : "border-white/[0.04] text-white/25")}>{m.l}</button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.06]">
            {step > 0 ? <button onClick={() => setStep(step - 1)} className="text-white/15 hover:text-white/30 text-[11px] flex items-center gap-1"><ArrowLeft className="w-3 h-3" />Voltar</button> : <div />}
            <button onClick={step === 0 ? createOrg : next} disabled={loading || (step === 0 && !companyName)} className={cn("px-6 py-2 rounded-lg text-[11px] font-medium transition-all flex items-center gap-2", (step === TOTAL - 1 || step === 0) ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08]", (loading || (step === 0 && !companyName)) && "opacity-30")}>
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
