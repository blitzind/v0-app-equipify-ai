"use client"

import { X } from "lucide-react"
import { GrowthSidebarNavContent } from "@/components/growth/shell/growth-sidebar-nav-content"
import { GROWTH_WORKSPACE_SHELL_MOBILE_QA_MARKER } from "@/components/growth/shell/growth-brand"
import { GROWTH_SHELL_NAV_QA_MARKER } from "@/components/growth/shell/growth-shell-navigation"
import { useGrowthSidebarRouteClose } from "@/components/growth/shell/growth-sidebar"
import { WorkspaceShellBrand } from "@/components/workspace/workspace-shell-brand"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-registry"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

type GrowthMobileNavDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GrowthMobileNavDrawer({ open, onOpenChange }: GrowthMobileNavDrawerProps) {
  useGrowthSidebarRouteClose(() => onOpenChange(false))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        id="mobile-sidebar-nav"
        role="navigation"
        aria-label="Growth Engine navigation"
        className="flex w-[min(85vw,280px)] flex-col border-r border-sidebar-border bg-[#0F172A] p-0 text-sidebar-foreground"
        data-qa-marker={GROWTH_WORKSPACE_SHELL_MOBILE_QA_MARKER}
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">Growth Engine navigation</SheetTitle>
        <div className="relative shrink-0">
          <WorkspaceShellBrand forceExpanded homeHref={GROWTH_WORKSPACE_BASE_PATH} />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors touch-manipulation"
            aria-label="Close navigation menu"
          >
            <X className="size-4" />
          </button>
        </div>
        <div data-qa-marker={GROWTH_SHELL_NAV_QA_MARKER} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <GrowthSidebarNavContent onNavigate={() => onOpenChange(false)} collapsed={false} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
