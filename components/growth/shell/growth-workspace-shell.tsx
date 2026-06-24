"use client"

import { useState, type ComponentPropsWithoutRef, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { GrowthWorkspaceShellPreferencesProvider, useGrowthWorkspaceShellPreferences } from "@/components/growth/settings/growth-workspace-shell-preferences-context"
import { GrowthBreadcrumbProvider } from "@/components/growth/shell/growth-breadcrumb-context"
import { GrowthBreadcrumbs } from "@/components/growth/shell/growth-breadcrumbs"
import { GROWTH_WORKSPACE_SHELL_QA_MARKER } from "@/components/growth/shell/growth-brand"
import { GrowthMobileNavDrawer } from "@/components/growth/shell/growth-mobile-nav-drawer"
import { GrowthWorkspaceActivityTracker } from "@/components/growth/workspace/growth-workspace-activity-tracker"
import { GrowthSidebar } from "@/components/growth/shell/growth-sidebar"
import { GrowthTopbar } from "@/components/growth/shell/growth-topbar"
import { WorkspaceShellSkipLink } from "@/components/workspace/workspace-shell-skip-link"
import { GROWTH_WORKSPACE_SETTINGS_CONSUMPTION_QA_MARKER } from "@/lib/growth/settings/growth-workspace-settings-consumption"
import { isGrowthWorkspaceSettingsPathname } from "@/lib/growth/navigation/growth-workspace-settings-paths"
import {
  GROWTH_AIDEN_SAFE_AREA_PB_SCROLL,
  GROWTH_AIDEN_SAFE_AREA_PR,
  GROWTH_FLOATING_INSET_QA_MARKER,
  GROWTH_STICKY_ACTION_BAR_INNER_LAYOUT,
  GROWTH_STICKY_ACTION_BAR_SURFACE,
  GROWTH_WIZARD_ACTION_ROW,
  GROWTH_WORKSPACE_SAFE_AREA,
  GROWTH_WORKSPACE_SAFE_AREA_STICKY_FOOTER,
} from "@/lib/layout/aiden-safe-area"
import { cn } from "@/lib/utils"
import {
  GROWTH_WORKSPACE_SHELL_MAIN_INNER,
  GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER,
  WORKSPACE_SHELL_MAIN_CONTENT_ID,
  WORKSPACE_SHELL_QA_MARKER,
  WORKSPACE_SHELL_VIEWPORT_BODY,
  WORKSPACE_SHELL_VIEWPORT_ROOT,
} from "@/lib/workspace/workspace-shell-tokens"

type GrowthWorkspaceShellProps = {
  children: ReactNode
}

function GrowthWorkspaceShellInner({ children }: GrowthWorkspaceShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const pathname = usePathname()
  const { personal } = useGrowthWorkspaceShellPreferences()
  const isSettingsRoute = isGrowthWorkspaceSettingsPathname(pathname)
  const mainInnerClass = isSettingsRoute
    ? GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER
    : GROWTH_WORKSPACE_SHELL_MAIN_INNER

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
              className="min-h-0 min-w-0 w-full flex-1 overflow-y-auto outline-none scroll-mt-14 md:scroll-mt-16"
            >
              <div
                className={cn(
                  mainInnerClass,
                  isSettingsRoute && "max-w-none mx-0",
                  GROWTH_AIDEN_SAFE_AREA_PR,
                  GROWTH_AIDEN_SAFE_AREA_PB_SCROLL,
                )}
                data-qa-marker={WORKSPACE_SHELL_QA_MARKER}
                data-growth-settings-full-width={isSettingsRoute ? "true" : undefined}
              >
                {children}
              </div>
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

type GrowthStickyActionBarProps = Omit<ComponentPropsWithoutRef<"footer">, "children"> & {
  children: ReactNode
  innerClassName?: string
  ariaLabel?: string
}

export function GrowthStickyActionBar({
  children,
  className,
  innerClassName,
  ariaLabel = "Page actions",
  ...props
}: GrowthStickyActionBarProps) {
  return (
    <footer
      className={cn(GROWTH_STICKY_ACTION_BAR_SURFACE, className)}
      aria-label={ariaLabel}
      data-growth-floating-inset={GROWTH_FLOATING_INSET_QA_MARKER}
      {...props}
    >
      <div className={cn(GROWTH_STICKY_ACTION_BAR_INNER_LAYOUT, innerClassName)}>{children}</div>
    </footer>
  )
}

type GrowthWorkspaceSafeAreaProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  children: ReactNode
  variant?: "scroll" | "sticky-footer"
}

export function GrowthWorkspaceSafeArea({
  children,
  className,
  variant = "scroll",
  ...props
}: GrowthWorkspaceSafeAreaProps) {
  return (
    <div
      className={cn(
        variant === "sticky-footer" ? GROWTH_WORKSPACE_SAFE_AREA_STICKY_FOOTER : GROWTH_WORKSPACE_SAFE_AREA,
        className,
      )}
      data-growth-floating-inset={GROWTH_FLOATING_INSET_QA_MARKER}
      {...props}
    >
      {children}
    </div>
  )
}

type GrowthWizardActionRowProps = ComponentPropsWithoutRef<"div"> & {
  align?: "between" | "end" | "start"
}

export function GrowthWizardActionRow({ align = "between", className, ...props }: GrowthWizardActionRowProps) {
  return (
    <div
      className={cn(
        GROWTH_WIZARD_ACTION_ROW,
        align === "between" && "justify-between",
        align === "end" && "justify-end",
        align === "start" && "justify-start",
        className,
      )}
      data-growth-floating-inset={GROWTH_FLOATING_INSET_QA_MARKER}
      {...props}
    />
  )
}
