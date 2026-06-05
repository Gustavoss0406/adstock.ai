import * as React from "react"
import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline" | "success" | "warning" | "danger" | "info"
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-muted text-muted-foreground",
      outline: "border border-border bg-transparent text-muted-foreground",
      success: "bg-success/10 text-success",
      warning: "bg-warning/10 text-warning",
      danger: "bg-danger/10 text-danger",
      info: "bg-info/10 text-info",
    }

    return (
      <span ref={ref} className={cn("inline-flex items-center rounded-pill px-3 py-1 text-xs font-semibold", variantClasses[variant], className)} {...props} />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
