import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; max?: number; variant?: "default" | "success" | "warning" | "danger"; showValue?: boolean; label?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, variant = "default", showValue = false, label, ...props }, ref) => {
    const pct = Math.min(Math.max((value / max) * 100, 0), 100)
    const colors: Record<string, string> = {
      default: "bg-primary",
      success: "bg-success",
      warning: "bg-warning",
      danger: "bg-danger",
    }
    return (
      <div ref={ref} className={cn("space-y-1", className)} {...props}>
        {(label || showValue) && (
          <div className="flex justify-between text-xs text-muted-foreground">
            {label && <span>{label}</span>}
            {showValue && <span>{Math.round(pct)}%</span>}
          </div>
        )}
        <div className="h-1.5 w-full overflow-hidden rounded-pill bg-muted">
          <div className={cn("h-full rounded-pill transition-all duration-500", colors[variant])} style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }
