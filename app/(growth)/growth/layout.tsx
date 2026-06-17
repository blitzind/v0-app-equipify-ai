"use client"

import type { ReactNode } from "react"
import { AidenAskLauncher } from "@/components/growth/aiden-ask-launcher"
import { GrowthCommandNavigationPalette } from "@/components/growth/growth-command-navigation-palette"
import { GrowthNavigationProvider } from "@/components/growth/growth-navigation-provider"
import { GrowthWorkspaceShell } from "@/components/growth/shell/growth-workspace-shell"

export default function GrowthWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <GrowthNavigationProvider>
      <GrowthWorkspaceShell>{children}</GrowthWorkspaceShell>
      <GrowthCommandNavigationPalette />
      <AidenAskLauncher />
    </GrowthNavigationProvider>
  )
}
