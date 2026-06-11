import type { Metadata } from "next"
import { Inter, Cormorant_Garamond } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"

export const dynamic = 'force-dynamic'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-display",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Adstock — Sua Agência de Marketing Autônoma",
  description:
    "Agentes de IA que trabalham 24/7 no marketing da sua empresa. Eles fazem reunioes, criam artes, analisam metricas e executam estrategias — sozinhos.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="min-h-screen bg-background font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
