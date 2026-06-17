"use client"

import { GrowthInboxShell } from "@/components/growth/inbox/growth-inbox-shell"
import { GrowthInboxWorkspaceProvider } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import type { ReactNode } from "react"

type GrowthInboxLayoutProps = {
  children: ReactNode
}

export default function GrowthInboxLayout({ children }: GrowthInboxLayoutProps) {
  return (
    <GrowthInboxWorkspaceProvider>
      <GrowthInboxShell>{children}</GrowthInboxShell>
    </GrowthInboxWorkspaceProvider>
  )
}
