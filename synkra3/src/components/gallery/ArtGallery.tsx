"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Image, Download, Calendar, User, BarChart3, X, Search } from "lucide-react"

interface Artwork {
  id: string; title: string; imageUrl?: string; platform?: string
  status: "published" | "pending" | "review"; reach?: number; engagement?: number
  createdBy: string; date: string; copy?: string
}

const MOCK_ARTWORKS: Artwork[] = [
  { id: "1", title: "Post Dia das Maes", platform: "instagram", status: "published", reach: 4240, engagement: 387, createdBy: "Carlos Lima", date: "2025-05-10", copy: "Neste dia especial, celebramos quem nos inspira..." },
  { id: "2", title: "Post Produto X", platform: "instagram", status: "published", reach: 3100, engagement: 245, createdBy: "Maya Ferreira", date: "2025-05-08", copy: "Conheca o lancamento que vai transformar..." },
  { id: "3", title: "Tutorial Stories", platform: "instagram", status: "published", reach: 2800, engagement: 198, createdBy: "Bruno Costa", date: "2025-05-07" },
  { id: "4", title: "LinkedIn Article", platform: "linkedin", status: "review", createdBy: "Maya Ferreira", date: "2025-05-12" },
  { id: "5", title: "Email Campaign", platform: "email", status: "pending", createdBy: "Maya Ferreira", date: "2025-05-15" },
  { id: "6", title: "Pinterest Pin", platform: "pinterest", status: "published", reach: 1500, engagement: 89, createdBy: "Carlos Lima", date: "2025-05-06" },
]

const STATUS_ICONS: Record<string, string> = { published: "publicado", pending: "pendente", review: "revisao" }
const STATUS_COLORS: Record<string, string> = { published: "text-success", pending: "text-warning", review: "text-primary" }

export function ArtGallery() {
  const [selected, setSelected] = useState<Artwork | null>(null)
  const [filter, setFilter] = useState("all")

  const filtered = filter === "all" ? MOCK_ARTWORKS : MOCK_ARTWORKS.filter(a => a.status === filter)

  return (
    <div className="h-full overflow-y-auto bg-editor-bg">
      <div className="max-w-[1200px] mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-editor-ink flex items-center gap-2"><Image className="w-4 h-4" />Galeria de Artes</h2>
          <div className="flex items-center gap-2">
            {["all","published","pending","review"].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1 rounded text-[10px] font-medium transition-colors", filter === f ? "bg-white/[0.06] text-editor-ink" : "text-editor-muted hover:text-editor-muted")}>
                {f === "all" ? "Todas" : STATUS_ICONS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(art => (
            <motion.div key={art.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} onClick={() => setSelected(art)} className="bg-editor-surface border border-editor-border  overflow-hidden cursor-pointer group">
              <div className="aspect-square bg-white/[0.02] flex items-center justify-center">
                <Image className="w-8 h-8 text-editor-muted group-hover:text-editor-muted transition-colors" />
              </div>
              <div className="p-3">
                <h3 className="text-[11px] font-semibold text-editor-muted truncate">{art.title}</h3>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-editor-muted">{art.platform || "sem plataforma"}</span>
                  <span className={cn("text-[9px] font-medium", STATUS_COLORS[art.status])}>{STATUS_ICONS[art.status]}</span>
                </div>
                {art.reach && <p className="text-[9px] text-editor-muted mt-1">{art.reach.toLocaleString()} alcance</p>}
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {selected && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/60" onClick={() => setSelected(null)} />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-editor-surface border border-editor-border  max-w-2xl w-full mx-4 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-editor-border">
                  <h3 className="text-sm font-semibold text-editor-ink">{selected.title}</h3>
                  <button onClick={() => setSelected(null)} className="text-editor-muted hover:text-editor-muted"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5">
                  <div className="aspect-video bg-white/[0.02]  flex items-center justify-center mb-4">
                    <Image className="w-12 h-12 text-editor-muted" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-editor-muted">Criado por</span><p className="text-editor-muted font-medium">{selected.createdBy}</p></div>
                    <div><span className="text-editor-muted">Data</span><p className="text-editor-muted font-medium">{selected.date}</p></div>
                    <div><span className="text-editor-muted">Plataforma</span><p className="text-editor-muted font-medium">{selected.platform || "-"}</p></div>
                    <div><span className="text-editor-muted">Status</span><p className={cn("font-medium", STATUS_COLORS[selected.status])}>{STATUS_ICONS[selected.status]}</p></div>
                  </div>
                  {selected.reach && (
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-editor-border text-xs">
                      <div><span className="text-editor-muted">Alcance</span><p className="text-editor-muted font-medium">{selected.reach.toLocaleString()}</p></div>
                      <div><span className="text-editor-muted">Engajamento</span><p className="text-editor-muted font-medium">{selected.engagement}</p></div>
                    </div>
                  )}
                  {selected.copy && <p className="text-xs text-editor-muted italic mt-3 pt-3 border-t border-editor-border">"{selected.copy}"</p>}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
