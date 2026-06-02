"use client"

import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { ThemeProvider } from "next-themes"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "#faf9f5",
                color: "#141413",
                border: "1px solid #e6dfd8",
                borderRadius: "8px",
                fontFamily: "Inter, sans-serif",
                fontSize: "14px",
              },
            }}
          />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
