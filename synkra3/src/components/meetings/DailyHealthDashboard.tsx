"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { CalendarCheck, TrendingUp, AlertTriangle, Users, MessageCircle, CheckCircle } from "lucide-react"

interface DailyMetricsData {
  period: number
  summary: {
    totalDailies: number
    completedDailies: number
    approvedDailies: number
    readDailies: number
    commentedDailies: number
    alertsDailies: number
    avgAgentCount: number
    avgSpeechCount: number
    avgTasksExtracted: number
    totalFallbacks: number
    missingDays: number
    missingDates: string[]
  }
  agents: Array<{
    agentId: string
    agentName: string
    role: string
    dailiesThisWeek: number
    daysSinceLastSpoke: number | null
  }>
  dailies: Array<{
    date: string
    status: string
    agentCount: number
    speechCount: number
    tasksExtracted: number
    hadAlerts: boolean
    agentFallbacks: number
    readAt: string | null
    approvedAt: string | null
    userCommented: boolean
  }>
}

interface Props {
  organizationId: string
}

const STATUS_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: "Concluída", color: "text-blue-400", bg: "bg-blue-500/10" },
  approved: { label: "Aprovada", color: "text-green-400", bg: "bg-green-500/10" },
  pending: { label: "Pendente", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  skipped: { label: "Pulada", color: "text-slate-400", bg: "bg-slate-500/10" },
  errored: { label: "Erro", color: "text-red-400", bg: "bg-red-500/10" },
}

export function DailyHealthDashboard({ organizationId }: Props) {
  const [data, setData] = useState<DailyMetricsData | null>(null)
  const [period, setPeriod] = useState(7)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/daily/metrics?orgId=${organizationId}&period=${period}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch {}
    }
    load()
  }, [organizationId, period])

  if (!data) {
    return (
      <div className="p-6 text-center text-editor-muted text-xs">
        Carregando métricas...
      </div>
    )
  }

  const s = data.summary
  const completionRate = s.totalDailies > 0
    ? Math.round((s.completedDailies / s.totalDailies) * 100)
    : 0
  const approvalRate = s.completedDailies > 0
    ? Math.round((s.approvedDailies / s.completedDailies) * 100)
    : 0

  return (
    <div className="h-full overflow-y-auto bg-[#1a1a2e]">
      <div className="max-w-[1000px] mx-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-[#000000]" />
              Saúde da Daily
            </h2>
            <p className="text-xs text-editor-muted mt-0.5">
              Métricas dos últimos {period} dias
            </p>
          </div>
          <div className="flex gap-1">
            {[7, 14, 30].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${
                  period === p
                    ? "bg-white/[0.08] text-editor-ink"
                    : "text-editor-muted hover:text-editor-muted"
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            icon={<CalendarCheck className="w-4 h-4" />}
            value={`${s.completedDailies}/${s.totalDailies}`}
            label="Dailies"
            sub={`${completionRate}% completude`}
            color="blue"
          />
          <KpiCard
            icon={<CheckCircle className="w-4 h-4" />}
            value={`${approvalRate}%`}
            label="Aprovação"
            sub={`${s.approvedDailies} aprovadas`}
            color="green"
          />
          <KpiCard
            icon={<AlertTriangle className="w-4 h-4" />}
            value={s.alertsDailies}
            label="Alertas"
            sub={`${s.totalFallbacks} fallbacks`}
            color={s.alertsDailies > 0 ? "red" : "green"}
          />
          <KpiCard
            icon={<MessageCircle className="w-4 h-4" />}
            value={s.commentedDailies}
            label="Intervenções"
            sub={`${s.missingDays} dias sem daily`}
            color="purple"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Daily timeline */}
          <Card className="p-4 border-0 bg-white/[0.03]">
            <h3 className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider mb-3">
              Últimas Dailies
            </h3>
            <div className="space-y-1.5">
              {data.dailies.length === 0 ? (
                <p className="text-xs text-editor-muted py-4 text-center">Nenhuma daily no período</p>
              ) : (
                data.dailies.map((d, i) => {
                  const badge = STATUS_BADGES[d.status] || STATUS_BADGES.pending
                  return (
                    <div
                      key={d.date}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/[0.02] text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-editor-muted font-mono w-[55px]">
                          {new Date(d.date + "T00:00:00").toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${badge.bg} ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-editor-muted">
                        <span>{d.agentCount} agents</span>
                        <span>{d.tasksExtracted} tasks</span>
                        {d.hadAlerts && <span className="text-yellow-400/60">⚠️</span>}
                        {d.userCommented && <span className="text-purple-400/60">💬</span>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          {/* Agent participation */}
          <Card className="p-4 border-0 bg-white/[0.03]">
            <h3 className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider mb-3">
              Participação dos Agentes (esta semana)
            </h3>
            <div className="space-y-1.5">
              {data.agents.map(agent => {
                const daysAgo = agent.daysSinceLastSpoke
                return (
                  <div
                    key={agent.agentId}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/[0.02] text-xs"
                  >
                    <span className="text-editor-ink">{agent.agentName}</span>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-editor-muted">{agent.dailiesThisWeek}x this week</span>
                      {daysAgo !== null && (
                        <span
                          className={
                            daysAgo <= 1
                              ? "text-green-400/60"
                              : daysAgo <= 2
                                ? "text-yellow-400/60"
                                : "text-red-400/60"
                          }
                        >
                          {daysAgo}d ago
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Avg stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 border-0 bg-white/[0.02]">
            <p className="text-[10px] text-editor-muted uppercase">Média Agentes</p>
            <p className="text-xl font-bold text-editor-ink mt-1">
              {s.avgAgentCount || "—"}
            </p>
          </Card>
          <Card className="p-3 border-0 bg-white/[0.02]">
            <p className="text-[10px] text-editor-muted uppercase">Média Falas</p>
            <p className="text-xl font-bold text-editor-ink mt-1">
              {s.avgSpeechCount || "—"}
            </p>
          </Card>
          <Card className="p-3 border-0 bg-white/[0.02]">
            <p className="text-[10px] text-editor-muted uppercase">Média Tarefas</p>
            <p className="text-xl font-bold text-editor-ink mt-1">
              {s.avgTasksExtracted || "—"}
            </p>
          </Card>
          <Card className="p-3 border-0 bg-white/[0.02]">
            <p className="text-[10px] text-editor-muted uppercase">Leitura</p>
            <p className="text-xl font-bold text-editor-ink mt-1">
              {s.readDailies}/{s.completedDailies}
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  icon,
  value,
  label,
  sub,
  color,
}: {
  icon: React.ReactNode
  value: string | number
  label: string
  sub: string
  color: string
}) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-400",
    green: "text-green-400",
    red: "text-red-400",
    purple: "text-purple-400",
  }

  return (
    <Card className="p-3 border-0 bg-white/[0.03]">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={colorMap[color] || "text-editor-muted"}>{icon}</span>
        <span className="text-[10px] text-editor-muted uppercase">{label}</span>
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] text-editor-muted mt-0.5">{sub}</div>
    </Card>
  )
}
