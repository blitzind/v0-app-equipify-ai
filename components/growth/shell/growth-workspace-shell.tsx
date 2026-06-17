"use client"

import { useState, type ReactNode } from "react"
import { GrowthBreadcrumbProvider } from "@/components/growth/shell/growth-breadcrumb-context"
import { GrowthBreadcrumbs } from "@/components/growth/shell/growth-breadcrumbs"
import { GROWTH_WORKSPACE_SHELL_QA_MARKER } from "@/components/growth/shell/growth-brand"
import { GrowthMobileNavDrawer } from "@/components/growth/shell/growth-mobile-nav-drawer"
import { GrowthWorkspaceActivityTracker } from "@/components/growth/workspace/growth-workspace-activity-tracker"
import { GrowthSidebar } from "@/components/growth/shell/growth-sidebar"
import { GrowthTopbar } from "@/components/growth/shell/growth-topbar"
import { WorkspaceContainer } from "@/components/workspace/workspace-container"
import { WorkspaceShellSkipLink } from "@/components/workspace/workspace-shell-skip-link"
import {
  WORKSPACE_SHELL_MAIN_CONTENT_ID,
  WORKSPACE_SHELL_VIEWPORT_BODY,
  WORKSPACE_SHELL_VIEWPORT_ROOT,
} from "@/lib/workspace/workspace-shell-tokens"

type GrowthWorkspaceShellProps = {
  children: ReactNode
}

export function GrowthWorkspaceShell({ children }: GrowthWorkspaceShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <GrowthBreadcrumbProvider>
      <div className={WORKSPACE_SHELL_VIEWPORT_ROOT} data-qa-marker={GROWTH_WORKSPACE_SHELL_QA_MARKER}>
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
              <WorkspaceContainer>{children}</WorkspaceContainer>
            </main>
          </div>
        </div>
        <GrowthMobileNavDrawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
        <GrowthWorkspaceActivityTracker />
      </div>
    </GrowthBreadcrumbProvider>
  )
}
