"use client"

import type { ReactNode } from "react"
import { GrowthAidenAskLauncherGate } from "@/components/growth/growth-aiden-ask-launcher-gate"
import { GrowthCommandNavigationPalette } from "@/components/growth/growth-command-navigation-palette"
import { GrowthNavigationProvider } from "@/components/growth/growth-navigation-provider"
import { GrowthWorkspaceShell } from "@/components/growth/shell/growth-workspace-shell"
import { TenantWorkspaceSync } from "@/components/tenant-workspace-sync"
import { ActiveOrganizationProvider } from "@/lib/active-organization-context"
import { OrgPermissionsProvider } from "@/lib/org-permissions-context"
import { TenantProvider } from "@/lib/tenant-store"

export default function GrowthWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <ActiveOrganizationProvider>
      <OrgPermissionsProvider>
        <TenantProvider>
          <TenantWorkspaceSync />
          <GrowthNavigationProvider>
            <GrowthWorkspaceShell>{children}</GrowthWorkspaceShell>
            <GrowthCommandNavigationPalette />
            <GrowthAidenAskLauncherGate />
          </GrowthNavigationProvider>
        </TenantProvider>
      </OrgPermissionsProvider>
    </ActiveOrganizationProvider>
  )
}
