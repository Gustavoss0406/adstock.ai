"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn, getAgentGradient, getAgentInitials, getRoleLabel, formatDate } from "@/lib/utils"
import { Agent } from "@prisma/client"
import { Plus, X, MessageCircle, Clock, AlertTriangle, ChevronRight, Link, Calendar } from "lucide-react"

interface BoardTask {
  id: string; title: string; description?: string; type?: string
  status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"
  priority: string; platform?: string; dueDate?: string; completedAt?: string
  assignee?: Agent; blocked?: boolean; blockedReason?: string; blockedById?: string
  comments?: Array<{ author: string; text: string; time: string }>
}

interface KanbanBoardProps {
  tasks: BoardTask[]; agents: Agent[]
  onMoveTask?: (taskId: string, newStatus: string) => void
  onCreateTask?: () => void
  onAssignTask?: (taskId: string, agentId: string) => void
}

const COLUMNS = [
  { id: "BACKLOG", label: "Backlog", desc: "Ideias" },
  { id: "TODO", label: "A Fazer", desc: "Esta Semana" },
  { id: "IN_PROGRESS", label: "Em Progresso", desc: "Trabalhando" },
  { id: "IN_REVIEW", label: "Revisao", desc: "Aprovacao" },
  { id: "DONE", label: "Concluido", desc: "Pronto" },
]

const TYPE_ICONS: Record<string, string> = { content: "C", analysis: "A", technical: "T", campaign: "M" }

export function KanbanBoard({ tasks, agents, onMoveTask, onCreateTask }: KanbanBoardProps) {
  const [detailTask, setDetailTask] = useState<BoardTask | null>(null)
  const [filter, setFilter] = useState<string | null>(null)

  const getColTasks = (col: string) => {
    let filtered = tasks.filter(t => t.status === col)
    if (filter) filtered = filtered.map(t => ({
      ...t, dimmed: !(t.assignee?.id === filter || !t.assignee),
    }))
    return filtered
  }

  const isOverdue = (task: BoardTask) => {
    if (!task.dueDate || task.status === "DONE") return false
    return new Date(task.dueDate) < new Date()
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a0b] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold text-white/50">Board</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setFilter(null)} className={cn("px-2 py-0.5 rounded text-[9px]", !filter ? "bg-white/[0.06] text-white/50" : "text-white/20 hover:text-white/40")}>Todos</button>
            {agents.slice(0, 5).map(a => (
              <button key={a.id} onClick={() => setFilter(a.id)} className={cn("px-1.5 py-0.5 rounded text-[9px]", filter === a.id ? "bg-white/[0.06] text-white/50" : "text-white/15 hover:text-white/30")}>{getAgentInitials(a.name)}</button>
            ))}
          </div>
        </div>
        <button onClick={onCreateTask} className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium text-white/35 hover:text-white/60 hover:bg-white/[0.04] transition-colors">
          <Plus className="w-3 h-3" />Tarefa
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-3">
        <div className="grid grid-cols-5 gap-2.5 min-w-[900px] h-full">
          {COLUMNS.map(col => {
            const colTasks = getColTasks(col.id)
            return (
              <div key={col.id} className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-1.5 flex-shrink-0 px-1">
                  <div>
                    <span className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">{col.label}</span>
                    <span className="text-[9px] text-white/15 ml-1.5">{col.desc}</span>
                  </div>
                  <span className="text-[9px] text-white/10">{colTasks.length}</span>
                </div>
                <div className="flex-1 rounded-lg border border-white/[0.04] bg-white/[0.01] p-1.5 space-y-1.5 overflow-y-auto min-h-[100px]">
                  {colTasks.map(task => (
                    <motion.div
                      key={task.id}
                      layout
                      onClick={() => setDetailTask(task)}
                      className={cn(
                        "rounded-lg border p-2.5 cursor-pointer transition-all hover:border-white/[0.08]",
                        "bg-[#111] border-white/[0.04]",
                        // Visual states
                        task.blocked && "border-l-2 border-l-[#ecb22e] bg-[#ecb22e]/[0.02]",
                        isOverdue(task) && "border-l-2 border-l-[#ff385c] bg-[#ff385c]/[0.02]",
                        task.status === "IN_REVIEW" && "border-l-2 border-l-[#7C3AED]",
                        task.status === "IN_PROGRESS" && task.assignee && "bg-white/[0.02]",
                        (task as any).dimmed && "opacity-40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {task.type && (
                            <span className="text-[8px] font-bold text-white/15 bg-white/[0.04] px-1 py-0.5 rounded">{TYPE_ICONS[task.type] || "T"}</span>
                          )}
                          <p className="text-[11px] font-medium text-white/55 truncate">{task.title}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {task.blocked && <Link className="w-2.5 h-2.5 text-[#ecb22e]/60" />}
                          {isOverdue(task) && <AlertTriangle className="w-2.5 h-2.5 text-[#ff385c]/60" />}
                          {task.status === "IN_REVIEW" && <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] animate-pulse" />}
                        </div>
                      </div>

                      {task.platform && <p className="text-[8px] text-white/15 mt-0.5">{task.platform}</p>}

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          {task.assignee && (
                            <div className="flex items-center gap-1">
                              <div className={cn("w-4 h-4 rounded flex items-center justify-center text-white text-[6px] font-bold", getAgentGradient(task.assignee.role))}>{getAgentInitials(task.assignee.name)}</div>
                              <span className="text-[9px] text-white/25">{task.assignee.name.split(" ")[0]}</span>
                            </div>
                          )}
                        </div>
                        {task.dueDate && (
                          <span className={cn("text-[8px] flex items-center gap-0.5", isOverdue(task) ? "text-[#ff385c]/60" : "text-white/15")}>
                            <Clock className="w-2 h-2" />
                            {new Date(task.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </span>
                        )}
                      </div>

                      {task.blocked && task.blockedReason && (
                        <p className="text-[8px] text-[#ecb22e]/40 mt-1 truncate">Bloqueado: {task.blockedReason}</p>
                      )}
                    </motion.div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="flex items-center justify-center h-12 text-white/[0.02] text-[10px]">Vazio</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Task Detail Modal */}
      <AnimatePresence>
        {detailTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setDetailTask(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[#111] border border-white/[0.06] rounded-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-white/70">{detailTask.title}</h3>
                <button onClick={() => setDetailTask(null)} className="text-white/20 hover:text-white/40"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 space-y-4">
                {/* Status + Info */}
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-white/30">Status:</span>
                  <span className={cn("font-medium", detailTask.status === "IN_PROGRESS" ? "text-[#2563eb]" : detailTask.status === "IN_REVIEW" ? "text-[#7C3AED]" : detailTask.status === "DONE" ? "text-[#2bac76]" : "text-white/50")}>
                    {COLUMNS.find(c => c.id === detailTask.status)?.label || detailTask.status}
                  </span>
                  {detailTask.priority && (
                    <span className={cn("px-1.5 py-0.5 rounded text-[9px]", detailTask.priority === "CRITICAL" ? "bg-[#ff385c]/10 text-[#ff385c]" : detailTask.priority === "HIGH" ? "bg-[#ecb22e]/10 text-[#ecb22e]" : "bg-white/[0.03] text-white/30")}>{detailTask.priority}</span>
                  )}
                </div>

                {/* Assignee */}
                {detailTask.assignee && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-white/30">Responsavel:</span>
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-5 h-5 rounded flex items-center justify-center text-white text-[7px] font-bold", getAgentGradient(detailTask.assignee.role))}>{getAgentInitials(detailTask.assignee.name)}</div>
                      <span className="text-[11px] text-white/50">{detailTask.assignee.name}</span>
                      <span className="text-[9px] text-white/25">{getRoleLabel(detailTask.assignee.role)}</span>
                    </div>
                  </div>
                )}

                {/* Due date */}
                {detailTask.dueDate && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Calendar className="w-3 h-3 text-white/15" />
                    <span className="text-white/30">Vence: {new Date(detailTask.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</span>
                    {isOverdue(detailTask) && <span className="text-[#ff385c]/60 text-[10px]">(Atrasado)</span>}
                  </div>
                )}

                {/* Description */}
                {detailTask.description && (
                  <div>
                    <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider mb-1">Descricao</p>
                    <p className="text-[11px] text-white/40 leading-relaxed">{detailTask.description}</p>
                  </div>
                )}

                {/* Blocked info */}
                {detailTask.blocked && (
                  <div className="p-2.5 rounded-lg bg-[#ecb22e]/5 border border-[#ecb22e]/10">
                    <p className="text-[10px] font-semibold text-[#ecb22e]/60 flex items-center gap-1.5"><Link className="w-3 h-3" />Bloqueado</p>
                    {detailTask.blockedReason && <p className="text-[10px] text-[#ecb22e]/40 mt-0.5">{detailTask.blockedReason}</p>}
                  </div>
                )}

                {/* Comments */}
                {detailTask.comments && detailTask.comments.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider mb-1.5">Comentarios ({detailTask.comments.length})</p>
                    <div className="space-y-1.5">
                      {detailTask.comments.map((c, i) => (
                        <p key={i} className="text-[10px] text-white/30"><span className="font-medium text-white/45">{c.author}</span>: {c.text}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-1.5 pt-2 border-t border-white/[0.04]">
                  {COLUMNS.filter(c => c.id !== detailTask.status).slice(0, 3).map(c => (
                    <button key={c.id} onClick={() => { onMoveTask?.(detailTask.id, c.id); setDetailTask(null) }}
                      className="flex-1 py-1.5 rounded text-[10px] font-medium bg-white/[0.03] hover:bg-white/[0.05] text-white/30 hover:text-white/50 transition-colors">
                      Mover para {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
