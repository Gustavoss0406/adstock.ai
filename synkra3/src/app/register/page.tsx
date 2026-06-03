"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { ArrowRight, Loader2, CheckCircle2, Eye, EyeOff, AlertCircle } from "lucide-react"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const [focused, setFocused] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Erro ao criar conta."); return }
      setDone(true)
      toast.success("Conta criada!")
      const { signIn } = await import("next-auth/react")
      await signIn("credentials", { email, password, redirect: false })
      setTimeout(() => router.push("/onboarding"), 1500)
    } catch (err: any) { setError(err.message || "Erro ao criar conta.") }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-editor-bg flex">
      <div className="hidden lg:flex w-[38%] relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]"><iframe src="http://localhost:3100" className="w-full h-full border-0 scale-125 pointer-events-none" /></div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-editor-muted text-[11px] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-pill bg-white/20 animate-pulse" />Sua equipe ja esta montando tudo...
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-[360px]">
          <Link href="/" className="inline-block mb-10"><span className="text-xl font-bold text-black tracking-tight">Agency<span className="text-[#000000]">OS</span></span></Link>

          <AnimatePresence mode="wait">
            {done ? (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 150 }} className="w-12 h-12  bg-white/[0.04] flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-6 h-6 text-editor-muted" /></motion.div>
                <h2 className="text-sm font-semibold text-editor-ink mb-1">Conta criada</h2>
                <p className="text-xs text-editor-muted">Preparando seu escritorio...</p>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-lg font-bold text-black mb-6">Crie sua conta</h1>

                {error && (
                  <div className="flex items-start gap-2 p-3  bg-white/[0.03] border border-editor-border mb-4">
                    <AlertCircle className="w-4 h-4 text-[#000000] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-editor-muted">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="relative">
                    <label className={`absolute left-0 transition-all duration-200 pointer-events-none text-xs ${focused === "name" || name ? "-top-4 text-[10px] text-editor-muted" : "top-2 text-editor-muted"}`}>Nome</label>
                    <input type="text" className={`w-full border-0 border-b bg-transparent py-2 text-sm text-editor-ink placeholder-transparent focus:outline-none transition-colors ${focused === "name" ? "border-white/20" : "border-editor-border"}`} value={name} onChange={e => setName(e.target.value)} onFocus={() => setFocused("name")} onBlur={() => setFocused("")} required />
                  </div>
                  <div className="relative">
                    <label className={`absolute left-0 transition-all duration-200 pointer-events-none text-xs ${focused === "email" || email ? "-top-4 text-[10px] text-editor-muted" : "top-2 text-editor-muted"}`}>Email</label>
                    <input type="email" className={`w-full border-0 border-b bg-transparent py-2 text-sm text-editor-ink placeholder-transparent focus:outline-none transition-colors ${focused === "email" ? "border-white/20" : "border-editor-border"}`} value={email} onChange={e => setEmail(e.target.value)} onFocus={() => setFocused("email")} onBlur={() => setFocused("")} required />
                  </div>
                  <div className="relative">
                    <label className={`absolute left-0 transition-all duration-200 pointer-events-none text-xs ${focused === "password" || password ? "-top-4 text-[10px] text-editor-muted" : "top-2 text-editor-muted"}`}>Senha</label>
                    <input type={showPwd ? "text" : "password"} className={`w-full border-0 border-b bg-transparent py-2 pr-8 text-sm text-editor-ink placeholder-transparent focus:outline-none transition-colors ${focused === "password" ? "border-white/20" : "border-editor-border"}`} value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setFocused("password")} onBlur={() => setFocused("")} required minLength={8} />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-0 top-2 text-editor-muted hover:text-editor-muted">{showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>

                  <div className="pt-3">
                    <button type="submit" disabled={loading} className="w-full h-11  bg-[#000000] hover:bg-[#333333] text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                      {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Criando...</> : <>Criar conta <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                </form>

                <p className="text-center text-[11px] text-editor-muted mt-5">
                  Ja tem conta? <Link href="/login" className="text-editor-muted hover:text-editor-ink font-medium">Entrar</Link>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
