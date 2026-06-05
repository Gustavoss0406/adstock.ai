"use client"

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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#18181B",
              color: "#FAFAFA",
              border: "1px solid #27272A",
              borderRadius: "10px",
              fontFamily: "Inter, sans-serif",
              fontSize: "14px",
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
