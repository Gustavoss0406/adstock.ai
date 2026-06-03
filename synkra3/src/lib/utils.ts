import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value)
}

export function formatDate(date: Date | string, format?: "short" | "long" | "relative"): string {
  const d = new Date(date)
  if (format === "relative") {
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d atrás`
    if (hours > 0) return `${hours}h atrás`
    if (minutes > 0) return `${minutes}min atrás`
    return "agora"
  }
  if (format === "short") {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  }
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function getAgentInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function getAgentColor(role: string): string {
  // Squarespace: monochrome. Agent differentiation via typography/layout, not color.
  const colors: Record<string, string> = {
    STRATEGIST: "bg-black",
    DESIGNER: "bg-[#333]",
    COPYWRITER: "bg-[#1A1A1A]",
    ANALYST: "bg-[#2A2A2A]",
    SOCIAL_MEDIA: "bg-[#222]",
    SEO: "bg-[#1A1A1A]",
    MEDIA_BUYER: "bg-[#333]",
    COMMUNITY_MANAGER: "bg-[#222]",
    CREATIVE_DIRECTOR: "bg-black",
    TRAFFIC_MANAGER: "bg-[#2A2A2A]",
  }
  return colors[role] || "bg-[#444]"
}

export function getAgentGradient(role: string): string {
  const gradients: Record<string, string> = {
    STRATEGIST: "bg-black",
    DESIGNER: "bg-[#333]",
    COPYWRITER: "bg-[#1A1A1A]",
    ANALYST: "bg-[#2A2A2A]",
    SOCIAL_MEDIA: "bg-[#222]",
    SEO: "bg-[#1A1A1A]",
    MEDIA_BUYER: "bg-[#333]",
    COMMUNITY_MANAGER: "bg-[#222]",
    CREATIVE_DIRECTOR: "bg-black",
    TRAFFIC_MANAGER: "bg-[#2A2A2A]",
  }
  return gradients[role] || "bg-[#444]"
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    STRATEGIST: "Estrategista",
    DESIGNER: "Designer",
    COPYWRITER: "Redator",
    ANALYST: "Analista de Dados",
    SOCIAL_MEDIA: "Social Media",
    SEO: "SEO Specialist",
    MEDIA_BUYER: "Media Buyer",
    COMMUNITY_MANAGER: "Community Manager",
    CREATIVE_DIRECTOR: "Diretor Criativo",
    TRAFFIC_MANAGER: "Gestor de Tráfego",
  }
  return labels[role] || role
}

export function getPersonalityColor(personality: string): string {
  const colors: Record<string, string> = {
    ANALYTICAL: "text-[#1264A3]",
    CREATIVE: "text-[#2BAC76]",
    PRAGMATIC: "text-[#ECB22E]",
    VISIONARY: "text-[#4A154B]",
    DETAILED: "text-[#616061]",
    BOLD: "text-black",
    DIPLOMATIC: "text-[#2BAC76]",
    DISRUPTIVE: "text-[#4A154B]",
  }
  return colors[personality] || "text-ink-muted"
}

export function getPersonalityEmoji(personality: string): string {
  const emojis: Record<string, string> = {
    ANALYTICAL: "🧮",
    CREATIVE: "🎨",
    PRAGMATIC: "🎯",
    VISIONARY: "🔮",
    DETAILED: "🔍",
    BOLD: "🦁",
    DIPLOMATIC: "🤝",
    DISRUPTIVE: "⚡",
  }
  return emojis[personality] || "🤖"
}

export const AVAILABLE_INTEGRATIONS = [
  { id: "instagram", name: "Instagram", icon: "📸", category: "social" },
  { id: "facebook", name: "Facebook", icon: "👤", category: "social" },
  { id: "tiktok", name: "TikTok", icon: "🎵", category: "social" },
  { id: "pinterest", name: "Pinterest", icon: "📌", category: "social" },
  { id: "linkedin", name: "LinkedIn", icon: "💼", category: "social" },
  { id: "twitter", name: "X (Twitter)", icon: "🐦", category: "social" },
  { id: "google_analytics", name: "Google Analytics", icon: "📊", category: "analytics" },
  { id: "google_search_console", name: "Google Search Console", icon: "🔎", category: "analytics" },
  { id: "meta_ads", name: "Meta Ads", icon: "📢", category: "ads" },
  { id: "google_ads", name: "Google Ads", icon: "🎯", category: "ads" },
  { id: "canva", name: "Canva", icon: "🎨", category: "design" },
  { id: "mailchimp", name: "Mailchimp", icon: "📧", category: "email" },
  { id: "hubspot", name: "HubSpot", icon: "🏢", category: "crm" },
  { id: "shopify", name: "Shopify", icon: "🛒", category: "ecommerce" },
] as const

export function getIntegrationIcon(platform: string): string {
  const found = AVAILABLE_INTEGRATIONS.find((i) => i.id === platform)
  return found?.icon || "🔌"
}
