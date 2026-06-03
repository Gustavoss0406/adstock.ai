"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Meeting, Message, Agent } from "@prisma/client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AgentThinking } from "@/components/agents/AgentThinking"
import { cn, formatDate, getAgentGradient, getAgentInitials } from "@/lib/utils"
import { Play, Clock, Users, MessageSquare, CheckCircle2, Loader2, Video, MessageCircle } from "lucide-react"

interface MeetingRoomProps {
  meeting: Meeting & {
    participants: Array<{ agent: Agent }>
    messages: Array<Message & { agent: Agent | null }>
  }
  onRun?: (meetingId: string) => Promise<void>
  isRunning?: boolean
}

const MEETING_PHASES = [
  "Agentes entrando na sala...",
  "Iniciando check-in...",
  "Compartilhando atualizações...",
  "Debatendo estratégias...",
  "Planejando ações do dia...",
  "Alinhando prioridades...",
  "Finalizando reunião...",
]

export function MeetingRoom({ meeting, onRun, isRunning = false }: MeetingRoomProps) {
  const [showThinking, setShowThinking] = useState(false)
  const [currentPhase, setCurrentPhase] = useState(MEETING_PHASES[0])
  const [speakingAgent, setSpeakingAgent] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isRunning) {
      setShowThinking(false)
      setSpeakingAgent(null)
      return
    }

    setShowThinking(true)

    const participants = meeting.participants.map((p) => p.agent.name)
    let phaseIndex = 0
    let speakerIndex = 0

    const interval = setInterval(() => {
      phaseIndex = (phaseIndex + 1) % MEETING_PHASES.length
      speakerIndex = (speakerIndex + 1) % participants.length
      setCurrentPhase(MEETING_PHASES[phaseIndex])
      if (participants.length > 0) {
        setSpeakingAgent(participants[speakerIndex])
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [isRunning, meeting.participants])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [meeting.messages])

  const isActive = meeting.status === "IN_PROGRESS"
  const isCompleted = meeting.status === "COMPLETED"
  const hasMessages = meeting.messages.length > 0

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="border-b border-[#DDDDDD] bg-[#F8F8F8] px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-md flex items-center justify-center",
              isActive ? "bg-black/5" : isCompleted ? "bg-black/5" : "bg-black/5"
            )}>
              {isActive ? (
                <Video className="w-5 h-5 text-black" />
              ) : isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-[#2BAC76]" />
              ) : (
                <Clock className="w-5 h-5 text-[#1264A3]" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-[#1D1C1D]">{meeting.title}</h3>
              <p className="text-xs text-[#616061]">{meeting.topic}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={isActive ? "danger" : isCompleted ? "success" : "info"}>
              {meeting.status === "SCHEDULED" && "Agendada"}
              {meeting.status === "IN_PROGRESS" && "Em andamento"}
              {meeting.status === "COMPLETED" && "Concluída"}
            </Badge>

            {meeting.status === "SCHEDULED" && (
              <Button
                size="sm"
                variant="default"
                onClick={() => onRun?.(meeting.id)}
                disabled={isRunning}
              >
                {isRunning ? (
                  <> <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Rodando... </>
                ) : (
                  <> <Play className="w-3.5 h-3.5 mr-1" /> Iniciar </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-[11px] text-[#616061]">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(meeting.scheduledAt, "long")}</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{meeting.participants.length} participantes</span>
          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{meeting.messages.length} mensagens</span>
        </div>
      </div>

      {/* Participants */}
      {meeting.participants.length > 0 && (
        <div className="px-5 py-2.5 border-b border-[#DDDDDD] flex items-center gap-2">
          <span className="text-xs font-bold text-[#616061]">Participantes:</span>
          <div className="flex -space-x-1.5">
            {meeting.participants.map((p) => (
              <motion.div
                key={p.agent.id}
                animate={speakingAgent === p.agent.name && isRunning ? {
                  scale: [1, 1.15, 1],
                  y: [0, -3, 0],
                } : {}}
                transition={{ duration: 0.6, repeat: Infinity }}
                className={cn(
                  "w-7 h-7 rounded-sm bg-gradient-to-br flex items-center justify-center text-white text-[9px] font-bold border-2 border-white shadow-sm",
                  getAgentGradient(p.agent.role),
                  speakingAgent === p.agent.name && isRunning && "ring-2 ring-[#2BAC76] ring-offset-1"
                )}
                title={p.agent.name}
              >
                {getAgentInitials(p.agent.name)}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Thinking indicator during meeting */}
      <AnimatePresence>
        {showThinking && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-5 py-3 border-b border-[#DDDDDD] bg-[#F8F8F8]"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-[#1264A3] animate-spin flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-[#1D1C1D]">{currentPhase}</p>
                {speakingAgent && (
                  <p className="text-xs text-[#616061] mt-0.5">
                    <span className="text-[#4A154B] font-bold">{speakingAgent}</span> está falando...
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-1.5 w-full rounded-pill bg-[#DDDDDD] overflow-hidden">
              <motion.div
                className="h-full rounded-pill bg-gradient-to-r from-[#4A154B] via-[#1264A3] to-[#2BAC76]"
                animate={{ width: ["0%", "100%"] }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="max-h-96 overflow-y-auto">
        {hasMessages ? (
          <div className="p-5 space-y-3">
            {meeting.messages.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-3"
              >
                {msg.agent ? (
                  <>
                    <div className={cn(
                      "w-7 h-7 rounded-sm bg-gradient-to-br flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mt-0.5",
                      getAgentGradient(msg.agent.role)
                    )}>
                      {getAgentInitials(msg.agent.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-[#1D1C1D]">{msg.agent.name}</span>
                        <span className="text-[11px] text-[#CFC3CF]">{formatDate(msg.createdAt, "relative")}</span>
                      </div>
                      <p className="text-[15px] text-[#1D1C1D] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </>
                ) : (
                  <div className="flex-1">
                    <p className="text-[15px] text-[#616061] italic">{msg.content}</p>
                  </div>
                )}
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : !isRunning && meeting.status === "SCHEDULED" ? (
          <div className="p-12 text-center">
            <Video className="w-10 h-10 text-[#CFC3CF] mx-auto mb-3" />
            <p className="text-[#616061] text-sm">A reunião ainda não começou</p>
            <p className="text-[#CFC3CF] text-xs mt-1">Clique em Iniciar para começar a daily</p>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
