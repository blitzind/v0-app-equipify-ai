"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-registry"
import {
  WORKSPACE_SIDEBAR_COLLAPSED_STORAGE_KEY,
  WORKSPACE_SIDEBAR_SURFACE,
  WORKSPACE_SIDEBAR_WIDTH_COLLAPSED,
  WORKSPACE_SIDEBAR_WIDTH_EXPANDED,
} from "@/lib/workspace/workspace-shell-tokens"
import { WorkspaceShellBrand } from "@/components/workspace/workspace-shell-brand"
import { GROWTH_WORKSPACE_SHELL_QA_MARKER } from "@/components/growth/shell/growth-brand"
import {
  GrowthSidebarFooter,
  GrowthSidebarNavContent,
} from "@/components/growth/shell/growth-sidebar-nav-content"
import { GROWTH_SHELL_NAV_QA_MARKER } from "@/components/growth/shell/growth-shell-navigation"

export function GrowthSidebar() {
  const [collapsed, setCollapsedState] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(WORKSPACE_SIDEBAR_COLLAPSED_STORAGE_KEY)
      if (raw === "1") setCollapsedState(true)
    } catch {
      // ignore
    }
  }, [])

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value)
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(WORKSPACE_SIDEBAR_COLLAPSED_STORAGE_KEY, value ? "1" : "0")
    } catch {
      // ignore
    }
  }, [])

  return (
    <aside
      className={cn(
        "hidden md:flex",
        WORKSPACE_SIDEBAR_SURFACE,
        collapsed ? WORKSPACE_SIDEBAR_WIDTH_COLLAPSED : WORKSPACE_SIDEBAR_WIDTH_EXPANDED,
      )}
      data-qa-marker={GROWTH_WORKSPACE_SHELL_QA_MARKER}
      aria-label="Growth Engine navigation"
    >
      <WorkspaceShellBrand collapsed={collapsed} homeHref={GROWTH_WORKSPACE_BASE_PATH} />
      <div className="flex min-h-0 flex-1 flex-col" data-qa-marker={GROWTH_SHELL_NAV_QA_MARKER}>
        <GrowthSidebarNavContent collapsed={collapsed} />
        <GrowthSidebarFooter
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed(!collapsed)}
        />
      </div>
    </aside>
  )
}

/** Close mobile drawer on route change — consumed by mobile nav drawer host. */
export function useGrowthSidebarRouteClose(onClose: () => void) {
  const pathname = usePathname()
  useEffect(() => {
    onClose()
  }, [pathname, onClose])
}
