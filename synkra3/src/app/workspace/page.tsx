"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

export default function WorkspaceRouter() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations")
      return res.json()
    },
    enabled: status === "authenticated",
  })

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-pill border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  if (status === "unauthenticated") { router.push("/login"); return null }
  if (orgs?.length > 0) { router.push(`/workspace/${orgs[0].id}`); return null }
  router.push("/onboarding")
  return null
}
