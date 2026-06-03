import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-[#000000] text-white hover:bg-[#333333] shadow-none",
        destructive: "bg-[#c13515] text-white hover:bg-[#b32505]",
        outline: "border border-[#ddd] bg-white text-[#222] hover:bg-[#f7f7f7]",
        secondary: "bg-[#f7f7f7] text-[#222] hover:bg-[#f2f2f2]",
        ghost: "text-[#6a6a6a] hover:text-[#222] hover:bg-[#f7f7f7]",
        link: "text-[#000000] underline-offset-2 hover:underline",
      },
      size: {
        default: "h-12  px-6 text-base",
        sm: "h-9  px-4 text-sm",
        lg: "h-12  px-6 text-base",
        xl: "h-14  px-8 text-base",
        icon: "h-10 w-10 rounded-pill",
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
