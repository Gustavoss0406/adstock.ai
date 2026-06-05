"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { ChevronRight, Chrome, Github } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("As senhas nao conferem.")
      return
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.")
      return
    }

    setLoading(true)

    try {
      // Create user via API (Supabase Auth + public.User table)
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erro ao criar conta.")
        setLoading(false)
        return
      }

      // Sign in with the newly created account
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        toast.error("Conta criada, mas nao foi possivel fazer login automatico.")
        router.push("/login")
        return
      }

      toast.success("Conta criada!")
      router.push("/onboarding")
    } catch (err: any) {
      setError(err.message || "Erro ao criar conta.")
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: "google" | "github") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) toast.error(error.message)
  }

  return (
    <div className="min-h-screen bg-black text-white flex w-full font-['Inter',sans-serif] selection:bg-zinc-800 selection:text-white">
      <div className="flex w-full min-h-screen">

        {/* Left Panel: Visual/Brand */}
        <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-zinc-900">
          <div className="absolute inset-0 bg-zinc-950 z-0"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E\")" }} />
          <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-zinc-900/20 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-zinc-800/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute inset-0 z-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

          <div className="relative z-10">
            <Link href="/" className="flex items-center gap-3">
              <span className="text-lg font-medium tracking-tighter text-white">ADSTOCK</span>
            </Link>
          </div>

          <div className="relative z-10 max-w-lg">
            <svg className="text-zinc-600 mb-6" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
            </svg>
            <p className="text-xl font-light leading-relaxed text-zinc-300 tracking-tight">
              "Em 3 dias ja tinhamos campanhas rodando. Parece que contratei uma equipe inteira de marketing por uma fracao do custo."
            </p>
            <div className="mt-8 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs text-zinc-400 font-medium">RC</div>
              <div>
                <p className="text-sm font-medium text-white">Rafael Costa</p>
                <p className="text-xs text-zinc-500">Founder, Texarte</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex justify-between items-end text-xs text-zinc-600 font-medium uppercase tracking-widest">
            <span>System Status: Optimal</span>
            <span>© 2025 Adstock</span>
          </div>
        </div>

        {/* Right Panel: Register Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-black relative z-20">
          <div className="absolute top-8 left-8 lg:hidden">
            <Link href="/" className="text-lg font-medium tracking-tighter text-white">ADSTOCK</Link>
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[380px] space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-medium tracking-tight text-white">Crie sua conta</h1>
              <p className="text-sm text-zinc-500 font-normal">Comece a transformar seu marketing com agentes de IA.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-xs font-medium text-zinc-400 block ml-1">Nome</label>
                <input
                  type="text" id="name"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder-zinc-700 shadow-sm"
                  placeholder="Seu nome ou empresa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  style={{"WebkitBoxShadow": "0 0 0 30px #09090b inset", "WebkitTextFillColor": "white"} as React.CSSProperties}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-medium text-zinc-400 block ml-1">Email</label>
                <input
                  type="email" id="email"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder-zinc-700 shadow-sm"
                  placeholder="nome@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  style={{"WebkitBoxShadow": "0 0 0 30px #09090b inset", "WebkitTextFillColor": "white"} as React.CSSProperties}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-medium text-zinc-400 block ml-1">Senha</label>
                <input
                  type="password" id="password"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder-zinc-700 shadow-sm"
                  placeholder="Minimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{"WebkitBoxShadow": "0 0 0 30px #09090b inset", "WebkitTextFillColor": "white"} as React.CSSProperties}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-xs font-medium text-zinc-400 block ml-1">Confirmar senha</label>
                <input
                  type="password" id="confirmPassword"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder-zinc-700 shadow-sm"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{"WebkitBoxShadow": "0 0 0 30px #09090b inset", "WebkitTextFillColor": "white"} as React.CSSProperties}
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full bg-white text-black hover:bg-zinc-200 focus:ring-4 focus:ring-zinc-800 font-medium rounded-lg text-sm px-5 py-3 text-center transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Criando conta...
                  </>
                ) : "Criar conta"}
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-900" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-black px-2 text-zinc-600 tracking-wider">Ou continue com</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleOAuth("google")}
                className="flex items-center justify-center gap-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900 text-white rounded-lg py-2.5 transition-all duration-200 group">
                <Chrome className="w-[18px] h-[18px] text-zinc-400 group-hover:text-white transition-colors" />
                <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">Google</span>
              </button>
              <button
                onClick={() => handleOAuth("github")}
                className="flex items-center justify-center gap-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900 text-white rounded-lg py-2.5 transition-all duration-200 group">
                <Github className="w-[18px] h-[18px] text-zinc-400 group-hover:text-white transition-colors" />
                <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">GitHub</span>
              </button>
            </div>

            <p className="text-center text-xs text-zinc-500 pt-4">
              Ja tem conta?{" "}
              <Link href="/login" className="font-medium text-white hover:underline decoration-zinc-500 underline-offset-4 transition-all">
                Entrar
              </Link>
            </p>
          </motion.div>

          <div className="absolute bottom-8 right-8">
            <a href="#" className="flex items-center gap-2 text-zinc-600 hover:text-zinc-400 transition-colors">
              <span className="text-xs font-medium">Ajuda &amp; Suporte</span>
              <ChevronRight className="w-[14px] h-[14px]" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
