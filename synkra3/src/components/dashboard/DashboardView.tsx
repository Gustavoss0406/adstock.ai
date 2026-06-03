"use client"

import { motion } from "framer-motion"
import { cn, getAgentGradient, getAgentInitials } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ArrowUp, ArrowDown, TrendingUp, BarChart3, Search, MessageCircle } from "lucide-react"

interface DashboardData {
  summary: {
    totalPosts: number
    engRate: number
    totalReach: number
    vsLastMonth: number
  }
  reachData: Array<{ date: string; value: number }>
  byNetwork: Array<{ network: string; pct: number; color: string }>
  topPosts: Array<{ title: string; reach: number; agent: string }>
  seo: { clicks: number; impressions: number; ctr: number; position: number }
  lenaAnalysis: { text: string; recommendations: string[] }
  agents: Array<{ name: string; role: string; performance: number; tasks: number; color: string }>
}

export function Dashboard({ data }: { data: DashboardData }) {
  const maxReach = Math.max(...data.reachData.map(d => d.value), 1)

  return (
    <div className="h-full overflow-y-auto bg-[#F8F8F8]">
      <div className="max-w-[1200px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-xl text-black flex items-center gap-2">📊 Dashboard</h2>
          <div className="flex items-center gap-2">
            <select className="text-xs border border-[#DDDDDD]  px-3 py-1.5 bg-white font-bold">
              <option>Janeiro 2025</option>
              <option>Dezembro 2024</option>
            </select>
            <button className="text-xs border border-[#DDDDDD]  px-3 py-1.5 bg-white hover:bg-[#F8F8F8] font-bold">Exportar</button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Posts no mês", value: data.summary.totalPosts, change: "+12%", up: true, icon: "📦" },
            { label: "Eng. Médio", value: `${data.summary.engRate}%`, change: "↓0.3%", up: false, icon: "📈" },
            { label: "Alcance Total", value: `${(data.summary.totalReach / 1000).toFixed(1)}K`, change: "+34%", up: true, icon: "👁️" },
            { label: "vs mês anterior", value: `${data.summary.vsLastMonth > 0 ? "+" : ""}${data.summary.vsLastMonth}%`, change: "", up: data.summary.vsLastMonth > 0, icon: "📊" },
          ].map(kpi => (
            <Card key={kpi.label} className="p-4">
              <div className="flex items-start justify-between mb-1">
                <span className="text-[11px] text-[#616061]">{kpi.label}</span>
                <span className="text-lg">{kpi.icon}</span>
              </div>
              <p className="text-2xl font-bold text-black">{kpi.value}</p>
              {kpi.change && (
                <span className={cn("text-[11px] font-bold", kpi.up ? "text-black" : "text-black")}>{kpi.change}</span>
              )}
            </Card>
          ))}
        </div>

        {/* Reach Chart */}
        <Card className="p-6">
          <h3 className="text-sm font-bold text-black mb-4">📈 Alcance ao longo do mês</h3>
          <div className="flex items-end gap-1 h-32">
            {data.reachData.map((d, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${(d.value / maxReach) * 100}%` }}
                className="flex-1 rounded-sm bg-gradient-to-t from-[#000000] to-[#A78BFA] min-h-[2px] relative group cursor-pointer"
              >
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#1D1C1D] text-white text-[9px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                  {d.date}: {d.value.toLocaleString()}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[9px] text-[#999]">
            {data.reachData.filter((_, i) => i % 7 === 0).map((d, i) => <span key={i}>{d.date}</span>)}
          </div>
        </Card>

        {/* By Network + Top Posts */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="text-sm font-bold text-black mb-3">📱 Por Rede Social</h3>
            <div className="space-y-3">
              {data.byNetwork.map(n => (
                <div key={n.network} className="flex items-center gap-3">
                  <span className="text-sm w-20 text-[#616061]">{n.network}</span>
                  <div className="flex-1 h-5 rounded-pill bg-[#F8F8F8] overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${n.pct}%` }} className="h-full rounded-pill" style={{ backgroundColor: n.color }} />
                  </div>
                  <span className="text-xs font-bold text-[#616061] w-10 text-right">{n.pct}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-bold text-black mb-3">🏆 Top 5 Posts</h3>
            <div className="space-y-2">
              {data.topPosts.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={cn("font-bold w-5", i === 0 ? "text-black" : "text-[#999]")}>#{i + 1}</span>
                  <span className="flex-1 text-[#616061] truncate">{p.title}</span>
                  <span className="text-[#000000] font-bold">{p.reach.toLocaleString()}</span>
                  <span className="text-[#999]">{p.agent}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* SEO Section */}
        <Card className="p-5">
          <h3 className="text-sm font-bold text-black mb-3 flex items-center gap-2"><Search className="w-4 h-4" /> SEO — Google Search Console</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            {[
              { label: "Cliques orgânicos", value: data.seo.clicks.toLocaleString(), change: "↑8%" },
              { label: "Impressões", value: data.seo.impressions.toLocaleString(), change: "↑12%" },
              { label: "CTR médio", value: `${data.seo.ctr}%`, change: "" },
              { label: "Posição média", value: data.seo.position, change: "" },
            ].map(s => (
              <div key={s.label}>
                <p className="text-xl font-bold text-black">{s.value}</p>
                <p className="text-[11px] text-[#616061]">{s.label}</p>
                {s.change && <p className="text-[10px] text-black font-bold">{s.change}</p>}
              </div>
            ))}
          </div>
        </Card>

        {/* Lena Analysis */}
        <Card className="p-5 border-l-4 border-l-black">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br bg-black flex items-center justify-center text-white font-bold text-xs flex-shrink-0">LS</div>
            <div>
              <p className="text-xs font-bold text-black mb-1">🟢 Lena Souza · Análise de Performance</p>
              <p className="text-sm text-[#616061] leading-relaxed mb-2">{data.lenaAnalysis.text}</p>
              {data.lenaAnalysis.recommendations.map((r, i) => (
                <p key={i} className="text-xs text-black font-bold">{i + 1}. {r}</p>
              ))}
              <button className="mt-3 text-xs text-[#000000] font-bold hover:underline">📋 Gerar tarefa baseada nessa análise →</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export const MOCK_DASHBOARD: DashboardData = {
  summary: { totalPosts: 47, engRate: 8.2, totalReach: 12400, vsLastMonth: 23 },
  reachData: Array.from({ length: 30 }, (_, i) => ({ date: `${i + 1}/01`, value: Math.floor(Math.random() * 800 + 200) })),
  byNetwork: [
    { network: "Instagram", pct: 67, color: "#E1306C" },
    { network: "LinkedIn", pct: 18, color: "#0A66C2" },
    { network: "Pinterest", pct: 15, color: "#E60023" },
  ],
  topPosts: [
    { title: "Arte Dia das Mães", reach: 4240, agent: "Carlos" },
    { title: "Post produto X", reach: 3100, agent: "Maya" },
    { title: "Tutorial Stories", reach: 2800, agent: "Bruno" },
    { title: "Behind scenes", reach: 2100, agent: "Carlos" },
    { title: "Copy LinkedIn", reach: 1900, agent: "Maya" },
  ],
  seo: { clicks: 1240, impressions: 18400, ctr: 6.7, position: 14.2 },
  lenaAnalysis: {
    text: "Conteúdo publicado às terças tem engajamento 34% acima da média. Posts de bastidores superam posts de produto em alcance. Recomendo aumentar frequência de terças e reduzir posts de venda de 4x para 2x por semana.",
    recommendations: ["Aumentar posts de bastidores (de 1 para 2/semana)", "Publicar às terças (melhor janela de engajamento)", "Priorizar blog post sobre palavra-chave detectada"],
  },
  agents: [],
}
