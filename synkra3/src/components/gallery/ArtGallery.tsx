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
const STATUS_COLORS: Record<string, string> = { published: "text-[#2bac76]", pending: "text-[#ecb22e]", review: "text-[#2563eb]" }

export function ArtGallery() {
  const [selected, setSelected] = useState<Artwork | null>(null)
  const [filter, setFilter] = useState("all")

  const filtered = filter === "all" ? MOCK_ARTWORKS : MOCK_ARTWORKS.filter(a => a.status === filter)

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0b]">
      <div className="max-w-[1200px] mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-white/70 flex items-center gap-2"><Image className="w-4 h-4" />Galeria de Artes</h2>
          <div className="flex items-center gap-2">
            {["all","published","pending","review"].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1 rounded text-[10px] font-medium transition-colors", filter === f ? "bg-white/[0.06] text-white/60" : "text-white/25 hover:text-white/40")}>
                {f === "all" ? "Todas" : STATUS_ICONS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(art => (
            <motion.div key={art.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} onClick={() => setSelected(art)} className="bg-[#111] border border-white/[0.04] rounded-xl overflow-hidden cursor-pointer group">
              <div className="aspect-square bg-white/[0.02] flex items-center justify-center">
                <Image className="w-8 h-8 text-white/10 group-hover:text-white/20 transition-colors" />
              </div>
              <div className="p-3">
                <h3 className="text-[11px] font-semibold text-white/50 truncate">{art.title}</h3>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-white/20">{art.platform || "sem plataforma"}</span>
                  <span className={cn("text-[9px] font-medium", STATUS_COLORS[art.status])}>{STATUS_ICONS[art.status]}</span>
                </div>
                {art.reach && <p className="text-[9px] text-white/15 mt-1">{art.reach.toLocaleString()} alcance</p>}
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {selected && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/60" onClick={() => setSelected(null)} />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-[#111] border border-white/[0.06] rounded-xl max-w-2xl w-full mx-4 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-white/70">{selected.title}</h3>
                  <button onClick={() => setSelected(null)} className="text-white/20 hover:text-white/40"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5">
                  <div className="aspect-video bg-white/[0.02] rounded-lg flex items-center justify-center mb-4">
                    <Image className="w-12 h-12 text-white/10" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-white/20">Criado por</span><p className="text-white/50 font-medium">{selected.createdBy}</p></div>
                    <div><span className="text-white/20">Data</span><p className="text-white/50 font-medium">{selected.date}</p></div>
                    <div><span className="text-white/20">Plataforma</span><p className="text-white/50 font-medium">{selected.platform || "-"}</p></div>
                    <div><span className="text-white/20">Status</span><p className={cn("font-medium", STATUS_COLORS[selected.status])}>{STATUS_ICONS[selected.status]}</p></div>
                  </div>
                  {selected.reach && (
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/[0.04] text-xs">
                      <div><span className="text-white/20">Alcance</span><p className="text-white/50 font-medium">{selected.reach.toLocaleString()}</p></div>
                      <div><span className="text-white/20">Engajamento</span><p className="text-white/50 font-medium">{selected.engagement}</p></div>
                    </div>
                  )}
                  {selected.copy && <p className="text-xs text-white/30 italic mt-3 pt-3 border-t border-white/[0.04]">"{selected.copy}"</p>}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
