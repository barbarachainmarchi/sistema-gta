'use client'

import { useEffect } from 'react'

interface ThemeConfig {
  accentH: number
  accentS: number
  accentL: number
  nomeSistema: string
}

export function ThemeProvider({
  children,
  config,
}: {
  children: React.ReactNode
  config: ThemeConfig | null
}) {
  useEffect(() => {
    if (!config) return
    const hsl = `hsl(${config.accentH}, ${config.accentS}%, ${config.accentL}%)`
    document.documentElement.style.setProperty('--color-primary', hsl)
    document.documentElement.style.setProperty('--color-ring', hsl)
  }, [config])

  return <>{children}</>
}
