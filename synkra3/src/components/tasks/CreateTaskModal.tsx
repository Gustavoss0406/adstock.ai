"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { X, Plus, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface CreateTaskModalProps {
  orgId: string
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

const PRIORITIES = [
  { value: "LOW", label: "Baixa", color: "bg-muted text-muted-foreground" },
  { value: "MEDIUM", label: "Media", color: "bg-info/10 text-info" },
  { value: "HIGH", label: "Alta", color: "bg-warning/10 text-warning" },
  { value: "CRITICAL", label: "Critica", color: "bg-destructive/10 text-destructive" },
]

const PLATFORMS = ["Instagram", "LinkedIn", "Pinterest", "Blog", "TikTok", "Email"]

export function CreateTaskModal({ orgId, open, onClose, onCreated }: CreateTaskModalProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("MEDIUM")
  const [platform, setPlatform] = useState("")
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, title, description, priority, platform: platform || undefined }),
      })
      if (!res.ok) throw new Error("Erro")
      toast.success("Tarefa criada!")
      setTitle(""); setDescription(""); setPriority("MEDIUM"); setPlatform("")
      onCreated?.()
      onClose()
    } catch { toast.error("Erro ao criar tarefa") }
    finally { setLoading(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative bg-editor-surface border border-editor-border rounded-2xl w-full max-w-lg mx-4 shadow-[0_0_60px_rgba(255,255,255,0.03)] overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-editor-border">
              <h2 className="text-sm font-semibold text-editor-ink">Nova tarefa</h2>
              <button onClick={onClose} className="text-editor-muted hover:text-editor-muted"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] text-editor-muted block mb-1.5 uppercase tracking-wider">Titulo</label>
                <input
                  className="w-full bg-white/[0.02] border border-editor-border rounded-xl px-3 py-2 text-sm text-editor-ink placeholder-white/10 focus:outline-none focus:border-white/15"
                  placeholder="Ex: Criar arte para Instagram"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] text-editor-muted block mb-1.5 uppercase tracking-wider">Descricao</label>
                <textarea
                  className="w-full bg-white/[0.02] border border-editor-border rounded-xl px-3 py-2 text-sm text-editor-muted placeholder-white/10 focus:outline-none focus:border-white/15 resize-none h-24"
                  placeholder="Detalhes da tarefa, briefing, referencias..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-editor-muted block mb-1.5 uppercase tracking-wider">Prioridade</label>
                  <div className="flex gap-1.5">
                    {PRIORITIES.map(p => (
                      <button key={p.value} onClick={() => setPriority(p.value)} className={cn("px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all", priority === p.value ? p.color + " ring-1 ring-white/10" : "bg-white/[0.02] text-editor-muted hover:bg-white/[0.04]")}>{p.label}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-editor-muted block mb-1.5 uppercase tracking-wider">Plataforma</label>
                  <select
                    className="w-full bg-white/[0.02] border border-editor-border rounded-xl px-2.5 py-2 text-xs text-editor-muted focus:outline-none focus:border-white/15"
                    value={platform}
                    onChange={e => setPlatform(e.target.value)}
                  >
                    <option value="">Nenhuma</option>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-editor-border flex gap-2">
              <button onClick={onClose} className="flex-1 py-2 rounded-xl text-[11px] font-medium text-editor-muted hover:text-editor-muted hover:bg-white/[0.02] transition-colors">Cancelar</button>
              <button onClick={handleCreate} disabled={!title.trim() || loading} className="flex-1 py-2 rounded-xl text-[11px] font-medium bg-white/[0.06] hover:bg-white/[0.08] text-editor-muted hover:text-editor-ink disabled:opacity-20 transition-all flex items-center justify-center gap-1.5">
                {loading ? <div className="w-3 h-3 rounded-pill border-2 border-white/20 border-t-white/50 animate-spin" /> : <Plus className="w-3 h-3" />}
                Criar tarefa
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
