"use client"

import { motion } from "framer-motion"
import { cn, getAgentGradient, getAgentInitials } from "@/lib/utils"
import { formatDate } from "@/lib/utils"
import { Agent } from "@prisma/client"

interface ChatMessageProps {
  content: string
  agent?: Agent | null
  isUser?: boolean
  timestamp?: string | Date
}

export function ChatMessage({ content, agent, isUser = false, timestamp }: ChatMessageProps) {
  const gradient = agent ? getAgentGradient(agent.role) : "from-primary to-primary-active"
  const initials = agent ? getAgentInitials(agent.name) : "VC"

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
    >
      <div
        className={cn(
          "w-7 h-7 rounded-md bg-gradient-to-br flex-shrink-0 flex items-center justify-center text-white text-[10px] font-medium",
          isUser ? "from-body-strong to-muted-foreground" : gradient
        )}
      >
        {isUser ? "VC" : initials}
      </div>

      <div className={cn("flex-1 min-w-0", isUser && "flex flex-col items-end")}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-body-strong">
            {isUser ? "Você" : agent?.name || "Agente"}
          </span>
          {timestamp && (
            <span className="text-[11px] text-muted-soft">
              {formatDate(timestamp, "relative")}
            </span>
          )}
        </div>

        <div
          className={cn(
            "rounded-lg px-3.5 py-2 text-sm leading-relaxed",
            isUser
              ? "bg-surface-soft border border-hairline text-body"
              : "bg-background border border-border text-body"
          )}
        >
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    </motion.div>
  )
}
