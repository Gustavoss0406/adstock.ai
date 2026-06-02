"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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

// Quick reply templates that agents trigger
const QUICK_REPLY_TRIGGERS = [
  { pattern: /reels|posts? no feed|formato|preferencia/i, options: ["Reels primeiro", "Mix dos dois", "Decidam voces"] },
  { pattern: /estilo visual|cores?|fonte|corporativo|colorido/i, options: ["Gosto moderno", "Prefiro classico", "Decide voce"] },
  { pattern: /conectar.*conta|integracao|configurar|google/i, options: ["Conectar conta", "Fazer depois", "Ajudar a configurar"] },
]

type DailyPhase = "entering" | "joining" | "awaiting_approval" | "creating_tasks" | "discussing" | "completed" | "error"

export function DailyModal({ open, agents, orgId, onClose, isFirstDaily }: DailyModalProps) {
  const [phase, setPhase] = useState<DailyPhase>("joining")
  const [speakingIdx, setSpeakingIdx] = useState(-1)
  const [speeches, setSpeeches] = useState<Array<{ agent: string; content: string; agentId?: string }>>([])
  const [summary, setSummary] = useState("")
  const [showChat, setShowChat] = useState(true)
  const [micActive, setMicActive] = useState(false)
  const [commentInput, setCommentInput] = useState("")
  const [sendingComment, setSendingComment] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [tasksCreated, setTasksCreated] = useState(0)
  const [approving, setApproving] = useState(false)
  const [cinematicPhase, setCinematicPhase] = useState<"entering" | "ready">("entering")
  const [quickReplies, setQuickReplies] = useState<string[]>([])
  const [quickReplyFor, setQuickReplyFor] = useState("")
  const [closing, setClosing] = useState(false)
  const [exitPhase, setExitPhase] = useState<"idle" | "leaving" | "done">("idle")
  const idleSince = useRef<number>(0)
  const easterFired = useRef<Set<string>>(new Set())
  const chatRef = useRef<HTMLDivElement>(null)
  const agentsActive = agents.filter(a => a.status !== "FIRED")
  const runRef = useRef(false)

  // Ring sound
  useEffect(() => {
    if (!open || !isFirstDaily) return
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const playBeep = (freq: number, delay: number, dur: number) => {
        setTimeout(() => {
          const osc = audioCtx.createOscillator()
          const gain = audioCtx.createGain()
          osc.connect(gain); gain.connect(audioCtx.destination)
          osc.type = "sine"; osc.frequency.value = freq
          gain.gain.setValueAtTime(0.06, audioCtx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur)
          osc.start(); osc.stop(audioCtx.currentTime + dur)
        }, delay)
      }
      playBeep(800, 0, 0.2)
      playBeep(1000, 800, 0.2)
      playBeep(800, 1600, 0.15)
      playBeep(1000, 2500, 0.3)
    } catch {}
  }, [open, isFirstDaily])

  // Cinematic entry
  useEffect(() => {
    if (!open || !isFirstDaily) { setCinematicPhase("ready"); return }
    setCinematicPhase("entering")
    const t = setTimeout(() => setCinematicPhase("ready"), 1500)
    return () => clearTimeout(t)
  }, [open, isFirstDaily])

  // Check for quick reply triggers
  useEffect(() => {
    if (speeches.length === 0) return
    const lastSpeech = speeches[speeches.length - 1]
    const text = lastSpeech.content || ""
    for (const trigger of QUICK_REPLY_TRIGGERS) {
      if (trigger.pattern.test(text)) {
        setQuickReplies(trigger.options)
        setQuickReplyFor(lastSpeech.agent)
        return
      }
    }
    setQuickReplies([])
    setQuickReplyFor("")
  }, [speeches])

  // Easter egg #2: Bruno "CEO sumiu?" after 60s idle in awaiting_approval
  useEffect(() => {
    if (phase !== "awaiting_approval") return
    if (easterFired.current.has("ceo-sumiu")) return
    idleSince.current = Date.now()
    const timer = setTimeout(() => {
      if (phase === "awaiting_approval" && !easterFired.current.has("ceo-sumiu")) {
        easterFired.current.add("ceo-sumiu")
        setSpeeches(s => [...s, { agent: "Bruno Costa", content: "CEO sumiu? 😅", agentId: agentsActive.find(a => a.name === "Bruno Costa")?.id }])
        // Maya responds after 3s
        setTimeout(() => {
          setSpeeches(s => [...s, { agent: "Maya Ferreira", content: "Deve estar ocupado, vamos continuar. Ele(a) aprova quando puder.", agentId: agentsActive[0]?.id }])
        }, 3000)
      }
    }, 60000)
    return () => clearTimeout(timer)
  }, [phase])

  // Main flow
  useEffect(() => {
    if (!open) return
    setPhase("joining")
    setSpeakingIdx(-1)
    setSpeeches([])
    setSummary("")
    setMicActive(false)
    setCommentInput("")
    setLoadingStep(0)
    setTasksCreated(0)
    setApproving(false)
    setQuickReplies([])
    setQuickReplyFor("")
    runRef.current = false

    const run = async () => {
      if (runRef.current) return
      runRef.current = true
      const activeAgents = agentsActive

      if (isFirstDaily && activeAgents.length > 0) {
        setPhase("joining")
        const maya = activeAgents[0]
        setSpeakingIdx(0)
        await new Promise(r => requestAnimationFrame(r))
        await new Promise(r => setTimeout(r, 50))

        let mayaContent = ""
        try {
          const res = await fetch("/api/daily/speak", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationId: orgId, agentId: maya.id, previousSpeeches: [], isFirst: true, isLast: false, isFirstDaily: true }),
          })
          if (res.ok) {
            const data = await res.json()
            mayaContent = data.content || ""
            setSpeeches([{ agent: data.agent, content: mayaContent, agentId: data.agentId }])
          }
        } catch {}
        if (!mayaContent) {
          const fb = "Nao consegui processar."
          setSpeeches([{ agent: maya.name, content: fb, agentId: maya.id }])
          mayaContent = fb
        }

        setPhase("awaiting_approval")
        return
      }

      // Regular daily
      await runAllAgents(activeAgents, [])
    }

    const timer = setTimeout(() => run(), isFirstDaily ? 1500 : 800)
    return () => clearTimeout(timer)
  }, [open, orgId])

  const runAllAgents = useCallback(async (
    agentList: Agent[],
    prevSpeeches: Array<{ agentName: string; content: string }>,
  ) => {
    setPhase("discussing")

    for (let i = 0; i < agentList.length; i++) {
      const agent = agentList[i]
      const isFirst = prevSpeeches.length <= 1
      const isLast = i === agentList.length - 1

      setSpeakingIdx(agentsActive.indexOf(agent))
      await new Promise(r => requestAnimationFrame(r))
      await new Promise(r => setTimeout(r, 50))

      try {
        const res = await fetch("/api/daily/speak", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: orgId, agentId: agent.id, previousSpeeches: prevSpeeches,
            isFirst, isLast, isFirstDaily: !!isFirstDaily,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const speech = { agent: data.agent, content: data.content, agentId: data.agentId }
          setSpeeches(s => [...s, speech])
          prevSpeeches.push({ agentName: data.agent, content: data.content })
        } else {
          const fb = { agent: agent.name, content: "Estou com dificuldades tecnicas.", agentId: agent.id }
          setSpeeches(s => [...s, fb])
          prevSpeeches.push({ agentName: agent.name, content: fb.content })
        }
      } catch {
        const fb = { agent: agent.name, content: "Estou com dificuldades tecnicas.", agentId: agent.id }
        setSpeeches(s => [...s, fb])
        prevSpeeches.push({ agentName: agent.name, content: fb.content })
      }

      if (!isLast) await new Promise(r => setTimeout(r, 3000))
    }

    await finishDaily(prevSpeeches)
  }, [orgId, isFirstDaily, agentsActive])

  const finishDaily = useCallback(async (speechesArr: Array<{ agentName: string; content: string }>) => {
    try {
      const summaryRes = await fetch("/api/daily/speak", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId, agentId: agentsActive[0]?.id || "",
          previousSpeeches: speechesArr, isSummary: true,
        }),
      })
      if (summaryRes.ok) {
        const sData = await summaryRes.json()
        setSummary(sData.content || "Daily concluida.")
        if (sData.tasksCreated) setTasksCreated(sData.tasksCreated)
      }
    } catch {}

    setPhase("completed")
    toast.success("Daily concluida!")
  }, [orgId, agentsActive])

  // Handle CEO approval
  const handleApprove = async () => {
    setApproving(true)
    setPhase("creating_tasks")

    const mayaSpeech = speeches[0]
    if (!mayaSpeech) return

    // Add Maya messages to local array manually (state won't be ready yet)
    const allSpeeches: Array<{ agentName: string; content: string }> = [
      { agentName: mayaSpeech.agent, content: mayaSpeech.content },
    ]

    // Post "creating cards" message
    setSpeeches(s => [...s, { agent: "Maya Ferreira", content: "Perfeito! Criando os cards agora...", agentId: agentsActive[0]?.id }])
    allSpeeches.push({ agentName: "Maya Ferreira", content: "Perfeito! Criando os cards agora..." })
    await new Promise(r => setTimeout(r, 1500))

    // Extract tasks — direct call to dedicated endpoint
    let created = 0
    try {
      const extRes = await fetch("/api/daily/extract-tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, speeches: allSpeeches }),
      })
      if (extRes.ok) {
        const extData = await extRes.json()
        created = extData.tasksCreated || 0
        setTasksCreated(created)
      }
    } catch {}

    await new Promise(r => setTimeout(r, 1500))

    // Maya posts completion
    const distributionMsg = `Pronto! Distribui tudo. ${created} cards criados e cada um ja sabe o que fazer.\n\nTime, alguma duvida ou sugestao antes de comecarmos?`
    setSpeeches(s => [...s, { agent: "Maya Ferreira", content: distributionMsg, agentId: agentsActive[0]?.id }])
    allSpeeches.push({ agentName: "Maya Ferreira", content: distributionMsg })

    await new Promise(r => setTimeout(r, 2000))

    // PHASE 3: Remaining agents speak
    const remainingAgents = agentsActive.slice(1)
    setApproving(false)
    await runAllAgents(remainingAgents, allSpeeches)
  }

  const handleAdjust = () => {
    setPhase("discussing")
    const mayaSpeech = speeches[0]
    const allSpeeches: Array<{ agentName: string; content: string }> = [
      { agentName: mayaSpeech?.agent || "Maya Ferreira", content: mayaSpeech?.content || "" },
    ]
    const remainingAgents = agentsActive.slice(1)
    runAllAgents(remainingAgents, allSpeeches)
  }

  const handleQuickReply = (reply: string) => {
    setQuickReplies([])
    setQuickReplyFor("")
    // Post CEO's quick reply
    setSpeeches(s => [...s, { agent: "CEO", content: reply }])
  }

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [speeches, quickReplies])

  useEffect(() => {
    if (phase === "joining") {
      const interval = setInterval(() => setLoadingStep(prev => (prev + 1) % LOADING_MESSAGES.length), 3000)
      return () => clearInterval(interval)
    }
  }, [phase])

  // Easter egg detection: funny text → agents react, junior vs senior → Maya responds
  const checkEasterEggs = (text: string) => {
    // #3: Funny text → random agent reacts with emoji
    if (/kkk|haha|rsrs|lol|engraçad|hilari/i.test(text) && !easterFired.current.has("funny")) {
      easterFired.current.add("funny")
      const reactors = agentsActive.filter(a => a.name !== "Maya Ferreira")
      const reactor = reactors[Math.floor(Math.random() * reactors.length)]
      if (reactor) {
        const emojis = ["😂", "🤣", "💀", "😹"]
        const emoji = emojis[Math.floor(Math.random() * emojis.length)]
        setTimeout(() => {
          setSpeeches(s => [...s, { agent: reactor.name, content: emoji, agentId: reactor.id }])
        }, 1500)
      }
    }
    // #4: CEO agrees with junior against senior → Maya "Interessante..."
    const jrIds = agentsActive.filter(a => (a.level ?? 99) <= 2).map(a => a.name)
    const srIds = agentsActive.filter(a => (a.level ?? 0) >= 3).map(a => a.name)
    if (jrIds.some(n => text.toLowerCase().includes(n.toLowerCase().split(" ")[0])) &&
        !easterFired.current.has("jr-sr")) {
      easterFired.current.add("jr-sr")
      setTimeout(() => {
        setSpeeches(s => [...s, { agent: "Maya Ferreira", content: "Interessante... vou considerar isso.", agentId: agentsActive[0]?.id }])
      }, 2000)
    }
  }

  const handleSendComment = async () => {
    if (!commentInput.trim() || sendingComment) return
    setSendingComment(true)
    checkEasterEggs(commentInput)
    try {
      await fetch("/api/daily/comment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, message: commentInput }),
      })
      setSpeeches(s => [...s, { agent: "CEO", content: commentInput }])
      setCommentInput("")
    } catch {} finally { setSendingComment(false) }
  }

  const handleClose = () => {
    setExitPhase("leaving")
    // After exit animation, notify + close
    setTimeout(() => {
      const names = agentsActive.map(a => a.name.split(" ")[0])
      toast.success(
        <div className="space-y-1">
          <p className="font-semibold">🎯 Time esta trabalhando!</p>
          <div className="text-[10px] opacity-80 space-y-0.5">
            {names.map((n, i) => <p key={i}>🟢 {n}: {["Criando conteudo...", "Analisando metricas...", "Configurando campanhas...", "Preparando briefings...", "Otimizando SEO..."][i] || "Trabalhando..."}</p>)}
          </div>
        </div>,
        { duration: 6000 }
      )
      onClose()
      setExitPhase("done")
    }, 800)
  }

  // Meeting room seats: Maya in front, others around table
  const meetingSeats = [0, 1, 2, 3, 4]
  const tableW = 480
  const tableH = 240
  const seats = [
    { x: tableW / 2, y: -20 },         // top center — Maya (standing)
    { x: tableW / 2, y: tableH + 20 },  // bottom center — CEO
    { x: -20, y: tableH / 2 },          // left — agent
    { x: tableW + 20, y: tableH / 2 },  // right — agent
    { x: tableW / 2 + 60, y: tableH / 2 }, // right side — extra agent
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={isFirstDaily ? { opacity: 0, scale: 0.98 } : { opacity: 1 }}
          animate={exitPhase === "leaving" ? { opacity: 0, scale: 1.03 } : { opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col"
        >
          {/* Cinematic entry */}
          {isFirstDaily && cinematicPhase === "entering" && (
            <motion.div
              initial={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-[101] bg-[#0a0a0b] flex items-center justify-center"
            >
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}
                className="text-center space-y-6">
                <motion.div
                  className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#ff385c] to-[#7C3AED] flex items-center justify-center ring-4 ring-[#ff385c]/10"
                  animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <img src="/agents/Maya.png" className="w-14 h-14 rounded-xl object-cover" alt="Maya" />
                </motion.div>
                <div>
                  <p className="text-sm text-white/40">Entrando na sala de reuniao...</p>
                  <p className="text-[11px] text-white/15 mt-1">A equipe ja esta te esperando</p>
                </div>
              </motion.div>
              </motion.div>
            )}
          </div>

          {/* Back-to-office exit transition */}
          {exitPhase === "leaving" && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-[102] bg-[#0a0a0b] flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center space-y-4"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 mx-auto rounded-full border-2 border-white/10 border-t-[#2bac76]/50"
                />
                <p className="text-sm text-white/30">Voltando ao escritorio...</p>
                <p className="text-[11px] text-white/15">Agentes indo para suas mesas</p>
              </motion.div>
            </motion.div>
          )}

          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-white/25" />
                <span className="text-[11px] text-white/30">{agentsActive.length + 1} participantes</span>
              </div>
              {phase === "entering" && (
                <span className="flex items-center gap-1 text-[10px] text-[#ff385c]/60">
                  <Sparkles className="w-3 h-3" /> Primeira Daily
                </span>
              )}
              {phase === "awaiting_approval" && (
                <span className="flex items-center gap-1 text-[10px] text-[#ecb22e]/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ecb22e] animate-pulse" /> Aguardando voce
                </span>
              )}
              {phase === "discussing" && (
                <span className="flex items-center gap-1 text-[10px] text-[#2bac76]/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2bac76] animate-pulse" /> Em reuniao
                </span>
              )}
              {phase === "completed" && <span className="text-[10px] text-white/20">Reuniao encerrada</span>}
            </div>
            <button onClick={() => setShowChat(!showChat)}
              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors", showChat ? "bg-white/[0.06] text-white/40" : "text-white/20 hover:text-white/40")}>
              <MessageSquare className="w-3 h-3" /> Chat
            </button>
          </div>

          {/* Main content: meeting room + chat */}
          <div className="flex-1 flex overflow-hidden">
            {/* Meeting room — conference table + agents */}
            <div className="flex-1 flex items-center justify-center p-8 relative">
              {(phase === "joining") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-10 h-10 border-2 border-white/10 border-t-[#2bac76]/50 rounded-full" />
                  <motion.p key={loadingStep} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-[12px] text-white/25 max-w-[250px] text-center">{LOADING_MESSAGES[loadingStep]}</motion.p>
                </div>
              )}

              {phase === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <p className="text-[12px] text-[#ff385c]/60 text-center max-w-[250px]">Nao foi possivel iniciar a daily.</p>
                  <button onClick={() => { setPhase("joining"); runRef.current = false }}
                    className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.08] text-[11px] text-white/40 transition-colors">Tentar novamente</button>
                </div>
              )}

              {/* Conference table + surrounding agents */}
              {phase !== "joining" && (
                <div className="relative" style={{ width: tableW + 80, height: tableH + 80 }}>
                  {/* Table */}
                  <motion.div
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: 0.6 }}
                    className="absolute rounded-full border border-white/[0.06] bg-white/[0.01]"
                    style={{ left: 40, top: 40, width: tableW, height: tableH }}
                  >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/[0.015] to-transparent" />
                    <div className="absolute inset-x-6 top-1/2 h-px bg-white/[0.03]" />
                  </motion.div>

                  {/* Whiteboard */}
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} transition={{ delay: 0.4 }}
                    className="absolute rounded-lg border border-white/[0.04] bg-white/[0.01]"
                    style={{ left: tableW / 2 - 60, top: -60, width: 120, height: 50 }}
                  >
                    <div className="p-1.5">
                      <div className="w-full h-0.5 bg-white/[0.08] rounded-full mb-1" />
                      <div className="w-3/4 h-0.5 bg-white/[0.05] rounded-full" />
                    </div>
                  </motion.div>

                  {/* Agents at their seats */}
                  {agentsActive.map((agent, idx) => {
                    const isSpeaking = (phase === "discussing") && speakingIdx === agentsActive.indexOf(agent)
                    const hasSpoken = speeches.some(s => s.agent === agent.name)
                    const isThinking = isSpeaking && !hasSpoken
                    const img = getAgentImage(agent.name)
                    const gradient = getAgentGradient(agent.role)
                    const isMaya = idx === 0

                    // Maya stands at the top (front of room)
                    const pos = isMaya
                      ? { x: tableW / 2 - 32, y: -90 }
                      : idx === 1 ? { x: 10, y: tableH / 2 - 32 }
                      : idx === 2 ? { x: tableW - 20, y: tableH / 2 + 10 }
                      : idx === 3 ? { x: tableW / 2 - 60, y: tableH + 10 }
                      : { x: tableW / 2 + 10, y: tableH + 10 }

                    return (
                      <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: hasSpoken || isSpeaking ? 1 : 0.5, y: 0 }}
                        transition={{ delay: 0.2 + idx * 0.1, type: "spring", stiffness: 200 }}
                        className={cn(
                          "absolute flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-500",
                          isMaya && "p-3",
                          isThinking ? "border border-[#2563eb]/30 bg-[#2563eb]/[0.04]" :
                          isSpeaking ? "border border-[#2bac76]/30 bg-[#2bac76]/[0.04]" :
                          hasSpoken ? "border border-white/[0.03] bg-white/[0.01]" : ""
                        )}
                        style={{ left: pos.x + 40, top: pos.y + 40 }}
                      >
                        {isThinking && <motion.div className="absolute inset-0 rounded-xl" animate={{ boxShadow: ["0 0 15px rgba(37,99,235,0.1)", "0 0 25px rgba(37,99,235,0.15)", "0 0 15px rgba(37,99,235,0.1)"] }} transition={{ duration: 2, repeat: Infinity }} />}
                        {isSpeaking && !isThinking && <motion.div className="absolute inset-0 rounded-xl" animate={{ boxShadow: ["0 0 15px rgba(43,172,118,0.1)", "0 0 25px rgba(43,172,118,0.15)", "0 0 15px rgba(43,172,118,0.1)"] }} transition={{ duration: 2, repeat: Infinity }} />}
                        <div className="relative">
                          {img ? <img src={img} className={cn("rounded-xl object-cover", isMaya ? "w-16 h-16 ring-2 ring-[#ff385c]/20" : "w-12 h-12", isThinking && "ring-2 ring-[#2563eb] ring-offset-2 ring-offset-[#0a0a0a]", isSpeaking && !isThinking && "ring-2 ring-[#2bac76] ring-offset-2 ring-offset-[#0a0a0a]")} alt={agent.name} /> :
                          <div className={cn("rounded-xl flex items-center justify-center text-white font-bold", gradient, isMaya ? "w-16 h-16 text-lg" : "w-12 h-12 text-sm")}>{getAgentInitials(agent.name)}</div>}
                          {isMaya && phase === "discussing" && <span className="absolute -top-1 -right-1 text-[8px]">🎤</span>}
                          <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#0a0a0a]",
                            isThinking ? "bg-[#2563eb] animate-pulse" : isSpeaking ? "bg-[#2bac76] animate-pulse" : hasSpoken ? "bg-[#2bac76]" : "bg-white/10")} />
                        </div>
                        <div className="text-center">
                          <p className={cn("font-semibold text-white/60 truncate", isMaya ? "text-[11px]" : "text-[9px]")}>{agent.name.split(" ")[0]}</p>
                        </div>
                        {isThinking && (
                          <div className="flex items-center gap-1">
                            {[0, 1, 2].map(i => <motion.span key={i} className="w-1 h-1 rounded-full bg-[#2563eb]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />)}
                          </div>
                        )}
                        {isSpeaking && !isThinking && (
                          <div className="flex items-center gap-1">
                            {[0, 1, 2].map(i => <motion.span key={i} className="w-1 h-1 rounded-full bg-[#2bac76]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />)}
                          </div>
                        )}
                      </motion.div>
                    )
                  })}

                  {/* CEO chair (empty, user's position) */}
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                    className="absolute flex flex-col items-center gap-1"
                    style={{ left: tableW / 2 - 24 + 40, top: tableH + 20 + 40 }}
                  >
                    <div className="w-12 h-12 rounded-xl border-2 border-dashed border-white/[0.06] bg-transparent flex items-center justify-center">
                      <span className="text-white/15 text-[18px]">👤</span>
                    </div>
                    <span className="text-[9px] font-semibold text-white/20">CEO</span>
                  </motion.div>
                </div>
              )}
            </div>

            {/* Chat panel */}
            {showChat && (
              <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }}
                className="w-[360px] bg-[#0d0d0f] border-l border-white/[0.04] flex flex-col">
                <div className="px-4 py-2.5 border-b border-white/[0.04]">
                  <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">#daily-standup</p>
                </div>

                <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {speeches.map((speech, idx) => {
                    const agent = agentsActive.find(a => a.name === speech.agent)
                    const img = speech.agent === "CEO" ? null : agent ? getAgentImage(agent.name) : null
                    const grad = agent ? getAgentGradient(agent.role) : ""
                    const isSystem = speech.content.includes("Pronto! Distribui") || speech.content.includes("Criando os cards")
                    return (
                      <motion.div key={`speech-${idx}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
                        {speech.agent === "CEO" ? (
                          <div className="w-6 h-6 rounded bg-white/[0.04] flex items-center justify-center text-white/30 text-[7px] font-bold flex-shrink-0 mt-0.5">CEO</div>
                        ) : img ? (
                          <img src={img} className="w-6 h-6 rounded object-cover flex-shrink-0 mt-0.5" alt={speech.agent} />
                        ) : (
                          <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white text-[7px] font-bold flex-shrink-0 mt-0.5", grad || "bg-[#444]")}>{(speech.agent || "A")[0]}</div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-white/50">{speech.agent}</span>
                            {isSystem && <span className="text-[9px] text-[#2bac76]/60">sistema</span>}
                          </div>
                          <p className="text-[11px] text-white/35 leading-relaxed mt-0.5 whitespace-pre-wrap">{speech.content}</p>
                        </div>
                      </motion.div>
                    )
                  })}

                  {/* Approval buttons */}
                  {phase === "awaiting_approval" && !approving && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                      <p className="text-[11px] text-white/40 text-center">Aprovar as prioridades?</p>
                      <div className="flex gap-2">
                        <button onClick={handleApprove}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#2bac76]/10 hover:bg-[#2bac76]/20 text-[11px] text-[#2bac76] font-medium transition-colors">
                          <Check className="w-3.5 h-3.5" />Sim, pode criar
                        </button>
                        <button onClick={handleAdjust}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] text-[11px] text-white/35 font-medium transition-colors">
                          <PenLine className="w-3.5 h-3.5" />Quero ajustar
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Creating tasks spinner */}
                  {phase === "creating_tasks" && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 py-2">
                      <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-[#2bac76]/50 animate-spin" />
                      <span className="text-[11px] text-white/25">Maya esta criando os cards...</span>
                    </motion.div>
                  )}

                  {/* Tasks created notification */}
                  {phase === "discussing" && tasksCreated > 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-[#2bac76]/[0.03] border border-[#2bac76]/10 text-center">
                      <span className="text-[11px] text-[#2bac76]/60">✨ {tasksCreated} cards criados e distribuidos!</span>
                    </motion.div>
                  )}

                  {/* Quick replies */}
                  {quickReplies.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                      <p className="text-[10px] text-white/25">{quickReplyFor} pergunta:</p>
                      {quickReplies.map((reply, i) => (
                        <button key={i} onClick={() => handleQuickReply(reply)}
                          className="w-full text-left px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] text-[11px] text-white/40 hover:text-white/60 transition-colors">
                          🎯 {reply}
                        </button>
                      ))}
                    </motion.div>
                  )}

                  {/* Summary + completion */}
                  {phase === "completed" && summary && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] mt-2">
                      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">Resumo da Daily</p>
                      <div className="text-[10px] text-white/35 leading-relaxed whitespace-pre-wrap">
                        {summary.split("\n").map((line, i) => {
                          if (!line.trim()) return <br key={i} />
                          if (line.trim().startsWith("-")) return <p key={i} className="text-white/25 pl-2 border-l border-white/[0.06] mb-1">{line}</p>
                          return <p key={i} className="text-white/30">{line}</p>
                        })}
                      </div>
                    </motion.div>
                  )}

                  {phase === "completed" && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-2 space-y-2">
                      <button onClick={handleClose}
                        className="px-4 py-2 rounded-lg bg-[#2bac76]/10 hover:bg-[#2bac76]/20 text-[11px] font-medium text-[#2bac76] transition-colors">
                        Ver Kanban
                      </button>
                      <br />
                      <button onClick={handleClose}
                        className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] text-[11px] font-medium text-white/40 hover:text-white/60 transition-colors">
                        Voltar ao escritorio
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Chat input */}
                {(phase === "discussing" || phase === "awaiting_approval") && (
                  <div className="px-3 py-2 border-t border-white/[0.04]">
                    <div className="flex gap-2">
                      <input type="text" value={commentInput} onChange={e => setCommentInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleSendComment() }}
                        placeholder="Intervir na daily..."
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04] text-[11px] text-white/40 placeholder-white/15 focus:outline-none focus:border-white/[0.1]" />
                      <button onClick={handleSendComment} disabled={!commentInput.trim() || sendingComment}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-20 text-[11px] text-white/40 transition-colors">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-white/[0.04] flex-shrink-0">
            <button onClick={() => setMicActive(!micActive)}
              className={cn("p-3 rounded-full transition-all", micActive ? "bg-white/[0.06] text-white/50" : "bg-[#ff385c]/10 text-[#ff385c]/60")}>
              {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
            <button onClick={handleClose}
              className="p-3 rounded-full bg-[#ff385c]/10 hover:bg-[#ff385c]/20 text-[#ff385c]/60 transition-colors">
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
