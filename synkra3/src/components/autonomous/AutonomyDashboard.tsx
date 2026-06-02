"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Zap, Activity, CheckCircle2, AlertTriangle, XCircle, Settings, BrainCircuit } from "lucide-react"

interface Props {
  orgId: string
}

export function AutonomyDashboard({ orgId }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({
    postsNeedApproval: true,
    strategyChangesNeedApproval: true,
    blogAutoPublish: false,
    scheduleAutoPublish: false,
    autoReplyComments: false,
    notificationsImportant: true,
    dailyReport: false,
  })

  useEffect(() => {
    fetch(`/api/autonomous/run?organizationId=${orgId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [orgId])

  if (loading) {
    return <div className="p-6 text-center text-white/20 text-xs">Carregando dashboard...</div>
  }

  const patterns = data?.patterns || {}
  const context = data?.context || {}
  const autonomyLevel = data?.autonomyLevel || 100

  return (
    <div className="p-4 space-y-4">
      {/* Autonomy Level */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-[#7C3AED]/60" />
            <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Nivel de Autonomia</span>
          </div>
          <span className="text-sm font-bold text-white/70">{autonomyLevel}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${autonomyLevel}%` }}
            transition={{ duration: 1 }}
            className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#ff385c]"
          />
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={<CheckCircle2 className="w-3 h-3 text-[#2bac76]" />}
          label="Tarefas criadas"
          value={context?.backlogSize || 0}
        />
        <StatCard
          icon={<Activity className="w-3 h-3 text-[#2563eb]" />}
          label="Em execucao"
          value={context?.taskCounts?.inProgress || 0}
        />
        <StatCard
          icon={<AlertTriangle className="w-3 h-3 text-[#ecb22e]" />}
          label="Aprovacoes pendentes"
          value={(patterns?.totalApprovals || 0) + (patterns?.totalRejections || 0)}
        />
        <StatCard
          icon={<XCircle className="w-3 h-3 text-[#ff385c]" />}
          label="Rejeicoes"
          value={patterns?.totalRejections || 0}
        />
      </div>

      {/* Approval Rate */}
      {patterns?.approvalRate > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
        >
          <p className="text-[10px] text-white/20 mb-1">Taxa de aprovacao do CEO</p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[#2bac76]">{Math.round(patterns.approvalRate * 100)}%</span>
            <span className="text-[10px] text-white/20">
              ({patterns.totalApprovals} aprovadas, {patterns.totalRejections} rejeitadas)
            </span>
          </div>
        </motion.div>
      )}

      {/* Settings */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-3 h-3 text-white/20" />
          <span className="text-[10px] font-semibold text-white/20 uppercase tracking-wider">Aprovacao necessaria</span>
        </div>
        {[
          { key: "postsNeedApproval", label: "Posts" },
          { key: "strategyChangesNeedApproval", label: "Mudanca de estrategia" },
          { key: "blogAutoPublish", label: "Blog posts (confio no time)" },
          { key: "scheduleAutoPublish", label: "Horarios de publicacao" },
          { key: "autoReplyComments", label: "Resposta a comentarios" },
        ].map(item => (
          <ToggleRow
            key={item.key}
            label={item.label}
            checked={(settings as any)[item.key]}
            onChange={() => setSettings((s: any) => ({ ...s, [item.key]: !s[item.key] }))}
          />
        ))}
      </motion.div>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-3 h-3 text-white/20" />
          <span className="text-[10px] font-semibold text-white/20 uppercase tracking-wider">Notificacoes</span>
        </div>
        {[
          { key: "notificationsImportant", label: "Apenas tarefas importantes" },
          { key: "dailyReport", label: "Relatorio diario as 20h" },
        ].map(item => (
          <ToggleRow
            key={item.key}
            label={item.label}
            checked={(settings as any)[item.key]}
            onChange={() => setSettings((s: any) => ({ ...s, [item.key]: !s[item.key] }))}
          />
        ))}
      </motion.div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[9px] text-white/20">{label}</span>
      </div>
      <span className="text-lg font-bold text-white/50">{value}</span>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors"
    >
      <span className="text-[11px] text-white/30">{label}</span>
      <div className={`w-7 h-4 rounded-full transition-colors ${checked ? "bg-[#2bac76]/40" : "bg-white/[0.06]"}`}>
        <div className={`w-3 h-3 rounded-full bg-white/40 mt-0.5 transition-transform ${checked ? "translate-x-3.5" : "translate-x-0.5"}`} />
      </div>
    </button>
  )
}
