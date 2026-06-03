"use client"

import { motion } from "framer-motion"
import { cn, getAgentInitials, getAgentGradient } from "@/lib/utils"
import { Agent } from "@prisma/client"
import { Plus } from "lucide-react"

interface SprintTask { id: string; title: string; status: string; priority: string; assignedTo?: string; day?: number }
interface SprintBoardProps {
  tasks: SprintTask[]; agents: Agent[]; sprintName?: string
  startDate?: string; endDate?: string; onCreateTask?: () => void
}

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex"]

export function SprintBoard({ tasks, agents, sprintName, startDate, endDate, onCreateTask }: SprintBoardProps) {
  const completed = tasks.filter(t => t.status === "DONE").length
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0

  return (
    <div className="h-full flex flex-col bg-editor-bg">
      <div className="flex items-center justify-between px-5 py-3 border-b border-editor-border flex-shrink-0">
        <div>
          <h2 className="text-xs font-bold text-editor-muted">{sprintName || "Sprint Atual"}</h2>
          {startDate && <p className="text-[9px] text-editor-muted mt-0.5">{startDate} → {endDate || "..."}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="h-1 w-28 rounded-full bg-white/[0.04] overflow-hidden">
              <motion.div className="h-full rounded-full bg-white/25" initial={{ width: 0 }} animate={{ width: `${pct}%` }} />
            </div>
            <p className="text-[9px] text-editor-muted mt-0.5">{completed}/{tasks.length} · {pct}%</p>
          </div>
          <button onClick={onCreateTask} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium text-white/35 hover:text-editor-ink hover:bg-white/[0.04] transition-colors">
            <Plus className="w-3 h-3" />Tarefa
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-5 gap-3 h-full">
          {DAYS.map((day, di) => {
            const dayTasks = tasks.filter(t => (t.day || 0) === di || (t.day === undefined && di === 0))
            return (
              <div key={day} className="flex flex-col min-h-0">
                <div className="text-center pb-2 mb-2 border-b border-editor-border flex-shrink-0">
                  <p className="text-[10px] font-semibold text-editor-muted uppercase tracking-wider">{day}</p>
                  <p className="text-[9px] text-editor-muted">{dayTasks.length}</p>
                </div>
                <div className="flex-1  border border-editor-border bg-white/[0.01] p-2 space-y-1.5 overflow-y-auto">
                  {dayTasks.map(task => (
                    <motion.div key={task.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-2  border border-editor-border bg-editor-surface",
                        task.priority === "CRITICAL" && "border-l-2 border-l-[#000000]"
                      )}
                    >
                      <p className="text-[11px] text-editor-muted truncate">{task.title}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className={cn("text-[8px]", task.priority === "CRITICAL" ? "text-[#000000]/60" : task.priority === "HIGH" ? "text-[#000000]/60" : "text-editor-muted")}>{task.priority}</span>
                        {task.assignedTo && (
                          <div className="flex -space-x-1">
                            {agents.filter(a => a.id === task.assignedTo).slice(0, 1).map(a => (
                              <div key={a.id} className={cn("w-4 h-4 rounded flex items-center justify-center text-white text-[6px] font-bold border border-[#0a0a0b]", getAgentGradient(a.role))}>{getAgentInitials(a.name)}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {dayTasks.length === 0 && <div className="h-10 flex items-center justify-center text-white/[0.02] text-[10px]">-</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
