"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn, getAgentGradient, getAgentInitials, getRoleLabel, formatDate } from "@/lib/utils"
import { Agent } from "@prisma/client"
import { Plus, X, MessageCircle, Clock, AlertTriangle, Link, Calendar, Image, Paperclip, Eye, GripVertical, AtSign, Trash2, CheckCircle } from "lucide-react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// ───── Types ─────

interface BoardTask {
  id: string; title: string; description?: string; type?: string
  status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"
  priority: string; platform?: string; dueDate?: string; completedAt?: string
  assignee?: Agent; blocked?: boolean; blockedReason?: string; blockedById?: string
  comments?: Array<{ author: string; text: string; time: string }>
  output?: any
  deliveryStatus?: "PENDING" | "APPROVED" | "REJECTED" | "REVISION" | "PUBLISHED" | null
  attachments?: Array<{ id: string; fileName: string; fileUrl: string; fileType: string; fileSize: number }>
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

// ───── Sortable Card ─────

function SortableCard({ task, onOpen }: { task: BoardTask; onOpen: (t: BoardTask) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 1,
    position: "relative" as const,
  }

  const tc = TYPE_CONFIG[task.type || "content"] || TYPE_CONFIG.content
  const cover = task.output?.coverUrl || task.output?.deliverableImage || task.output?.artworkUrl || null
  const isOverdue = task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < new Date()

  const handleClick = () => {
    if (!isDragging) onOpen(task)
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      <div
        onClick={handleClick}
        className={cn(
          "rounded-lg border bg-editor-surface border-editor-border cursor-grab active:cursor-grabbing transition-all hover:border-white/10 hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)]",
          "overflow-hidden group",
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
          {/* Grip indicator */}
          <div className="absolute top-1.5 right-1.5 p-1 rounded bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <GripVertical className="w-3 h-3 text-white/60" />
          </div>
          {/* Badges */}
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
            <span className={cn("text-[8px] px-1.5 py-0.5 rounded border font-semibold", tc.color)}>{tc.label}</span>
            {task.platform && (
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/30 text-white/60">{task.platform}</span>
            )}
          </div>
          {task.blocked && (
            <div className="absolute top-1.5 right-8 w-5 h-5 rounded bg-black/40 flex items-center justify-center">
              <Link className="w-3 h-3 text-destructive/80" />
            </div>
          )}
          {isOverdue && !task.blocked && (
            <div className="absolute top-1.5 right-8 w-5 h-5 rounded bg-black/40 flex items-center justify-center">
              <AlertTriangle className="w-3 h-3 text-warning/80" />
            </div>
          )}
          {task.status === "IN_REVIEW" && !task.blocked && !isOverdue && (
            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-info animate-pulse group-hover:opacity-0" />
          )}
        </div>

        {/* Body */}
        <div className="p-2.5">
          <p className="text-[11px] font-semibold text-editor-ink leading-snug line-clamp-2 mb-1.5">{task.title}</p>

          {task.description && (
            <p className="text-[9px] text-editor-muted/60 leading-relaxed line-clamp-2 mb-2">{task.description}</p>
          )}

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
              {task.attachments && task.attachments.length > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] text-editor-muted">
                  <Paperclip className="w-2.5 h-2.5" />{task.attachments.length}
                </span>
              )}
              {task.dueDate && (
                <span className={cn("text-[8px]", isOverdue ? "text-warning/80" : "text-editor-muted")}>
                  {new Date(task.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ───── Column ─────

function Column({ column, tasks, onOpen }: { column: typeof COLUMNS[0]; tasks: BoardTask[]; onOpen: (t: BoardTask) => void }) {
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks])
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: "column", column: column.id } })

  return (
    <div ref={setNodeRef} className={cn("flex flex-col min-h-0 transition-colors", isOver && "bg-white/[0.02] rounded-lg")}>
      <div className="flex items-center justify-between mb-1.5 flex-shrink-0 px-1">
        <div>
          <span className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider">{column.label}</span>
          <span className="text-[9px] text-editor-muted ml-1.5">{column.desc}</span>
        </div>
        <span className="text-[9px] text-editor-muted">{tasks.length}</span>
      </div>
      <div className={cn("flex-1 border border-editor-border bg-white/[0.01] p-1.5 space-y-1.5 overflow-y-auto min-h-[100px]", isOver && "border-primary/30 bg-primary/[0.02]")}>
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableCard key={task.id} task={task} onOpen={onOpen} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-12 text-white/[0.02] text-[10px]">{isOver ? "Soltar aqui" : "Vazio"}</div>
        )}
      </div>
    </div>
  )
}

// ───── Main Board ─────

export function KanbanBoard({ tasks, agents, onMoveTask, onCreateTask }: KanbanBoardProps) {
  const [detailTask, setDetailTask] = useState<BoardTask | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [commentInput, setCommentInput] = useState("")
  const [comments, setComments] = useState<Array<{ id: string; text: string; author: string; authorId?: string; time: string }>>([])
  const [commentLoading, setCommentLoading] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionFilter, setMentionFilter] = useState("")
  const [deletingTask, setDeletingTask] = useState<string | null>(null)

  // Carregar comentários ao abrir o card
  const loadComments = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`)
      if (res.ok) setComments(await res.json())
    } catch { setComments([]) }
  }

  // Postar comentário
  const postComment = async () => {
    if (!commentInput.trim() || !detailTask) return
    setCommentLoading(true)
    try {
      const res = await fetch(`/api/tasks/${detailTask.id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentInput.trim(), author: 'CEO', authorId: 'user' })
      })
      if (res.ok) {
        const data = await res.json()
        const userComment = data.comment || data
        setComments(prev => [...prev, userComment])

        // Add agent replies if any
        if (data.agentReplies?.length) {
          setTimeout(() => {
            setComments(prev => [...prev, ...data.agentReplies])
            setDetailTask(prev => prev ? { ...prev, comments: [...(prev.comments||[]), { author: 'CEO', text: commentInput.trim(), time: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) }, ...data.agentReplies.map((r: any) => ({ author: r.author, text: r.text, time: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) }))] } : null)
          }, 800)
        } else {
          setDetailTask(prev => prev ? { ...prev, comments: [...(prev.comments||[]), { author: 'CEO', text: commentInput.trim(), time: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) }] } : null)
        }
        setCommentInput("")
      }
    } catch {} finally { setCommentLoading(false) }
  }

  // Renderizar texto com @mentions coloridos
  const renderMentionText = (text: string, _agents: Agent[]) => {
    return text.split(/(@\w+)/g).map((part, i) => {
      if (part.startsWith('@')) {
        const name = part.substring(1)
        const agent = agents.find(a => a.name.toLowerCase().startsWith(name.toLowerCase()))
        return <span key={i} className="text-primary font-semibold">{part}</span>
      }
      return <span key={i}>{part}</span>
    })
  }

  // Abrir card
  const openTask = (t: BoardTask) => {
    setDetailTask(t)
    setComments((t.output as any)?.comments || [])
    loadComments(t.id)
    setCommentInput("")
  }
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null)
  const [dailyLimitShown, setDailyLimitShown] = useState(false)

  // Check for 10 daily deliveries
  useEffect(() => {
    if (dailyLimitShown) return
    const today = new Date().toISOString().slice(0, 10)
    const storageKey = `kanban_daily_limit_${today}`
    if (localStorage.getItem(storageKey)) return

    const todayDone = tasks.filter(t => {
      if (t.status !== "DONE") return false
      if (t.completedAt) {
        return t.completedAt.slice(0, 10) === today
      }
      return false
    })

    if (todayDone.length >= 10) {
      setDailyLimitShown(true)
      localStorage.setItem(storageKey, "1")
    }
  }, [tasks, dailyLimitShown])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const getColTasks = (col: string) => {
    let filtered = tasks.filter(t => t.status === col)
    if (filter) filtered = filtered.map(t => ({
      ...t, dimmed: !(t.assignee?.id === filter || !t.assignee),
    }))
    return filtered
  }

  const findColumnOfTask = (taskId: string): string | null => {
    const task = tasks.find(t => t.id === taskId)
    return task?.status ?? null
  }

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const activeCol = findColumnOfTask(activeId)
    if (!activeCol) return

    // If dropped on a task card, move to that card's column
    const overTask = tasks.find(t => t.id === overId)
    if (overTask && overTask.status !== activeCol) {
      onMoveTask?.(activeId, overTask.status)
      return
    }

    // If dropped on a column droppable
    const overCol = COLUMNS.find(c => c.id === overId)
    if (overCol && overCol.id !== activeCol) {
      onMoveTask?.(activeId, overCol.id)
    }
  }

  const isOverdue = (task: BoardTask) => {
    if (!task.dueDate || task.status === "DONE") return false
    return new Date(task.dueDate) < new Date()
  }

  const coverImage = (task: BoardTask) => task.output?.coverUrl || task.output?.deliverableImage || task.output?.artworkUrl || null
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

      {/* Board with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto p-3">
          <div className="grid grid-cols-5 gap-2.5 min-w-[900px] h-full">
            {COLUMNS.map(col => (
              <Column
                key={col.id}
                column={col}
                tasks={getColTasks(col.id)}
                onOpen={openTask}
              />
            ))}
          </div>
        </div>

        {/* Drag overlay: shows the card being dragged */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className="rotate-2 scale-105 opacity-90">
              <DraggedCardPreview task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Detail Modal */}
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
              <div className={cn("h-32 bg-gradient-to-br relative flex-shrink-0", typeConfig(detailTask).coverGradient)}>
                {coverImage(detailTask) && (
                  <img src={coverImage(detailTask)!} className="w-full h-full object-cover absolute inset-0" alt="" />
                )}
                <button onClick={() => setDetailTask(null)} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-colors z-10">
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    const task = detailTask
                    setDetailTask(null)
                    try { await fetch(`/api/tasks`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id }) }) } catch {}
                    setDeletingTask(task.id)
                    setTimeout(() => setDeletingTask(null), 300)
                  }}
                  className="absolute top-3 right-12 p-1.5 rounded-full bg-black/40 hover:bg-red-500/60 text-white/60 hover:text-white transition-colors z-10"
                  title="Deletar card"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
                  <img src={detailTask.output.deliverableImage} className="w-full object-contain max-h-64 bg-editor-surface" alt="Entregavel" />
                )}
                {detailTask.output?.artworkUrl && !detailTask.output?.deliverableImage && (
                  <img src={detailTask.output.artworkUrl} className="w-full object-contain max-h-80 bg-editor-surface rounded-lg" alt="Arte" />
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

                {/* Comments with @mentions */}
                <div>
                  <h3 className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="w-3 h-3" />
                      Comentarios {comments.length > 0 ? `(${comments.length})` : ""}
                    </span>
                  </h3>
                  {comments.length > 0 ? (
                    <div className="space-y-3 mb-3 max-h-40 overflow-y-auto">
                      {comments.map((c) => {
                        const isMention = c.text.includes('@')
                        const mentionedAgent = isMention ? agents.find(a => c.text.toLowerCase().includes('@'+a.name.split(' ')[0].toLowerCase())) : null
                        return (
                        <div key={c.id} className="flex gap-2.5 group">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 mt-0.5"
                            style={{ background: mentionedAgent ? 'linear-gradient(135deg, #DEDBC8, #e05c2a)' : 'linear-gradient(135deg, #3b3b3b, #1a1a1a)' }}>
                            {c.author[0]}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-white/80">{c.author}</span>
                              <span className="text-[8px] text-white/25">{new Date(c.time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
                            </div>
                            <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">{renderMentionText(c.text, agents)}</p>
                          </div>
                        </div>
                      )})}
                    </div>
                  ) : (
                    <p className="text-[10px] text-white/20 mb-3">Nenhum comentario ainda.</p>
                  )}
                  <div className="flex gap-2 relative">
                    <input
                      value={commentInput}
                      onChange={e => {
                        setCommentInput(e.target.value)
                        const cursor = e.target.value.lastIndexOf('@')
                        if (cursor >= 0 && cursor === e.target.value.length - 1) {
                          setMentionOpen(true)
                          setMentionFilter('')
                        } else if (cursor >= 0) {
                          const filter = e.target.value.substring(cursor + 1).toLowerCase()
                          if (!filter.includes(' ')) {
                            setMentionOpen(true)
                            setMentionFilter(filter)
                          } else {
                            setMentionOpen(false)
                          }
                        } else {
                          setMentionOpen(false)
                        }
                      }}
                      placeholder="Comente ou use @ para mencionar um agente..."
                      className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-white placeholder:text-white/15 focus:outline-none focus:border-white/[0.15] focus:bg-white/[0.05] transition-colors"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment() }
                        if (e.key === 'Escape') setMentionOpen(false)
                      }}
                    />
                    {mentionOpen && (
                      <div className="absolute bottom-full left-0 mb-1 w-48 bg-editor-panel border border-white/[0.08] rounded-lg shadow-xl overflow-hidden z-50">
                        {agents.filter(a => !mentionFilter || a.name.toLowerCase().includes(mentionFilter)).slice(0,5).map(a => (
                          <button key={a.id} onClick={() => {
                            const atPos = commentInput.lastIndexOf('@')
                            const newText = commentInput.substring(0, atPos) + '@' + a.name.split(' ')[0] + ' '
                            setCommentInput(newText)
                            setMentionOpen(false)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] text-left transition-colors">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[7px] font-bold" style={{background:getAgentGradient(a.role)}}>
                              {getAgentInitials(a.name)}
                            </div>
                            <span className="text-[11px] text-white/70">{a.name.split(' ')[0]}</span>
                            <span className="text-[9px] text-white/30 ml-auto">{getRoleLabel(a.role)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={postComment} disabled={!commentInput.trim() || commentLoading}
                      className="px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 disabled:opacity-30 text-primary text-xs font-semibold transition-colors">
                      {commentLoading ? '...' : 'Enviar'}
                    </button>
                  </div>
                </div>

                {/* Review feedback — visible when task is back in IN_PROGRESS */}
                {detailTask.status === "IN_PROGRESS" && (detailTask.output as any)?.reviewFeedback && (
                  <div>
                    <h3 className="text-[10px] font-semibold text-amber-400/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" />Feedback do Revisor
                    </h3>
                    <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-amber-300/70 leading-relaxed">
                        {(detailTask.output as any).reviewFeedback}
                      </p>
                      <p className="text-[8px] text-white/20 mt-1">
                        — {(detailTask.output as any).lastReviewer || "Maya"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Delivery / Review — Aprovação */}
                {(detailTask.status === "DONE" || detailTask.status === "IN_REVIEW") && (
                  <div>
                    <h3 className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3" />
                      {detailTask.status === "IN_REVIEW" ? "Revisão" : "Entrega"}
                    </h3>
                    <div className="space-y-2">
                      {/* Status badge */}
                      <div className="flex items-center gap-2">
                        {detailTask.status === "IN_REVIEW" ? (
                          <span className="text-[9px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/30">
                            Em Revisão
                          </span>
                        ) : (
                          <span className={cn(
                            "text-[9px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider",
                            detailTask.deliveryStatus === "APPROVED" ? "bg-green-500/15 text-green-400 border border-green-500/30" :
                            detailTask.deliveryStatus === "REJECTED" ? "bg-red-500/15 text-red-400 border border-red-500/30" :
                            detailTask.deliveryStatus === "REVISION" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" :
                            "bg-white/[0.04] text-white/40 border border-white/[0.06]"
                          )}>
                            {detailTask.deliveryStatus === "APPROVED" ? "✓ Aprovado" :
                             detailTask.deliveryStatus === "REJECTED" ? "✕ Reprovado" :
                             detailTask.deliveryStatus === "REVISION" ? "⟳ Em Revisão" : "⏳ Aguardando"}
                          </span>
                        )}
                      </div>

                      {/* Review history */}
                      {detailTask.status === "IN_REVIEW" && (detailTask.output as any)?.reviewHistory && (
                        <div className="space-y-1.5">
                          <span className="text-[9px] text-white/20 uppercase tracking-wider">Histórico de revisão</span>
                          {((detailTask.output as any).reviewHistory as any[] || []).map((h: any, i: number) => (
                            <div key={i} className={cn(
                              "text-[10px] px-2.5 py-1.5 rounded-lg border",
                              h.status === "approved" ? "bg-green-500/5 border-green-500/15" :
                              h.status === "rejected" ? "bg-red-500/5 border-red-500/15" :
                              "bg-amber-500/5 border-amber-500/15"
                            )}>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="font-semibold text-white/60">{h.reviewedBy}</span>
                                <span className={cn(
                                  "text-[8px]",
                                  h.status === "approved" ? "text-green-400" : h.status === "rejected" ? "text-red-400" : "text-amber-400"
                                )}>
                                  {h.status === "approved" ? "✓" : h.status === "rejected" ? "✕" : "⟳"}
                                </span>
                              </div>
                              <p className="text-white/40 leading-relaxed">{h.feedback}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Delivery metadata specs */}
                      {(detailTask.output as any)?.deliveryMetadata?.platform && (
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          <span className="text-white/30">Plataforma:</span>
                          <span className="text-white/60">{(detailTask.output as any).deliveryMetadata.platform}</span>
                          <span className="text-white/30">Tipo:</span>
                          <span className="text-white/60">{(detailTask.output as any).deliveryMetadata.postType || detailTask.type}</span>
                          {(detailTask.output as any).deliveryMetadata.dimensions && (
                            <>
                              <span className="text-white/30">Dimensões:</span>
                              <span className="text-white/60">{(detailTask.output as any).deliveryMetadata.dimensions.width}×{(detailTask.output as any).deliveryMetadata.dimensions.height}px</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Approve / Reject / Revision buttons */}
                      {(!detailTask.deliveryStatus || detailTask.deliveryStatus === "PENDING") && detailTask.status === "DONE" ? (
                        <div className="flex gap-1.5 pt-1">
                          <button
                            onClick={async () => {
                              try {
                                await fetch("/api/deliveries", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: detailTask.id, deliveryStatus: "APPROVED" }),
                                })
                                const updated = { ...detailTask, deliveryStatus: "APPROVED" as const }
                                setDetailTask(updated)
                              } catch {}
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-[10px] font-semibold text-green-400 transition-colors"
                          >
                            ✓ Aprovar
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await fetch("/api/deliveries", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: detailTask.id, deliveryStatus: "REVISION" }),
                                })
                                const updated = { ...detailTask, deliveryStatus: "REVISION" as const }
                                setDetailTask(updated)
                              } catch {}
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-[10px] font-semibold text-amber-400 transition-colors"
                          >
                            ⟳ Revisão
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await fetch("/api/deliveries", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: detailTask.id, deliveryStatus: "REJECTED" }),
                                })
                                const updated = { ...detailTask, deliveryStatus: "REJECTED" as const }
                                setDetailTask(updated)
                              } catch {}
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-[10px] font-semibold text-red-400 transition-colors"
                          >
                            ✕ Reprovar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              await fetch("/api/deliveries", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: detailTask.id, deliveryStatus: "PENDING" }),
                              })
                              const updated = { ...detailTask, deliveryStatus: "PENDING" as const }
                              setDetailTask(updated)
                            } catch {}
                          }}
                          className="text-[9px] text-white/30 hover:text-white/50 transition-colors"
                        >
                          Desfazer status
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {((detailTask.attachments && detailTask.attachments.length > 0) || detailTask.output?.artworkUrl || detailTask.output?.htmlDocument) && (
                  <div>
                    <h3 className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider mb-2">
                      <span className="flex items-center gap-1.5"><Paperclip className="w-3 h-3" />Anexos</span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {detailTask.attachments && detailTask.attachments.map(att => (
                        <a key={att.id} href={att.fileUrl} target="_blank" rel="noopener"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.15] text-[10px] text-white/60 hover:text-white/80 transition-all">
                          {att.fileType === 'png' ? '🖼️' : '📄'} {att.fileName || (att.fileType === 'png' ? 'Arte (PNG)' : 'Documentação')} ({Math.round(att.fileSize / 1024)}KB)
                        </a>
                      ))}
                      {/* Fallback: output-level attachments (backward compat) */}
                      {detailTask.output?.artworkUrl && !detailTask.attachments?.some(a => a.fileType === 'png') && (
                        <a href={detailTask.output.artworkUrl} target="_blank" rel="noopener"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.15] text-[10px] text-white/60 hover:text-white/80 transition-all">
                          🖼️ Arte (PNG)
                        </a>
                      )}
                      {detailTask.output?.htmlDocument && !detailTask.attachments?.some(a => a.fileType === 'html') && (
                        <button onClick={() => {
                          const blob = new Blob([detailTask.output.htmlDocument], { type: 'text/html' })
                          window.open(URL.createObjectURL(blob), '_blank')
                        }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.15] text-[10px] text-white/60 hover:text-white/80 transition-all cursor-pointer">
                          📄 Documentação
                        </button>
                      )}
                    </div>
                  </div>
                )}

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

      {/* Daily limit popup */}
      <AnimatePresence>
        {dailyLimitShown && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setDailyLimitShown(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative z-10 mx-4 max-w-[380px] w-full rounded-[24px] bg-editor-bg border border-editor-border shadow-[0_0_60px_rgba(0,0,0,0.5)] p-8 text-center"
            >
              <div className="text-5xl mb-5">🎯</div>
              <h2 className="text-lg font-semibold text-editor-ink mb-2">
                Plano de hoje finalizado!
              </h2>
              <p className="text-sm text-editor-muted leading-relaxed mb-6">
                Todas as 10 entregas diarias foram concluidas. Amanha os agentes vao acompanhar as metricas e iniciar uma nova daily.
              </p>
              <button
                onClick={() => setDailyLimitShown(false)}
                className="w-full py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.12] text-sm font-medium text-editor-ink transition-colors"
              >
                Entendi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ───── Drag Overlay Preview ─────

function DraggedCardPreview({ task }: { task: BoardTask }) {
  const tc = TYPE_CONFIG[task.type || "content"] || TYPE_CONFIG.content
  const cover = task.output?.coverUrl || task.output?.deliverableImage || task.output?.artworkUrl || null

  return (
    <div className={cn(
      "rounded-lg border bg-editor-surface border-white/20 shadow-xl w-64",
      "overflow-hidden",
      PRIORITY_COLORS[task.priority] || "",
    )}>
      <div className={cn("h-16 bg-gradient-to-br relative", tc.coverGradient)}>
        {cover && <img src={cover} className="w-full h-full object-cover absolute inset-0" alt="" />}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
          <span className={cn("text-[8px] px-1.5 py-0.5 rounded border font-semibold", tc.color)}>{tc.label}</span>
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-[11px] font-semibold text-editor-ink leading-snug line-clamp-2">{task.title}</p>
      </div>
    </div>
  )
}
