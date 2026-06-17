"use client"

import { useState, type ReactNode } from "react"
import { GrowthBreadcrumbProvider } from "@/components/growth/shell/growth-breadcrumb-context"
import { GrowthBreadcrumbs } from "@/components/growth/shell/growth-breadcrumbs"
import { GROWTH_WORKSPACE_SHELL_QA_MARKER } from "@/components/growth/shell/growth-brand"
import { GrowthMobileNavDrawer } from "@/components/growth/shell/growth-mobile-nav-drawer"
import { GrowthSidebar } from "@/components/growth/shell/growth-sidebar"
import { GrowthTopbar } from "@/components/growth/shell/growth-topbar"
import { WorkspaceContainer } from "@/components/workspace/workspace-container"
import { WORKSPACE_SHELL_HORIZONTAL_PADDING } from "@/lib/workspace/workspace-shell-tokens"

type GrowthWorkspaceShellProps = {
  children: ReactNode
}

export function GrowthWorkspaceShell({ children }: GrowthWorkspaceShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <GrowthBreadcrumbProvider>
      <div
        className="flex min-h-screen bg-background text-foreground"
        data-qa-marker={GROWTH_WORKSPACE_SHELL_QA_MARKER}
      >
        <GrowthSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <GrowthTopbar onOpenMobileNav={() => setMobileNavOpen(true)} />
          <GrowthBreadcrumbs className={WORKSPACE_SHELL_HORIZONTAL_PADDING} />
          <main className="min-h-0 flex-1 overflow-y-auto outline-none scroll-mt-14 md:scroll-mt-16">
            <WorkspaceContainer>{children}</WorkspaceContainer>
          </main>
        </div>
        <GrowthMobileNavDrawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      </div>
    </GrowthBreadcrumbProvider>
  )
}
