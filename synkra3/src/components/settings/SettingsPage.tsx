"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface SettingsData {
  dailyTime: string
  weeklyDay: string
  weeklyTime: string
  workflowMethod: string
  timezone: string
  brandVoice: string
}

type Tab = "company" | "routines" | "identity" | "integrations" | "billing" | "notifications"

export function SettingsPage({
  orgId, settings, onSave,
}: {
  orgId: string
  settings?: SettingsData
  onSave?: (data: Partial<SettingsData>) => void
}) {
  const [activeTab, setActiveTab] = useState<Tab>("company")
  const [dailyTime, setDailyTime] = useState(settings?.dailyTime || "09:00")
  const [weeklyDay, setWeeklyDay] = useState(settings?.weeklyDay || "monday")
  const [weeklyTime, setWeeklyTime] = useState(settings?.weeklyTime || "10:00")
  const [workflow, setWorkflow] = useState(settings?.workflowMethod || "KANBAN")

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "company", label: "Perfil da Empresa", icon: "👤" },
    { id: "routines", label: "Rotinas e Horários", icon: "⏰" },
    { id: "identity", label: "Identidade Visual", icon: "🎨" },
    { id: "integrations", label: "Integrações", icon: "🔗" },
    { id: "billing", label: "Plano e Faturamento", icon: "💳" },
    { id: "notifications", label: "Notificações", icon: "🔔" },
  ]

  const handleSaveRoutines = async () => {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, dailyTime, weeklyDay, weeklyTime, workflowMethod: workflow }),
      })
      toast.success("Rotinas salvas!")
      onSave?.({ dailyTime, weeklyDay, weeklyTime, workflowMethod: workflow })
    } catch { toast.error("Erro ao salvar") }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#F8F8F8]">
      <div className="max-w-3xl mx-auto p-6">
        <h2 className="font-bold text-xl text-[#1D1C1D] mb-6 flex items-center gap-2">⚙️ Configurações</h2>

        <div className="flex gap-6">
          {/* Tabs sidebar */}
          <div className="w-48 flex-shrink-0 space-y-0.5">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2",
                  activeTab === tab.id ? "bg-[#7C3AED] text-white font-bold" : "text-[#616061] hover:bg-white hover:text-[#1D1C1D]"
                )}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            {/* Company */}
            {activeTab === "company" && (
              <Card className="p-6">
                <h3 className="font-bold text-lg text-[#1D1C1D] mb-4">Perfil da Empresa</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#616061] block mb-1">Nome da empresa</label>
                    <input className="w-full rounded-lg border border-[#DDDDDD] px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#7C3AED] focus:outline-none" defaultValue="Minha Agência" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#616061] block mb-1">Website</label>
                    <input className="w-full rounded-lg border border-[#DDDDDD] px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#7C3AED] focus:outline-none" placeholder="https://seusite.com" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#616061] block mb-1">Descrição</label>
                    <textarea className="w-full rounded-lg border border-[#DDDDDD] px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#7C3AED] focus:outline-none h-20 resize-none" placeholder="Breve descrição da sua empresa..." />
                  </div>
                  <Button size="sm">Salvar</Button>
                </div>
              </Card>
            )}

            {/* Routines */}
            {activeTab === "routines" && (
              <Card className="p-6">
                <h3 className="font-bold text-lg text-[#1D1C1D] mb-4">⏰ Rotinas da Agência</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#616061] font-bold">Daily</span>
                    <select className="border border-[#DDDDDD] rounded-lg px-3 py-1.5 text-sm bg-white" value={dailyTime} onChange={e => setDailyTime(e.target.value)}>
                      {["07:00","08:00","09:00","10:00","11:00"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#616061] font-bold">Weekly</span>
                    <div className="flex items-center gap-2">
                      <select className="border border-[#DDDDDD] rounded-lg px-3 py-1.5 text-sm bg-white" value={weeklyDay} onChange={e => setWeeklyDay(e.target.value)}>
                        {[{v:"monday",l:"Segunda"},{v:"tuesday",l:"Terça"},{v:"wednesday",l:"Quarta"},{v:"thursday",l:"Quinta"},{v:"friday",l:"Sexta"}].map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
                      </select>
                      <span className="text-sm text-[#CFC3CF]">às</span>
                      <select className="border border-[#DDDDDD] rounded-lg px-3 py-1.5 text-sm bg-white" value={weeklyTime} onChange={e => setWeeklyTime(e.target.value)}>
                        {["08:00","09:00","10:00","11:00"].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-[#616061] font-bold block mb-2">📋 Modo de trabalho</span>
                    <div className="space-y-2">
                      {[{v:"KANBAN",l:"Kanban — fluxo contínuo"},{v:"SPRINTS_1",l:"Sprint — 1 semana"},{v:"SPRINTS_2",l:"Sprint — 2 semanas"}].map(m => (
                        <label key={m.v} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-[#F8F8F8]">
                          <input type="radio" name="workflow" className="sr-only" checked={workflow === m.v} onChange={() => setWorkflow(m.v)} />
                          <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", workflow === m.v ? "border-[#7C3AED]" : "border-[#DDDDDD]")}>
                            {workflow === m.v && <div className="w-2 h-2 rounded-full bg-[#7C3AED]" />}
                          </div>
                          <span className="text-sm text-[#616061]">{m.l}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#616061] font-bold">Relatório semanal</span>
                    <select className="border border-[#DDDDDD] rounded-lg px-3 py-1.5 text-sm bg-white">
                      <option>Domingo às 20:00</option>
                      <option>Segunda às 08:00</option>
                    </select>
                  </div>
                  <Button size="sm" onClick={handleSaveRoutines}>Salvar</Button>
                </div>
              </Card>
            )}

            {/* Identity */}
            {activeTab === "identity" && (
              <Card className="p-6">
                <h3 className="font-bold text-lg text-[#1D1C1D] mb-4">🎨 Identidade Visual</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#616061] font-bold">Cor primária</span>
                    <div className="flex items-center gap-2">
                      <input type="color" defaultValue="#7C3AED" className="w-8 h-8 rounded cursor-pointer border-0" />
                      <span className="text-xs text-[#CFC3CF]">#7C3AED</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#616061] font-bold">Cor secundária</span>
                    <div className="flex items-center gap-2">
                      <input type="color" defaultValue="#2563EB" className="w-8 h-8 rounded cursor-pointer border-0" />
                      <span className="text-xs text-[#CFC3CF]">#2563EB</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-[#616061] font-bold block mb-2">Tom de voz</span>
                    {["Formal e profissional","Descontraído e próximo","Jovem e irreverente","Técnico e especialista"].map(tone => (
                      <label key={tone} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-[#F8F8F8]">
                        <input type="radio" name="tone" className="sr-only" defaultChecked={tone === "Descontraído e próximo"} />
                        <div className="w-4 h-4 rounded-full border-2 border-[#DDDDDD] flex items-center justify-center" />
                        <span className="text-sm text-[#616061]">{tone}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-[#CFC3CF]">Os agentes usam essas informações em tudo que criam.</p>
                  <Button size="sm">Salvar</Button>
                </div>
              </Card>
            )}

            {/* Billing */}
            {activeTab === "billing" && (
              <Card className="p-6">
                <h3 className="font-bold text-lg text-[#1D1C1D] mb-4">💳 Plano e Faturamento</h3>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-[#1D1C1D]">Growth · R$197/mês</p>
                      <p className="text-xs text-[#616061]">Próxima cobrança: 15 de Fevereiro</p>
                    </div>
                    <Badge variant="success" className="text-[10px]">Ativo</Badge>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "Posts gerados", current: 67, max: 90 },
                      { label: "Agentes ativos", current: 6, max: 6 },
                      { label: "Redes conectadas", current: 3, max: 4 },
                    ].map(u => (
                      <div key={u.label}>
                        <div className="flex justify-between text-xs text-[#616061] mb-0.5">
                          <span>{u.label}</span><span>{u.current}/{u.max}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#F8F8F8] overflow-hidden">
                          <div className="h-full rounded-full bg-[#7C3AED]" style={{ width: `${(u.current/u.max)*100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { name: "Starter", price: "97", agents: 3, redes: 2, posts: 30 },
                    { name: "Growth", price: "197", agents: 6, redes: 4, posts: 90, current: true },
                    { name: "Agency", price: "397", agents: 10, redes: "Ilimitado", posts: "Ilimitado" },
                  ].map(p => (
                    <div key={p.name} className={cn("p-4 rounded-xl border text-center", (p as any).current ? "border-[#7C3AED] bg-[#7C3AED]/5" : "border-[#DDDDDD]")}>
                      <h4 className="font-bold text-sm">{p.name}</h4>
                      <p className="text-xl font-bold mt-1">R${p.price}<span className="text-xs text-[#616061]">/mês</span></p>
                      <div className="text-[11px] text-[#616061] mt-2 space-y-0.5">
                        <p>{p.agents} agentes</p><p>{p.redes} redes</p><p>{p.posts} posts</p>
                      </div>
                      <button className={cn("mt-3 w-full py-1.5 rounded-lg text-xs font-bold", (p as any).current ? "bg-[#7C3AED] text-white" : "border border-[#DDDDDD] text-[#616061]")}>
                        {(p as any).current ? "Plano atual" : p.price < "197" ? "Downgrade" : "Upgrade"}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Notifications */}
            {activeTab === "notifications" && (
              <Card className="p-6">
                <h3 className="font-bold text-lg text-[#1D1C1D] mb-4">🔔 Notificações</h3>
                <div className="space-y-3">
                  {[
                    { label: "Daily iniciada", desc: "Notificar quando a daily começar" },
                    { label: "Artes para aprovar", desc: "Carlos terminou uma arte" },
                    { label: "Conflitos", desc: "Quando dois agentes discordam" },
                    { label: "Relatório semanal", desc: "Lena publicou o relatório" },
                    { label: "Oportunidades SEO", desc: "Diego encontrou algo" },
                  ].map(n => (
                    <div key={n.label} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-bold text-[#1D1C1D]">{n.label}</p>
                        <p className="text-xs text-[#616061]">{n.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-9 h-5 bg-[#DDDDDD] rounded-full peer-checked:bg-[#7C3AED] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                      </label>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Default for integrations tab */}
            {activeTab === "integrations" && (
              <Card className="p-6 text-center">
                <p className="text-[#616061] text-sm">Acesse a página de Integrações para gerenciar suas conexões.</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Badge({ children, variant, className }: any) {
  const colors: Record<string, string> = { success: "bg-[#059669]/10 text-[#059669]", outline: "border border-[#DDDDDD] text-[#616061]" }
  return <span className={cn("inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-bold", colors[variant] || "", className)}>{children}</span>
}
