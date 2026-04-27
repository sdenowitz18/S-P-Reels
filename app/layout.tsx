import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'S&P Reels',
  description: 'a quiet room for the films you sit with.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
