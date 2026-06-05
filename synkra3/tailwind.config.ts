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
        sans: ['Inter', 'Graphik', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
        display: ['Graphik', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
        mono: ['Roboto Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
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
          hover: "var(--primary-hover)",
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
          DEFAULT: "var(--surface-1)",
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
        editor: {
          bg: "var(--editor-bg)",
          panel: "var(--editor-panel)",
          ink: "var(--editor-ink)",
          muted: "var(--editor-muted)",
          border: "var(--editor-border)",
          surface: "var(--editor-surface)",
        },
        success: { DEFAULT: "var(--success)" },
        warning: { DEFAULT: "var(--warning)" },
        danger: { DEFAULT: "var(--danger)" },
        info: { DEFAULT: "var(--info)" },
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        pill: "9999px",
        full: "9999px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
        elevated: "0 4px 24px rgba(0,0,0,0.15)",
        "glow-primary": "0 0 20px rgba(99,102,241,0.15)",
        "glow-success": "0 0 20px rgba(16,185,129,0.15)",
      },
      spacing: {
        section: "128px",
      },
      fontSize: {
        "display-xl": ["64px", { lineHeight: "0.95", fontWeight: "900", letterSpacing: "-0.04em" }],
        "display-lg": ["48px", { lineHeight: "0.95", fontWeight: "900", letterSpacing: "-0.04em" }],
        "display-md": ["36px", { lineHeight: "0.95", fontWeight: "900", letterSpacing: "-0.03em" }],
        "title-lg": ["24px", { lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.02em" }],
        "title-md": ["20px", { lineHeight: "1.2", fontWeight: "600", letterSpacing: "-0.01em" }],
        "title-sm": ["16px", { lineHeight: "1.25", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
      },
      transitionDuration: {
        base: "300ms",
      },
      transitionTimingFunction: {
        base: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "slide-up": { "0%": { transform: "translateY(16px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
      },
      animation: {
        "fade-in": "fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) both",
        "slide-up": "slide-up 0.3s cubic-bezier(0.4, 0, 0.2, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
