import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && <label className="text-sm font-medium text-[#6a6a6a]">{label}</label>}
        <input
          type={type}
          className={cn(
            "flex h-14 w-full  border border-[#ddd] bg-white px-4 py-3 text-base text-[#222] placeholder:text-[#929292]",
            "focus:outline-none focus:border-[#222] focus:ring-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-colors duration-150",
            error && "border-[#c13515] focus:border-[#c13515]",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-[#c13515]">{error}</p>}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
