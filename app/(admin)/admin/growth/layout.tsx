"use client"

import type { ReactNode } from "react"
import { GrowthCommandNavigationPalette } from "@/components/growth/growth-command-navigation-palette"
import { GrowthNavigationProvider } from "@/components/growth/growth-navigation-provider"

/** Wraps all Growth Engine routes with command palette (Cmd/Ctrl+K). */
export default function AdminGrowthLayout({ children }: { children: ReactNode }) {
  return (
    <GrowthNavigationProvider>
      {children}
      <GrowthCommandNavigationPalette />
    </GrowthNavigationProvider>
  )
}
