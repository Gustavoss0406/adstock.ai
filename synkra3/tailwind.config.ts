import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
      },
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          active: "var(--primary-active)",
          disabled: "var(--primary-disabled)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
          teal: "var(--accent-teal)",
          amber: "var(--accent-amber)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          soft: "var(--surface-1)",
          card: "var(--surface-1)",
          strong: "var(--surface-2)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          body: "var(--ink-body)",
          muted: "var(--ink-muted)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          text: "var(--sidebar-text)",
          active: "var(--sidebar-active)",
        },
        success: { DEFAULT: "var(--success)" },
        warning: { DEFAULT: "var(--warning)" },
        danger: { DEFAULT: "var(--danger)" },
        info: { DEFAULT: "var(--info)" },
        rausch: {
          DEFAULT: "#ff385c",
          active: "#e00b41",
          disabled: "#ffd1da",
        },
      },
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "14px",
        lg: "20px",
        xl: "32px",
        pill: "9999px",
        full: "9999px",
      },
      boxShadow: {
        card: "0 0 0 1px rgba(0,0,0,0.02), 0 2px 6px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.1)",
        elevated: "0 0 0 1px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.12)",
      },
      spacing: {
        section: "64px",
      },
      fontSize: {
        "display-xl": ["28px", { lineHeight: "1.43", fontWeight: "700" }],
        "display-lg": ["22px", { lineHeight: "1.18", fontWeight: "500", letterSpacing: "-0.44px" }],
        "title-md": ["16px", { lineHeight: "1.25", fontWeight: "600" }],
        "title-sm": ["16px", { lineHeight: "1.25", fontWeight: "500" }],
      },
      keyframes: {
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "slide-up": { "0%": { transform: "translateY(8px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        pulse: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.7" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.2s ease-out",
        pulse: "pulse 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
