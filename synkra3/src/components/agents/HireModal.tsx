"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatCurrency } from "@/lib/utils"
import { Sparkles, UserPlus, Star, Zap, Brain, Loader2, Check } from "lucide-react"
import { toast } from "sonner"

interface Profile {
  key: string
  name: string
  role: string
  personality: string
  preview: string
  strengths: string[]
  salary: number
}

interface HireModalProps {
  orgId: string
  onHired?: () => void
  onClose?: () => void
}

const roleIcons: Record<string, React.ReactNode> = {
  SEO: <Zap className="w-4 h-4" />,
  CREATIVE_DIRECTOR: <Star className="w-4 h-4" />,
  MEDIA_BUYER: <Brain className="w-4 h-4" />,
  COMMUNITY_MANAGER: <Sparkles className="w-4 h-4" />,
}

const roleColors: Record<string, string> = {
  SEO: "bg-black",
  CREATIVE_DIRECTOR: "bg-black",
  MEDIA_BUYER: "bg-black",
  COMMUNITY_MANAGER: "bg-black",
}

export function HireModal({ orgId, onHired, onClose }: HireModalProps) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"browse" | "confirm" | "done">("browse")
  const [hiredName, setHiredName] = useState("")

  const openModal = async () => {
    setStep("browse")
    setSelected(null)
    const res = await fetch("/api/agents/hire")
    const data = await res.json()
    setProfiles(data)
  }

  const handleHire = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const res = await fetch("/api/agents/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, profileKey: selected }),
      })
      const agent = await res.json()
      setHiredName(agent.name)
      setStep("done")
      toast.success(`${agent.name} contratado! 🎉`)
      onHired?.()
      // Create pixel office session for new agent immediately
      fetch("/api/agents/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pulse", agentId: agent.id }),
      }).catch(() => {})
    } catch {
      toast.error("Erro ao contratar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={openModal} className="text-black border-[#4A154B]/30 hover:bg-black/5">
        <UserPlus className="w-3.5 h-3.5 mr-1" />Contratar
      </Button>

      {/* Modal overlay */}
      <AnimatePresence>
        {step !== "browse" || profiles.length > 0 ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40"
              onClick={step === "done" ? onClose : undefined}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white  shadow-2xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#DDDDDD]">
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus className="w-5 h-5 text-black" />
                  <h2 className="font-bold text-xl text-black">
                    {step === "done" ? "Contratação concluída!" : "Abrir Vaga — Contratar Agente"}
                  </h2>
                </div>
                <p className="text-sm text-[#616061]">
                  {step === "browse" ? "Escolha um perfil para sua agência. Cada agente tem personalidade própria." :
                   step === "confirm" ? "Confirme a contratação. O agente se juntará imediatamente à sua equipe." :
                   `${hiredName} agora faz parte da sua agência!`}
                </p>
              </div>

              {step === "browse" && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profiles.map(profile => (
                    <motion.div
                      key={profile.key}
                      whileHover={{ y: -2 }}
                      className={cn(
                        "p-4  border-2 cursor-pointer transition-all",
                        selected === profile.key
                          ? "border-[#4A154B] bg-black/5 shadow-elevated"
                          : "border-[#DDDDDD] hover:border-[#4A154B]/30"
                      )}
                      onClick={() => setSelected(profile.key)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-12 h-12 rounded-md bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg flex-shrink-0",
                          roleColors[profile.role] || "from-[#616061] to-[#4a4a4a]"
                        )}>
                          {profile.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-black">{profile.name}</h3>
                            <Badge variant="outline" className="text-[10px]">{profile.role}</Badge>
                          </div>
                          <p className="text-[11px] text-black font-medium mt-0.5">{profile.personality}</p>
                          <p className="text-xs text-[#616061] mt-2 line-clamp-3">{profile.preview}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {profile.strengths.slice(0, 3).map(s => (
                              <span key={s} className="text-[10px] bg-[#F8F8F8] px-1.5 py-0.5 rounded-sm text-[#616061]">{s}</span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#DDDDDD]">
                            <span className="text-sm font-bold text-black">{formatCurrency(profile.salary)}/mês</span>
                            {selected === profile.key && <Check className="w-4 h-4 text-black" />}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {step === "confirm" && (
                <div className="p-6 text-center">
                  <p className="text-[#616061] text-sm mb-4">O agente será adicionado à sua equipe com status ativo e poderá participar das dailys, tarefas e conversas imediatamente.</p>
                </div>
              )}

              {step === "done" && (
                <div className="p-6 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="w-16 h-16 rounded-pill bg-black/10 flex items-center justify-center mx-auto mb-4"
                  >
                    <Check className="w-8 h-8 text-black" />
                  </motion.div>
                  <p className="text-black font-bold text-lg">{hiredName} contratado!</p>
                  <p className="text-[#616061] text-sm mt-1">Ele já está disponível no seu time.</p>
                </div>
              )}

              {/* Footer */}
              <div className="p-4 border-t border-[#DDDDDD] flex items-center justify-between">
                {step === "browse" ? (
                  <>
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button onClick={() => setStep("confirm")} disabled={!selected}>
                      Continuar
                    </Button>
                  </>
                ) : step === "confirm" ? (
                  <>
                    <Button variant="ghost" onClick={() => setStep("browse")}>Voltar</Button>
                    <Button onClick={handleHire} disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Confirmar Contratação
                    </Button>
                  </>
                ) : (
                  <Button className="w-full" onClick={onClose}>Fechar</Button>
                )}
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
