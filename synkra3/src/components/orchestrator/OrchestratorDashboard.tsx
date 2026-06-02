"use client"

import { useState, useEffect, useCallback } from "react"
import { cn, getAgentColor, getPersonalityColor } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Activity, Users, MessageCircle, GitBranch, Clock, AlertTriangle, Wifi, WifiOff } from "lucide-react"

// ── Types ──────────────────────────────────────────────────

interface OrchestrationStatus {
  timestamp: string
  agents: Array<{
    id: string
    name: string
    role: string
    personality: string
    status: string
    workState: string
    performance: number
    morale: number
    lastCheckAt: string | null
    lastUpdated: string
  }>
  workStateDistribution: Record<string, number>
  statusDistribution: Record<string, number>
  channels: Array<{
    id: string
    name: string
    locked: boolean
    lockedBy: string | null
    lockAgeMs: number | null
    queueLength: number
    typing: { agentId: string; agentName: string; ageMs: number } | null
  }>
  actionQueue: Array<{
    id: string
    type: string
    priority: number
    agentId: string
    agentName: string
    scheduledFor: string
    secondsUntil: number
  }>
  metrics: {
    messagesLastHour: number
    taskMoves24h: number
    totalActions24h: number
    completedActions24h: number
    failedActions24h: number
    conflicts24h: number
    avgResponseTimeMs: number | null
    totalLocks: number
    pendingReleases: number
  }
  activityLog: Array<{
    id: string
    timestamp: string
    agentName: string
    eventType: string
    details: any
  }>
}

// ── Work State Badge ──────────────────────────────────────

const WORK_STATE_LABELS: Record<string, { label: string; emoji: string }> = {
  IDLE: { label: "Ocioso", emoji: "💤" },
  THINKING: { label: "Pensando", emoji: "🤔" },
  WORKING_SILENT: { label: "Trabalhando", emoji: "🔇" },
  WORKING_VISIBLE: { label: "Comunicando", emoji: "📢" },
  WAITING: { label: "Aguardando", emoji: "⏳" },
  SPEAKING: { label: "Falando", emoji: "🗣️" },
}

function WorkStateBadge({ state }: { state: string }) {
  const info = WORK_STATE_LABELS[state] || { label: state, emoji: "❓" }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/70">
      {info.emoji} {info.label}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: number }) {
  const colors: Record<number, string> = {
    10: "bg-red-500/20 text-red-300",
    9: "bg-orange-500/20 text-orange-300",
    8: "bg-orange-500/20 text-orange-300",
    7: "bg-yellow-500/20 text-yellow-300",
    6: "bg-yellow-500/20 text-yellow-300",
    5: "bg-blue-500/20 text-blue-300",
    4: "bg-blue-500/20 text-blue-300",
    3: "bg-slate-500/20 text-slate-300",
    2: "bg-slate-500/20 text-slate-300",
    1: "bg-slate-500/20 text-slate-300",
  }
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono font-bold", colors[priority] || colors[5])}>
      P{priority}
    </span>
  )
}

// ── Main Component ────────────────────────────────────────

interface Props {
  organizationId: string
}

export function OrchestratorDashboard({ organizationId }: Props) {
  const [data, setData] = useState<OrchestrationStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/orchestrator/status?orgId=${organizationId}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json()
      setData(json)
      setLastFetch(new Date())
      setError(null)
    } catch (err: any) {
      setError(err.message || "fetch error")
    }
  }, [organizationId])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-white/40 text-sm">
        {error ? `Erro: ${error}` : "Carregando..."}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[#1a1a2e]">
      <div className="max-w-[1400px] mx-auto p-6 space-y-5">
        {/* ── Header ────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
              Painel de Orquestração
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Sistema Nervoso do AgencyOS
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/30">
            {error ? (
              <span className="flex items-center gap-1 text-red-400">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            ) : (
              <span className="flex items-center gap-1 text-green-400">
                <Wifi className="w-3 h-3" /> Live
              </span>
            )}
            {lastFetch && (
              <span>Atualizado {lastFetch.toLocaleTimeString()}</span>
            )}
          </div>
        </div>

        {/* ── Metrics Row ───────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <MetricCard
            icon={<MessageCircle className="w-4 h-4" />}
            label="Msgs/h"
            value={data.metrics.messagesLastHour}
            color="blue"
          />
          <MetricCard
            icon={<GitBranch className="w-4 h-4" />}
            label="Tasks/24h"
            value={data.metrics.taskMoves24h}
            color="green"
          />
          <MetricCard
            icon={<Activity className="w-4 h-4" />}
            label="Ações/24h"
            value={`${data.metrics.completedActions24h}/${data.metrics.totalActions24h}`}
            sub={`${data.metrics.failedActions24h} falhas`}
            color="purple"
          />
          <MetricCard
            icon={<Clock className="w-4 h-4" />}
            label="Resp. Médio"
            value={data.metrics.avgResponseTimeMs ? `${(data.metrics.avgResponseTimeMs / 1000).toFixed(1)}s` : "—"}
            color="yellow"
          />
          <MetricCard
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Conflitos"
            value={data.metrics.conflicts24h}
            color="red"
          />
          <MetricCard
            icon={<Users className="w-4 h-4" />}
            label="Locks"
            value={`${data.metrics.totalLocks}`}
            sub={`${data.metrics.pendingReleases} pendentes`}
            color="slate"
          />
        </div>

        {/* ── Agent Grid ────────────────────────────────── */}
        <Section title="Agentes" count={data.agents.length}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.agents.map(agent => {
              const color = getAgentColor(agent.role)
              return (
                <Card key={agent.id} className="p-3 border-0 bg-white/5 hover:bg-white/8 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-medium text-white truncate">{agent.name}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <WorkStateBadge state={agent.workState} />
                      <span className={cn(
                        "text-[10px] font-medium",
                        agent.status === "ACTIVE" && "text-green-400",
                        agent.status === "WORKING" && "text-blue-400",
                        agent.status === "IN_MEETING" && "text-yellow-400",
                        agent.status === "IDLE" && "text-slate-400",
                        agent.status === "OFFLINE" && "text-red-400",
                      )}>
                        {agent.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <span>Perf: {agent.performance.toFixed(0)}%</span>
                      <span className="text-white/20">|</span>
                      <span>Moral: {agent.morale}</span>
                    </div>
                    {agent.lastCheckAt && (
                      <div className="text-[9px] text-white/20">
                        Check: {new Date(agent.lastCheckAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* ── Channel Locks ────────────────────────────── */}
          <Section title="Canais" count={data.channels.length}>
            <div className="space-y-2">
              {data.channels.map(ch => (
                <div
                  key={ch.id}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg text-sm",
                    ch.locked ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-white/5",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-white/80 font-medium truncate">#{ch.name}</span>
                    {ch.locked && (
                      <span className="text-[10px] text-yellow-400/80 flex-shrink-0">
                        lock {(ch.lockAgeMs! / 1000).toFixed(0)}s
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs flex-shrink-0">
                    {ch.typing && (
                      <span className="text-purple-400/80 animate-pulse">
                        {ch.typing.agentName} digitando...
                      </span>
                    )}
                    {ch.lockedBy && !ch.typing && (
                      <span className="text-white/50">{ch.lockedBy} falando</span>
                    )}
                    {ch.queueLength > 0 && (
                      <span className="text-white/30">fila: {ch.queueLength}</span>
                    )}
                    {!ch.lockedBy && !ch.typing && (
                      <span className="text-green-400/60 text-[10px]">livre</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Action Queue ─────────────────────────────── */}
          <Section title="Fila de Ações" count={data.actionQueue.length}>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {data.actionQueue.length === 0 ? (
                <p className="text-xs text-white/30 py-4 text-center">Nenhuma ação pendente</p>
              ) : (
                data.actionQueue.map(action => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between p-2 rounded bg-white/5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PriorityBadge priority={action.priority} />
                      <span className="text-white/70 truncate">{action.type}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/30 flex-shrink-0">
                      <span className="truncate max-w-[80px]">{action.agentName}</span>
                      <span className="font-mono text-white/20">
                        {action.secondsUntil <= 0 ? "agora" : `${action.secondsUntil}s`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Section>
        </div>

        {/* ── Activity Log ───────────────────────────────── */}
        <Section title="Log de Atividade" count={data.activityLog.length}>
          <div className="space-y-1 max-h-[250px] overflow-y-auto font-mono">
            {data.activityLog.map(log => (
              <div key={log.id} className="flex items-start gap-2 text-[11px] py-0.5">
                <span className="text-white/20 flex-shrink-0 w-[60px] text-right">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-white/50 flex-shrink-0 w-[90px] truncate">
                  {log.agentName}
                </span>
                <span className={cn(
                  "flex-shrink-0 w-[140px] truncate",
                  log.eventType.includes("error") && "text-red-400",
                  log.eventType.includes("acquired") && "text-green-400",
                  log.eventType.includes("queued") && "text-yellow-400",
                  log.eventType.includes("completed") && "text-blue-400",
                  "text-white/60",
                )}>
                  {log.eventType}
                </span>
                <span className="text-white/20 truncate flex-1">
                  {log.details ? JSON.stringify(log.details).slice(0, 80) : ""}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── State Distribution ─────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 border-0 bg-white/5">
            <h4 className="text-[10px] font-medium text-white/30 uppercase mb-2">Work States</h4>
            <div className="space-y-1">
              {Object.entries(data.workStateDistribution).map(([state, count]) => (
                <div key={state} className="flex items-center justify-between text-xs">
                  <WorkStateBadge state={state} />
                  <span className="text-white/50">{count}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-3 border-0 bg-white/5">
            <h4 className="text-[10px] font-medium text-white/30 uppercase mb-2">Status</h4>
            <div className="space-y-1">
              {Object.entries(data.statusDistribution).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <span className="text-white/60">{status}</span>
                  <span className="text-white/50">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">{title}</h3>
        <span className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded">{count}</span>
      </div>
      {children}
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-400",
    green: "text-green-400",
    purple: "text-purple-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
    slate: "text-slate-400",
  }

  return (
    <Card className="p-3 border-0 bg-white/5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={colorMap[color] || "text-white/50"}>{icon}</span>
        <span className="text-[10px] text-white/30 uppercase">{label}</span>
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
      {sub && <div className="text-[10px] text-white/20 mt-0.5">{sub}</div>}
    </Card>
  )
}
