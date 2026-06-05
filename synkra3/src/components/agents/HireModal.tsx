"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn, formatCurrency } from "@/lib/utils"
import { getAgentGradient, getAgentInitials } from "@/lib/utils"
import { UserPlus, Loader2, Check, X, DollarSign, MapPin, Clock, Briefcase, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"

interface Profile {
  key: string
  name: string
  role: string
  personality: string
  preview: string
  strengths: string[]
  salary: number
  isRehire?: boolean
  agentId?: string
}

interface HireModalProps {
  orgId: string
  onHired?: () => void
}

const AGENT_CHARS: Record<string, string> = {
  "Maya Ferreira": "/characters/Maya.png",
  "Bruno Costa": "/characters/Bruno.png",
  "Lena Souza": "/characters/Lena.png",
  "Carlos Lima": "/characters/Carlos.png",
  "Diego Ramos": "/characters/Diego.png",
}

const ROLE_LABELS: Record<string, string> = {
  STRATEGIST: "Estrategista",
  DESIGNER: "Designer",
  COPYWRITER: "Redator",
  ANALYST: "Analista",
  SOCIAL_MEDIA: "Social Media",
  SEO: "Especialista SEO",
  MEDIA_BUYER: "Midia Paga",
  COMMUNITY_MANAGER: "Community Manager",
  CREATIVE_DIRECTOR: "Dir. Criativo",
  TRAFFIC_MANAGER: "Gestor de Trafego",
}

const ROLE_CATEGORIES: Record<string, string> = {
  STRATEGIST: "Estrategia",
  DESIGNER: "Criacao",
  COPYWRITER: "Conteudo",
  ANALYST: "Dados",
  SOCIAL_MEDIA: "Redes Sociais",
  SEO: "SEO",
  MEDIA_BUYER: "Midia",
  COMMUNITY_MANAGER: "Relacionamento",
  CREATIVE_DIRECTOR: "Criacao",
  TRAFFIC_MANAGER: "Performance",
}

export function HireModal({ orgId, onHired }: HireModalProps) {
  const [open, setOpen] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [hiring, setHiring] = useState(false)
  const [step, setStep] = useState<"browse" | "confirm" | "hired">("browse")
  const [hiredProfile, setHiredProfile] = useState<Profile | null>(null)

  const close = () => {
    setOpen(false)
    setStep("browse")
    setSelected(null)
    setProfiles([])
    setHiredProfile(null)
  }

  const openModal = async () => {
    setOpen(true)
    setStep("browse")
    setSelected(null)
    setProfiles([])
    setHiredProfile(null)
    const res = await fetch(`/api/agents/hire?orgId=${orgId}`)
    const data = await res.json()
    setProfiles(data)
  }

  const selectProfile = (profile: Profile) => {
    setSelected(profile.key)
    setStep("confirm")
  }

  const handleHire = async () => {
    if (!selected) return
    setHiring(true)
    const profile = profiles.find(p => p.key === selected)
    try {
      const res = await fetch("/api/agents/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, profileKey: selected }),
      })
      const agent = await res.json()
      setHiredProfile(profile || null)
      setStep("hired")
      toast.success(`${agent.name} contratado!`)
      onHired?.()
      fetch("/api/agents/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pulse", agentId: agent.id }),
      }).catch(() => {})
    } catch {
      toast.error("Erro ao contratar")
    } finally {
      setHiring(false)
    }
  }

  const selectedProfile = profiles.find(p => p.key === selected)
  const charImg = selectedProfile?.name ? AGENT_CHARS[selectedProfile.name] : null

  return (
    <>
      <button
        onClick={openModal}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all text-editor-muted hover:text-editor-ink hover:bg-white/[0.04]"
      >
        <UserPlus className="w-3 h-3" />Contratar
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={close}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative bg-editor-panel border border-editor-border max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-editor-border flex-shrink-0">
                <div>
                  <h2 className="text-sm font-semibold text-editor-ink">
                    {step === "hired" ? "Contratado" : step === "confirm" ? "Revisar Candidato" : "Abrir Vaga"}
                  </h2>
                  <p className="text-[11px] text-editor-muted mt-0.5">
                    {step === "hired" ? `${hiredProfile?.name || ""} agora faz parte da equipe.` :
                     step === "confirm" ? "Revise o perfil antes de confirmar." :
                     `${profiles.length} candidato${profiles.length !== 1 ? "s" : ""} disponivel${profiles.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <button onClick={close} className="p-1.5 rounded-lg hover:bg-white/[0.04] text-editor-muted hover:text-editor-ink transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto">
                {/* Step: Browse */}
                {step === "browse" && (
                  <div className="p-5">
                    {profiles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="w-6 h-6 border-2 border-editor-border border-t-primary rounded-full" />
                        <p className="text-xs text-editor-muted">Buscando candidatos...</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {profiles.map((profile) => (
                          <button
                            key={profile.key}
                            onClick={() => selectProfile(profile)}
                            className="w-full flex items-start gap-4 p-4 border border-editor-border hover:border-primary/30 hover:bg-white/[0.02] transition-colors text-left group"
                          >
                            {/* Photo */}
                            <div className="w-12 h-12 bg-editor-surface border border-editor-border flex-shrink-0 overflow-hidden">
                              {AGENT_CHARS[profile.name] ? (
                                <img src={AGENT_CHARS[profile.name]} className="w-full h-full object-cover" alt={profile.name} />
                              ) : (
                                <div className={cn("w-full h-full flex items-center justify-center text-white text-sm font-bold", getAgentGradient(profile.role))}>
                                  {getAgentInitials(profile.name)}
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <h3 className="text-sm font-semibold text-editor-ink group-hover:text-primary transition-colors">{profile.name}</h3>
                                <span className="text-[10px] text-editor-muted">{ROLE_LABELS[profile.role] || profile.role}</span>
                                {profile.isRehire && (
                                  <span className="text-[9px] text-amber-400/70 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                                    Recontratar
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-editor-muted/70 leading-relaxed line-clamp-2">{profile.preview}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] text-editor-muted flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />{formatCurrency(profile.salary)}/mes
                                </span>
                                <span className="text-[10px] text-editor-muted flex items-center gap-1">
                                  <Briefcase className="w-3 h-3" />{ROLE_CATEGORIES[profile.role] || profile.role}
                                </span>
                              </div>
                            </div>

                            {/* Arrow */}
                            <ChevronRight className="w-4 h-4 text-editor-muted/30 group-hover:text-primary transition-colors mt-4 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Step: Confirm */}
                {step === "confirm" && selectedProfile && (
                  <div className="p-5 space-y-5">
                    {/* Top card: photo + name + role */}
                    <div className="flex items-start gap-4 pb-5 border-b border-editor-border">
                      <div className="w-16 h-16 bg-editor-surface border border-editor-border overflow-hidden flex-shrink-0">
                        {charImg ? (
                          <img src={charImg} className="w-full h-full object-cover" alt={selectedProfile.name} />
                        ) : (
                          <div className={cn("w-full h-full flex items-center justify-center text-white text-xl font-bold", getAgentGradient(selectedProfile.role))}>
                            {getAgentInitials(selectedProfile.name)}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-editor-ink">{selectedProfile.name}</h3>
                        <p className="text-xs text-editor-muted mt-0.5">{ROLE_LABELS[selectedProfile.role] || selectedProfile.role}</p>
                        <p className="text-[11px] text-editor-muted/70 mt-1">{selectedProfile.personality}</p>
                      </div>
                    </div>

                    {/* Skills */}
                    <div>
                      <h4 className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider mb-2">Habilidades</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProfile.strengths.map((s) => (
                          <span key={s} className="text-[10px] bg-editor-surface border border-editor-border px-2 py-1 text-editor-muted">{s}</span>
                        ))}
                      </div>
                    </div>

                    {/* About */}
                    <div>
                      <h4 className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider mb-2">Sobre</h4>
                      <p className="text-[11px] text-editor-muted/70 leading-relaxed">{selectedProfile.preview}</p>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-editor-surface border border-editor-border p-3">
                        <DollarSign className="w-3.5 h-3.5 text-editor-muted mb-1" />
                        <p className="text-xs font-semibold text-editor-ink">{formatCurrency(selectedProfile.salary)}</p>
                        <p className="text-[9px] text-editor-muted">Salario mensal</p>
                      </div>
                      <div className="bg-editor-surface border border-editor-border p-3">
                        <Briefcase className="w-3.5 h-3.5 text-editor-muted mb-1" />
                        <p className="text-xs font-semibold text-editor-ink">{ROLE_CATEGORIES[selectedProfile.role] || "—"}</p>
                        <p className="text-[9px] text-editor-muted">Departamento</p>
                      </div>
                      <div className="bg-editor-surface border border-editor-border p-3">
                        <Clock className="w-3.5 h-3.5 text-editor-muted mb-1" />
                        <p className="text-xs font-semibold text-editor-ink">Imediato</p>
                        <p className="text-[9px] text-editor-muted">Inicio</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step: Hired */}
                {step === "hired" && (
                  <div className="p-5 flex flex-col items-center justify-center py-16">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                    >
                      <div className="w-16 h-16 bg-success/10 border border-success/30 flex items-center justify-center">
                        <Check className="w-8 h-8 text-success" />
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="text-center mt-4"
                    >
                      <h3 className="text-sm font-semibold text-editor-ink">{hiredProfile?.name || "Agente"} contratado!</h3>
                      <p className="text-xs text-editor-muted mt-1.5 max-w-xs">
                        O agente ja esta disponivel na sua equipe e participara das dailys, tarefas e decisoes.
                      </p>
                    </motion.div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-editor-border flex-shrink-0 flex items-center gap-2">
                {step === "browse" && (
                  <button onClick={close} className="flex-1 py-2 text-xs text-editor-muted hover:text-editor-ink hover:bg-white/[0.03] transition-colors">
                    Cancelar
                  </button>
                )}

                {step === "confirm" && (
                  <>
                    <button onClick={() => setStep("browse")} className="flex items-center gap-1 py-2 px-3 text-xs text-editor-muted hover:text-editor-ink hover:bg-white/[0.03] transition-colors">
                      <ChevronLeft className="w-3.5 h-3.5" />Voltar
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={handleHire}
                      disabled={hiring}
                      className="py-2 px-6 bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {hiring ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" />Contratando...</>
                      ) : (
                        <><UserPlus className="w-3.5 h-3.5" />Contratar {selectedProfile?.name.split(" ")[0]}</>
                      )}
                    </button>
                  </>
                )}

                {step === "hired" && (
                  <button onClick={close} className="flex-1 py-2 bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover transition-colors">
                    Fechar
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
