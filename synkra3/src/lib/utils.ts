import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ROLE_LABELS: Record<string, string> = {
  STRATEGIST: "Estrategista",
  DESIGNER: "Designer",
  COPYWRITER: "Redator",
  ANALYST: "Analista",
  SOCIAL_MEDIA: "Social Media",
  SEO: "SEO",
  MEDIA_BUYER: "Midia Paga",
  COMMUNITY_MANAGER: "Community Manager",
  CREATIVE_DIRECTOR: "Dir. Criativo",
  TRAFFIC_MANAGER: "Gestor de Trafego",
}

const ROLE_GRADIENTS: Record<string, string> = {
  STRATEGIST: "bg-gradient-to-br from-rose-500 to-rose-700",
  DESIGNER: "bg-gradient-to-br from-violet-500 to-violet-700",
  COPYWRITER: "bg-gradient-to-br from-amber-500 to-amber-700",
  ANALYST: "bg-gradient-to-br from-sky-500 to-sky-700",
  SOCIAL_MEDIA: "bg-gradient-to-br from-pink-500 to-pink-700",
  SEO: "bg-gradient-to-br from-emerald-500 to-emerald-700",
  MEDIA_BUYER: "bg-gradient-to-br from-orange-500 to-orange-700",
  COMMUNITY_MANAGER: "bg-gradient-to-br from-cyan-500 to-cyan-700",
  CREATIVE_DIRECTOR: "bg-gradient-to-br from-purple-500 to-purple-700",
  TRAFFIC_MANAGER: "bg-gradient-to-br from-blue-500 to-blue-700",
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

export function getAgentGradient(role: string): string {
  return ROLE_GRADIENTS[role] ?? "bg-gradient-to-br from-zinc-500 to-zinc-700"
}

export function getAgentInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function formatDate(date: string | Date, format: "relative" | "short" = "short"): string {
  const d = typeof date === "string" ? new Date(date) : date
  if (format === "relative") {
    const now = Date.now()
    const diff = now - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "agora"
    if (mins < 60) return `ha ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `ha ${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `ha ${days}d`
    return d.toLocaleDateString("pt-BR")
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}
