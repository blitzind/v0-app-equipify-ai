"use client"

import { useState, type ReactNode } from "react"
import { GrowthWorkspaceShellPreferencesProvider, useGrowthWorkspaceShellPreferences } from "@/components/growth/settings/growth-workspace-shell-preferences-context"
import { GrowthBreadcrumbProvider } from "@/components/growth/shell/growth-breadcrumb-context"
import { GrowthBreadcrumbs } from "@/components/growth/shell/growth-breadcrumbs"
import { GROWTH_WORKSPACE_SHELL_QA_MARKER } from "@/components/growth/shell/growth-brand"
import { GrowthMobileNavDrawer } from "@/components/growth/shell/growth-mobile-nav-drawer"
import { GrowthWorkspaceActivityTracker } from "@/components/growth/workspace/growth-workspace-activity-tracker"
import { GrowthSidebar } from "@/components/growth/shell/growth-sidebar"
import { GrowthTopbar } from "@/components/growth/shell/growth-topbar"
import { WorkspaceContainer } from "@/components/workspace/workspace-container"
import { WorkspaceShellSkipLink } from "@/components/workspace/workspace-shell-skip-link"
import { GROWTH_WORKSPACE_SETTINGS_CONSUMPTION_QA_MARKER } from "@/lib/growth/settings/growth-workspace-settings-consumption"
import { cn } from "@/lib/utils"
import {
  GROWTH_WORKSPACE_SHELL_MAIN_INNER,
  WORKSPACE_SHELL_MAIN_CONTENT_ID,
  WORKSPACE_SHELL_VIEWPORT_BODY,
  WORKSPACE_SHELL_VIEWPORT_ROOT,
} from "@/lib/workspace/workspace-shell-tokens"

type GrowthWorkspaceShellProps = {
  children: ReactNode
}

function GrowthWorkspaceShellInner({ children }: GrowthWorkspaceShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { personal } = useGrowthWorkspaceShellPreferences()

  return (
    <GrowthBreadcrumbProvider>
      <div
        className={cn(
          WORKSPACE_SHELL_VIEWPORT_ROOT,
          personal.compactMode && "[&_.gap-6]:!gap-4 [&_.p-5]:!p-4",
          personal.reducedMotion && "[&_*]:!transition-none [&_*]:!animate-none",
        )}
        data-qa-marker={GROWTH_WORKSPACE_SHELL_QA_MARKER}
        data-growth-workspace-settings-consumption-marker={GROWTH_WORKSPACE_SETTINGS_CONSUMPTION_QA_MARKER}
        data-growth-compact={personal.compactMode ? "true" : "false"}
        data-growth-reduced-motion={personal.reducedMotion ? "true" : "false"}
      >
        <WorkspaceShellSkipLink />
        <div className={WORKSPACE_SHELL_VIEWPORT_BODY}>
          <GrowthSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <GrowthTopbar
              mobileNavOpen={mobileNavOpen}
              onOpenMobileNav={() => setMobileNavOpen(true)}
            />
            <GrowthBreadcrumbs />
            <main
              id={WORKSPACE_SHELL_MAIN_CONTENT_ID}
              tabIndex={-1}
              className="min-h-0 flex-1 overflow-y-auto outline-none scroll-mt-14 md:scroll-mt-16"
            >
              <WorkspaceContainer className={GROWTH_WORKSPACE_SHELL_MAIN_INNER}>{children}</WorkspaceContainer>
            </main>
          </div>
        </div>
        <GrowthMobileNavDrawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
        <GrowthWorkspaceActivityTracker />
      </div>
    </GrowthBreadcrumbProvider>
  )
}

export function GrowthWorkspaceShell({ children }: GrowthWorkspaceShellProps) {
  return (
    <GrowthWorkspaceShellPreferencesProvider>
      <GrowthWorkspaceShellInner>{children}</GrowthWorkspaceShellInner>
    </GrowthWorkspaceShellPreferencesProvider>
  )
}
