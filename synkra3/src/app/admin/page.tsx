"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface Stats {
  totalUsers: number
  totalOrgs: number
  totalAgents: number
  totalTasks: number
  totalMeetings: number
  totalProjects: number
  recentUsers: { id: string; name: string | null; email: string; createdAt: string }[]
  recentOrgs: { id: string; name: string; createdAt: string; _count: { members: number } }[]
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login")
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (data) setStats(data)
      })
      .catch(() => setError("Erro ao carregar dados"))
  }, [router])

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" })
    router.push("/admin/login")
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">Carregando...</p>
      </div>
    )
  }

  const cards = [
    { label: "Usuarios", value: stats.totalUsers, color: "text-blue-400" },
    { label: "Organizacoes", value: stats.totalOrgs, color: "text-emerald-400" },
    { label: "Agentes", value: stats.totalAgents, color: "text-purple-400" },
    { label: "Tarefas", value: stats.totalTasks, color: "text-amber-400" },
    { label: "Reunioes", value: stats.totalMeetings, color: "text-rose-400" },
    { label: "Projetos", value: stats.totalProjects, color: "text-cyan-400" },
  ]

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 px-8 py-4">
        <div>
          <h1 className="text-lg font-bold text-white">Adstock Admin</h1>
          <p className="text-xs text-zinc-500">Painel administrativo</p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
        >
          Sair
        </button>
      </header>

      <main className="p-8">
        <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <p className="mb-1 text-xs font-medium text-zinc-500">{card.label}</p>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-sm font-semibold text-zinc-400">Usuarios recentes</h2>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              {stats.recentUsers.length === 0 ? (
                <p className="p-6 text-sm text-zinc-500">Nenhum usuario cadastrado</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                      <th className="px-5 py-3 font-medium">Nome</th>
                      <th className="px-5 py-3 font-medium">Email</th>
                      <th className="px-5 py-3 font-medium">Criado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentUsers.map((user) => (
                      <tr key={user.id} className="border-b border-zinc-800/50 last:border-0">
                        <td className="px-5 py-3 text-zinc-300">{user.name || "-"}</td>
                        <td className="px-5 py-3 text-zinc-400">{user.email}</td>
                        <td className="px-5 py-3 text-zinc-500">
                          {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-semibold text-zinc-400">Organizacoes recentes</h2>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              {stats.recentOrgs.length === 0 ? (
                <p className="p-6 text-sm text-zinc-500">Nenhuma organizacao cadastrada</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                      <th className="px-5 py-3 font-medium">Nome</th>
                      <th className="px-5 py-3 font-medium">Membros</th>
                      <th className="px-5 py-3 font-medium">Criada em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentOrgs.map((org) => (
                      <tr key={org.id} className="border-b border-zinc-800/50 last:border-0">
                        <td className="px-5 py-3 font-medium text-zinc-300">{org.name}</td>
                        <td className="px-5 py-3 text-zinc-400">{org._count.members}</td>
                        <td className="px-5 py-3 text-zinc-500">
                          {new Date(org.createdAt).toLocaleDateString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
