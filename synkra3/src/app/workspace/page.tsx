"use client"

import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/lib/auth/useAuth"

export default function WorkspaceRouter() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations")
      return res.json()
    },
    enabled: !!user,
  })

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-editor-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-xl border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  if (!user) { router.push("/login"); return null }
  if (orgs?.length > 0) { router.push(`/workspace/${orgs[0].id}`); return null }
  router.push("/onboarding")
  return null
}
