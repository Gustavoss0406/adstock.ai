"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Phone, PhoneOff, Sparkles } from "lucide-react"

interface Props {
  orgId: string
  orgName: string
  onAccept: () => void
  onDismiss: () => void
}

const RINGING_PHRASES = [
  "Sua equipe esta se preparando...",
  "Maya esta organizando a pauta...",
  "Bruno esta revisando os briefings...",
  "Lena esta analisando o mercado...",
  "Carlos esta preparando o estudio...",
  "Diego esta configurando as ferramentas...",
]

const MAYA_SPEECH = [
  "CEO, hora da nossa primeira daily!",
  "O time esta te esperando na sala de reuniao.",
  "Tenho um plano pronto baseado no que voce me contou.",
]

export function FirstDailyOverlay({ orgId, orgName, onAccept, onDismiss }: Props) {
  const [phase, setPhase] = useState<"ringing" | "connecting" | "ready">("ringing")
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [mayaLineIdx, setMayaLineIdx] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (phase !== "ringing") return
    const iv = setInterval(() => {
      setPhraseIdx(p => (p + 1) % RINGING_PHRASES.length)
    }, 2500)
    return () => clearInterval(iv)
  }, [phase])

  // Maya speech line rotation (ready phase)
  useEffect(() => {
    if (phase !== "ready") return
    const iv = setInterval(() => {
      setMayaLineIdx(p => (p + 1) % MAYA_SPEECH.length)
    }, 2000)
    return () => clearInterval(iv)
  }, [phase])

  useEffect(() => {
    // Auto-transition after ringing
    const t1 = setTimeout(() => setPhase("connecting"), 4000)
    const t2 = setTimeout(() => setPhase("ready"), 7000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (dismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        className="fixed inset-0 z-[200] bg-[#0a0a0b]/97 flex items-center justify-center backdrop-blur-sm"
      >
        <div className="text-center space-y-8 max-w-[360px]">
          {/* Phone icon ringing */}
          <motion.div
            className="relative mx-auto"
            animate={phase === "ringing" ? {
              rotate: [-5, 5, -5, 5, 0],
              scale: [1, 1.03, 1],
            } : {}}
            transition={{ duration: 0.8, repeat: phase === "ringing" ? Infinity : 0 }}
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-[#ff385c]/[0.06] border border-[#ff385c]/10 flex items-center justify-center">
              <Phone className="w-6 h-6 text-[#ff385c]/40" />
            </div>
            {phase === "ringing" && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full border border-[#ff385c]/20"
                  animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border border-[#ff385c]/10"
                  animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: 0.7 }}
                />
              </>
            )}
          </motion.div>

          {/* Avatar + Caller info */}
          <div className="space-y-4">
            <motion.div
              className="relative mx-auto w-24 h-24"
              animate={phase === "ringing" ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#ff385c] to-[#7C3AED] flex items-center justify-center ring-4 ring-[#ff385c]/10">
                <img src="/agents/Maya.png" className="w-18 h-18 rounded-xl object-cover" alt="Maya Ferreira" />
              </div>
              {phase === "ringing" && (
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  animate={{ boxShadow: [
                    "0 0 0px rgba(255,56,92,0)",
                    "0 0 30px rgba(255,56,92,0.3)",
                    "0 0 0px rgba(255,56,92,0)",
                  ] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>

            <div className="space-y-1">
              <motion.h3
                className="text-lg font-bold text-white"
                animate={phase === "ringing" ? { opacity: [1, 0.7, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Maya Ferreira
              </motion.h3>
              <p className="text-xs text-white/30">Diretora de Conteudo · {orgName}</p>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-3">
            {phase === "ringing" && (
              <>
                <motion.p
                  className="text-sm font-medium text-white/50"
                  animate={{ opacity: [1, 0.6, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Chamada recebida...
                </motion.p>
                <motion.p
                  key={phraseIdx}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[11px] text-white/25"
                >
                  {RINGING_PHRASES[phraseIdx]}
                </motion.p>
              </>
            )}

            {phase === "connecting" && (
              <div className="space-y-3">
                <div className="w-8 h-8 border-2 border-white/[0.06] border-t-[#ff385c]/50 rounded-full animate-spin mx-auto" />
                <p className="text-[12px] text-white/25">Conectando com a equipe...</p>
              </div>
            )}

            {phase === "ready" && (
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <h2 className="text-base font-bold text-white mb-1">
                    Primeira Daily
                  </h2>
                  <p className="text-[11px] text-white/25 max-w-[280px] mx-auto leading-relaxed">
                    Sua equipe esta pronta para a primeira reuniao. Eles vao definir as tarefas iniciais e comecar a trabalhar imediatamente.
                  </p>
                </motion.div>

                {/* Maya speech bubble */}
                <motion.div
                  className="relative mx-4 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {/* Triangle pointer */}
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/[0.03] border-l border-t border-white/[0.06] rotate-45" />
                  <div className="flex items-center gap-2 mb-1.5">
                    <img src="/agents/Maya.png" className="w-4 h-4 rounded object-cover" alt="Maya" />
                    <span className="text-[10px] font-medium text-[#ff385c]/60">Maya</span>
                    <span className="text-[9px] text-white/15 ml-auto">agora</span>
                  </div>
                  <motion.p
                    key={mayaLineIdx}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[12px] text-white/45 leading-relaxed"
                  >
                    {MAYA_SPEECH[mayaLineIdx]}
                  </motion.p>
                </motion.div>

                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    onClick={() => {
                      setDismissed(true)
                      onAccept()
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#ff385c] hover:bg-[#ff385c]/80 text-white text-sm font-medium transition-all active:scale-95"
                  >
                    <Phone className="w-4 h-4" />
                    Atender
                  </button>
                  <button
                    onClick={() => {
                      setDismissed(true)
                      onDismiss()
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] text-white/25 hover:text-white/40 text-sm transition-all active:scale-95"
                  >
                    <PhoneOff className="w-4 h-4" />
                    Depois
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 pb-4">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                animate={{
                  backgroundColor: i <= (phase === "ringing" ? 0 : phase === "connecting" ? 1 : 2) ? "#ff385c" : "rgba(255,255,255,0.06)",
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
