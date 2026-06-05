"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { cn, getAgentGradient, getAgentInitials, getRoleLabel } from "@/lib/utils"
import { PIXEL_OFFICE_URL } from "@/lib/ai/config"
import { Agent } from "@prisma/client"
import { Hash, ChevronDown, Zap, Maximize2, Minimize2, Send, Plus, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth/useAuth"
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal"
import { HireModal } from "@/components/agents/HireModal"
import { AgentProfile } from "@/components/agents/AgentProfile"
import { KanbanBoard } from "@/components/kanban/KanbanBoard"
import { SprintBoard } from "@/components/kanban/SprintBoard"
import { DailyModal } from "@/components/meetings/DailyModal"
import { FirstDailyOverlay } from "@/components/meetings/FirstDailyOverlay"
import { CarlosBrandModal } from "@/components/meetings/CarlosBrandModal"
import type { BrandIdentity } from "@/lib/images/template-engine"

type OrgData = { id: string; name: string; agents: Agent[]; channels: Array<{ id: string; name: string }>; officeSettings?: { workflowMethod: string; dailyTime: string } }

const AGENT_CHARS: Record<string, string> = {
  "Maya Ferreira": "/agents/Maya.png", "Bruno Costa": "/agents/Bruno.png",
  "Lena Souza": "/agents/Lena.png", "Carlos Lima": "/agents/Carlos.png",
  "Diego Ramos": "/agents/Diego.png",
}

export default function WorkspaceHub() {
  const params = useParams(); const router = useRouter()
  const { user: session, signOut } = useAuth()
  const queryClient = useQueryClient()
  const orgId = params.id as string

  const [stage, setStage] = useState<"load" | "arrival" | "ready">("load")
  const [loadStep, setLoadStep] = useState(0); const [loadPct, setLoadPct] = useState(0)
  const [arrivalIdx, setArrivalIdx] = useState(0)
  const [selChannel, setSelChannel] = useState("geral")
  const [chatInput, setChatInput] = useState("")
  const [dividerY, setDividerY] = useState(60); const [officeFs, setOfficeFs] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [mentionedAgentId, setMentionedAgentId] = useState<string | null>(null)
  const [showMentions, setShowMentions] = useState(false)
  const [sending, setSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [typingAgent, setTypingAgent] = useState("")
  const [welcome, setWelcome] = useState("")
  const [welcomeDone, setWelcomeDone] = useState(false)
  const [wData, setWData] = useState<{ name: string; role: string; agentId: string; gradient: string } | null>(null)
  const [messages, setMessages] = useState<Array<{ id: string; agentId?: string; agentName?: string; agentRole?: string; agentGradient?: string; content: string; time: string; metadata?: any }>>([])
  const [dailyOpen, setDailyOpen] = useState(false)
  const [isFirstDaily, setIsFirstDaily] = useState(false)
  const [firstDailyOverlay, setFirstDailyOverlay] = useState(false)
  const [carlosBrandOpen, setCarlosBrandOpen] = useState(false)
  const [brandIdentity, setBrandIdentity] = useState<BrandIdentity | null>(null)
  const [dailyApproved, setDailyApproved] = useState<Record<string, boolean>>({})
  const [showingCommentInput, setShowingCommentInput] = useState<Record<string, boolean>>({})
  const [commentText, setCommentText] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  const [officeReady, setOfficeReady] = useState(false)
  const officeIframeRef = useRef<HTMLIFrameElement | null>(null)
  const bridgeUrlRef = useRef("/api/agents/bridge") // local bridge if detected, else Vercel
  const selChannelRef = useRef(selChannel)
  selChannelRef.current = selChannel // always current

  // Push agents to pixel office via postMessage to iframe
  const pushAgentsToOffice = () => {
    const iframe = officeIframeRef.current
    const agents = org?.agents?.filter(a => a.status !== "FIRED") || []
    if (!agents.length) return

    const agentIds: number[] = []
    const agentMeta: Record<number, { palette?: number; hueShift?: number }> = {}
    const folderNames: Record<number, string> = {}

    agents.forEach((a, i) => {
      const id = i + 1
      agentIds.push(id)
      agentMeta[id] = { palette: i % 6, hueShift: i >= 6 ? ((i % 6) * 45 + 45) : 0 }
      folderNames[id] = a.name
    })

    const msg = { type: "existingAgents", agents: agentIds, agentMeta, folderNames }

    // Method 1: postMessage to iframe (iframe will self-POST to its own /api/agents)
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(msg, "*")
    }

    // Method 2: Direct POST to Render (backup)
    fetch("https://adstock-ai.onrender.com/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    }).then(r => r.json()).then(d => {
      console.log("[Office] Agents pushed to Render:", d.count)
    }).catch(() => {})
  }
  const divRef = useRef<HTMLDivElement>(null); const chatRef = useRef<HTMLDivElement>(null)

  const { data: org } = useQuery<OrgData>({ queryKey: ["organization", orgId], queryFn: async () => { const r = await fetch(`/api/organizations/${orgId}`); return r.json() }, enabled: !!orgId })

  const { data: tasks } = useQuery<any[]>({
    queryKey: ["tasks", orgId],
    queryFn: async () => { const r = await fetch(`/api/tasks?orgId=${orgId}`); return r.json() },
    enabled: !!orgId, refetchInterval: 15000,
  })

  // Regenerate stale outputs for DONE tasks on first load
  const regenRef = useRef(false)
  useEffect(() => {
    if (stage !== "ready" || regenRef.current || !tasks?.length) return
    const hasStale = tasks.some((t: any) => {
      if (t.status !== "DONE") return false
      const out = typeof t.output === "string" ? JSON.parse(t.output) : t.output
      if (!out?.content) return true
      return out.content === t.description || out.content === t.title
    })
    if (hasStale) {
      regenRef.current = true
      fetch("/api/tasks/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      }).then(r => r.json()).then((d: any) => {
        if (d.regenerated > 0) queryClient.invalidateQueries({ queryKey: ["tasks", orgId] })
      }).catch(() => {})
    }
  }, [stage, tasks, orgId])

  const LOAD = ["Contratando equipe...", "Organizando canais...", "Decorando escritorio...", "Pronto."]

  useEffect(() => { if (stage !== "load") return; let i = 0; const t = setInterval(() => { setLoadPct(p => { if (p >= 100) { if (i < LOAD.length - 1) { i++; setLoadStep(i); return 0 } clearInterval(t); setTimeout(() => { setStage("arrival"); setArrivalIdx(0) }, 600); return 100 } return p + 3 }) }, 50); return () => clearInterval(t) }, [stage])
  useEffect(() => { if (stage !== "arrival") return; const ags = org?.agents?.filter(a => a.status !== "FIRED") || []; if (!ags.length) { setTimeout(() => { setStage("ready"); emitWelcome(org) }, 1500); return }; const t = setInterval(() => { setArrivalIdx(p => { if (p >= ags.length) { clearInterval(t); setTimeout(() => { setStage("ready"); emitWelcome(org) }, 1500); return p } return p + 1 }) }, 1500); return () => clearInterval(t) }, [stage, org])
  // Bridge init, autonomous loop, and auto-daily
  useEffect(() => {
    if (stage !== "ready") return

    // ── First daily detection (post-onboarding) ──────
    const onboardingFlag = localStorage.getItem("onboarding_just_completed")
    if (onboardingFlag === orgId) {
      localStorage.removeItem("onboarding_just_completed")
      setFirstDailyOverlay(true)
    }

    // Detect local pixel bridge server
    fetch("http://localhost:3101/health", { signal: AbortSignal.timeout(2000) })
      .then(r => r.ok && r.json())
      .then(d => {
        if (d?.status === "ok") {
          bridgeUrlRef.current = "http://localhost:3101"
          console.log("[Bridge] Local pixel bridge detected")
        }
      })
      .catch(() => {})

    // Bridge init
    setTimeout(() => {
      fetch(bridgeUrlRef.current, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, action: "init" }),
      }).catch(() => {})
    }, 500)

    // ── Pre-warm pixel office (Render free tier cold start) ──

    const syncAgents = () => {
      // Also sync via server API (fallback)
      fetch("/api/office/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      }).catch(() => {})
      // Push directly to iframe (primary method)
      pushAgentsToOffice()
    }

    const warmPixelOffice = async () => {
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const res = await fetch("/api/office/sync", { signal: AbortSignal.timeout(10000) })
          const data = await res.json()
          if (data.status === "ok") {
            setOfficeReady(true)
            // Sync agents with delays — the iframe needs time to initialize WebSocket
            setTimeout(syncAgents, 3000)
            setTimeout(syncAgents, 8000)
            setTimeout(syncAgents, 15000)
            return
          }
        } catch {}
        await new Promise(r => setTimeout(r, 5000))
      }
      setOfficeReady(true)
    }
    warmPixelOffice()

    // Periodic agent sync — keeps agents in the office
    const syncInterval = setInterval(syncAgents, 45000)

    // Warmup do Worker AI — esquenta o modelo pra respostas rapidas
    fetch("https://plain-hill-073a.gustavoss0406.workers.dev/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "oi", temperature: 0.3, maxTokens: 10, model: "glm-5.1" }) }).catch(() => {})

    // Auto-trigger daily if not run today
    /* disabled: daily now runs only on user click
    const checkDaily = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10)
        const stored = localStorage.getItem(`daily_${orgId}`)
        if (stored === today) return
        localStorage.setItem(`daily_${orgId}`, today)
        await fetch("/api/routine", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: orgId, event: "daily_standup" }),
        })
        toast.success("Daily automatica iniciada!")
      } catch {}
    }
    checkDaily()
     */

    // Bridge pulse
    const pulse = () => {
      const a = org?.agents?.filter(a => a.status !== "FIRED") || []
      if (!a.length) return
      fetch(bridgeUrlRef.current, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pulse", agentId: a[Math.floor(Math.random() * a.length)].id }) }).catch(() => {})
    }
    pulse()
    const pulseIv = setInterval(pulse, 12000 + Math.random() * 8000)

    // Auto-daily: check every 60s if daily should run
    const checkDaily = async () => {
      const dailyTime = org?.officeSettings?.dailyTime || "09:00"
      const [dh, dm] = dailyTime.split(":").map(Number)
      const now = new Date()
      const currentMins = now.getHours() * 60 + now.getMinutes()
      const dailyMins = dh * 60 + dm
      // Start 2 min early so results are ready at daily time
      if (currentMins >= dailyMins - 2 && currentMins < dailyMins + 1) {
        const today = now.toISOString().slice(0, 10)
        const stored = localStorage.getItem(`daily_${orgId}`)
        if (stored !== today) {
          localStorage.setItem(`daily_${orgId}`, today)
          setTimeout(() => runDaily(), 1500)
        }
      }
    }
    checkDaily()
    const dailyIv = setInterval(checkDaily, 60000)

    // Heartbeat: agents work on tasks every 60s
    let hbCount = 0
    const heartbeat = () => {
      fetch("/api/agents/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: orgId }) }).catch(() => {})
      hbCount++
      // Run proactive system check every 30 heartbeats (~30 min)
      if (hbCount % 30 === 0) {
        fetch("/api/system/proactive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: orgId }) }).catch(() => {})
      }
    }
    setTimeout(heartbeat, 8000)
    // Also run proactive once at startup
    setTimeout(() => fetch("/api/system/proactive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: orgId }) }).catch(() => {}), 15000)
    const hbIv = setInterval(heartbeat, 60000)

    // ── Real-time message polling ────────────────────────
    let lastMsgTime = new Date().toISOString()
    const pollMessages = async () => {
      try {
        const currentChannel = selChannelRef.current
        const chId = org?.channels?.find((c: any) => c.name === currentChannel)?.id
        const url = `/api/messages?orgId=${orgId}&limit=10&since=${encodeURIComponent(lastMsgTime)}${chId ? `&channelId=${chId}` : ""}`
        const res = await fetch(url)
        if (res.ok) {
          const newMsgs = await res.json()
          if (Array.isArray(newMsgs) && newMsgs.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id))
              const merged = [...prev]
              for (const m of newMsgs) {
                if (!existingIds.has(m.id)) {
                  merged.push({
                    id: m.id,
                    agentId: m.agentId,
                    agentName: m.agent?.name,
                    agentRole: m.agent ? getRoleLabel(m.agent.role) : "",
                    agentGradient: m.agent ? getAgentGradient(m.agent.role) : "",
                    content: m.content,
                    time: m.createdAt,
                    metadata: m.metadata,
                  })
                }
              }
              return merged
            })
            lastMsgTime = newMsgs[newMsgs.length - 1].createdAt
          }
        }
      } catch {}
    }
    pollMessages()
    const msgIv = setInterval(pollMessages, 5000)

    // ── SSE for typing indicators ─────────────────────────
    const sseUrl = `/api/events/stream?orgId=${orgId}`
    const sseSource = new EventSource(sseUrl)
    sseSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "update" && data.orchestration?.channels) {
          const currentChannel = selChannelRef.current
          const currentCh = data.orchestration.channels.find((c: any) => c.name === currentChannel)
          if (currentCh?.typing) {
            setTypingAgent(currentCh.typing.agentName)
            setIsTyping(true)
          } else if (!currentCh) {
            // No typing in this channel
            setIsTyping(false)
            setTypingAgent("")
          }
        }
      } catch {}
    }

    return () => { clearInterval(pulseIv); clearInterval(hbIv); clearInterval(dailyIv); clearInterval(syncInterval); clearInterval(msgIv); sseSource.close() }
  }, [stage, org, orgId])

  const emitWelcome = (d: OrgData | undefined) => {
    if (!d) return
    const a = d.agents?.find(ag => ag.name === "Maya Ferreira") || d.agents?.[0]
    if (!a) return
    setWData({ name: a.name, role: getRoleLabel(a.role), agentId: a.id, gradient: getAgentGradient(a.role) })
    const msg = `Ola! Bem-vindo a ${d.name}.\n\nEu ja tenho um plano pronto. Quer ver o que o time preparou?`
    setWelcomeDone(false); setWelcome("")
    let j = 0; const iv = setInterval(() => { if (j >= msg.length) { clearInterval(iv); setTimeout(() => setWelcomeDone(true), 200); return } setWelcome(msg.slice(0, j + 1)); j++ }, 18)
    return () => clearInterval(iv)
  }

  const handleDailyApprove = async (msgId: string) => {
    setDailyApproved(prev => ({ ...prev, [msgId]: true }))
    try {
      await fetch("/api/daily/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      })
      // Add system message confirming approval
      setMessages(prev => [...prev, {
        id: `approve-${Date.now()}`,
        agentId: "system", agentName: "Sistema",
        content: "Tudo certo, time! Mãos à obra. 🚀",
        time: new Date().toISOString(),
        metadata: { type: "daily_approval" },
      }])
    } catch {
      setDailyApproved(prev => ({ ...prev, [msgId]: false }))
    }
  }

  const handleDailyComment = (msgId: string) => {
    setShowingCommentInput(prev => ({ ...prev, [msgId]: !prev[msgId] }))
    setCommentText("")
  }

  const handleSubmitComment = async (msgId: string) => {
    if (!commentText.trim() || submittingComment) return
    setSubmittingComment(true)
    try {
      const res = await fetch("/api/daily/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, message: commentText, replyToMessageId: msgId }),
      })
      const data = await res.json()
      if (data.success) {
        setMessages(prev => [...prev, {
          id: `comment-${Date.now()}`,
          content: commentText,
          time: new Date().toISOString(),
          metadata: { type: "daily_comment" },
        }])
        setCommentText("")
        setShowingCommentInput(prev => ({ ...prev, [msgId]: false }))
      }
    } catch {} finally {
      setSubmittingComment(false)
    }
  }

  const handleSend = async () => {
    if (!chatInput.trim() || sending) return
    const text = chatInput; setChatInput(""); setSending(true)
    setMentionedAgentId(null)
    setShowMentions(false)
    setMessages(prev => [...prev, { id: Date.now().toString(), content: text, time: new Date().toISOString() }])

    try {
      setTypingAgent(mentionedAgentId ? agents.find(a => a.id === mentionedAgentId)?.name || "..." : (wData?.name || org?.agents?.[0]?.name || "..."))
      setIsTyping(true)

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: mentionedAgentId || wData?.agentId || org?.agents?.[0]?.id, message: text, channelId: selChannel, context: `Empresa: ${org?.name}` }),
      })
      const data = await res.json()

      setIsTyping(false)
      setTypingAgent("")

      if (data.reply) {
        // Check for conflict
        if (data.conflict) {
          setMessages(prev => [...prev, {
            id: `conflict-${Date.now()}`,
            agentId: "system", agentName: "Sistema",
            content: JSON.stringify({ type: "conflict", ...data.conflict }),
            time: new Date().toISOString(),
          }])
          setTimeout(() => chatRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
        }

        const agent = org?.agents?.find(a => a.id === data.agentId)
        const newMsg = {
          id: data.messageId || Date.now().toString(),
          agentId: data.agentId, agentName: agent?.name || data.agentName,
          agentRole: agent ? getRoleLabel(agent.role) : "", agentGradient: agent ? getAgentGradient(agent.role) : "",
          content: "", time: new Date().toISOString(),
        }
        setMessages(prev => [...prev, newMsg])

        // Stream the response letter by letter
        const fullText = data.reply
        let i = 0
        const streamIv = setInterval(() => {
          if (i >= fullText.length) { clearInterval(streamIv); return }
          setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, content: fullText.slice(0, i + 1) } : m))
          i++; chatRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 15)

        // Sound chime
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const osc = ctx.createOscillator(); const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.type = "sine"; gain.gain.value = 0.08
          osc.frequency.setValueAtTime(880, ctx.currentTime)
          osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3)
        } catch {}

        // Auto-chain follow-up
        if (data.followUp) {
          setTimeout(() => {
            const fAgent = org?.agents?.find(a => a.id === data.followUp.agentId)
            const fMsg = {
              id: data.followUp.messageId || Date.now().toString(),
              agentId: data.followUp.agentId, agentName: fAgent?.name || data.followUp.agentName,
              agentRole: fAgent ? getRoleLabel(fAgent.role) : "", agentGradient: fAgent ? getAgentGradient(fAgent.role) : "",
              content: "", time: new Date().toISOString(),
            }
            setMessages(prev => [...prev, fMsg])
            const fText = data.followUp.reply
            let j = 0
            const fIv = setInterval(() => {
              if (j >= fText.length) { clearInterval(fIv); return }
              setMessages(prev => prev.map(m => m.id === fMsg.id ? { ...m, content: fText.slice(0, j + 1) } : m))
              j++; chatRef.current?.scrollIntoView({ behavior: "smooth" })
            }, 12)
          }, 1500)
        }
      }
      chatRef.current?.scrollIntoView({ behavior: "smooth" })
    } catch { toast.error("Erro ao enviar") }
    finally { setSending(false) }
  }

  const runDaily = async () => {
    setIsFirstDaily(false)
    setDailyOpen(true)
  }

  const dragDiv = (e: React.MouseEvent) => { e.preventDefault(); const sy = e.clientY; const sp = dividerY; const mv = (ev: MouseEvent) => { const r = divRef.current?.parentElement?.getBoundingClientRect(); if (!r) return; setDividerY(Math.max(30, Math.min(75, sp + ((ev.clientY - sy) / (r.height - 48)) * 100))) }; const up = () => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up) }; document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up) }

  if (stage === "load") {
    return (
      <div className="h-screen w-full bg-editor-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-editor-muted text-xs mb-4">{LOAD[loadStep]}</p>
          <div className="w-40 h-0.5 bg-white/[0.04] rounded-pill overflow-hidden mx-auto">
            <motion.div className="h-full bg-white/20 rounded-pill" initial={{ width: "0%" }} animate={{ width: `${loadPct}%` }} />
          </div>
        </div>
      </div>
    )
  }

  if (stage === "arrival") {
    const ags = org?.agents?.filter(a => a.status !== "FIRED") || []
    return (
      <div className="h-screen bg-editor-bg flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <iframe src="https://adstock-ai.onrender.com" className="w-full h-full border-0 pointer-events-none" />
        </div>
        <div className="relative space-y-5">
          {ags.slice(0, arrivalIdx).map((a) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 18 }}>
              <div className="flex items-center gap-3 bg-editor-surface border border-editor-border rounded-xl px-4 py-3 min-w-[240px]">
                {AGENT_CHARS[a.name] ? (
                  <img src={AGENT_CHARS[a.name]} className="w-10 h-10  object-cover" alt={a.name} />
                ) : (
                  <div className={cn("w-10 h-10  flex items-center justify-center text-white font-bold text-sm", getAgentGradient(a.role))}>{getAgentInitials(a.name)}</div>
                )}
                <div>
                  <span className="text-sm font-semibold text-editor-ink">{a.name}</span>
                  <span className="text-[11px] text-editor-muted ml-2">{getRoleLabel(a.role)}</span>
                </div>
              </div>
            </motion.div>
          ))}
          {arrivalIdx < ags.length && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 justify-center">
              <div className="w-5 h-5 rounded-pill border-2 border-white/10 border-t-white/40 animate-spin" />
              <span className="text-editor-muted text-xs">Alguem esta chegando...</span>
            </motion.div>
          )}
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-16 bg-white/[0.02] rounded-t-xl border border-editor-border flex items-center justify-center">
          <span className="text-editor-muted text-lg">| |</span>
        </div>
      </div>
    )
  }

  if (!org) return <div className="h-screen w-full bg-editor-bg flex items-center justify-center"><div className="w-6 h-6 rounded-pill border-2 border-white/10 border-t-white/40 animate-spin" /></div>

  const agents = org.agents?.filter(a => a.status !== "FIRED") || []
  const channels = org.channels || []
  const statusDot = (a: Agent) => { if (a.status === "WORKING") return "bg-info animate-pulse"; if (a.status === "ACTIVE") return "bg-success"; return "bg-muted-foreground" }

  return (
    <div className="h-screen w-full flex overflow-hidden bg-editor-bg">
      {/* SIDEBAR */}
      <div className="w-[200px] bg-editor-panel flex flex-col flex-shrink-0 border-r border-editor-border select-none">
        <div className="h-10 flex items-center px-4 border-b border-editor-border"><span className="text-editor-ink text-xs font-semibold tracking-tight truncate">{org.name}</span></div>
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 pb-2 space-y-1">
            <button onClick={() => setTaskOpen(true)} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium text-editor-muted hover:text-editor-ink hover:bg-white/[0.04] transition-all">
              <Plus className="w-3 h-3" />Nova tarefa
            </button>
            <HireModal orgId={orgId} onHired={() => queryClient.invalidateQueries({ queryKey: ["organization", orgId] })} />
          </div>
          <div className="px-4 py-1"><span className="text-[9px] font-semibold text-editor-muted uppercase tracking-widest">Canais</span></div>
          {channels.map(ch => (<button key={ch.id} onClick={() => { setSelChannel(ch.name); setBoardOpen(false) }} className={cn("w-full flex items-center gap-1.5 px-4 py-0.5 text-xs transition-colors", selChannel === ch.name ? "text-editor-ink" : "text-editor-muted hover:text-editor-muted")}><Hash className="w-3 h-3 opacity-30" /><span className="truncate">{ch.name}</span></button>))}
          <div className="mt-4 pt-3 border-t border-editor-border"><div className="px-4 py-1"><span className="text-[9px] font-semibold text-editor-muted uppercase tracking-widest">Agentes</span></div>
             {agents.map(a => {
               const ws = a.status === "WORKING" ? "Trabalhando..." : a.status === "IN_MEETING" ? "Em reuniao" : a.status === "ACTIVE" ? "Online" : "Offline"
               return (
               <button key={a.id} onClick={() => setSelectedAgent(a)} className="w-full flex items-center gap-2 px-4 py-0.5 text-xs text-left hover:bg-white/[0.03] transition-colors"><div className="relative flex-shrink-0">{AGENT_CHARS[a.name] ? <img src={AGENT_CHARS[a.name]} className="w-5 h-5 rounded object-cover" alt={a.name} /> : <div className={cn("w-5 h-5 rounded flex items-center justify-center text-white text-[7px] font-bold", getAgentGradient(a.role))}>{getAgentInitials(a.name)}</div>}<span className={cn("absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-pill border border-[#0d0d0f]", statusDot(a))} /></div><div className="flex-1 min-w-0"><div className="text-editor-ink truncate text-[11px]">{a.name}</div><div className="text-editor-muted text-[9px] truncate">{ws}</div></div></button>
             )})}
          </div>
        </div>
        <div className="p-3 border-t border-editor-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold text-editor-muted uppercase tracking-widest">
              {org.officeSettings?.workflowMethod === "SPRINTS" ? "Sprint" : "Kanban"}
            </span>
            <span className="text-[9px] text-editor-muted">{org.officeSettings?.workflowMethod === "SPRINTS" ? "2 semanas" : "Fluxo continuo"}</span>
          </div>
          <div className="h-1 rounded-pill bg-white/[0.04] overflow-hidden">
            <div className="h-full rounded-pill bg-white/20" style={{ width: "45%" }} />
          </div>
          <div className="flex gap-1">
            <button onClick={() => setBoardOpen(true)} className="flex-1 text-center py-1 rounded-lg text-[9px] text-editor-muted hover:text-editor-muted hover:bg-white/[0.03] transition-colors">
              {org.officeSettings?.workflowMethod === "SPRINTS" ? "Sprint board" : "Kanban board"}
            </button>
          </div>
          <button onClick={runDaily} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] text-editor-muted hover:text-editor-ink text-[11px] font-medium transition-all"><Zap className="w-3 h-3" />Daily</button>
          <button onClick={() => fetch("/api/agents/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: orgId }) }).then(() => toast.success("Agentes trabalhando!"))} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] text-editor-muted hover:text-editor-muted text-[10px] font-medium transition-all">Executar tarefas</button>
          <button onClick={async () => {
            if (!confirm("Limpar TODAS as tarefas do board?")) return
            const res = await fetch(`/api/tasks/clear?orgId=${orgId}`, { method: "DELETE" })
            if (res.ok) {
              const d = await res.json()
              toast.success(d.message)
              queryClient.invalidateQueries({ queryKey: ["tasks", orgId] })
            }
          }} className="w-full text-center text-editor-muted hover:text-danger/40 text-[10px] transition-colors">Limpar board</button>
          <button onClick={() => signOut()} className="w-full text-center text-editor-muted hover:text-editor-muted text-[10px] transition-colors">Sair</button>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden" ref={divRef as any}>
        {boardOpen ? (
          <div className="flex-1 overflow-hidden">
            {org?.officeSettings?.workflowMethod === "SPRINTS" ? (
              <SprintBoard tasks={(tasks || []).map((t: any) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, assignedTo: t.assignedTo, day: t.day || 0 }))} agents={agents} onCreateTask={() => setTaskOpen(true)} />
            ) : (
              <KanbanBoard
                tasks={(tasks || []).map((t: any) => ({
                  id: t.id, title: t.title, description: t.description, type: t.type,
                  status: t.status === "TODO" ? "TODO" : t.status === "IN_PROGRESS" ? "IN_PROGRESS" : t.status === "IN_REVIEW" ? "IN_REVIEW" : t.status === "DONE" ? "DONE" : "BACKLOG",
                  priority: t.priority, platform: t.platform, dueDate: t.dueDate, completedAt: t.completedAt,
                  assignee: t.assignee || undefined, blocked: t.blocked, blockedReason: t.blockedReason,
                  output: typeof t.output === "string" ? JSON.parse(t.output) : t.output,
                  comments: t.comments || undefined,
                }))}
                agents={agents}
                onCreateTask={() => setTaskOpen(true)}
                onMoveTask={async (taskId, newStatus) => {
                  await fetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, status: newStatus }) })
                  queryClient.invalidateQueries({ queryKey: ["tasks", orgId] })
                }}
              />
            )}
          </div>
        ) : (
          <>
            {/* Office */}
            <div className="relative bg-editor-bg flex-shrink-0 border-2 border-editor-border rounded-xl overflow-hidden" style={{ height: officeFs ? "100%" : `${dividerY}%` }}>
          {officeReady ? (
            <iframe
              ref={(el) => { officeIframeRef.current = el }}
              src="https://adstock-ai.onrender.com"
              className="w-full h-full border-0"
              allow="clipboard-read; clipboard-write"
              onLoad={() => {
                // Push agents as soon as iframe loads
                setTimeout(() => pushAgentsToOffice(), 2000)
                setTimeout(() => pushAgentsToOffice(), 5000)
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-editor-bg">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 border-2 border-white/10 border-t-primary/60 rounded-pill animate-spin mx-auto" />
                <p className="text-[11px] text-editor-muted">Acordando o escritorio...</p>
              </div>
            </div>
          )}
          <button onClick={() => setOfficeFs(!officeFs)} className="absolute top-2 right-2 p-1 rounded bg-black/20 hover:bg-black/40 text-editor-muted hover:text-editor-ink transition-colors z-10">{officeFs ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}</button>
        </div>
        {/* Divider */}
        {!officeFs && (<div className="h-1 bg-white/[0.03] hover:bg-white/[0.06] cursor-row-resize flex-shrink-0 flex items-center justify-center group transition-colors" onMouseDown={dragDiv}><div className="w-6 h-0.5 rounded-pill bg-white/[0.06] group-hover:bg-white/15 transition-colors" /></div>)}
        {/* Chat */}
        {!officeFs && (
          <div className="flex-1 flex flex-col bg-editor-bg min-h-0">
            <div className="h-8 border-b border-editor-border flex items-center px-4 flex-shrink-0 gap-2">
              <Hash className="w-3 h-3 text-editor-muted" />
              <span className="text-xs font-medium text-editor-muted flex-1">{selChannel}</span>
              <button onClick={async () => {
                const a = org?.agents?.[Math.floor(Math.random() * org.agents.filter(a => a.status !== "FIRED").length)]
                if (!a) return
                toast.info(`${a.name} esta gerando conteudo...`)
                await fetch("/api/routine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: orgId, event: "approval_request", agentId: a.id }) })
                queryClient.invalidateQueries({ queryKey: ["messages"] })
                toast.success("Conteudo gerado!")
              }} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] text-editor-muted hover:text-editor-muted hover:bg-white/[0.04] transition-colors">
                <Plus className="w-3 h-3" />Conteudo
              </button>
              <button onClick={() => setTaskOpen(true)} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] text-editor-muted hover:text-editor-muted hover:bg-white/[0.04] transition-colors"><Plus className="w-3 h-3" />Tarefa</button>
              <button onClick={runDaily} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] text-editor-muted hover:text-editor-muted hover:bg-white/[0.04] transition-colors"><Zap className="w-3 h-3" />Daily</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
              {/* Welcome message */}
              {selChannel === "geral" && welcome && wData && (
                <div className="flex gap-2">
                  {AGENT_CHARS[wData.name] ? <img src={AGENT_CHARS[wData.name]} className="w-7 h-7 rounded object-cover flex-shrink-0 mt-0.5" alt={wData.name} /> : <div className={cn("w-7 h-7 rounded flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mt-0.5", wData.gradient)}>{wData.name[0]}</div>}
                  <div><div className="flex items-center gap-2 mb-0.5"><span className="text-xs font-semibold text-editor-ink">{wData.name}</span><span className="text-[10px] text-editor-muted">{wData.role}</span></div><p className="text-xs text-white/45 leading-relaxed whitespace-pre-wrap">{welcome}{!welcomeDone && <span className="animate-pulse text-editor-muted">|</span>}</p></div>
                </div>
              )}

              {/* Chat messages */}
              {messages.map(msg => {
                // Check if this is an approval message (JSON content)
                let approvalData: any = null
                let conflictData: any = null
                try { const parsed = JSON.parse(msg.content); if (parsed.type === "approval") approvalData = parsed; if (parsed.type === "conflict") conflictData = parsed } catch {}

                // ── Conflict Card ──
                if (conflictData) {
                  return (
                    <div key={msg.id} className="my-3 p-4 rounded-xl border border-warning/20 bg-warning/[0.03]">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-semibold text-warning/80 uppercase tracking-wider">Conflito Detectado</span>
                      </div>
                      <p className="text-[10px] text-editor-muted mb-3">Sobre: {conflictData.topic || "estrategia"}</p>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-editor-border">
                          <p className="text-[10px] font-semibold text-editor-muted mb-1">{conflictData.agentA || "Agente A"}</p>
                          <p className="text-[10px] text-editor-muted italic">"{conflictData.positionA?.slice(0, 150) || "..."}"</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-editor-border">
                          <p className="text-[10px] font-semibold text-editor-muted mb-1">{conflictData.agentB || "Agente B"}</p>
                          <p className="text-[10px] text-editor-muted italic">"{conflictData.positionB?.slice(0, 150) || "..."}"</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-editor-muted mb-2">Com quem voce concorda?</div>
                      <div className="flex gap-1.5">
                        <button className="flex-1 py-1.5 rounded-lg text-[10px] font-medium bg-white/[0.03] hover:bg-white/[0.05] text-white/35 hover:text-editor-muted transition-colors">{conflictData.agentA || "Ag. A"}</button>
                        <button className="flex-1 py-1.5 rounded-lg text-[10px] font-medium bg-white/[0.03] hover:bg-white/[0.05] text-white/35 hover:text-editor-muted transition-colors">{conflictData.agentB || "Ag. B"}</button>
                        <button className="flex-1 py-1.5 rounded-lg text-[10px] font-medium bg-white/[0.03] hover:bg-white/[0.05] text-white/35 hover:text-editor-muted transition-colors">Meio a meio</button>
                      </div>
                    </div>
                  )
                }

                // ── Approval Card ──
                if (approvalData) {
                  return (
                    <div key={msg.id} className="my-3 p-3 rounded-xl border border-editor-border bg-white/[0.02]">
                      <div className="flex items-center gap-2 mb-2">
                        {msg.agentId ? (AGENT_CHARS[msg.agentName || ""] ? <img src={AGENT_CHARS[msg.agentName || ""]} className="w-6 h-6 rounded object-cover" alt={msg.agentName} /> : <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white text-[8px] font-bold", msg.agentGradient || "bg-primary")}>{(msg.agentName || "A")[0]}</div>) : null}
                        <span className="text-xs font-semibold text-editor-ink">{msg.agentName}</span>
                        <span className="text-[9px] text-editor-muted">pede aprovacao</span>
                      </div>
                      <div className="bg-white/[0.02] rounded-xl p-3 mb-2">
                        <p className="text-[10px] text-editor-muted uppercase tracking-wider mb-1">{approvalData.platform} · {approvalData.specs || "1080x1080px"}</p>
                        <h4 className="text-xs font-semibold text-editor-muted mb-1">{approvalData.title}</h4>
                        <p className="text-[11px] text-editor-muted italic">"{approvalData.copy}"</p>
                        <p className="text-[9px] text-editor-muted mt-1">Publicacao sugerida: {approvalData.publishDate || "em breve"}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button className="flex-1 py-1.5 rounded-lg text-[10px] font-medium bg-success/5 hover:bg-success/10 text-success transition-colors">Aprovar</button>
                        <button className="flex-1 py-1.5 rounded-lg text-[10px] font-medium bg-warning/5 hover:bg-warning/10 text-warning transition-colors">Revisao</button>
                        <button className="flex-1 py-1.5 rounded-lg text-[10px] font-medium bg-destructive/5 hover:bg-destructive/10 text-destructive transition-colors">Reprovar</button>
                      </div>
                    </div>
                  )
                }

                const content = msg.content || ""
                const msgMeta = (msg as any).metadata
                const metaType = typeof msgMeta === "object" ? msgMeta?.type : null
                const isDailyStart = metaType === "daily_start" || content.startsWith("[DAILY_START]")
                const isDailySpeech = metaType === "daily_speech" || content.startsWith("[DAILY]")
                const isDailySummary = metaType === "daily_summary" || content.startsWith("[DAILY_SUMMARY]")
                const cleanContent = isDailyStart ? content.replace("[DAILY_START] ", "") : isDailySpeech ? content.replace("[DAILY] ", "") : isDailySummary ? content.replace("[DAILY_SUMMARY] ", "") : content

                if (isDailyStart) {
                  return (
                    <div key={msg.id} className="my-3 text-center">
                      <div className="inline-flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-white/[0.02] border border-editor-border">
                        <span className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider">Daily Standup</span>
                        <p className="text-[11px] text-editor-muted whitespace-pre-wrap">{cleanContent}</p>
                      </div>
                    </div>
                  )
                }

                if (isDailySummary) {
                  const approved = dailyApproved[msg.id]
                  const showComment = showingCommentInput[msg.id]
                  return (
                    <div key={msg.id} className="my-3 p-4 rounded-xl bg-white/[0.02] border border-editor-border">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider">Resumo da Daily</span>
                      </div>
                      <p className="text-[11px] text-editor-muted leading-relaxed whitespace-pre-wrap">{cleanContent}</p>
                      {!approved ? (
                        <>
                          <div className="flex gap-2 mt-3 pt-3 border-t border-editor-border">
                            <button
                              onClick={() => handleDailyApprove(msg.id)}
                              className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-[10px] text-primary font-medium transition-colors"
                            >
                              ✅ Tudo certo, podem comecar
                            </button>
                            <button
                              onClick={() => handleDailyComment(msg.id)}
                              className={cn(
                                "px-3 py-1.5 rounded-xl border border-editor-border hover:bg-white/[0.03] text-[10px] transition-colors",
                                showComment ? "text-editor-ink border-editor-border" : "text-editor-muted"
                              )}
                            >
                              💬 Tenho um comentario
                            </button>
                          </div>
                          {showComment && (
                            <div className="flex gap-2 mt-2 pt-2 border-t border-editor-border">
                              <input
                                type="text"
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") handleSubmitComment(msg.id) }}
                                placeholder="Escreva seu comentario..."
                                className="flex-1 px-2.5 py-1.5 rounded-xl bg-white/[0.02] border border-editor-border text-[11px] text-editor-muted placeholder-white/15 focus:outline-none focus:border-white/[0.1]"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSubmitComment(msg.id)}
                                disabled={!commentText.trim() || submittingComment}
                                className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 text-[10px] text-editor-muted transition-colors"
                              >
                                {submittingComment ? "..." : "Enviar"}
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-editor-border">
                          <span className="text-[10px] text-primary/70">✅ Daily aprovada — time trabalhando</span>
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                <div key={msg.id} className={cn(
                  "flex gap-2 px-2 py-1.5 -mx-2 ",
                  isDailySpeech && `ring-1 ring-inset ${(msg.agentGradient ? `bg-[${msg.agentGradient}]/[0.03]` : "bg-white/[0.02]")} border-l-2` as string,
                  // Fallback style when no agentGradient
                  isDailySpeech && !msg.agentGradient && "bg-white/[0.02]",
                )}
                style={isDailySpeech && msg.agentGradient ? {
                  backgroundColor: `${msg.agentGradient}08`,
                  borderLeftColor: `${msg.agentGradient}40`,
                  borderLeftWidth: '2px',
                } : undefined}
                >
                  {msg.agentId ? (
                    AGENT_CHARS[msg.agentName || ""] ? <img src={AGENT_CHARS[msg.agentName || ""]} className="w-7 h-7 rounded object-cover flex-shrink-0 mt-0.5" alt={msg.agentName} /> :
                    <div className={cn("w-7 h-7 rounded flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mt-0.5", msg.agentGradient || "bg-primary")}>{(msg.agentName || "A")[0]}</div>
                  ) : (
                    <div className="w-7 h-7 rounded bg-white/[0.04] flex items-center justify-center text-editor-muted text-[9px] font-bold flex-shrink-0 mt-0.5">Voce</div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-editor-ink">{msg.agentName || "Voce"}</span>
                      {msg.agentRole && <span className="text-[10px] text-editor-muted">{msg.agentRole}</span>}
                      {isDailySpeech && <span className="text-[9px] text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded font-medium">📅 Daily</span>}
                    </div>
                    <p className="text-xs text-white/45 leading-relaxed whitespace-pre-wrap">{cleanContent}</p>
                  </div>
                </div>
              )})}
              {!welcome && messages.length === 0 && !isTyping && <div className="text-center py-20 text-white/[0.04] text-xs">{selChannel === "daily-standup" ? "Nenhuma daily hoje. Clique em Daily para iniciar." : selChannel === "aprovacoes" ? "Nenhum conteudo para aprovar." : "Nenhuma mensagem em #" + selChannel}</div>}
              {isTyping && typingAgent && (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} className="w-1.5 h-1.5 rounded-pill bg-white/30" animate={{ opacity: [0.2, 0.8, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {AGENT_CHARS[typingAgent] ? <img src={AGENT_CHARS[typingAgent]} className="w-4 h-4 rounded object-cover opacity-60" alt={typingAgent} /> : null}
                    <span className="text-[11px] text-editor-muted">{typingAgent} esta digitando...</span>
                  </div>
                </div>
              )}
              <div ref={chatRef} />
            </div>

            <div className="border-t border-editor-border px-4 py-2 flex gap-2 flex-shrink-0 relative">
              {/* @Mention dropdown */}
              {showMentions && (
                <div className="absolute bottom-full left-4 mb-1 w-48 bg-editor-surface border border-editor-border rounded-xl shadow-2xl p-1 z-20">
                  {agents.map(a => (
                    <button key={a.id} onClick={() => {
                      const beforeAt = chatInput.substring(0, chatInput.lastIndexOf("@"))
                      setChatInput(beforeAt + "@" + a.name.split(" ")[0] + " ")
                      setMentionedAgentId(a.id)
                      setShowMentions(false)
                    }} className="w-full text-left px-3 py-1.5 rounded text-[11px] text-editor-muted hover:bg-white/[0.04] hover:text-editor-ink transition-colors flex items-center gap-2">
                      {AGENT_CHARS[a.name] ? <img src={AGENT_CHARS[a.name]} className="w-5 h-5 rounded object-cover" alt={a.name} /> : <div className={cn("w-5 h-5 rounded flex items-center justify-center text-white text-[7px] font-bold", getAgentGradient(a.role))}>{getAgentInitials(a.name)}</div>}
                      <div><div className="font-medium">{a.name.split(" ")[0]}</div><div className="text-[9px] opacity-50">{getRoleLabel(a.role)}</div></div>
                    </button>
                  ))}
                </div>
              )}
              {mentionedAgentId && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] text-[10px] text-editor-muted flex-shrink-0">
                  @{agents.find(a => a.id === mentionedAgentId)?.name?.split(" ")[0] || "..."}
                  <button onClick={() => setMentionedAgentId(null)} className="hover:text-editor-ink"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              <input
                className="flex-1 bg-transparent text-xs text-editor-muted placeholder-white/10 focus:outline-none"
                placeholder={mentionedAgentId ? `Mensagem para @${agents.find(a => a.id === mentionedAgentId)?.name?.split(" ")[0] || "..."}...` : `Mensagem em #${selChannel}...`}
                value={chatInput}
                onChange={e => {
                  setChatInput(e.target.value)
                  if (e.target.value.endsWith("@")) setShowMentions(true)
                  else setShowMentions(false)
                }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSend() } }}
              />
              <button onClick={handleSend} disabled={!chatInput.trim() || sending} className="w-6 h-6 rounded bg-white/[0.04] hover:bg-white/[0.06] text-editor-muted hover:text-editor-muted flex items-center justify-center disabled:opacity-10 transition-colors">
                {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              </button>
            </div>
          </div>
        )}
        </>
        )}
      </div>

      <CreateTaskModal orgId={orgId} open={taskOpen} onClose={() => setTaskOpen(false)} onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["tasks", orgId] })
        // Auto-assign new task to best agent
        setTimeout(() => fetch("/api/agents/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: orgId }) }).catch(() => {}), 2000)
      }} />
      {selectedAgent && (
        <AgentProfile agent={selectedAgent} orgId={orgId} onClose={() => setSelectedAgent(null)}
          onPromote={() => queryClient.invalidateQueries({ queryKey: ["organization", orgId] })}
          onFire={() => { setSelectedAgent(null); queryClient.invalidateQueries({ queryKey: ["organization", orgId] }) }} />
      )}
      {firstDailyOverlay && org && (
        <FirstDailyOverlay
          orgId={orgId}
          orgName={org.name || "sua agencia"}
          onAccept={() => {
            setFirstDailyOverlay(false)
            setIsFirstDaily(true)
            setDailyOpen(true)
          }}
          onDismiss={() => {
            setFirstDailyOverlay(false)
            // Maya sends a gentle follow-up
            fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                agentId: org?.agents?.find(a => a.name === "Maya Ferreira")?.id,
                message: "",
                channelId: "geral",
                context: "voce e Maya. o CEO acabou de recusar a chamada da primeira daily. mande uma mensagem gentil: \"Ta tudo bem? Podemos fazer a daily daqui 5 minutos?\" mantenha o tom profissional e acolhedor.",
              }),
            }).catch(() => {})
            // Refresh messages after a delay
            setTimeout(() => queryClient.invalidateQueries({ queryKey: ["messages"] }), 3000)
          }}
        />
      )}
      <DailyModal
        open={dailyOpen}
        agents={org?.agents?.filter(a => a.status !== "FIRED") || []}
        orgId={orgId}
        isFirstDaily={isFirstDaily}
        onClose={() => {
          setDailyOpen(false)
          setIsFirstDaily(false)
          // If first daily completed, open Carlos brand modal
          if (isFirstDaily) {
            setTimeout(() => setCarlosBrandOpen(true), 1500)
          }
          queryClient.invalidateQueries({ queryKey: ["meetings"] })
          queryClient.invalidateQueries({ queryKey: ["organization", orgId] })
        }}
      />
      <CarlosBrandModal
        open={carlosBrandOpen}
        userName={(session as any)?.user_metadata?.name || session?.email?.split("@")[0] || "CEO"}
        orgId={orgId}
        onSave={(brand) => {
          setBrandIdentity(brand)
          setCarlosBrandOpen(false)
        }}
        onDismiss={() => setCarlosBrandOpen(false)}
      />
    </div>
  )
}
