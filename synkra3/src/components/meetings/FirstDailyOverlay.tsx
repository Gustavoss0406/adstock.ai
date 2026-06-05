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
  const [declining, setDeclining] = useState(false)

  useEffect(() => {
    if (phase !== "ringing") return
    const iv = setInterval(() => {
      setPhraseIdx(p => (p + 1) % RINGING_PHRASES.length)
    }, 2500)
    return () => clearInterval(iv)
  }, [phase])

  useEffect(() => {
    if (phase !== "ready") return
    const iv = setInterval(() => {
      setMayaLineIdx(p => (p + 1) % MAYA_SPEECH.length)
    }, 2200)
    return () => clearInterval(iv)
  }, [phase])

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("connecting"), 4500)
    const t2 = setTimeout(() => setPhase("ready"), 7500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const handleDecline = () => {
    setDeclining(true)
    setTimeout(() => {
      setDismissed(true)
      onDismiss()
    }, 400)
  }

  if (dismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #111111 50%, #0a0a0a 100%)" }}
      >
        {/* ── Phone frame ── */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 40 }}
          animate={
            declining
              ? { scale: 0.8, opacity: 0, y: 100 }
              : { scale: 1, opacity: 1, y: 0 }
          }
          transition={{ type: "spring", stiffness: 250, damping: 25 }}
          className="relative w-full max-w-[320px] mx-4 aspect-[9/19]"
        >
          {/* Phone bezel */}
          <div className="relative rounded-[40px] bg-black border-[3px] border-zinc-700 overflow-hidden shadow-[0_0_0_2px_#1a1a1a,0_0_0_5px_#111,0_0_0_7px_#1a1a1a,0_25px_60px_rgba(0,0,0,0.6)]">

            {/* Notch */}
            <div className="absolute top-0 inset-x-0 z-10 flex justify-center pt-2.5">
              <div className="w-28 h-6 bg-black rounded-b-2xl border-b border-l border-r border-zinc-700 flex items-center justify-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-zinc-800 ring-1 ring-zinc-700" />
              </div>
            </div>

            {/* Screen content */}
            <div className="relative pt-10 pb-8 px-6 h-full flex flex-col items-center justify-center">
              {/* ── Background gradient based on phase ── */}
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black" />

              {/* ── Calling avatar (Maya photo) ── */}
              <div className="relative z-10 flex flex-col items-center">
                <motion.div
                  className="relative"
                  animate={phase === "ringing" ? {
                    scale: [1, 1.03, 1],
                  } : phase === "connecting" ? {
                    scale: 1,
                  } : {
                    scale: 0.85,
                  }}
                  transition={phase === "ringing" ? {
                    duration: 1.5, repeat: Infinity,
                  } : { duration: 0.3 }}
                >
                  {/* Maya avatar circle */}
                  <div className="relative">
                    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-rose-500/30 via-violet-500/20 to-indigo-500/30 p-[2px]">
                      <div className="w-full h-full rounded-full bg-zinc-900 overflow-hidden">
                        <img
                          src="/agents/Maya.png"
                          className="w-full h-full object-cover"
                          alt="Maya Ferreira"
                        />
                      </div>
                    </div>

                    {/* Ripple effects when ringing */}
                    {phase === "ringing" && (
                      <>
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-rose-500/40"
                          animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
                          transition={{ duration: 3, repeat: Infinity }}
                        />
                        <motion.div
                          className="absolute inset-0 rounded-full border border-rose-500/20"
                          animate={{ scale: [1, 2], opacity: [0.3, 0] }}
                          transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                        />
                      </>
                    )}
                  </div>
                </motion.div>

                {/* Caller name */}
                <div className="mt-6 text-center z-10">
                  <motion.h2
                    className="text-2xl font-bold text-white tracking-tight"
                    animate={phase === "ringing" ? { opacity: [1, 0.8, 1] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Maya Ferreira
                  </motion.h2>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <span className="text-sm text-white/40">{orgName}</span>
                    <span className="text-white/20">·</span>
                    <span className="text-sm text-white/40">Diretora</span>
                  </div>
                </div>

                {/* Status line */}
                <div className="mt-7 text-center min-h-[48px] flex flex-col items-center justify-center">
                  {phase === "ringing" && (
                    <div className="space-y-1.5">
                      <motion.p
                        className="text-white/50 text-sm font-medium"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        Chamando...
                      </motion.p>
                      <motion.p
                        key={phraseIdx}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-white/25 max-w-[260px] leading-relaxed"
                      >
                        {RINGING_PHRASES[phraseIdx]}
                      </motion.p>
                    </div>
                  )}

                  {phase === "connecting" && (
                    <div className="space-y-3">
                      <div className="w-7 h-7 border-[2.5px] border-white/10 border-t-white/60 rounded-full animate-spin mx-auto" />
                      <p className="text-sm text-white/40">Conectando com a equipe...</p>
                    </div>
                  )}

                  {phase === "ready" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span className="text-xs font-medium text-green-400/70">Conectado</span>
                      </div>

                      {/* Speech bubble from Maya */}
                      <div className="relative">
                        <div className="bg-white/[0.06] border border-white/[0.10] rounded-2xl px-5 py-4 backdrop-blur-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center overflow-hidden">
                              <img src="/agents/Maya.png" className="w-5 h-5 object-cover" alt="" />
                            </div>
                            <span className="text-[11px] font-medium text-white/60">Maya</span>
                            <span className="text-[10px] text-white/25 ml-auto">agora</span>
                          </div>
                          <motion.p
                            key={mayaLineIdx}
                            initial={{ opacity: 0, y: 3 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[13px] text-white/70 leading-relaxed"
                          >
                            {MAYA_SPEECH[mayaLineIdx]}
                          </motion.p>
                        </div>
                        {/* Triangle pointer */}
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white/[0.06] border-l border-t border-white/[0.10] rotate-45 -z-10" />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* ── Action buttons ── */}
                <div className="mt-10 flex items-center gap-8">
                  {/* Decline */}
                  <button
                    onClick={handleDecline}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <div className="w-16 h-16 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors active:scale-90">
                      <PhoneOff className="w-7 h-7 text-red-400" />
                    </div>
                    <span className="text-[11px] text-white/30 group-hover:text-white/50 transition-colors">
                      Recusar
                    </span>
                  </button>

                  {/* Accept */}
                  {phase === "ready" && (
                    <button
                      onClick={() => {
                        setDismissed(true)
                        onAccept()
                      }}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="w-16 h-16 rounded-full bg-green-500/90 hover:bg-green-500 flex items-center justify-center transition-colors active:scale-90 shadow-[0_0_30px_rgba(34,197,94,0.2)]"
                      >
                        <Phone className="w-7 h-7 text-white" />
                      </motion.div>
                      <span className="text-[11px] text-white/40 group-hover:text-white/60 transition-colors">
                        Atender
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Home indicator */}
            <div className="absolute bottom-2 inset-x-0 flex justify-center z-10">
              <div className="w-32 h-1 rounded-full bg-zinc-700" />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
