"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Link, Unlink, Settings, CheckCircle2, ArrowRight } from "lucide-react"

interface Integration {
  id: string
  platform: string
  name: string
  emoji: string
  connected: boolean
  accountName?: string
  stats?: string
  lastSync?: string
  features: string[]
  color: string
}

const INTEGRATIONS: Integration[] = [
  {
    id: "instagram", platform: "instagram", name: "Instagram", emoji: "📸", connected: false,
    features: ["Publica artes automaticamente", "Métricas de engajamento", "Stories programados"],
    color: "from-pink-500 to-orange-400",
  },
  {
    id: "google_search_console", platform: "google_search_console", name: "Google Search Console", emoji: "🔍", connected: false,
    features: ["Diego analisa seu SEO", "Métricas de busca orgânica", "Oportunidades de keywords"],
    color: "from-blue-500 to-green-400",
  },
  {
    id: "linkedin", platform: "linkedin", name: "LinkedIn", emoji: "💼", connected: false,
    features: ["Posts e análise de alcance", "Artigos profissionais", "Networking B2B"],
    color: "from-blue-600 to-blue-400",
  },
  {
    id: "canva", platform: "canva", name: "Canva", emoji: "🎨", connected: false,
    features: ["Criação de artes automática", "Brand kit integrado", "Templates prontos"],
    color: "from-cyan-400 to-blue-500",
  },
  {
    id: "pinterest", platform: "pinterest", name: "Pinterest", emoji: "📌", connected: false,
    features: ["Posts de imagem automáticos", "Pins ricos para SEO", "Boards organizados"],
    color: "from-red-500 to-red-400",
  },
  {
    id: "google_analytics", platform: "google_analytics", name: "Google Analytics", emoji: "📊", connected: false,
    features: ["Comportamento do site", "Métricas de conversão", "Relatórios de audiência"],
    color: "from-yellow-500 to-orange-400",
  },
  {
    id: "tiktok", platform: "tiktok", name: "TikTok", emoji: "🎵", connected: false,
    features: ["Trend detection", "Agendamento de posts", "Métricas de viralização"],
    color: "from-gray-900 to-gray-700",
  },
  {
    id: "mailchimp", platform: "mailchimp", name: "Mailchimp", emoji: "📧", connected: false,
    features: ["Email marketing automático", "Newsletters programadas", "Segmentação de lista"],
    color: "from-yellow-400 to-yellow-500",
  },
]

export function IntegrationsPage({ orgIntegrations }: { orgIntegrations?: Array<{ platform: string; name: string }> }) {
  const [connecting, setConnecting] = useState<string | null>(null)

  const handleConnect = async (platform: string) => {
    setConnecting(platform)
    // Simulate OAuth flow
    await new Promise(r => setTimeout(r, 2000))
    setConnecting(null)
    // In production: redirect to OAuth URL
    window.open(`/api/integrations/${platform}/auth`, "_blank", "width=600,height=700")
  }

  const merged = INTEGRATIONS.map(int => {
    const orgInt = orgIntegrations?.find(i => i.platform === int.platform)
    return { ...int, connected: !!orgInt, accountName: orgInt?.name || undefined }
  })

  const connected = merged.filter(i => i.connected)
  const available = merged.filter(i => !i.connected)

  return (
    <div className="h-full overflow-y-auto bg-card">
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        <div>
          <h2 className="font-bold text-xl text-black flex items-center gap-2">🔗 Integrações</h2>
          <p className="text-sm text-muted-foreground mt-1">Quanto mais conectado, mais os agentes conseguem fazer por você.</p>
        </div>

        {/* Connected */}
        {connected.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Conectadas</h3>
            <div className="space-y-3">
              {connected.map(int => (
                <motion.div key={int.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="p-5 border-black/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12  bg-gradient-to-br flex items-center justify-center text-2xl", int.color)}>
                          {int.emoji}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-black">{int.name}</h3>
                            <Badge variant="success" className="text-[10px]">Conectado</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{int.accountName || "Conectado"} · {int.stats || "Sincronizado"} · Última sync: agora</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="text-xs"><Settings className="w-3 h-3 mr-1" />Configurar</Button>
                        <Button variant="ghost" size="sm" className="text-xs text-black"><Unlink className="w-3 h-3 mr-1" />Desconectar</Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Available */}
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Disponíveis</h3>
          <div className="space-y-3">
            {available.map(int => (
              <motion.div key={int.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12  bg-card flex items-center justify-center text-2xl">
                        {int.emoji}
                      </div>
                      <div>
                        <h3 className="font-bold text-black">{int.name}</h3>
                        <p className="text-xs text-muted-foreground">{int.features[0]}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="text-xs"
                      onClick={() => handleConnect(int.platform)}
                      disabled={connecting === int.platform}
                    >
                      {connecting === int.platform ? (
                        <><div className="w-3 h-3 rounded-pill border-2 border-white border-t-transparent animate-spin mr-1" /> Conectando...</>
                      ) : (
                        <>Conectar <ArrowRight className="w-3 h-3 ml-1" /></>
                      )}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3 pl-16">
                    {int.features.map((f, i) => (
                      <span key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> {f}
                      </span>
                    ))}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
