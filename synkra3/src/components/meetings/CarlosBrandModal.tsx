"use client"

import { useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Trash2, Upload, Check, Paintbrush, Type, ImageIcon, ArrowLeft, ArrowRight, ChevronRight } from "lucide-react"
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
  fontStyle: "modern",
  colors: [],
  logo: "",
  logoBase64: null,
  tone: "professional",
}

const COLOR_SUGGESTIONS = [
  "#6366F1", "#EC4899", "#10B981", "#F59E0B", "#EF4444",
  "#3B82F6", "#8B5CF6", "#06B6D4", "#84CC16", "#F97316",
  "#1A1A1A", "#FFFFFF",
]

export function CarlosBrandModal({ open, userName, orgId, onSave, onDismiss }: Props) {
  const [brand, setBrand] = useState<BrandIdentity>({ ...INITIAL_BRAND, name: userName || "" })
  const [colorInput, setColorInput] = useState("#6366F1")
  const [logoUrl, setLogoUrl] = useState("")
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const colorPickerRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const addColor = useCallback((color: string) => {
    const normalized = color.startsWith("#") ? color.toUpperCase() : "#" + color.toUpperCase()
    if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      if (brand.colors.length >= 4) return
      if (brand.colors.includes(normalized)) return
      setBrand(b => ({ ...b, colors: [...b.colors, normalized] }))
      setColorInput(normalized)
    }
  }, [brand.colors])

  const removeColor = (idx: number) => {
    if (brand.colors.length <= 1) return
    setBrand(b => ({ ...b, colors: b.colors.filter((_, i) => i !== idx) }))
  }

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value.toUpperCase()
    setColorInput(hex)
    addColor(hex)
  }

  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase()
    setColorInput(val)
    if (/^#[0-9A-F]{6}$/.test(val)) {
      addColor(val)
    }
  }

  const handleHexKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && colorInput) {
      addColor(colorInput.startsWith("#") ? colorInput : "#" + colorInput)
    }
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
    if (brand.colors.length === 0) return
    setSaved(true)

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

  const nextStep = () => setStep(s => (s === 3 ? 3 : (s + 1) as 1 | 2 | 3))
  const prevStep = () => setStep(s => (s === 1 ? 1 : (s - 1) as 1 | 2 | 3))

  if (!open) return null

  const selectedStyle = ((FONT_PAIRS as Record<FontStyle, { label: string; fontFamily: string; preview: string }>)[brand.fontStyle])
  const primaryIsDark = brand.colors[0]
    ? parseInt(brand.colors[0].slice(1, 3), 16) * 0.299 +
      parseInt(brand.colors[0].slice(3, 5), 16) * 0.587 +
      parseInt(brand.colors[0].slice(5, 7), 16) * 0.114 < 100
    : true

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
          className="w-full max-w-[500px] bg-editor-surface border border-editor-border rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(99,102,241,0.08)]"
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-4 p-6 pb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center ring-2 ring-orange-500/10 flex-shrink-0">
              <img src="/agents/Carlos.png" className="w-9 h-9 object-cover" alt="Carlos" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Carlos Lima</span>
                <span className="text-[10px] text-white/40">Designer</span>
              </div>
              <p className="text-[12px] text-white/50 mt-1 leading-relaxed">
                {step === 1 && "Vamos comecar pelas cores da sua marca. Escolha ate 4 cores principais. 🎨"}
                {step === 2 && "Agora sua logo. Ela deve ser PNG sem fundo para funcionar em qualquer arte. 📤"}
                {step === 3 && "Por ultimo, o estilo visual que define sua marca. ✨"}
              </p>
            </div>
            <button onClick={onDismiss} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Step indicator ── */}
          <div className="flex items-center px-6 pb-4 gap-1">
            {[
              { num: 1 as const, label: "Cores", icon: Paintbrush },
              { num: 2 as const, label: "Logo", icon: ImageIcon },
              { num: 3 as const, label: "Estilo", icon: Type },
            ].map((s, i) => (
              <div key={s.num} className="flex items-center gap-1 flex-1">
                <button
                  onClick={() => setStep(s.num)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium transition-all ${
                    step === s.num
                      ? "bg-white/[0.08] text-white"
                      : step > s.num
                        ? "text-white/40 hover:text-white/60"
                        : "text-white/20"
                  }`}
                >
                  <s.icon className="w-3.5 h-3.5" />
                  {s.label}
                </button>
                {i < 2 && <ChevronRight className="w-3 h-3 text-white/10 flex-shrink-0" />}
              </div>
            ))}
          </div>

          <div className="px-6 py-2 space-y-4 max-h-[380px] overflow-y-auto">
            {/* ════════════════════════════════════════════ */}
            {/* STEP 1: COLORS */}
            {/* ════════════════════════════════════════════ */}
            {step === 1 && (
              <div className="space-y-5">
                {/* Photoshop-style color picker */}
                <div>
                  <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-2 block">
                    Seletor de Cor
                  </label>
                  <div className="flex gap-3">
                    {/* Color wheel */}
                    <div className="relative">
                      <input
                        ref={colorPickerRef}
                        type="color"
                        value={colorInput || "#6366F1"}
                        onChange={handleColorPickerChange}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                      <div
                        className="w-16 h-16 rounded-xl border-2 border-white/10 cursor-pointer hover:border-white/20 transition-colors shadow-inner"
                        style={{ backgroundColor: colorInput || "#6366F1" }}
                      />
                    </div>
                    {/* Hex input */}
                    <div className="flex-1">
                      <input
                        type="text"
                        value={colorInput}
                        onChange={handleHexInput}
                        onKeyDown={handleHexKeyDown}
                        onBlur={() => colorInput && /^#[0-9A-F]{6}$/.test(colorInput) && addColor(colorInput)}
                        placeholder="#000000"
                        maxLength={7}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm font-mono tracking-wider placeholder:text-white/10 focus:outline-none focus:border-white/[0.15] focus:bg-white/[0.05] transition-colors"
                      />
                      <p className="text-[10px] text-white/20 mt-1.5 ml-1">
                        Digite um hex (ex: #FF6B35) ou use o seletor ao lado
                      </p>
                    </div>
                  </div>
                </div>

                {/* Selected palette */}
                <div>
                  <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-2 block">
                    Paleta Selecionada ({brand.colors.length}/4)
                  </label>
                  <div className="flex gap-2">
                    {brand.colors.map((c, i) => (
                      <div key={i} className="relative group flex-1">
                        <div
                          className="w-full aspect-square rounded-xl border-2 border-white/[0.08] shadow-lg transition-transform hover:scale-105"
                          style={{ backgroundColor: c }}
                        />
                        <span className="block text-center text-[9px] text-white/30 mt-1 group-hover:text-white/50 transition-colors">
                          {c}
                        </span>
                        <button
                          onClick={() => removeColor(i)}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/30"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    {brand.colors.length < 4 && (
                      <div
                        onClick={() => colorPickerRef.current?.click()}
                        className="flex-1 aspect-square rounded-xl border-2 border-dashed border-white/[0.06] hover:border-white/[0.12] flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Plus className="w-5 h-5 text-white/15" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Suggestions */}
                <div>
                  <label className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-2 block">
                    Paletas sugeridas
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_SUGGESTIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => addColor(c)}
                        className="w-8 h-8 rounded-lg border border-white/[0.06] hover:border-white/[0.15] hover:scale-110 transition-all active:scale-95"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════ */}
            {/* STEP 2: LOGO */}
            {/* ════════════════════════════════════════════ */}
            {step === 2 && (
              <div className="space-y-5">
                {/* Warning about transparent bg */}
                <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/[0.12]">
                  <p className="text-[10px] font-semibold text-amber-400/70 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <span className="text-base">⚠️</span> Importante
                  </p>
                  <p className="text-[11px] text-amber-400/50 leading-relaxed">
                    Sua logo precisa ser <strong className="text-amber-400/70">PNG com fundo transparente</strong>. Logos com fundo branco ou colorido nao funcionam bem nas artes — ele sera aplicado sobre diferentes cores de fundo e precisa se integrar naturalmente.
                  </p>
                </div>

                {/* Drag & drop */}
                <div>
                  <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-2 block">
                    Upload da Logo
                  </label>
                  <input
                    type="file"
                    ref={fileRef}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                    accept="image/png"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full h-36 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-white/[0.15] flex flex-col items-center justify-center gap-3 transition-all group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center group-hover:bg-white/[0.06] transition-colors">
                      <Upload className="w-5 h-5 text-white/25 group-hover:text-white/40 transition-colors" />
                    </div>
                    <div className="text-center">
                      <p className="text-[12px] text-white/30 group-hover:text-white/45 transition-colors">
                        Clique para selecionar um PNG
                      </p>
                      <p className="text-[10px] text-white/15 mt-0.5">
                        ou arraste o arquivo aqui
                      </p>
                    </div>
                  </button>
                </div>

                {/* URL input */}
                <div>
                  <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-2 block">
                    Ou cole uma URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={logoUrl}
                      onChange={e => setLogoUrl(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleUrlLogo()}
                      placeholder="https://seusite.com/logo.png"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm placeholder:text-white/10 focus:outline-none focus:border-white/[0.15] transition-colors"
                    />
                    <button
                      onClick={handleUrlLogo}
                      disabled={!logoUrl}
                      className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] disabled:opacity-20 text-white text-sm font-medium transition-colors"
                    >
                      Carregar
                    </button>
                  </div>
                </div>

                {/* Preview */}
                {logoPreview && (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg flex items-center justify-center p-2" style={{
                        background: "repeating-conic-gradient(#ffffff08 0% 25%, #ffffff04 0% 50%) 50% / 12px 12px",
                      }}>
                        <img src={logoPreview} className="max-w-full max-h-full object-contain" alt="Logo preview" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[12px] text-white/60 font-medium">Preview da logo</p>
                        <p className="text-[10px] text-green-400/60 mt-0.5">✓ Carregada — fundo transparente detectado</p>
                      </div>
                      <button
                        onClick={() => { setLogoPreview(null); setBrand(b => ({ ...b, logoBase64: null })) }}
                        className="p-2 rounded-lg hover:bg-white/[0.06] text-white/20 hover:text-red-400/60 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════════ */}
            {/* STEP 3: STYLE */}
            {/* ════════════════════════════════════════════ */}
            {step === 3 && (
              <div className="space-y-4">
                <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider block">
                  Estilo Visual
                </label>
                <p className="text-[11px] text-white/25 -mt-3">
                  Escolha o estilo que melhor representa sua marca. Isso define a tipografia e o tom visual das artes.
                </p>

                {/* Live preview bar */}
                {brand.colors.length > 0 && (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Preview</p>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {brand.colors.map((c, i) => (
                          <div key={i} className="w-6 h-6 rounded-md" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <p className="text-[13px] text-white/70 font-medium" style={{
                        fontFamily: selectedStyle?.fontFamily || "Inter, sans-serif",
                      }}>
                        {selectedStyle?.label || "Modern"} — {selectedStyle?.preview || "Aa"}
                      </p>
                    </div>
                  </div>
                )}

                {(Object.entries(FONT_PAIRS) as [FontStyle, typeof FONT_PAIRS[keyof typeof FONT_PAIRS]][]).map(([key, font]) => {
                  const isActive = brand.fontStyle === key
                  return (
                    <button
                      key={key}
                      onClick={() => setBrand(b => ({ ...b, fontStyle: key }))}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        isActive
                          ? "border-white/[0.12] bg-white/[0.04]"
                          : "border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                          isActive ? "bg-white/[0.10] ring-1 ring-white/[0.15]" : "bg-white/[0.03]"
                        }`}>
                          {isActive && <Check className="w-4 h-4 text-white" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-[13px] font-semibold text-white mb-0.5" style={{
                            fontFamily: font.fontFamily + ", sans-serif",
                          }}>
                            {font.label}
                          </p>
                          <p className="text-[11px] text-white/30">{font.preview}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Bottom navigation ── */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-white/[0.04] mt-2">
            {step > 1 ? (
              <button
                onClick={prevStep}
                className="px-4 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] text-white/50 hover:text-white/70 text-[12px] font-medium transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar
              </button>
            ) : (
              <button
                onClick={onDismiss}
                className="px-4 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] text-white/50 hover:text-white/70 text-[12px] font-medium transition-colors"
              >
                Pular
              </button>
            )}

            <div className="flex-1" />

            {step < 3 ? (
              <button
                onClick={nextStep}
                disabled={step === 1 && brand.colors.length === 0}
                className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] disabled:opacity-20 disabled:cursor-not-allowed text-white text-[12px] font-medium transition-colors flex items-center gap-1.5"
              >
                Continuar
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={brand.colors.length === 0}
                className="px-6 py-2.5 rounded-xl bg-white hover:bg-white/90 disabled:opacity-20 disabled:cursor-not-allowed text-black text-[12px] font-semibold transition-all active:scale-[0.98]"
              >
                Salvar identidade
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
