import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'

export const metadata: Metadata = {
  title: 'LookAny - 联盟业绩监控',
  description: '多联盟佣金业绩监控系统',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Navigation />
        {children}
      </body>
    </html>
  )
}

