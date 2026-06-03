"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getRandomThinkingPhrase } from "@/lib/ai/config"
import { Brain, Loader2, Sparkles, Lightbulb, Search, BarChart3, Palette, PenTool } from "lucide-react"

interface AgentThinkingProps {
  agentName: string
  action: string
  isActive: boolean
  progressSteps?: string[]
  currentStep?: number
}

const stepIcons = [Search, BarChart3, Lightbulb, Palette, PenTool, Sparkles]

export function AgentThinking({ agentName, action, isActive, progressSteps, currentStep }: AgentThinkingProps) {
  const [currentPhrase, setCurrentPhrase] = useState(getRandomThinkingPhrase())
  const [dots, setDots] = useState("")
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    if (!isActive) return

    intervalRef.current = setInterval(() => {
      setCurrentPhrase(getRandomThinkingPhrase())
    }, 2200)

    const dotsInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."))
    }, 400)

    return () => {
      clearInterval(intervalRef.current)
      clearInterval(dotsInterval)
    }
  }, [isActive])

  const steps = progressSteps || [
    "Buscando referências...",
    "Analisando métricas...",
    "Processando dados...",
    "Gerando insights...",
    "Preparando resposta...",
  ]

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="relative overflow-hidden"
        >
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#4A154B]/5 via-[#1264A3]/5 to-[#2BAC76]/5 animate-pulse" />

          <div className="relative flex flex-col gap-3 p-4  border border-[#DDDDDD] bg-white shadow-card">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-md bg-[#4A154B] flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <motion.div
                  className="absolute -bottom-0.5 -right-0.5"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-4 h-4 text-[#1264A3]" />
                </motion.div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1D1C1D]">
                  {agentName} está {action}{dots}
                </p>
                <motion.p
                  key={currentPhrase}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs text-[#616061] mt-0.5"
                >
                  {currentPhrase}
                </motion.p>
              </div>

              {/* Spinning indicator */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="flex-shrink-0"
              >
                <Sparkles className="w-5 h-5 text-[#ECB22E]" />
              </motion.div>
            </div>

            {/* Progress steps */}
            <div className="space-y-1.5 pl-1">
              {steps.map((step, i) => {
                const StepIcon = stepIcons[i % stepIcons.length]
                const isCurrentStep = currentStep === i
                const isDone = currentStep !== undefined && i < currentStep

                return (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{
                      opacity: isDone ? 0.6 : isCurrentStep ? 1 : 0.3,
                      x: 0,
                    }}
                    transition={{ delay: i * 0.15 }}
                    className={cn(
                      "flex items-center gap-2.5 transition-colors",
                      isCurrentStep && "text-[#1264A3]",
                      isDone && "text-[#2BAC76]",
                    )}
                  >
                    {isCurrentStep ? (
                      <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Loader2 className="w-3.5 h-3.5 text-[#1264A3] animate-spin" />
                      </motion.div>
                    ) : isDone ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-3.5 h-3.5 rounded-pill bg-[#2BAC76] flex items-center justify-center"
                      >
                        <svg className="w-2 h-2 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </motion.div>
                    ) : (
                      <StepIcon className="w-3.5 h-3.5 opacity-40" />
                    )}
                    <span className="text-xs">{step}</span>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
