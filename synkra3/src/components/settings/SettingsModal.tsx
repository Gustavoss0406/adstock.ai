"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Check, Settings } from "lucide-react"
import { toast } from "sonner"

interface Props {
  open: boolean
  orgId: string
  onClose: () => void
}

const VERBOSITY_OPTIONS = [
  { value: "SILENT", label: "Silencioso", desc: "So alertas criticos. Economia maxima de tokens." },
  { value: "MINIMAL", label: "Minimo", desc: "Checkpoints + bloqueios. Recomendado para autonomia total." },
  { value: "BALANCED", label: "Balanceado", desc: "Tarefas completadas + bloqueios + conflitos. Padrao." },
  { value: "VERBOSE", label: "Detalhado", desc: "Todos os eventos. Util para debug." },
]

export function SettingsModal({ open, orgId, onClose }: Props) {
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !orgId) return
    fetch(`/api/settings?orgId=${orgId}`)
      .then(r => r.json())
      .then(setSettings)
  }, [open, orgId])

  const update = async (field: string, value: any) => {
    setSettings((s: any) => ({ ...s, [field]: value }))
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, [field]: value }),
      })
      if (res.ok) toast.success("Configuracao salva")
    } catch {
      toast.error("Erro ao salvar")
    }
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-editor-panel border border-editor-border rounded-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl"
        >
          <div className="flex items-center justify-between p-5 border-b border-editor-border">
            <div>
              <h2 className="text-sm font-semibold text-white">Configuracoes</h2>
              <p className="text-[11px] text-white/40 mt-0.5">Gerencie o comportamento da agencia</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* Workflow */}
            <div>
              <label className="text-[11px] font-semibold text-white/60 uppercase tracking-wider block mb-2">Metodo de Trabalho</label>
              <div className="flex gap-2">
                {["KANBAN", "SPRINTS"].map(m => (
                  <button
                    key={m}
                    onClick={() => update("workflowMethod", m)}
                    className={`flex-1 py-2.5 rounded-lg text-[12px] font-medium transition-colors ${
                      settings?.workflowMethod === m
                        ? "bg-white/[0.08] text-white border border-white/[0.12]"
                        : "bg-white/[0.02] text-white/40 border border-white/[0.04] hover:bg-white/[0.04]"
                    }`}
                  >
                    {m === "KANBAN" ? "Kanban" : "Sprints"}
                  </button>
                ))}
              </div>
            </div>

            {/* Verbosity */}
            <div>
              <label className="text-[11px] font-semibold text-white/60 uppercase tracking-wider block mb-2">Nivel de Comunicacao</label>
              <div className="space-y-1.5">
                {VERBOSITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => update("verbosityLevel", opt.value)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      settings?.verbosityLevel === opt.value
                        ? "border-white/[0.12] bg-white/[0.04]"
                        : "border-white/[0.04] hover:border-white/[0.08]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-white">{opt.label}</span>
                      {settings?.verbosityLevel === opt.value && <Check className="w-3.5 h-3.5 text-white/60 ml-auto" />}
                    </div>
                    <p className="text-[10px] text-white/30 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Time */}
            <div>
              <label className="text-[11px] font-semibold text-white/60 uppercase tracking-wider block mb-2">Horario da Daily</label>
              <input
                type="time"
                value={settings?.dailyTime || "09:00"}
                onChange={e => update("dailyTime", e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-white/[0.15]"
              />
            </div>

            {/* Check Interval */}
            <div>
              <label className="text-[11px] font-semibold text-white/60 uppercase tracking-wider block mb-2">
                Intervalo de Checagem: {settings?.checkIntervalSec || 45}s
              </label>
              <input
                type="range"
                min="15"
                max="120"
                value={settings?.checkIntervalSec || 45}
                onChange={e => update("checkIntervalSec", parseInt(e.target.value))}
                className="w-full accent-white/60"
              />
              <div className="flex justify-between text-[9px] text-white/20 mt-1">
                <span>15s (rapido)</span>
                <span>120s (economico)</span>
              </div>
            </div>

            {/* Proactive work */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  onClick={() => update("proactiveWorkEnabled", !settings?.proactiveWorkEnabled)}
                  className={`w-8 h-5 rounded-full transition-colors relative ${
                    settings?.proactiveWorkEnabled ? "bg-white/30" : "bg-white/[0.06]"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings?.proactiveWorkEnabled ? "translate-x-3.5" : "translate-x-0.5"
                  }`} />
                </button>
                <div>
                  <span className="text-[12px] text-white/70">Trabalho proativo</span>
                  <p className="text-[10px] text-white/25">Agentes pegam tarefas e trabalham sozinhos</p>
                </div>
              </label>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
