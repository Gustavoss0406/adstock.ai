"use client"

import { motion } from "framer-motion"
import { Agent, AgentStatus } from "@prisma/client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { cn, getAgentGradient, getAgentInitials, getRoleLabel, formatCurrency } from "@/lib/utils"
import { MessageCircle, ChevronUp, MoreHorizontal, Star, TrendingUp } from "lucide-react"

interface AgentCardProps {
  agent: Agent & { agentMetrics?: Array<{ qualityScore: number; tasksCompleted: number }> }
  onChat?: (agent: Agent) => void
  onDetails?: (agent: Agent) => void
  onPromote?: (agent: Agent) => void
  onFire?: (agent: Agent) => void
  compact?: boolean
}

const statusConfig: Record<AgentStatus, { label: string; color: string; dot: string }> = {
  ACTIVE: { label: "Ativo", color: "text-[#2BAC76]", dot: "bg-[#2BAC76]" },
  IDLE: { label: "Ocioso", color: "text-[#ECB22E]", dot: "bg-[#ECB22E]" },
  WORKING: { label: "Trabalhando", color: "text-[#2BAC76]", dot: "bg-[#2BAC76] animate-pulse" },
  IN_MEETING: { label: "Em reunião", color: "text-[#4A154B]", dot: "bg-[#4A154B] animate-pulse" },
  OFFLINE: { label: "Offline", color: "text-[#616061]", dot: "bg-[#616061]" },
  FIRED: { label: "Demitido", color: "text-black", dot: "bg-black" },
}

export function AgentCard({ agent, onChat, onDetails, onPromote, onFire, compact = false }: AgentCardProps) {
  const status = statusConfig[agent.status] || statusConfig.OFFLINE
  const initials = getAgentInitials(agent.name)
  const gradient = getAgentGradient(agent.role)

  if (compact) {
    return (
      <motion.div whileHover={{ scale: 1.01 }} className="cursor-pointer" onClick={() => onDetails?.(agent)}>
        <div className="flex items-center gap-3 p-3 rounded-md border border-[#DDDDDD] bg-white hover:bg-[#F8F8F8] transition-colors shadow-card">
          <div className={cn("w-8 h-8 rounded-sm bg-gradient-to-br flex items-center justify-center text-white font-bold text-xs", gradient)}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm truncate text-[#1D1C1D]">{agent.name}</span>
              <span className={cn("w-1.5 h-1.5 rounded-pill flex-shrink-0", status.dot)} />
            </div>
            <span className="text-[13px] text-[#616061]">{getRoleLabel(agent.role)}</span>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
    >
      <Card className="overflow-hidden border-[#DDDDDD] transition-shadow hover:shadow-elevated">
        {/* Agent Header */}
        <div className={cn("h-20 bg-gradient-to-br", gradient)}>
          <div className="h-full flex items-end p-4 gap-3">
            <div className="w-12 h-12 rounded-sm bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white font-bold text-lg">
              {initials}
            </div>
            <div className="flex-1 min-w-0 pb-0.5">
              <h3 className="font-bold text-white truncate text-sm">{agent.name}</h3>
              <p className="text-xs text-editor-ink">{getRoleLabel(agent.role)}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-pill", status.dot)} />
              <span className={cn("text-[11px] font-bold", status.color)}>{status.label}</span>
            </div>
          </div>
        </div>

        <CardContent className="p-4">
          {/* Bio */}
          {agent.bio && (
            <p className="text-[13px] text-[#616061] line-clamp-2 mb-3">{agent.bio}</p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-[#F8F8F8] rounded-sm p-2">
              <div className="flex items-center gap-1 text-[11px] text-[#616061] mb-0.5">
                <Star className="w-3 h-3" />
                Nível
              </div>
              <span className="text-sm font-bold text-[#1264A3]">{agent.level}</span>
            </div>
            <div className="bg-[#F8F8F8] rounded-sm p-2">
              <div className="flex items-center gap-1 text-[11px] text-[#616061] mb-0.5">
                <TrendingUp className="w-3 h-3" />
                Perf.
              </div>
              <span className="text-sm font-bold text-[#2BAC76]">{Math.round(agent.performance)}%</span>
            </div>
          </div>

          {/* Morale */}
          <div className="mb-3">
            <div className="flex justify-between text-[11px] text-[#616061] mb-1">
              <span>Moral</span>
              <span>{agent.morale}%</span>
            </div>
            <Progress
              value={agent.morale}
              variant={agent.morale > 60 ? "success" : agent.morale > 30 ? "warning" : "danger"}
            />
          </div>

          {/* Salary */}
          <div className="flex items-center justify-between pt-3 border-t border-[#DDDDDD]">
            <span className="text-[13px] text-[#616061]">
              Salário <span className="text-[#1D1C1D] font-bold">{formatCurrency(agent.salary)}</span>
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-1.5 pt-3">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs h-8"
              onClick={(e) => { e.stopPropagation(); onChat?.(agent) }}
            >
              <MessageCircle className="w-3 h-3 mr-1" />
              Chat
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-8 px-2 text-[#2BAC76] hover:text-[#2BAC76]"
              onClick={(e) => { e.stopPropagation(); onPromote?.(agent) }}
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-8 px-2 text-black hover:text-black"
              onClick={(e) => { e.stopPropagation(); onFire?.(agent) }}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
