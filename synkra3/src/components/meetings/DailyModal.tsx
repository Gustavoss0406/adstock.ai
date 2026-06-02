"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn, getAgentGradient, getAgentInitials, getRoleLabel } from "@/lib/utils"
import { Agent } from "@prisma/client"
import { X, PhoneOff, Mic, MicOff, Users, MessageSquare, Send, Sparkles, Check, PenLine } from "lucide-react"
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
  isFirstDaily?: boolean
}

function getAgentImage(name: string): string | null {
  return AGENT_CHARS[name] || null
}

const LOADING_MESSAGES = [
  "Agentes estao chegando na sala...",
  "Maya esta preparando o plano do dia...",
  "Bruno esta revisando as redes sociais...",
  "Lena esta analisando metricas recentes...",
  "Carlos esta organizando os briefings...",
  "Diego esta verificando o SEO...",
]

type DailyPhase = "joining" | "awaiting_approval" | "creating_tasks" | "discussing" | "completed" | "error"

export function DailyModal({ open, agents, orgId, onClose, isFirstDaily }: DailyModalProps) {
  const [state, setState] = useState<"joining" | "running" | "completed" | "error">("joining")
  const [phase, setPhase] = useState<DailyPhase>("joining")
  const [speakingIdx, setSpeakingIdx] = useState(-1)
  const [speeches, setSpeeches] = useState<Array<{ agent: string; content: string; agentId?: string }>>([])
  const [summary, setSummary] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [showChat, setShowChat] = useState(true)
  const [micActive, setMicActive] = useState(false)
  const [commentInput, setCommentInput] = useState("")
  const [sendingComment, setSendingComment] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [tasksCreated, setTasksCreated] = useState(0)
  const [approving, setApproving] = useState(false)
  const [cinematicPhase, setCinematicPhase] = useState<"entering" | "ready">("entering")
  const chatRef = useRef<HTMLDivElement>(null)
  const agentsActive = agents.filter(a => a.status !== "FIRED")
  const runRef = useRef(false)

  // Cinematic entry for first daily
  useEffect(() => {
    if (!open || !isFirstDaily) {
      setCinematicPhase("ready")
      return
    }
    setCinematicPhase("entering")
    const t = setTimeout(() => setCinematicPhase("ready"), 1200)
    return () => clearTimeout(t)
  }, [open, isFirstDaily])

  useEffect(() => {
    if (!open) return
    setState("joining")
    setPhase("joining")
    setSpeakingIdx(-1)
    setSpeeches([])
    setSummary("")
    setMessages([])
    setMicActive(false)
    setCommentInput("")
    setLoadingStep(0)
    setTasksCreated(0)
    setApproving(false)
    runRef.current = false

    const run = async () => {
      if (runRef.current) return
      runRef.current = true
      try {
        const activeAgents = agentsActive
        const previousSpeeches: Array<{ agentName: string; content: string }> = []

        // ── First daily: Phase 1 — Maya speaks ──
        if (isFirstDaily && activeAgents.length > 0) {
          setState("running")
          setPhase("joining")
          const maya = activeAgents[0]
          setSpeakingIdx(0)
          await new Promise(r => requestAnimationFrame(r))
          await new Promise(r => setTimeout(r, 50))

          try {
            const res = await fetch("/api/daily/speak", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                organizationId: orgId,
                agentId: maya.id,
                previousSpeeches: [],
                isFirst: true,
                isLast: false,
                isFirstDaily: true,
              }),
            })
            if (res.ok) {
              const data = await res.json()
              const speech = { agent: data.agent, content: data.content, agentId: data.agentId }
              setSpeeches(prev => [...prev, speech])
              previousSpeeches.push({ agentName: data.agent, content: data.content })
            } else {
              const fb = { agent: maya.name, content: "Nao consegui processar.", agentId: maya.id }
              setSpeeches(prev => [...prev, fb])
              previousSpeeches.push({ agentName: maya.name, content: fb.content })
            }
          } catch {
            const fb = { agent: maya.name, content: "Nao consegui processar.", agentId: maya.id }
            setSpeeches(prev => [...prev, fb])
            previousSpeeches.push({ agentName: maya.name, content: fb.content })
          }

          // Pause for CEO approval
          setPhase("awaiting_approval")
          return // Wait for approval callback
        }

        // ── Regular daily: all agents speak sequentially ──
        await runAllAgents(activeAgents, previousSpeeches)
      } catch {
        toast.error("Erro ao iniciar a daily")
        setState("error")
        setPhase("error")
      }
    }

    const runAllAgents = async (
      agentList: Agent[],
      prevSpeeches: Array<{ agentName: string; content: string }>,
    ) => {
      setState("running")
      setPhase("discussing")

      for (let i = 0; i < agentList.length; i++) {
        const agent = agentList[i]
        const isFirst = i === 0
        const isLast = i === agentList.length - 1

        setSpeakingIdx(i)
        await new Promise(r => requestAnimationFrame(r))
        await new Promise(r => setTimeout(r, 50))

        try {
          const res = await fetch("/api/daily/speak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organizationId: orgId,
              agentId: agent.id,
              previousSpeeches: prevSpeeches,
              isFirst,
              isLast,
              isFirstDaily: isFirstDaily || false,
            }),
          })
          if (res.ok) {
            const data = await res.json()
            const speech = { agent: data.agent, content: data.content, agentId: data.agentId }
            setSpeeches(s => [...s, speech])
            prevSpeeches.push({ agentName: data.agent, content: data.content })
          } else {
            const fb = { agent: agent.name, content: "Estou com dificuldades tecnicas. Vou me atualizar depois.", agentId: agent.id }
            setSpeeches(s => [...s, fb])
            prevSpeeches.push({ agentName: agent.name, content: fb.content })
          }
        } catch {
          const fb = { agent: agent.name, content: "Estou com dificuldades tecnicas. Vou me atualizar depois.", agentId: agent.id }
          setSpeeches(s => [...s, fb])
          prevSpeeches.push({ agentName: agent.name, content: fb.content })
        }

        if (!isLast) await new Promise(r => setTimeout(r, 2000))
      }

      await finishDaily(prevSpeeches)
    }

    const finishDaily = async (speechesArr: Array<{ agentName: string; content: string }>) => {
      // Summary
      try {
        const summaryRes = await fetch("/api/daily/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: orgId,
            agentId: agentsActive[0]?.id || "",
            previousSpeeches: speechesArr,
            isFirst: false,
            isLast: true,
            isSummary: true,
          }),
        })
        if (summaryRes.ok) {
          const sData = await summaryRes.json()
          setSummary(sData.content || "Daily concluida.")
          if (sData.tasksCreated) setTasksCreated(sData.tasksCreated)
        }
      } catch {}

      setState("completed")
      setPhase("completed")
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
    }

    const timer = setTimeout(() => run(), 800)
    return () => clearTimeout(timer)
  }, [open, orgId])

  // Handle CEO approval
  const handleApprove = async () => {
    setApproving(true)
    setPhase("creating_tasks")

    // Post Maya "creating cards" message
    setSpeeches(s => [...s, {
      agent: "Maya Ferreira",
      content: "Perfeito! Criando os cards agora...",
      agentId: agentsActive[0]?.id,
    }])

    await new Promise(r => setTimeout(r, 1500))

    try {
      // Extract tasks from Maya's speech
      const mayaSpeech = speeches[0]
      if (mayaSpeech) {
        const res = await fetch("/api/daily/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: orgId,
            agentId: agentsActive[0]?.id || "",
            previousSpeeches: [{ agentName: mayaSpeech.agent, content: mayaSpeech.content }],
            isSummary: true,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setTasksCreated(data.tasksCreated || 0)
        }
      }
    } catch {}

    await new Promise(r => setTimeout(r, 2000))

    // Maya posts completion + distribution
    setSpeeches(s => [...s, {
      agent: "Maya Ferreira",
      content: `Pronto! Distribui tudo. ${tasksCreated || 5} cards criados e cada um ja sabe o que fazer.\n\nTime, alguma duvida ou sugestao antes de comecarmos?`,
      agentId: agentsActive[0]?.id,
    }])

    await new Promise(r => setTimeout(r, 1000))

    // Phase 3: remaining agents speak
    const remainingAgents = agentsActive.slice(1)
    const previousSpeeches = speeches.map(s => ({
      agentName: s.agent,
      content: s.content,
    }))

    await runAllAgents(remainingAgents, previousSpeeches)
    setApproving(false)
  }

  const handleAdjust = () => {
    setPhase("discussing")
    // Continue with remaining agents — CEO can intervene in chat
    const remainingAgents = agentsActive.slice(1)
    const previousSpeeches = speeches.map(s => ({
      agentName: s.agent,
      content: s.content,
    }))
    runAllAgents(remainingAgents, previousSpeeches)
  }

  // Helper to run all agents (regular flow)
  const runAllAgents = async (
    agentList: Agent[],
    prevSpeeches: Array<{ agentName: string; content: string }>,
  ) => {
    setState("running")
    setPhase("discussing")

    for (let i = 0; i < agentList.length; i++) {
      const agent = agentList[i]
      const isFirst = speeches.length === 1 // Maya already spoke
      const isLast = i === agentList.length - 1

      setSpeakingIdx(agentsActive.indexOf(agent))
      await new Promise(r => requestAnimationFrame(r))
      await new Promise(r => setTimeout(r, 50))

      try {
        const res = await fetch("/api/daily/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: orgId,
            agentId: agent.id,
            previousSpeeches: prevSpeeches,
            isFirst,
            isLast,
            isFirstDaily: isFirstDaily || false,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const speech = { agent: data.agent, content: data.content, agentId: data.agentId }
          setSpeeches(s => [...s, speech])
          prevSpeeches.push({ agentName: data.agent, content: data.content })
        } else {
          const fb = { agent: agent.name, content: "Estou com dificuldades tecnicas. Vou me atualizar depois.", agentId: agent.id }
          setSpeeches(s => [...s, fb])
          prevSpeeches.push({ agentName: agent.name, content: fb.content })
        }
      } catch {
        const fb = { agent: agent.name, content: "Estou com dificuldades tecnicas. Vou me atualizar depois.", agentId: agent.id }
        setSpeeches(s => [...s, fb])
        prevSpeeches.push({ agentName: agent.name, content: fb.content })
      }

      if (!isLast) await new Promise(r => setTimeout(r, 2000))
    }

    await finishDaily(prevSpeeches)
  }

  const finishDaily = async (speechesArr: Array<{ agentName: string; content: string }>) => {
    try {
      const summaryRes = await fetch("/api/daily/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          agentId: agentsActive[0]?.id || "",
          previousSpeeches: speechesArr,
          isFirst: false,
          isLast: true,
          isSummary: true,
        }),
      })
      if (summaryRes.ok) {
        const sData = await summaryRes.json()
        setSummary(sData.content || "Daily concluida.")
        if (sData.tasksCreated) setTasksCreated(sData.tasksCreated)
      }
    } catch {}

    setState("completed")
    setPhase("completed")
    toast.success("Daily concluida!")

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
  }

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, speeches])

  useEffect(() => {
    if (state === "joining" && phase === "joining") {
      const interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % LOADING_MESSAGES.length)
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [state, phase])

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
        setSpeeches(s => [...s, {
          agent: "Voce",
          content: commentInput,
        }])
        setCommentInput("")
      }
    } catch {} finally {
      setSendingComment(false)
    }
  }

  const speakIdx = speakingIdx >= 0 && speakingIdx < speakersArray.length ? speakingIdx : -1
  // Calculate speaking index relative to current phase
  const speakersArray = phase === "awaiting_approval" ? speeches : speeches

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={isFirstDaily ? { opacity: 0, scale: 0.98 } : { opacity: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: isFirstDaily ? 0.6 : 0.2 }}
          className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col"
        >
          {/* Cinematic entry overlay */}
          {isFirstDaily && cinematicPhase === "entering" && (
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[101] bg-[#0a0a0b] flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="text-center space-y-4"
              >
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#ff385c] to-[#7C3AED] flex items-center justify-center">
                  <img src="/agents/Maya.png" className="w-12 h-12 rounded-xl object-cover" alt="Maya" />
                </div>
                <p className="text-sm text-white/40">Entrando na sala de reuniao...</p>
              </motion.div>
            </motion.div>
          )}

          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-white/25" />
                <span className="text-[11px] text-white/30">{agentsActive.length} participantes</span>
              </div>
              {phase === "awaiting_approval" && (
                <span className="flex items-center gap-1 text-[10px] text-[#ecb22e]/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ecb22e] animate-pulse" />
                  Aguardando aprovacao
                </span>
              )}
              {(state === "running" || phase === "discussing") && (
                <span className="flex items-center gap-1 text-[10px] text-[#2bac76]/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2bac76] animate-pulse" />
                  Em reuniao
                </span>
              )}
              {isFirstDaily && (phase === "joining" || state === "joining") && (
                <span className="flex items-center gap-1 text-[10px] text-[#ff385c]/60">
                  <Sparkles className="w-3 h-3 text-[#ff385c]" />
                  Primeira Daily
                </span>
              )}
              {phase === "completed" && (
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
              {(state === "joining" || phase === "joining") && (
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
                  <button onClick={() => { setState("joining"); setPhase("joining") }}
                    className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.08] text-[11px] text-white/40 hover:text-white/60 transition-colors">
                    Tentar novamente
                  </button>
                </div>
              )}
              <motion.div layout className={cn("grid gap-3 w-full max-w-3xl", agentsActive.length <= 3 ? "grid-cols-3" : agentsActive.length === 4 ? "grid-cols-2" : "grid-cols-3")}>
                {agentsActive.map((agent, idx) => {
                  const isSpeaking = (phase === "discussing" || state === "running") && speakIdx === idx
                  const hasSpoken = speeches.some(s => s.agent === agent.name)
                  const isThinking = isSpeaking && !hasSpoken
                  const img = getAgentImage(agent.name)
                  const initials = getAgentInitials(agent.name)
                  const gradient = getAgentGradient(agent.role)
                  return (
                    <motion.div key={agent.id} layout animate={{ scale: isSpeaking ? 1.02 : 1, opacity: (state === "joining" || phase === "joining") ? 0.5 : hasSpoken ? 1 : 0.6 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className={cn(
                      "relative flex flex-col items-center gap-3 p-4 rounded-2xl transition-all duration-500",
                      isThinking ? "border-2 border-[#2563eb] bg-[#2563eb]/[0.05] shadow-[0_0_30px_rgba(37,99,235,0.15)]" :
                      isSpeaking ? "border-2 border-[#2bac76] bg-[#2bac76]/[0.05] shadow-[0_0_30px_rgba(43,172,118,0.15)]" :
                      hasSpoken ? "border border-white/[0.04] bg-white/[0.02]" :
                      "border border-white/[0.02] bg-white/[0.01]"
                    )}>
                      {isThinking && <motion.div className="absolute inset-0 rounded-2xl" animate={{ boxShadow: ["0 0 20px rgba(37,99,235,0.1)", "0 0 40px rgba(37,99,235,0.2)", "0 0 20px rgba(37,99,235,0.1)"] }} transition={{ duration: 2, repeat: Infinity }} />}
                      {isSpeaking && !isThinking && <motion.div className="absolute inset-0 rounded-2xl" animate={{ boxShadow: ["0 0 20px rgba(43,172,118,0.1)", "0 0 40px rgba(43,172,118,0.2)", "0 0 20px rgba(43,172,118,0.1)"] }} transition={{ duration: 2, repeat: Infinity }} />}
                      <div className="relative flex-shrink-0">
                        {img ? <img src={img} className={cn("w-20 h-20 rounded-2xl object-cover transition-all duration-500", isThinking && "ring-2 ring-[#2563eb] ring-offset-2 ring-offset-[#0a0a0a]", isSpeaking && !isThinking && "ring-2 ring-[#2bac76] ring-offset-2 ring-offset-[#0a0a0a]")} alt={agent.name} /> :
                        <div className={cn("w-20 h-20 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-2xl transition-all duration-500", gradient, isThinking && "ring-2 ring-[#2563eb] ring-offset-2 ring-offset-[#0a0a0a]", isSpeaking && !isThinking && "ring-2 ring-[#2bac76] ring-offset-2 ring-offset-[#0a0a0a]")}>{initials}</div>}
                        <span className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0a0a]", isThinking ? "bg-[#2563eb] animate-pulse" : isSpeaking ? "bg-[#2bac76] animate-pulse" : hasSpoken ? "bg-[#2bac76]" : "bg-white/15")} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-white/70 truncate max-w-[140px]">{agent.name}</p>
                        <p className="text-[10px] text-white/25 mt-0.5">{getRoleLabel(agent.role)}</p>
                      </div>
                      {isThinking && (
                        <motion.div className="flex flex-col items-center gap-1 mt-0.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <div className="flex items-center gap-1.5">
                            {[0, 1, 2].map(i => <motion.span key={i} className="w-1 h-1 rounded-full bg-[#2563eb]" animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />)}
                          </div>
                          <span className="text-[9px] text-[#2563eb]/60 font-medium">Pensando...</span>
                        </motion.div>
                      )}
                      {isSpeaking && !isThinking && (
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
                    const isSystemMessage = speech.content.includes("Pronto! Distribui") || speech.content.includes("Criando os cards")
                    return (
                      <motion.div key={`speech-${idx}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-2")}>
                        {img ? <img src={img} className="w-6 h-6 rounded object-cover flex-shrink-0 mt-0.5" alt={speech.agent} /> :
                        speech.agent === "Voce" ? <div className="w-6 h-6 rounded bg-white/[0.06] flex items-center justify-center text-white/40 text-[7px] font-bold flex-shrink-0 mt-0.5">CEO</div> :
                        <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white text-[7px] font-bold flex-shrink-0 mt-0.5", grad || "bg-[#444]")}>{(speech.agent || "A")[0]}</div>}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-white/50">{speech.agent}</span>
                            {isSystemMessage && <span className="text-[9px] text-[#2bac76]/60">acao</span>}
                          </div>
                          <p className="text-[11px] text-white/35 leading-relaxed mt-0.5 whitespace-pre-wrap">{speech.content}</p>
                        </div>
                      </motion.div>
                    )
                  })}

                  {/* Approval buttons after Maya's first-daily speech */}
                  {phase === "awaiting_approval" && !approving && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                      <p className="text-[11px] text-white/40 text-center">Aprovar as prioridades?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleApprove}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#2bac76]/10 hover:bg-[#2bac76]/20 text-[11px] text-[#2bac76] font-medium transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Sim, pode criar
                        </button>
                        <button
                          onClick={handleAdjust}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] text-[11px] text-white/35 font-medium transition-colors"
                        >
                          <PenLine className="w-3.5 h-3.5" />
                          Quero ajustar
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Creating tasks animation */}
                  {phase === "creating_tasks" && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 py-2">
                      <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-[#2bac76]/50 animate-spin" />
                      <span className="text-[11px] text-white/25">Maya esta criando os cards...</span>
                    </motion.div>
                  )}

                  {/* Tasks created notification */}
                  {phase === "discussing" && tasksCreated > 0 && speeches.length >= 3 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-[#2bac76]/[0.03] border border-[#2bac76]/10 text-center">
                      <span className="text-[11px] text-[#2bac76]/60">✨ {tasksCreated} cards criados e distribuidos!</span>
                    </motion.div>
                  )}

                  {phase === "completed" && summary && (
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

                  {phase === "completed" && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-2 space-y-2">
                      <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] text-[11px] font-medium text-white/40 hover:text-white/60 transition-colors"
                      >
                        Voltar ao escritorio
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Chat input for live intervention */}
                {(phase === "discussing" || phase === "awaiting_approval") && (
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
          <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-white/[0.04] flex-shrink-0">
            <button onClick={() => setMicActive(!micActive)} className={cn("p-3 rounded-full transition-all", micActive ? "bg-white/[0.06] text-white/50 hover:bg-white/[0.08]" : "bg-[#ff385c]/10 text-[#ff385c]/60 hover:bg-[#ff385c]/20")}>{micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}</button>
            <button onClick={() => { if (phase === "completed") onClose(); else { toast.info("A daily continua em segundo plano. Voce pode voltar depois."); onClose() } }} className="p-3 rounded-full bg-[#ff385c]/10 hover:bg-[#ff385c]/20 text-[#ff385c]/60 transition-colors"><PhoneOff className="w-5 h-5" /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
