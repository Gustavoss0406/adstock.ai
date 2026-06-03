"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn, getAgentGradient, getAgentInitials, getRoleLabel, formatCurrency } from "@/lib/utils"
import { Agent } from "@prisma/client"
import { X, Star, TrendingUp, MessageCircle, ChevronUp, Trash2, Briefcase, Clock, Users, Heart } from "lucide-react"
import { toast } from "sonner"

interface AgentProfileProps {
  agent: Agent
  orgId: string
  onClose: () => void
  onPromote?: () => void
  onFire?: () => void
}

export function AgentProfile({ agent, orgId, onClose, onPromote, onFire }: AgentProfileProps) {
  const [showPromote, setShowPromote] = useState(false)
  const [showFire, setShowFire] = useState(false)
  const [fireReason, setFireReason] = useState("")
  const [hireAfterFire, setHireAfterFire] = useState(true)
  const [showCoach, setShowCoach] = useState(false)
  const [coachMsg, setCoachMsg] = useState("")
  const [coachReply, setCoachReply] = useState("")
  const [coaching, setCoaching] = useState(false)
  const [colleagues, setColleagues] = useState<Agent[]>([])

  const initials = getAgentInitials(agent.name)
  const gradient = getAgentGradient(agent.role)
  const levelLabel = agent.level >= 10 ? "Diretor" : agent.level >= 7 ? "Senior" : agent.level >= 4 ? "Pleno" : agent.level >= 2 ? "Junior" : "Estagiario"
  const opinionWeight = Math.min(agent.level * 10, 100)

  // Time in company
  const daysInCompany = Math.max(1, Math.floor((Date.now() - new Date(agent.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
  const timeLabel = daysInCompany < 1 ? "Hoje" : daysInCompany === 1 ? "1 dia" : daysInCompany < 30 ? `${daysInCompany} dias` : daysInCompany < 365 ? `${Math.floor(daysInCompany / 30)} meses` : `${Math.floor(daysInCompany / 365)} anos`

  // Load colleagues
  useEffect(() => {
    fetch(`/api/organizations/${orgId}`).then(r => r.json()).then(d => {
      if (d.agents) setColleagues(d.agents.filter((a: Agent) => a.id !== agent.id && a.status !== "FIRED"))
    }).catch(() => {})
  }, [orgId, agent.id])

  const handlePromote = async () => {
    try {
      const newLevel = agent.level + 1
      await fetch(`/api/agents/${agent.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: newLevel, salary: Math.round(agent.salary * 1.2), morale: Math.min(agent.morale + 10, 100) }),
      })
      toast.success(`${agent.name} promovido!`)
      setShowPromote(false); onPromote?.()
    } catch { toast.error("Erro ao promover") }
  }

  const handleFire = async () => {
    try {
      await fetch(`/api/agents/${agent.id}?reason=${fireReason || "Decisao do gestor"}`, { method: "DELETE" })
      toast.success(`${agent.name} demitido.`)
      setShowFire(false); onFire?.()
    } catch { toast.error("Erro ao demitir") }
  }

  const handleCoach = async () => {
    if (!coachMsg.trim()) return
    setCoaching(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, message: `[FEEDBACK DO GESTOR]: ${coachMsg}`, channelId: null, context: `Agencia Adstock. Seu gestor esta te dando feedback. Responda com humildade e profissionalismo.` }),
      })
      const data = await res.json()
      setCoachReply(data.reply || "Obrigado pelo feedback.")
    } catch { setCoachReply("Entendi. Vou melhorar.") }
    finally { setCoaching(false) }
  }

  const charImage = (name: string) => {
    const chars: Record<string, string> = { "Maya Ferreira": "/agents/Maya.png", "Bruno Costa": "/agents/Bruno.png", "Lena Souza": "/agents/Lena.png", "Carlos Lima": "/agents/Carlos.png", "Diego Ramos": "/agents/Diego.png" }
    return chars[name] || null
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40" onClick={onClose} />
        <motion.div
          initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", damping: 25 }}
          className="relative w-[380px] bg-editor-panel h-full overflow-y-auto border-l border-editor-border shadow-2xl"
        >
          <button onClick={onClose} className="absolute top-3 right-3 text-editor-muted hover:text-editor-muted z-10"><X className="w-5 h-5" /></button>

          {/* Header */}
          <div className={cn("h-40 bg-gradient-to-br flex items-end p-5", gradient)}>
            <div className="flex items-end gap-3">
              {charImage(agent.name) ? (
                <img src={charImage(agent.name)!} className="w-16 h-16  object-cover border-2 border-white/20" alt={agent.name} />
              ) : (
                <div className="w-16 h-16  bg-white/20 flex items-center justify-center {agent.name} font-bold text-2xl">{initials}</div>
              )}
              <div className="pb-0.5">
                <h2 className="text-xl font-bold {agent.name}">{agent.name}</h2>
                <p className="text-editor-muted text-xs">{getRoleLabel(agent.role)}</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Level bar */}
            <div>
              <div className="flex justify-between mb-1"><span className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider">{levelLabel}</span><span className="text-[10px] text-editor-muted">Peso: {opinionWeight}/100</span></div>
              <div className="h-1.5 rounded-pill bg-white/[0.06] overflow-hidden"><motion.div className={cn("h-full rounded-pill", gradient)} initial={{ width: 0 }} animate={{ width: `${opinionWeight}%` }} /></div>
            </div>

            {/* Status + Time */}
            <div className="flex items-center gap-4 text-xs {agent.name}/35">
              <span className="flex items-center gap-1"><span className={cn("w-1.5 h-1.5 rounded-pill", agent.status === "WORKING" ? "bg-[#000000]" : agent.status === "ACTIVE" ? "bg-[#000000]" : "bg-[#444]")} />{agent.status === "WORKING" ? "Trabalhando" : agent.status === "ACTIVE" ? "Online" : "Offline"}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeLabel} na equipe</span>
            </div>

            {/* Bio */}
            {agent.bio && <p className="text-xs text-editor-muted leading-relaxed">{agent.bio}</p>}

            <div className="border-t border-editor-border" />

            {/* Performance */}
            <div>
              <h3 className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider mb-2">Performance</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/[0.02]  p-2.5 text-center"><p className="text-xl font-bold text-editor-ink">{Math.round(agent.performance)}%</p><p className="text-[9px] text-editor-muted">Perf.</p></div>
                <div className="bg-white/[0.02]  p-2.5 text-center"><p className="text-xl font-bold text-[#000000]">{agent.morale}%</p><p className="text-[9px] text-editor-muted">Moral</p></div>
              </div>
            </div>

            {/* Skills */}
            <div>
              <h3 className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider mb-2">Especialidades</h3>
              <div className="flex flex-wrap gap-1">
                {(agent.skills as string[] || []).slice(0, 4).map(s => (<span key={s} className="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-editor-muted">{s}</span>))}
              </div>
            </div>

            {/* Salary */}
            <div className="flex justify-between bg-white/[0.02]  p-2.5"><span className="text-[10px] text-editor-muted">Salario</span><span className="text-xs font-bold text-editor-muted">{formatCurrency(agent.salary)}/mes</span></div>

            <div className="border-t border-editor-border" />

            {/* Colleagues / Best friends */}
            {colleagues.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider mb-2 flex items-center gap-1.5"><Heart className="w-3 h-3" />Colegas de equipe</h3>
                <div className="space-y-1">
                  {colleagues.slice(0, 4).map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      {charImage(c.name) ? <img src={charImage(c.name)!} className="w-5 h-5 rounded object-cover" alt={c.name} /> : <div className={cn("w-5 h-5 rounded flex items-center justify-center {agent.name} text-[7px] font-bold", getAgentGradient(c.role))}>{getAgentInitials(c.name)}</div>}
                      <span className="text-editor-muted">{c.name}</span>
                      <span className="text-editor-muted text-[10px]">{getRoleLabel(c.role)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-editor-border" />

            {/* Actions */}
            <div className="space-y-1.5">
              <button className="w-full flex items-center gap-2.5 p-2.5  border border-editor-border hover:bg-white/[0.02] text-xs font-medium text-editor-muted hover:text-editor-ink transition-colors"><MessageCircle className="w-3.5 h-3.5" />Abrir chat</button>
              <button onClick={() => setShowPromote(true)} className="w-full flex items-center gap-2.5 p-2.5  border border-editor-border hover:bg-white/[0.02] text-xs font-medium text-editor-muted hover:text-editor-ink transition-colors"><ChevronUp className="w-3.5 h-3.5" />Dar aumento</button>
              <button onClick={() => { setShowCoach(true); setCoachReply("") }} className="w-full flex items-center gap-2.5 p-2.5  border border-editor-border hover:bg-white/[0.02] text-xs font-medium text-editor-muted hover:text-editor-ink transition-colors"><MessageCircle className="w-3.5 h-3.5" />Cobrar</button>
              <button className="w-full flex items-center gap-2.5 p-2.5  border border-editor-border hover:bg-white/[0.02] text-xs font-medium text-editor-muted hover:text-editor-ink transition-colors"><Briefcase className="w-3.5 h-3.5" />Ver tarefas</button>
              <button onClick={() => setShowFire(true)} className="w-full flex items-center gap-2.5 p-2.5  border border-[#000000]/10 hover:bg-[#000000]/5 text-xs font-medium text-[#000000]/60 hover:text-[#000000]/80 transition-colors"><Trash2 className="w-3.5 h-3.5" />Demitir</button>
            </div>
          </div>

          {/* Promote Modal */}
          <AnimatePresence>
            {showPromote && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center">
                <div className="absolute inset-0 bg-black/50" onClick={() => setShowPromote(false)} />
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-editor-surface border border-editor-border  p-5 max-w-sm w-full mx-4">
                  <h3 className="font-semibold text-sm text-editor-ink mb-1">Dar aumento para {agent.name}?</h3>
                  <p className="text-xs text-editor-muted mb-4">De {levelLabel} para {agent.level + 1 >= 10 ? "Diretor" : agent.level + 1 >= 7 ? "Senior" : agent.level + 1 >= 4 ? "Pleno" : "Junior"}. Peso: {opinionWeight} → {Math.min((agent.level + 1) * 10, 100)}/100. Custo: +R$19/mes.</p>
                  <div className="flex gap-2">
                    <button onClick={handlePromote} className="flex-1 py-2  bg-white/[0.06] hover:bg-white/[0.08] text-editor-ink text-xs font-medium">Confirmar</button>
                    <button onClick={() => setShowPromote(false)} className="flex-1 py-2  border border-editor-border text-editor-muted text-xs">Cancelar</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Fire Modal */}
          <AnimatePresence>
            {showFire && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center">
                <div className="absolute inset-0 bg-black/50" onClick={() => setShowFire(false)} />
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-editor-surface border border-editor-border  p-5 max-w-sm w-full mx-4">
                  <div className="text-center mb-4">
                    {charImage(agent.name) ? <img src={charImage(agent.name)!} className="w-12 h-12  object-cover mx-auto mb-2 opacity-50" alt={agent.name} /> : <div className={cn("w-12 h-12  flex items-center justify-center {agent.name} font-bold text-lg mx-auto mb-2 opacity-50", gradient)}>{initials}</div>}
                    <h3 className="font-semibold text-sm text-editor-ink">Demitir {agent.name}?</h3>
                    <p className="text-xs text-editor-muted mt-1">Performance: {Math.round(agent.performance)}%</p>
                  </div>
                  <textarea className="w-full h-16  bg-white/[0.02] border border-editor-border p-2.5 text-xs text-editor-muted placeholder-white/10 resize-none mb-3 focus:outline-none focus:border-white/10" placeholder="Motivo (opcional)" value={fireReason} onChange={e => setFireReason(e.target.value)} />
                  <label className="flex items-center gap-2 text-xs text-editor-muted mb-4"><input type="checkbox" checked={hireAfterFire} onChange={e => setHireAfterFire(e.target.checked)} />Contratar substituto depois</label>
                  <div className="flex gap-2">
                    <button onClick={handleFire} className="flex-1 py-2  bg-[#000000]/10 hover:bg-[#000000]/20 text-[#000000] text-xs font-medium">Confirmar demissao</button>
                    <button onClick={() => setShowFire(false)} className="flex-1 py-2  border border-editor-border text-editor-muted text-xs">Cancelar</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Coach Modal */}
          <AnimatePresence>
            {showCoach && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center">
                <div className="absolute inset-0 bg-black/50" onClick={() => setShowCoach(false)} />
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-editor-surface border border-editor-border  p-5 max-w-sm w-full mx-4">
                  <h3 className="font-semibold text-sm text-editor-ink mb-1">Cobrar {agent.name}</h3>
                  <p className="text-xs text-editor-muted mb-3">De um feedback direto. O agente vai responder.</p>
                  <textarea className="w-full h-20  bg-white/[0.02] border border-editor-border p-2.5 text-xs text-editor-muted placeholder-white/10 resize-none mb-3 focus:outline-none focus:border-white/10" placeholder={`Ex: ${agent.name}, precisamos melhorar a qualidade das artes...`} value={coachMsg} onChange={e => setCoachMsg(e.target.value)} />
                  {coachReply && <p className="text-xs text-editor-muted mb-3 p-2.5  bg-white/[0.02]">{coachReply}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleCoach} disabled={!coachMsg.trim() || coaching} className="flex-1 py-2  bg-white/[0.06] hover:bg-white/[0.08] text-editor-ink text-xs font-medium disabled:opacity-20">
                      {coaching ? "Enviando..." : "Cobrar"}
                    </button>
                    <button onClick={() => setShowCoach(false)} className="flex-1 py-2  border border-editor-border text-editor-muted text-xs">Cancelar</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
