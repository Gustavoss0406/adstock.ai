"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn, getAgentGradient, getAgentInitials, getRoleLabel, formatDate } from "@/lib/utils"
import { Agent } from "@prisma/client"
import { Plus, X, MessageCircle, Clock, AlertTriangle, Link, Calendar, Image, Paperclip, Eye } from "lucide-react"

interface BoardTask {
  id: string; title: string; description?: string; type?: string
  status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"
  priority: string; platform?: string; dueDate?: string; completedAt?: string
  assignee?: Agent; blocked?: boolean; blockedReason?: string; blockedById?: string
  comments?: Array<{ author: string; text: string; time: string }>
  output?: any
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

const TYPE_CONFIG: Record<string, { label: string; color: string; coverGradient: string }> = {
  content:   { label: "Conteudo", color: "bg-rose-500/10 text-rose-400 border-rose-500/20", coverGradient: "from-rose-500/20 to-rose-600/5" },
  analysis:  { label: "Analise", color: "bg-sky-500/10 text-sky-400 border-sky-500/20", coverGradient: "from-sky-500/20 to-sky-600/5" },
  technical: { label: "Tecnico", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", coverGradient: "from-amber-500/20 to-amber-600/5" },
  campaign:  { label: "Campanha", color: "bg-violet-500/10 text-violet-400 border-violet-500/20", coverGradient: "from-violet-500/20 to-violet-600/5" },
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "border-l-2 border-l-destructive",
  HIGH: "border-l-2 border-l-warning",
  MEDIUM: "",
  LOW: "",
}

export function KanbanBoard({ tasks, agents, onMoveTask, onCreateTask }: KanbanBoardProps) {
  const [detailTask, setDetailTask] = useState<BoardTask | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [commentInput, setCommentInput] = useState("")

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

  const coverImage = (task: BoardTask) => task.output?.coverUrl || task.output?.deliverableImage || null
  const hasDeliverable = (task: BoardTask) => task.output?.content || task.output?.deliverableImage
  const typeConfig = (task: BoardTask) => TYPE_CONFIG[task.type || "content"] || TYPE_CONFIG.content

  return (
    <div className="h-full flex flex-col bg-editor-bg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-editor-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold text-editor-muted">Board</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setFilter(null)} className={cn("px-2 py-0.5 rounded text-[9px]", !filter ? "bg-white/[0.06] text-editor-muted" : "text-editor-muted hover:text-editor-muted")}>Todos</button>
            {agents.slice(0, 5).map(a => (
              <button key={a.id} onClick={() => setFilter(a.id)} className={cn("px-1.5 py-0.5 rounded text-[9px]", filter === a.id ? "bg-white/[0.06] text-editor-muted" : "text-editor-muted hover:text-editor-muted")}>{getAgentInitials(a.name)}</button>
            ))}
          </div>
        </div>
        <button onClick={onCreateTask} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium text-white/35 hover:text-editor-ink hover:bg-white/[0.04] transition-colors">
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
                    <span className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider">{col.label}</span>
                    <span className="text-[9px] text-editor-muted ml-1.5">{col.desc}</span>
                  </div>
                  <span className="text-[9px] text-editor-muted">{colTasks.length}</span>
                </div>
                <div className="flex-1 border border-editor-border bg-white/[0.01] p-1.5 space-y-1.5 overflow-y-auto min-h-[100px]">
                  {colTasks.map(task => {
                    const tc = typeConfig(task)
                    const cover = coverImage(task)
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        onClick={() => setDetailTask(task)}
                        className={cn(
                          "rounded-lg border bg-editor-surface border-editor-border cursor-pointer transition-all hover:border-white/10 hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)]",
                          "overflow-hidden",
                          PRIORITY_COLORS[task.priority] || "",
                          task.status === "IN_PROGRESS" && task.assignee && "bg-white/[0.02]",
                          (task as any).dimmed && "opacity-40",
                        )}
                      >
                        {/* Cover */}
                        <div className={cn("h-16 bg-gradient-to-br relative", tc.coverGradient)}>
                          {cover && (
                            <img src={cover} className="w-full h-full object-cover absolute inset-0" alt="" />
                          )}
                          {/* Badges */}
                          <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                            <span className={cn("text-[8px] px-1.5 py-0.5 rounded border font-semibold", tc.color)}>{tc.label}</span>
                            {task.platform && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/30 text-white/60">{task.platform}</span>
                            )}
                          </div>
                          {task.blocked && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-black/40 flex items-center justify-center">
                              <Link className="w-3 h-3 text-destructive/80" />
                            </div>
                          )}
                          {isOverdue(task) && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-black/40 flex items-center justify-center">
                              <AlertTriangle className="w-3 h-3 text-warning/80" />
                            </div>
                          )}
                          {task.status === "IN_REVIEW" && !task.blocked && !isOverdue(task) && (
                            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-info animate-pulse" />
                          )}
                        </div>

                        {/* Body */}
                        <div className="p-2.5">
                          <p className="text-[11px] font-semibold text-editor-ink leading-snug line-clamp-2 mb-1.5">{task.title}</p>

                          {/* Description preview */}
                          {task.description && (
                            <p className="text-[9px] text-editor-muted/60 leading-relaxed line-clamp-2 mb-2">{task.description}</p>
                          )}

                          {/* Deliverable thumbnail */}
                          {task.output?.deliverableImage && (
                            <div className="mb-2 rounded overflow-hidden border border-editor-border">
                              <img src={task.output.deliverableImage} className="w-full h-20 object-cover" alt="Entregavel" />
                            </div>
                          )}

                          {/* Footer */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              {task.assignee ? (
                                <div className="flex items-center gap-1">
                                  <div className={cn("w-4 h-4 rounded flex items-center justify-center text-white text-[6px] font-bold", getAgentGradient(task.assignee.role))}>
                                    {getAgentInitials(task.assignee.name)}
                                  </div>
                                  <span className="text-[9px] text-editor-muted">{task.assignee.name.split(" ")[0]}</span>
                                </div>
                              ) : (
                                <span className="text-[9px] text-editor-muted/40">Nao atribuido</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {task.comments && task.comments.length > 0 && (
                                <span className="flex items-center gap-0.5 text-[9px] text-editor-muted">
                                  <MessageCircle className="w-2.5 h-2.5" />{task.comments.length}
                                </span>
                              )}
                              {task.output?.deliverableImage && (
                                <Image className="w-2.5 h-2.5 text-editor-muted" />
                              )}
                              {task.dueDate && (
                                <span className={cn("text-[8px]", isOverdue(task) ? "text-warning/80" : "text-editor-muted")}>
                                  {new Date(task.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                  {colTasks.length === 0 && (
                    <div className="flex items-center justify-center h-12 text-white/[0.02] text-[10px]">Vazio</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Task Detail Modal (Trello-style) ── */}
      <AnimatePresence>
        {detailTask && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
            <div className="absolute inset-0 bg-black/60" onClick={() => setDetailTask(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-editor-panel border border-editor-border rounded-lg max-w-xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Cover image/color */}
              <div className={cn("h-32 bg-gradient-to-br relative flex-shrink-0", typeConfig(detailTask).coverGradient)}>
                {coverImage(detailTask) && (
                  <img src={coverImage(detailTask)!} className="w-full h-full object-cover absolute inset-0" alt="" />
                )}
                <button onClick={() => setDetailTask(null)} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-colors z-10">
                  <X className="w-4 h-4" />
                </button>
                {/* Title overlay */}
                <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-black/60 to-transparent">
                  <h2 className="text-lg font-bold text-white leading-tight">{detailTask.title}</h2>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Meta row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[10px] px-2 py-0.5 rounded border font-medium", typeConfig(detailTask).color)}>
                    {typeConfig(detailTask).label}
                  </span>
                  {detailTask.platform && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-editor-surface border border-editor-border text-editor-muted">{detailTask.platform}</span>
                  )}
                  <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium",
                    detailTask.status === "DONE" ? "bg-success/10 text-success border border-success/20" :
                    detailTask.status === "IN_PROGRESS" ? "bg-primary/10 text-primary border border-primary/20" :
                    detailTask.status === "IN_REVIEW" ? "bg-info/10 text-info border border-info/20" :
                    "bg-editor-surface border border-editor-border text-editor-muted"
                  )}>
                    {COLUMNS.find(c => c.id === detailTask.status)?.label || detailTask.status}
                  </span>
                  {detailTask.priority && detailTask.priority !== "MEDIUM" && (
                    <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium",
                      detailTask.priority === "CRITICAL" ? "bg-destructive/10 text-destructive border border-destructive/20" :
                      "bg-warning/10 text-warning border border-warning/20"
                    )}>{detailTask.priority}</span>
                  )}
                </div>

                {/* Assignee + Due date */}
                <div className="flex items-center gap-6">
                  {detailTask.assignee ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-editor-muted uppercase tracking-wider">Responsavel</span>
                      <div className="flex items-center gap-1.5">
                        <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white text-[8px] font-bold", getAgentGradient(detailTask.assignee.role))}>
                          {getAgentInitials(detailTask.assignee.name)}
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-editor-ink">{detailTask.assignee.name}</p>
                          <p className="text-[9px] text-editor-muted">{getRoleLabel(detailTask.assignee.role)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-editor-muted uppercase tracking-wider">Responsavel</span>
                      <span className="text-[11px] text-editor-muted/40">Nao atribuido</span>
                    </div>
                  )}
                  {detailTask.dueDate && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-editor-muted uppercase tracking-wider">Prazo</span>
                      <span className={cn("text-[11px] font-medium flex items-center gap-1", isOverdue(detailTask) ? "text-warning" : "text-editor-ink")}>
                        <Calendar className="w-3 h-3" />
                        {new Date(detailTask.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                        {isOverdue(detailTask) && <span className="text-[10px] text-warning/60">(Atrasado)</span>}
                      </span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {detailTask.description && (
                  <div>
                    <h3 className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider mb-2">Descricao</h3>
                    <div className="p-3 rounded-lg bg-editor-surface border border-editor-border">
                      <p className="text-xs text-editor-muted/80 leading-relaxed whitespace-pre-wrap">{detailTask.description}</p>
                    </div>
                  </div>
                )}

                {/* Deliverable content */}
                {detailTask.output?.content && (
                  <div>
                    <h3 className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider mb-2">Entregavel</h3>
                    <div className="p-3 rounded-lg bg-editor-surface border border-editor-border">
                      <p className="text-xs text-editor-muted/80 leading-relaxed whitespace-pre-wrap">{detailTask.output.content}</p>
                    </div>
                  </div>
                )}

                {/* Deliverable image */}
                {detailTask.output?.deliverableImage && (
                  <div>
                    <h3 className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider mb-2">
                      <span className="flex items-center gap-1.5"><Image className="w-3 h-3" />Imagem do Entregavel</span>
                    </h3>
                    <div className="rounded-lg overflow-hidden border border-editor-border">
                      <img src={detailTask.output.deliverableImage} className="w-full object-contain max-h-64 bg-editor-surface" alt="Entregavel" />
                    </div>
                    {detailTask.output.imageDescription && (
                      <p className="text-[10px] text-editor-muted/60 mt-1.5 italic">{detailTask.output.imageDescription}</p>
                    )}
                  </div>
                )}

                {/* Blocked */}
                {detailTask.blocked && (
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                    <p className="text-[10px] font-semibold text-destructive/70 flex items-center gap-1.5 mb-1">
                      <Link className="w-3 h-3" />Bloqueado
                    </p>
                    {detailTask.blockedReason && <p className="text-[10px] text-destructive/50">{detailTask.blockedReason}</p>}
                  </div>
                )}

                {/* Comments / Chat */}
                <div>
                  <h3 className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="w-3 h-3" />
                      Comentarios {detailTask.comments ? `(${detailTask.comments.length})` : ""}
                    </span>
                  </h3>
                  {detailTask.comments && detailTask.comments.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {detailTask.comments.map((c, i) => (
                        <div key={i} className="flex gap-2">
                          <div className="w-6 h-6 rounded bg-editor-surface border border-editor-border flex items-center justify-center text-white text-[7px] font-bold flex-shrink-0 mt-0.5">
                            {c.author[0]}
                          </div>
                          <div>
                            <span className="text-[10px] font-medium text-editor-ink">{c.author}</span>
                            <span className="text-[9px] text-editor-muted ml-2">{c.time}</span>
                            <p className="text-[11px] text-editor-muted/70 mt-0.5">{c.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-editor-muted/40 mb-3">Nenhum comentario ainda.</p>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={commentInput}
                      onChange={e => setCommentInput(e.target.value)}
                      placeholder="Adicionar comentario..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-editor-surface border border-editor-border text-xs text-editor-ink placeholder:text-editor-muted/30 focus:outline-none focus:border-primary/30"
                      onKeyDown={e => {
                        if (e.key === "Enter" && commentInput.trim()) {
                          const task = detailTask
                          if (task.comments) {
                            task.comments.push({ author: "Voce", text: commentInput.trim(), time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) })
                          } else {
                            task.comments = [{ author: "Voce", text: commentInput.trim(), time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) }]
                          }
                          setDetailTask({ ...task })
                          setCommentInput("")
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (!commentInput.trim()) return
                        const task = detailTask
                        if (task.comments) {
                          task.comments.push({ author: "Voce", text: commentInput.trim(), time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) })
                        } else {
                          task.comments = [{ author: "Voce", text: commentInput.trim(), time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) }]
                        }
                        setDetailTask({ ...task })
                        setCommentInput("")
                      }}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
                    >
                      Enviar
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 pt-2 border-t border-editor-border">
                  {COLUMNS.filter(c => c.id !== detailTask.status).slice(0, 4).map(c => (
                    <button key={c.id} onClick={() => { onMoveTask?.(detailTask.id, c.id); setDetailTask(null) }}
                      className="flex-1 py-2 rounded-lg text-[10px] font-medium bg-white/[0.03] hover:bg-white/[0.06] text-editor-muted hover:text-editor-ink transition-colors">
                      Mover p/ {c.label}
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
