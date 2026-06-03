import * as React from "react"
import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline" | "success" | "warning" | "danger" | "info"
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-[#f7f7f7] text-[#6a6a6a]",
      outline: "border border-[#ddd] bg-transparent text-[#6a6a6a]",
      success: "bg-[#000000]/10 text-black",
      warning: "bg-[#000000]/10 text-[#b0801a]",
      danger: "bg-[#c13515]/10 text-[#b32505]",
      info: "bg-[#000000]/10 text-[#1d4ed8]",
    }

    return (
      <span ref={ref} className={cn("inline-flex items-center rounded-pill px-3 py-1 text-xs font-semibold", variantClasses[variant], className)} {...props} />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
