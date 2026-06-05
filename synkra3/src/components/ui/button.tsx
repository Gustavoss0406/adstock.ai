import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-200 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-primary/80 text-primary-foreground hover:bg-primary border border-primary/30 shadow-[0_0_15px_rgba(99,102,241,0.15)] rounded-xl",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 rounded-xl",
        outline: "border border-white/10 bg-white/5 text-foreground hover:bg-white/10 hover:border-white/20 rounded-xl",
        secondary: "bg-white/5 text-foreground hover:bg-white/10 border border-white/[0.08] rounded-xl",
        ghost: "text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-xl",
        link: "text-primary underline-offset-2 hover:underline rounded-none",
        glass: "bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] text-foreground hover:bg-white/[0.06] hover:border-white/15 shadow-[0_0_20px_rgba(255,255,255,0.03)] rounded-xl",
      },
      size: {
        default: "h-11 px-5 text-sm",
        sm: "h-8 px-3.5 text-xs",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-base",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
