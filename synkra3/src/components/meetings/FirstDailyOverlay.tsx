"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Phone, PhoneOff } from "lucide-react"

interface Props {
  orgId: string
  orgName: string
  onAccept: () => void
  onDismiss: () => void
}

const RINGING_PHRASES = [
  "Sua equipe está se preparando...",
  "Maya está organizando a pauta...",
  "Bruno está revisando os briefings...",
  "Lena está analisando o mercado...",
  "Carlos está preparando o estúdio...",
  "Diego está configurando as ferramentas...",
]

export function FirstDailyOverlay({ orgId, orgName, onAccept, onDismiss }: Props) {
  const [phase, setPhase] = useState<"ringing" | "connecting" | "ready">("ringing")
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (phase !== "ringing") return
    const iv = setInterval(() => {
      setPhraseIdx(p => (p + 1) % RINGING_PHRASES.length)
    }, 2500)
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
        className="fixed inset-0 z-[200] bg-[#0a0a0b]/95 flex items-center justify-center"
      >
        <div className="text-center space-y-6 max-w-[320px]">
          {/* Avatar ring */}
          <motion.div
            className="relative mx-auto w-32 h-32"
            animate={phase === "ringing" ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {/* Pulse rings */}
            {phase === "ringing" && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-[#ff385c]/30"
                  animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-[#ff385c]/20"
                  animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                />
              </>
            )}
            {/* Avatar */}
            <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-[#ff385c] to-[#7C3AED] flex items-center justify-center ring-4 ring-[#ff385c]/20">
              <img src="/agents/Maya.png" className="w-24 h-24 rounded-xl object-cover" alt="Maya" />
            </div>
          </motion.div>

          {/* Status */}
          <div className="space-y-2">
            {phase === "ringing" && (
              <>
                <motion.h2
                  className="text-xl font-bold text-white"
                  animate={{ opacity: [1, 0.7, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Chamada recebida...
                </motion.h2>
                <motion.p
                  key={phraseIdx}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-white/40"
                >
                  {RINGING_PHRASES[phraseIdx]}
                </motion.p>
              </>
            )}

            {phase === "connecting" && (
              <div className="space-y-3">
                <div className="w-8 h-8 border-2 border-white/10 border-t-[#ff385c] rounded-full animate-spin mx-auto" />
                <p className="text-sm text-white/30">Conectando com a equipe...</p>
              </div>
            )}

            {phase === "ready" && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white">
                  Primeira Daily da {orgName}
                </h2>
                <p className="text-xs text-white/40 max-w-[250px] mx-auto leading-relaxed">
                  Sua equipe está pronta para a primeira reunião. Eles vão definir as tarefas iniciais e começar a trabalhar imediatamente.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setDismissed(true)
                      onAccept()
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ff385c] hover:bg-[#ff385c]/80 text-white text-sm font-medium transition-all"
                  >
                    <Phone className="w-4 h-4" />
                    Atender
                  </button>
                  <button
                    onClick={() => {
                      setDismissed(true)
                      onDismiss()
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] text-white/30 hover:text-white/50 text-sm transition-all"
                  >
                    <PhoneOff className="w-4 h-4" />
                    Depois
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                animate={{
                  backgroundColor: phase === "ringing" && i === 0 ? "#ff385c" :
                    phase === "connecting" && i <= 1 ? "#ff385c" :
                    phase === "ready" ? "#ff385c" : "transparent",
                  borderColor: "rgba(255,56,92,0.3)",
                }}
                style={{ border: "1px solid rgba(255,56,92,0.3)" }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
