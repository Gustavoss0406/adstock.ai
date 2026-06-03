"use client"

import { motion } from "framer-motion"
import { cn, getAgentGradient, getAgentInitials, getRoleLabel, formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Agent } from "@prisma/client"
import { Crown, ChevronDown, Zap, Clock, DollarSign, AlertTriangle } from "lucide-react"

interface OrgNode {
  agent: Agent
  children: OrgNode[]
}

interface OrgChartProps {
  agents: Agent[]
  onAgentClick?: (agent: Agent) => void
  onPromote?: (agent: Agent) => void
  onFire?: (agent: Agent) => void
}

const HIERARCHY: Record<string, number> = {
  CREATIVE_DIRECTOR: 0,
  STRATEGIST: 0,
  MEDIA_BUYER: 1,
  TRAFFIC_MANAGER: 1,
  SEO: 1,
  ANALYST: 1,
  DESIGNER: 2,
  COPYWRITER: 2,
  SOCIAL_MEDIA: 2,
  COMMUNITY_MANAGER: 2,
}

function buildOrgTree(agents: Agent[]): OrgNode[] {
  const sorted = [...agents].sort((a, b) => (HIERARCHY[a.role] ?? 3) - (HIERARCHY[b.role] ?? 3))
  const top = sorted.slice(0, Math.ceil(sorted.length / 2))
  const bottom = sorted.slice(Math.ceil(sorted.length / 2))

  const ceoNode: OrgNode = {
    agent: { id: "ceo", name: "CEO (Você)", role: "CREATIVE_DIRECTOR" as any, level: 99, salary: 0, performance: 100, morale: 100, status: "ACTIVE" as any, personality: "VISIONARY" as any, skills: [], traits: [], promptTemplate: "", organizationId: "", avatar: null, bio: null, salaryCurrency: "BRL", workState: "IDLE" as any, lastCheckAt: null, lastMessageSeenId: null, lastDailySpokeAt: null, createdAt: new Date(), updatedAt: new Date() },
    children: top.map(a => ({
      agent: a,
      children: bottom.filter(b => HIERARCHY[b.role] > HIERARCHY[a.role]).map(b => ({ agent: b, children: [] })),
    })),
  }
  return [ceoNode]
}

export function OrgChart({ agents }: OrgChartProps) {
  const tree = buildOrgTree(agents)

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex flex-col items-center min-w-[700px] py-4">
        {tree.map((node, i) => (
          <OrgChartNode key={i} node={node} depth={0} isLast />
        ))}
      </div>
    </div>
  )
}

function OrgChartNode({ node, depth, isLast }: { node: OrgNode; depth: number; isLast: boolean }) {
  const isOnline = node.agent.status === "ACTIVE" || node.agent.status === "WORKING"
  const isCeo = node.agent.id === "ceo"

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: depth * 0.1 }}
        className={cn(
          "relative p-3  border bg-white shadow-card min-w-[180px] max-w-[200px]",
          isCeo ? "border-[#4A154B] ring-2 ring-[#4A154B]/20" :
          node.agent.status === "WORKING" ? "border-[#2BAC76]" :
          isOnline ? "border-[#DDDDDD]" : "border-[#DDDDDD] opacity-60"
        )}
      >
        {/* Status dot */}
        <span className={cn(
          "absolute top-2 right-2 w-2.5 h-2.5 rounded-pill border-2 border-white",
          node.agent.status === "WORKING" ? "bg-black animate-pulse" :
          isOnline ? "bg-black" : "bg-[#CFC3CF]"
        )} />

        {/* Crown for CEO */}
        {isCeo && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Crown className="w-5 h-5 text-black drop-shadow-sm" />
          </div>
        )}

        <div className="flex items-center gap-2 mt-1">
          <div className={cn(
            "w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0",
            isCeo ? "bg-black" : `bg-gradient-to-br ${getAgentGradient(node.agent.role)}`
          )}>
            {isCeo ? "CE" : getAgentInitials(node.agent.name)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-black truncate">{node.agent.name}</p>
            <p className="text-[10px] text-[#616061]">{isCeo ? "CEO" : getRoleLabel(node.agent.role)}</p>
          </div>
        </div>

        {/* Budget bar */}
        {!isCeo && (
          <div className="mt-2">
            <div className="flex justify-between text-[9px] text-[#999] mb-0.5">
              <span>Orçamento</span>
              <span>{formatCurrency(node.agent.salary)}/mês</span>
            </div>
            <div className="h-1 rounded-pill bg-[#F8F8F8] overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-pill transition-all",
                  node.agent.salary > 3000 ? "bg-black" : "bg-black"
                )}
                style={{ width: `${Math.min((node.agent.salary / 5000) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Performance */}
        {!isCeo && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Progress value={node.agent.performance} variant={node.agent.performance > 70 ? "success" : node.agent.performance > 40 ? "default" : "warning"} className="flex-1 h-1" />
            <span className="text-[9px] font-bold text-[#616061]">{Math.round(node.agent.performance)}%</span>
          </div>
        )}
      </motion.div>

      {/* Connector line */}
      {node.children.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-px h-6 bg-[#DDDDDD]" />
          <div className="flex items-start">
            {node.children.map((child, i) => (
              <div key={child.agent.id} className="flex flex-col items-center">
                <div className="flex">
                  {/* Horizontal connectors */}
                  {i > 0 && <div className="w-8 h-px bg-[#DDDDDD] mt-3" />}
                  {i === 0 && node.children.length > 1 && <div className="w-8 h-px bg-[#DDDDDD] mt-3 ml-auto" />}
                </div>
                <div className="w-px h-3 bg-[#DDDDDD]" />
                <OrgChartNode node={child} depth={depth + 1} isLast={i === node.children.length - 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
