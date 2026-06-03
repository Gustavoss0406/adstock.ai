"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { cn, formatDate, getAgentGradient, getAgentInitials } from "@/lib/utils"
import { Agent } from "@prisma/client"
import { CheckCircle2, AlertTriangle, XCircle, MessageCircle, ChevronDown, ChevronUp } from "lucide-react"

// ── Message types ────────────────────────────────────────────────

interface AgentMessage {
  id: string
  type: "agent" | "system" | "approval" | "conflict" | "alert"
  agent?: Agent
  content: string
  timestamp: string
  reactions?: Array<{ emoji: string; count: number }>
  // Approval
  approvalData?: {
    title: string
    image?: string
    specs: string
    copy: string
    publishDate: string
    votes: Array<{ name: string; color: string; vote: "approve" | "warn" | "none"; comment: string }>
  }
  // Conflict
  conflictData?: {
    agentA: { name: string; color: string; quote: string; weight: number }
    agentB: { name: string; color: string; quote: string; weight: number }
  }
  // Alert
  alertData?: {
    metric: string
    impact: string
    recommendation: string
    link: string
  }
  // System
  systemData?: {
    icon: string
    action: string
    link: string
  }
}

// ── Single Message ───────────────────────────────────────────────

export function ChatMessage({ msg, onReact }: { msg: AgentMessage; onReact?: (msgId: string, emoji: string) => void }) {
  const [showReactions, setShowReactions] = useState(false)

  if (msg.type === "system") {
    return (
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 border-t border-[#DDDDDD]" />
        <div className="text-xs text-[#CFC3CF] font-bold whitespace-nowrap">{msg.content}</div>
        <div className="flex-1 border-t border-[#DDDDDD]" />
      </div>
    )
  }

  if (msg.type === "approval" && msg.approvalData) {
    return <ApprovalCard msg={msg} onReact={onReact} />
  }

  if (msg.type === "conflict" && msg.conflictData) {
    return <ConflictCard msg={msg} onReact={onReact} />
  }

  if (msg.type === "alert" && msg.alertData) {
    return <AlertCard msg={msg} />
  }

  // Normal agent message
  if (!msg.agent) return null
  const gradient = getAgentGradient(msg.agent.role)
  const initials = getAgentInitials(msg.agent.name)

  return (
    <div className="group flex gap-3 py-1 px-2 -mx-2  hover:bg-[#F8F8F8] transition-colors">
      <div className={cn("w-8 h-8 rounded-md bg-gradient-to-br flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5", gradient)}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-sm text-[#1D1C1D]">{msg.agent.name}</span>
          <span className="text-[11px] text-[#CFC3CF]">{msg.agent.role?.replace(/_/g, " ")}</span>
          <span className="text-[11px] text-[#CFC3CF]">{formatDate(msg.timestamp, "relative")}</span>
        </div>
        <p className="text-[15px] text-[#1D1C1D] leading-relaxed whitespace-pre-wrap">{msg.content}</p>

        {/* Reactions + Actions */}
        <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {msg.reactions?.map(r => (
            <button key={r.emoji} onClick={() => onReact?.(msg.id, r.emoji)} className="px-2 py-0.5 rounded-pill border border-[#DDDDDD] text-[13px] hover:bg-[#F8F8F8] transition-colors">{r.emoji} {r.count}</button>
          ))}
          <button className="text-[11px] text-[#CFC3CF] hover:text-[#1264A3]">Responder</button>
          <button className="text-[11px] text-[#CFC3CF] hover:text-[#1264A3]">Thread</button>
          <button onClick={() => setShowReactions(!showReactions)} className="text-[11px] text-[#CFC3CF] hover:text-[#1264A3]">+</button>
        </div>

        {showReactions && (
          <div className="flex gap-1 mt-1">
            {["🔥","❤️","📊","✅","👀","💡"].map(emoji => (
              <button key={emoji} onClick={() => { onReact?.(msg.id, emoji); setShowReactions(false) }} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F8F8F8] text-sm">{emoji}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Approval Card ────────────────────────────────────────────────

function ApprovalCard({ msg, onReact }: { msg: AgentMessage; onReact?: (msgId: string, emoji: string) => void }) {
  const [vote, setVote] = useState<"none" | "approve" | "reject" | "review">("none")
  if (!msg.agent || !msg.approvalData) return null

  return (
    <div className="flex gap-3 py-2 my-2">
      <div className={cn("w-8 h-8 rounded-md bg-gradient-to-br flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5", getAgentGradient(msg.agent.role))}>
        {getAgentInitials(msg.agent.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-sm text-[#1D1C1D]">{msg.agent.name}</span>
          <span className="text-[11px] text-[#CFC3CF]">{formatDate(msg.timestamp, "relative")}</span>
        </div>
        <p className="text-[15px] text-[#1D1C1D] font-bold mb-2">Arte pronta para aprovação! 🎨</p>

        <div className=" border border-[#DDDDDD] bg-[#F8F8F8] p-4 mb-3">
          <div className="text-center text-[#CFC3CF] text-sm mb-2">📐 {msg.approvalData.specs}</div>
          <p className="text-sm text-[#616061] italic mb-2">"{msg.approvalData.copy}"</p>
          <p className="text-xs text-[#CFC3CF]">📅 Publicação sugerida: {msg.approvalData.publishDate}</p>
        </div>

        {/* Team votes */}
        <div className="space-y-1 mb-3">
          {msg.approvalData.votes.map((v, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={cn("w-2 h-2 rounded-pill")} style={{ backgroundColor: v.color }} />
              <span className="font-bold text-[#1D1C1D]">{v.name}</span>
              <span className={v.vote === "approve" ? "text-black" : v.vote === "warn" ? "text-[#ECB22E]" : "text-[#CFC3CF]"}>
                {v.vote === "approve" ? "✅" : v.vote === "warn" ? "⚠️" : "—"}
              </span>
              <span className="text-[#616061]">{v.comment}</span>
            </div>
          ))}
        </div>

        {/* CEO approval buttons */}
        <div className="flex gap-2">
          <button onClick={() => setVote("approve")} className={cn("flex-1 py-2  text-xs font-bold transition-all", vote === "approve" ? "bg-black text-white" : "border border-[#DDDDDD] text-black hover:bg-black/5")}>✅ Aprovar</button>
          <button onClick={() => setVote("review")} className={cn("flex-1 py-2  text-xs font-bold transition-all", vote === "review" ? "bg-black text-white" : "border border-[#DDDDDD] text-black hover:bg-black/5")}>✏️ Revisão</button>
          <button onClick={() => setVote("reject")} className={cn("flex-1 py-2  text-xs font-bold transition-all", vote === "reject" ? "bg-black text-white" : "border border-[#DDDDDD] text-black hover:bg-black/5")}>❌ Reprovar</button>
        </div>
      </div>
    </div>
  )
}

// ── Conflict Card ────────────────────────────────────────────────

function ConflictCard({ msg, onReact }: { msg: AgentMessage; onReact?: (msgId: string, emoji: string) => void }) {
  if (!msg.conflictData) return null
  const { agentA, agentB } = msg.conflictData

  return (
    <div className="my-3 p-4  border border-[#ECB22E]/20 bg-[#ECB22E]/5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-[#ECB22E]" />
        <span className="text-sm font-bold text-[#1D1C1D]">Conflito Detectado</span>
        <span className="text-[11px] text-[#CFC3CF]">{msg.content}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3  bg-white border border-[#DDDDDD]">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-pill" style={{ backgroundColor: agentA.color }} />
            <span className="text-sm font-bold text-[#1D1C1D]">{agentA.name} diz:</span>
          </div>
          <p className="text-xs text-[#616061] italic leading-relaxed">"{agentA.quote}"</p>
          <p className="text-[10px] text-[#CFC3CF] mt-2">Peso: {agentA.weight}/100</p>
        </div>
        <div className="p-3  bg-white border border-[#DDDDDD]">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-pill" style={{ backgroundColor: agentB.color }} />
            <span className="text-sm font-bold text-[#1D1C1D]">{agentB.name} diz:</span>
          </div>
          <p className="text-xs text-[#616061] italic leading-relaxed">"{agentB.quote}"</p>
          <p className="text-[10px] text-[#CFC3CF] mt-2">Peso: {agentB.weight}/100</p>
        </div>
      </div>

      <p className="text-xs font-bold text-[#1D1C1D] mb-2">Com quem você concorda?</p>
      <div className="flex gap-2">
        <button className="flex-1 py-2  text-xs font-bold border border-[#000000] text-[#000000] hover:bg-[#000000]/5">🟣 {agentA.name} está certa</button>
        <button className="flex-1 py-2  text-xs font-bold border border-black text-black hover:bg-black/5">🟢 {agentB.name} está certa</button>
        <button className="flex-1 py-2  text-xs font-bold border border-[#DDDDDD] text-[#616061] hover:bg-[#F8F8F8]">🤝 Meio a meio</button>
      </div>
    </div>
  )
}

// ── Alert Card ───────────────────────────────────────────────────

function AlertCard({ msg }: { msg: AgentMessage }) {
  if (!msg.agent || !msg.alertData) return null

  return (
    <div className="flex gap-3 py-2 my-2">
      <div className={cn("w-8 h-8 rounded-md bg-gradient-to-br flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5", getAgentGradient(msg.agent.role))}>
        {getAgentInitials(msg.agent.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-sm text-[#1D1C1D]">{msg.agent.name}</span>
          <span className="text-[11px] text-[#CFC3CF]">{formatDate(msg.timestamp, "relative")}</span>
        </div>

        <div className="p-3  border border-black/10 bg-black/5">
          <p className="text-sm font-bold text-black mb-1">⚠️ Alerta de Métricas</p>
          <p className="text-xs text-[#616061]">{msg.alertData.metric}</p>
          <p className="text-xs text-[#616061] mt-1">{msg.alertData.impact}</p>
          <p className="text-xs text-[#1D1C1D] font-bold mt-2">{msg.alertData.recommendation}</p>
          <div className="flex gap-2 mt-3">
            <button className="px-3 py-1.5  border border-[#DDDDDD] text-xs font-bold hover:bg-[#F8F8F8]">📊 Ver Dashboard</button>
            <button className="px-3 py-1.5  border border-[#DDDDDD] text-xs font-bold hover:bg-[#F8F8F8]">🔔 Notificar {msg.alertData.link}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── System Message ───────────────────────────────────────────────

export function SystemMessage({ text, action, onClick }: { text: string; action?: string; onClick?: () => void }) {
  return (
    <div className="flex gap-3 py-2 my-2">
      <div className="w-8 h-8 rounded-md bg-[#F8F8F8] flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-sm">🤖</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-sm text-[#1D1C1D]">AgencyOS</span>
          <span className="text-[11px] text-[#CFC3CF]">Sistema</span>
        </div>
        <p className="text-[15px] text-[#1D1C1D]">{text}</p>
        {action && (
          <button onClick={onClick} className="mt-1.5 text-xs text-[#1264A3] font-bold hover:underline">
            {action} →
          </button>
        )}
      </div>
    </div>
  )
}

// ── Composer ─────────────────────────────────────────────────────

export function ChatComposer({ channel, onSend, agentColors }: { channel: string; onSend: (text: string) => void; agentColors: Record<string, string> }) {
  const [text, setText] = useState("")
  const [showMentions, setShowMentions] = useState(false)
  const agents = Object.keys(agentColors)

  const handleSend = () => {
    if (!text.trim()) return
    onSend(text)
    setText("")
  }

  const handleMention = (name: string) => {
    setText(prev => prev + `@${name} `)
    setShowMentions(false)
  }

  return (
    <div className="relative">
      {showMentions && (
        <div className="absolute bottom-full left-0 mb-1 w-48 bg-white border border-[#DDDDDD]  shadow-elevated p-1 z-10">
          {agents.filter(a => a.toLowerCase().startsWith((text.split("@").pop() || "").toLowerCase())).map(name => (
            <button key={name} onClick={() => handleMention(name)} className="w-full text-left px-3 py-2 rounded-md hover:bg-[#F8F8F8] text-sm font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded-pill" style={{ backgroundColor: agentColors[name] }} /> {name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end p-3 bg-white">
        <button onClick={() => setShowMentions(true)} className="text-[#CFC3CF] hover:text-[#616061] text-lg">@</button>
        <button className="text-[#CFC3CF] hover:text-[#616061] text-lg">📎</button>
        <input
          className="flex-1 bg-transparent text-[15px] text-[#1D1C1D] placeholder-[#CFC3CF] focus:outline-none py-1"
          placeholder={`Mensagem para #${channel}...`}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
        />
        <button onClick={handleSend} disabled={!text.trim()} className="w-8 h-8 rounded-md bg-[#000000] text-white flex items-center justify-center disabled:opacity-30 hover:bg-[#6D28D9] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  )
}
