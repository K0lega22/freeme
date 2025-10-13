import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Freeme - AI Calendar Assistant',
  description: 'Manage your schedule effortlessly with natural language AI. Schedule meetings, appointments, and events using plain English.',
  keywords: ['calendar', 'AI', 'scheduling', 'productivity', 'events'],
  authors: [{ name: 'Freeme' }],
  openGraph: {
    title: 'Freeme - AI Calendar Assistant',
    description: 'Your AI-powered calendar management tool',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}