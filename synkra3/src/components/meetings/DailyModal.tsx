"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn, getAgentGradient, getAgentInitials, getRoleLabel } from "@/lib/utils"
import { Agent } from "@prisma/client"
import { X, PhoneOff, Mic, MicOff, Users, MessageSquare, Send } from "lucide-react"
import { toast } from "sonner"

const AGENT_CHARS: Record<string, string> = {
  "Maya Ferreira": "/agents/Maya.png", "Bruno Costa": "/agents/Bruno.png",
  "Lena Souza": "/agents/Lena.png", "Carlos Lima": "/agents/Carlos.png",
  "Diego Ramos": "/agents/Diego.png",
}

type ChatMessage = {
  id: string
  agentId?: string
  agentName?: string
  agentRole?: string
  agentGradient?: string
  content: string
  time: string
  metadata?: any
}

interface DailyModalProps {
  open: boolean
  agents: Agent[]
  orgId: string
  onClose: () => void
}

function statusDot(status: string): string {
  switch (status) {
    case "IN_MEETING": return "bg-[#2bac76] animate-pulse"
    case "ACTIVE": case "WORKING": return "bg-[#2bac76]"
    default: return "bg-[#444]"
  }
}

function getAgentImage(name: string): string | null {
  return AGENT_CHARS[name] || null
}

const LOADING_MESSAGES = [
  "Agentes estão chegando na sala...",
  "Maya está preparando o plano do dia...",
  "Bruno está revisando as redes sociais...",
  "Lena está analisando métricas recentes...",
  "Carlos está organizando os briefings...",
  "Diego está verificando o SEO...",
]

export function DailyModal({ open, agents, orgId, onClose }: DailyModalProps) {
  const [state, setState] = useState<"joining" | "running" | "completed" | "error">("joining")
  const [speakingIdx, setSpeakingIdx] = useState(-1)
  const [speeches, setSpeeches] = useState<Array<{ agent: string; content: string }>>([])
  const [summary, setSummary] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [showChat, setShowChat] = useState(true)
  const [micActive, setMicActive] = useState(false)
  const [commentInput, setCommentInput] = useState("")
  const [sendingComment, setSendingComment] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const chatRef = useRef<HTMLDivElement>(null)
  const agentsActive = agents.filter(a => a.status !== "FIRED")

  useEffect(() => {
    if (!open) return
    setState("joining")
    setSpeakingIdx(-1)
    setSpeeches([])
    setSummary("")
    setMessages([])
    setMicActive(false)
    setCommentInput("")
    setLoadingStep(0)

    const run = async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout
      try {
        const res = await fetch("/api/routine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: orgId, event: "daily_standup" }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (!res.ok) throw new Error("API failed")

        const data = await res.json()
        const results: Array<{ agent: string; content: string }> = data.results || []

        if (results.length > 0) {
          setState("running")
          for (let i = 0; i < results.length; i++) {
            setSpeakingIdx(i)
            setSpeeches(prev => [...prev, results[i]])
            await new Promise(r => setTimeout(r, 800 + Math.random() * 700))
          }
        }

        setSummary(data.summary || "")
        setState("completed")
        toast.success("Daily concluida!")

        // Load messages
        try {
          const msgRes = await fetch(`/api/messages?orgId=${orgId}&limit=30`)
          const msgData = await msgRes.json()
          if (Array.isArray(msgData)) {
            const dailyMsgs = msgData.filter((m: any) => m.channel?.name === "daily-standup")
            const newMsgs = dailyMsgs.reverse().map((m: any) => ({
              id: m.id, agentId: m.agentId, agentName: m.agent?.name,
              agentRole: m.agent ? getRoleLabel(m.agent.role) : "",
              agentGradient: m.agent ? getAgentGradient(m.agent.role) : "",
              content: m.content, time: m.createdAt,
              metadata: m.metadata,
            }))
            setMessages(newMsgs)
          }
        } catch {}
      } catch (err) {
        clearTimeout(timeoutId)
        if ((err as Error)?.name === "AbortError") {
          toast.error("A daily demorou demais. Tente novamente.")
        } else {
          toast.error("Erro ao iniciar a daily")
        }
        setState("error")
      }
    }

    const timer = setTimeout(() => run(), 800)
    return () => clearTimeout(timer)
  }, [open, orgId])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, speeches])

  // Rotating loading messages
  useEffect(() => {
    if (state !== "joining") return
    const interval = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [state])

  const speakIdx = speakingIdx >= 0 && speakingIdx < speeches.length ? speakingIdx : -1

  const handleSendComment = async () => {
    if (!commentInput.trim() || sendingComment) return
    setSendingComment(true)
    try {
      const res = await fetch("/api/daily/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, message: commentInput }),
      })
      const data = await res.json()
      if (data.success) {
        setMessages(prev => [...prev, {
          id: `comment-${Date.now()}`,
          content: commentInput,
          time: new Date().toISOString(),
          metadata: { type: "daily_comment" },
        }])
        setCommentInput("")
      }
    } catch {} finally {
      setSendingComment(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-white/25" />
                <span className="text-[11px] text-white/30">{agentsActive.length} participantes</span>
              </div>
              {state === "running" && (
                <span className="flex items-center gap-1 text-[10px] text-[#2bac76]/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2bac76] animate-pulse" />
                  Em reuniao
                </span>
              )}
              {state === "completed" && (
                <span className="text-[10px] text-white/20">Reuniao encerrada</span>
              )}
            </div>
            <button
              onClick={() => { setShowChat(!showChat) }}
              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors", showChat ? "bg-white/[0.06] text-white/40" : "text-white/20 hover:text-white/40")}
            >
              <MessageSquare className="w-3 h-3" /> Chat
            </button>
          </div>

          {/* Main content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Agent grid */}
            <div className="flex-1 flex items-center justify-center p-6 relative">
              {state === "joining" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-10 h-10 border-2 border-white/10 border-t-[#2bac76]/50 rounded-full" />
                  <motion.p key={loadingStep} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-[12px] text-white/25 max-w-[250px] text-center">{LOADING_MESSAGES[loadingStep]}</motion.p>
                </div>
              )}
              {state === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <p className="text-[12px] text-[#ff385c]/60 text-center max-w-[250px]">
                    Nao foi possivel iniciar a daily. Verifique sua conexao ou tente novamente.
                  </p>
                  <button onClick={() => { setState("joining"); setTimeout(() => { const el = document.querySelector("[data-daily-run]"); if (el) (el as HTMLElement).click() }, 800) }}
                    className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.08] text-[11px] text-white/40 hover:text-white/60 transition-colors">
                    Tentar novamente
                  </button>
                </div>
              )}
              <motion.div layout className={cn("grid gap-3 w-full max-w-3xl", agentsActive.length <= 3 ? "grid-cols-3" : agentsActive.length === 4 ? "grid-cols-2" : "grid-cols-3")}>
                {agentsActive.map((agent, idx) => {
                  const isSpeaking = state === "running" && speakIdx === idx
                  const hasSpoken = speeches.some(s => s.agent === agent.name)
                  const img = getAgentImage(agent.name)
                  const initials = getAgentInitials(agent.name)
                  const gradient = getAgentGradient(agent.role)
                  return (
                    <motion.div key={agent.id} layout animate={{ scale: isSpeaking ? 1.02 : 1, opacity: state === "joining" ? 0.5 : hasSpoken ? 1 : 0.6 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className={cn("relative flex flex-col items-center gap-3 p-4 rounded-2xl transition-all duration-500", isSpeaking ? "border-2 border-[#2bac76] bg-[#2bac76]/[0.05] shadow-[0_0_30px_rgba(43,172,118,0.15)]" : hasSpoken ? "border border-white/[0.04] bg-white/[0.02]" : "border border-white/[0.02] bg-white/[0.01]")}>
                      {isSpeaking && <motion.div className="absolute inset-0 rounded-2xl" animate={{ boxShadow: ["0 0 20px rgba(43,172,118,0.1)", "0 0 40px rgba(43,172,118,0.2)", "0 0 20px rgba(43,172,118,0.1)"] }} transition={{ duration: 2, repeat: Infinity }} />}
                      <div className="relative flex-shrink-0">
                        {img ? <img src={img} className={cn("w-20 h-20 rounded-2xl object-cover transition-all duration-500", isSpeaking && "ring-2 ring-[#2bac76] ring-offset-2 ring-offset-[#0a0a0a]")} alt={agent.name} /> :
                        <div className={cn("w-20 h-20 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-2xl transition-all duration-500", gradient, isSpeaking && "ring-2 ring-[#2bac76] ring-offset-2 ring-offset-[#0a0a0a]")}>{initials}</div>}
                        <span className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0a0a]", isSpeaking ? "bg-[#2bac76] animate-pulse" : hasSpoken ? "bg-[#2bac76]" : "bg-white/15")} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-white/70 truncate max-w-[140px]">{agent.name}</p>
                        <p className="text-[10px] text-white/25 mt-0.5">{getRoleLabel(agent.role)}</p>
                      </div>
                      {isSpeaking && (
                        <motion.div className="flex items-center gap-1.5 mt-0.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          {[0, 1, 2].map(i => <motion.span key={i} className="w-1 h-1 rounded-full bg-[#2bac76]" animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />)}
                        </motion.div>
                      )}
                    </motion.div>
                  )
                })}
              </motion.div>
            </div>

            {/* Chat panel */}
            {showChat && (
              <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="w-[340px] bg-[#0d0d0f] border-l border-white/[0.04] flex flex-col">
                <div className="px-4 py-2.5 border-b border-white/[0.04]">
                  <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Daily Standup</p>
                </div>

                <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {speeches.map((speech, idx) => {
                    const agent = agentsActive.find(a => a.name === speech.agent)
                    const img = agent ? getAgentImage(agent.name) : null
                    const grad = agent ? getAgentGradient(agent.role) : ""
                    const isCurrent = idx === speakIdx
                    return (
                      <motion.div key={`speech-${idx}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-2", isCurrent && "bg-white/[0.02] -mx-4 px-4 py-2 rounded-lg")}>
                        {img ? <img src={img} className="w-6 h-6 rounded object-cover flex-shrink-0 mt-0.5" alt={speech.agent} /> :
                        <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white text-[7px] font-bold flex-shrink-0 mt-0.5", grad)}>{(speech.agent || "A")[0]}</div>}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-white/50">{speech.agent}</span>
                            {isCurrent && <div className="flex items-center gap-0.5">{[0, 1, 2].map(i => <motion.span key={i} className="w-1 h-1 rounded-full bg-[#2bac76]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }} />)}</div>}
                          </div>
                          <p className="text-[11px] text-white/35 leading-relaxed mt-0.5 whitespace-pre-wrap">{speech.content}</p>
                        </div>
                      </motion.div>
                    )
                  })}

                  {state === "completed" && summary && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] mt-2">
                      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">Resumo da Daily</p>
                      <div className="text-[10px] text-white/35 leading-relaxed whitespace-pre-wrap">
                        {summary.split("\n").map((line, i) => {
                          if (!line.trim()) return <br key={i} />
                          if (line.trim().startsWith("-")) return <p key={i} className="text-white/25 pl-2 border-l border-white/[0.06] mb-1">{line}</p>
                          if (line.includes(":")) return <p key={i} className="text-white/40 font-medium mt-2 mb-1">{line}</p>
                          return <p key={i} className="text-white/30">{line}</p>
                        })}
                      </div>
                    </motion.div>
                  )}

                  {state === "completed" && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-2">
                      <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] text-[11px] font-medium text-white/40 hover:text-white/60 transition-colors">Sair da reuniao</button>
                    </motion.div>
                  )}
                </div>

                {/* Chat input for live intervention */}
                {state === "running" && (
                  <div className="px-3 py-2 border-t border-white/[0.04]">
                    <div className="flex gap-2">
                      <input type="text" value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleSendComment() }} placeholder="Intervir na daily..." className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04] text-[11px] text-white/40 placeholder-white/15 focus:outline-none focus:border-white/[0.1]" />
                      <button onClick={handleSendComment} disabled={!commentInput.trim() || sendingComment} className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-20 text-[11px] text-white/40 transition-colors"><Send className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-white/[0.04]">
            <button onClick={() => setMicActive(!micActive)} className={cn("p-3 rounded-full transition-all", micActive ? "bg-white/[0.06] text-white/50 hover:bg-white/[0.08]" : "bg-[#ff385c]/10 text-[#ff385c]/60 hover:bg-[#ff385c]/20")}>{micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}</button>
            <button onClick={() => { if (state === "completed") onClose(); else { toast.info("A daily continua em segundo plano. Voce pode voltar depois."); onClose() } }} className="p-3 rounded-full bg-[#ff385c]/10 hover:bg-[#ff385c]/20 text-[#ff385c]/60 transition-colors"><PhoneOff className="w-5 h-5" /></button>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
