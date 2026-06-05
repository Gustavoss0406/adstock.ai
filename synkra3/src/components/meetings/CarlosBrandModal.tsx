"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Trash2, Upload, Check, Paintbrush, Type, ImageIcon } from "lucide-react"
import type { BrandIdentity, FontStyle, TemplateId } from "@/lib/images/template-engine"
import { FONT_PAIRS, TEMPLATE_LABELS } from "@/lib/images/template-engine"

interface Props {
  open: boolean
  userName: string
  orgId: string
  onSave: (brand: BrandIdentity) => void
  onDismiss: () => void
}

const INITIAL_BRAND: BrandIdentity = {
  name: "",
  handle: "@",
  primaryColor: "#6366F1",
  secondaryColor: "#18181B",
  fontFamily: "Inter",
  fontStyle: "luxe",
  colors: ["#6366F1"],
  logo: "",
  logoBase64: null,
  tone: "professional",
}

// Predefined color suggestions
const COLOR_SUGGESTIONS = [
  "#6366F1", "#EC4899", "#10B981", "#F59E0B", "#EF4444",
  "#3B82F6", "#8B5CF6", "#06B6D4", "#84CC16", "#F97316",
  "#1A1A1A", "#FFFFFF",
]

export function CarlosBrandModal({ open, userName, orgId, onSave, onDismiss }: Props) {
  const [brand, setBrand] = useState<BrandIdentity>({ ...INITIAL_BRAND, name: userName || "" })
  const [colorInput, setColorInput] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const addColor = (color: string) => {
    if (brand.colors.length >= 4) return
    if (brand.colors.includes(color)) return
    setBrand(b => ({ ...b, colors: [...b.colors, color] }))
    setColorInput("")
  }

  const removeColor = (idx: number) => {
    if (brand.colors.length <= 1) return
    setBrand(b => ({ ...b, colors: b.colors.filter((_, i) => i !== idx) }))
  }

  const handleFile = (file: File) => {
    if (!file.type.includes("png")) return
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = reader.result as string
      setLogoPreview(b64)
      setBrand(b => ({ ...b, logoBase64: b64 }))
    }
    reader.readAsDataURL(file)
  }

  const handleUrlLogo = () => {
    if (!logoUrl) return
    setLogoPreview(logoUrl)
    setBrand(b => ({ ...b, logoBase64: logoUrl }))
  }

  const handleSave = async () => {
    if (!brand.name || brand.colors.length === 0) return
    setSaved(true)

    // Save to backend
    try {
      await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          metadata: { brandIdentity: brand },
        }),
      })
    } catch {}

    setTimeout(() => onSave(brand), 800)
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] flex items-center justify-center bg-editor-bg/90 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={saved ? { scale: 1.05, opacity: 0 } : { scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="w-full max-w-[480px] bg-editor-surface border border-editor-border rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(255,107,53,0.08)]"
        >
          {/* Carlos header */}
          <div className="flex items-center gap-4 p-6 pb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br bg-black flex items-center justify-center ring-2 ring-black/10 flex-shrink-0">
              <img src="/agents/Carlos.png" className="w-10 h-10  object-cover" alt="Carlos" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-editor-ink">Carlos Lima</span>
                <span className="text-[10px] text-editor-muted">Designer Senior</span>
              </div>
              <p className="text-[12px] text-editor-muted mt-1 leading-relaxed">
                Ei {userName || "CEO"}! Antes de criar suas artes, me conta sua identidade visual. Prometo que vai ficar incrivel! 🎨
              </p>
            </div>
            <button onClick={onDismiss} className="p-1 rounded-lg hover:bg-white/[0.04] text-editor-muted hover:text-editor-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 px-6 pb-2">
            {[
              { num: 1, label: "Cores", icon: Paintbrush },
              { num: 2, label: "Logo", icon: ImageIcon },
              { num: 3, label: "Estilo", icon: Type },
            ].map(s => (
              <button key={s.num} onClick={() => setStep(s.num as 1 | 2 | 3)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] transition-colors ${
                  step === s.num ? "bg-white/[0.06] text-editor-ink" : "text-editor-muted hover:text-editor-muted"
                }`}>
                <s.icon className="w-3 h-3" />
                {s.label}
              </button>
            ))}
          </div>

          <div className="px-6 py-4 space-y-4 max-h-[400px] overflow-y-auto">
            {/* Step 1: Colors */}
            {step === 1 && (
              <div className="space-y-4">
                <label className="text-[11px] font-medium text-editor-muted uppercase tracking-wider">Cores da Marca</label>
                {/* Selected colors */}
                <div className="flex flex-wrap gap-3">
                  {brand.colors.map((c, i) => (
                    <div key={i} className="relative group">
                      <div className="w-14 h-14 rounded-xl border-2 border-editor-border shadow-inner" style={{ backgroundColor: c }} />
                      <span className="block text-center text-[9px] text-editor-muted mt-1">{c}</span>
                      {brand.colors.length > 1 && (
                        <button onClick={() => removeColor(i)}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-pill bg-black/5 border border-black/10 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {brand.colors.length < 4 && (
                    <div className="relative">
                      <input
                        type="text"
                        value={colorInput}
                        onChange={e => setColorInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && colorInput) { addColor(colorInput.startsWith("#") ? colorInput : "#" + colorInput) } }}
                        placeholder="#Hex"
                        className="w-14 h-14 rounded-xl bg-white/[0.02] border border-dashed border-editor-border text-[11px] text-editor-muted text-center focus:outline-none focus:border-editor-border placeholder-white/10"
                        maxLength={7}
                      />
                      <Plus className="w-3 h-3 text-editor-muted absolute inset-0 m-auto pointer-events-none" />
                    </div>
                  )}
                </div>

                {/* Suggestions */}
                <div>
                  <p className="text-[10px] text-editor-muted mb-2">Sugestoes:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_SUGGESTIONS.map(c => (
                      <button key={c} onClick={() => addColor(c)}
                        className="w-7 h-7 rounded-lg border border-editor-border hover:border-editor-border transition-all hover:scale-110"
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Logo */}
            {step === 2 && (
              <div className="space-y-4">
                <label className="text-[11px] font-medium text-editor-muted uppercase tracking-wider">Logo (PNG sem fundo)</label>

                {/* Drag & drop zone */}
                <input type="file" ref={fileRef} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} accept="image/png" className="hidden" />
                <button onClick={() => fileRef.current?.click()}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-editor-border hover:border-editor-border flex flex-col items-center justify-center gap-2 transition-colors">
                  <Upload className="w-5 h-5 text-editor-muted" />
                  <span className="text-[11px] text-editor-muted">Soltar PNG aqui ou clicar para selecionar</span>
                </button>

                {/* Or URL */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={e => setLogoUrl(e.target.value)}
                    placeholder="ou cole a URL da logo..."
                    className="flex-1 px-3 py-2 rounded-xl bg-white/[0.02] border border-editor-border text-[11px] text-editor-muted placeholder-white/10 focus:outline-none focus:border-white/[0.1]"
                  />
                  <button onClick={handleUrlLogo} disabled={!logoUrl}
                    className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] disabled:opacity-20 text-[11px] text-editor-muted transition-colors">
                    Carregar
                  </button>
                </div>

                {/* Preview */}
                {logoPreview && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-editor-border">
                    <img src={logoPreview} className="w-12 h-12  object-contain bg-white/[0.03]" alt="Logo preview" />
                    <div>
                      <p className="text-[11px] text-editor-muted">Preview da logo</p>
                      <p className="text-[10px] text-black">✓ Carregada</p>
                    </div>
                    <button onClick={() => { setLogoPreview(null); setBrand(b => ({ ...b, logoBase64: null })) }}
                      className="ml-auto p-1 rounded hover:bg-white/[0.04] text-editor-muted hover:text-editor-muted">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Font Style */}
            {step === 3 && (
              <div className="space-y-3">
                <label className="text-[11px] font-medium text-editor-muted uppercase tracking-wider">Estilo Visual</label>
                {(Object.entries(FONT_PAIRS) as [FontStyle, typeof FONT_PAIRS[keyof typeof FONT_PAIRS]][]).map(([key, font]) => (
                  <button
                    key={key}
                    onClick={() => setBrand(b => ({ ...b, fontStyle: key }))}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      brand.fontStyle === key
                        ? "border-editor-border bg-white/[0.04]"
                        : "border-editor-border hover:border-editor-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-pill flex items-center justify-center ${brand.fontStyle === key ? "bg-black/5" : "bg-white/[0.03]"}`}>
                        {brand.fontStyle === key && <Check className="w-3 h-3 text-black" />}
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-editor-ink">{font.label}</p>
                        <p className="text-[11px] text-editor-muted">{font.preview}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bottom buttons */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-editor-border">
            <button onClick={onDismiss}
              className="flex-1 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] text-[11px] text-editor-muted hover:text-editor-muted transition-colors">
              Pular — depois
            </button>
            <button onClick={handleSave}
              disabled={!brand.name || brand.colors.length === 0}
              className="flex-1 py-2 rounded-xl bg-black/5 hover:bg-black/10 disabled:opacity-20 text-[11px] text-black font-medium transition-colors">
              Salvar identidade
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
