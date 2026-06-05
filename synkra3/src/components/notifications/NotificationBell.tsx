"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn, getAgentGradient, getAgentInitials } from "@/lib/utils"
import { Bell, CheckCircle2, AlertTriangle, BarChart3, Search, X, UserPlus } from "lucide-react"

interface Notification {
  id: string
  type: "approval" | "conflict" | "report" | "seo" | "hire" | "system" | "daily"
  title: string
  description: string
  channel?: string
  time: string
  read: boolean
  agent?: { name: string; role: string; color: string }
}

const TYPE_ICONS: Record<string, string> = {
  approval: "✅",
  conflict: "⚡",
  report: "📊",
  seo: "🔍",
  hire: "👋",
  system: "🤖",
  daily: "📅",
}

const TYPE_COLORS: Record<string, string> = {
  approval: "text-black",
  conflict: "text-black",
  report: "text-black",
  seo: "text-[#DC2626]",
  hire: "text-foreground",
  system: "text-muted-foreground",
  daily: "text-foreground",
}

export function NotificationBell({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Poll for notifications
  useEffect(() => {
    if (!orgId) return
    const load = async () => {
      try {
        const res = await fetch(`/api/events?orgId=${orgId}`)
        if (res.ok) {
          const events = await res.json()
          const mapped: Notification[] = (Array.isArray(events) ? events : []).slice(0, 10).map((e: any, i: number) => ({
            id: e.id || String(i),
            type: e.type?.includes("daily_agent_speaking") ? "daily" : e.type?.includes("daily_starting") ? "daily" : e.type?.includes("daily_completed") ? "daily" : e.type?.includes("heartbeat") ? "system" : e.type?.includes("meeting") ? "report" : e.type?.includes("hired") ? "hire" : "system",
            title: e.title || "",
            description: e.description || "",
            time: e.createdAt || new Date().toISOString(),
            read: i > 2,
          }))
          setNotifications(mapped)
          setUnreadCount(mapped.filter(n => !n.read).length)
        }
      } catch {}
    }
    load()
    const i = setInterval(load, 15000)
    return () => clearInterval(i)
  }, [orgId])

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2  hover:bg-muted transition-colors">
        <Bell className="w-5 h-5 text-[#616061]" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-pill bg-black text-white text-[10px] font-bold flex items-center justify-center"
          >
            {unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 w-96 bg-white  border border-border shadow-2xl z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-bold text-sm text-black">🔔 Notificações</h3>
                <button onClick={markAllRead} className="text-[11px] text-foreground hover:underline font-bold">Marcar todas lidas</button>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma notificação ainda</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={cn("px-4 py-3 hover:bg-muted transition-colors cursor-pointer", !n.read && "bg-[#000000]/3")}>
                      <div className="flex items-start gap-3">
                        <span className="text-lg flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type]}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-black">{n.title}</p>
                          <p className="text-[11px] text-[#616061] truncate">{n.description}</p>
                          {n.channel && <p className="text-[10px] text-foreground font-bold mt-0.5">#{n.channel}</p>}
                        </div>
                        <div className="flex-shrink-0 flex flex-col items-end gap-1">
                          <span className="text-[10px] text-muted-foreground">{n.time ? new Date(n.time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                          {!n.read && <span className="w-2 h-2 rounded-pill bg-[#000000]" />}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-4 py-2 border-t border-border">
                <button className="w-full text-center text-xs text-foreground font-bold hover:underline py-1">Ver todas as notificações</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
