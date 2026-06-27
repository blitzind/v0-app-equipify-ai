"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  NAV_ICON_ACTIVE_SIDEBAR,
  NAV_ICON_INACTIVE_SIDEBAR,
  NAV_PRIMARY_ROW_MOTION,
  NAV_ROW_ACTIVE_SIDEBAR,
  NAV_ROW_INACTIVE_HOVER_SIDEBAR,
  NAV_SIDEBAR_ACTIVE_INDICATOR,
} from "@/lib/navigation-chrome"
import {
  GROWTH_SHELL_NAV_GROUPS,
  isGrowthShellNavItemActive,
} from "@/components/growth/shell/growth-shell-navigation"
import {
  readWorkspaceSidebarCollapsedSections,
  toggleWorkspaceSidebarCollapsedSection,
  writeWorkspaceSidebarCollapsedSections,
  WORKSPACE_GROWTH_SIDEBAR_SECTIONS_STORAGE_KEY,
} from "@/lib/workspace/workspace-sidebar-section-collapse"
import {
  WORKSPACE_SIDEBAR_GROUP_HEADER,
  WORKSPACE_SIDEBAR_NAV_ICON,
  WORKSPACE_SIDEBAR_NAV_ROW,
  WORKSPACE_SIDEBAR_GROWTH_ENGINE_LABEL,
} from "@/lib/workspace/workspace-shell-tokens"
import { AI_OS_SIDEBAR_WORKSPACE_INDICATOR_LABEL } from "@/lib/workspace/ai-os-workspace-branding"

type GrowthSidebarNavContentProps = {
  onNavigate?: () => void
  className?: string
  collapsed?: boolean
}

export function GrowthSidebarNavContent({
  onNavigate,
  className,
  collapsed = false,
}: GrowthSidebarNavContentProps) {
  const pathname = usePathname()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setCollapsedGroups(readWorkspaceSidebarCollapsedSections(WORKSPACE_GROWTH_SIDEBAR_SECTIONS_STORAGE_KEY))
  }, [])

  useEffect(() => {
    setCollapsedGroups((prev) => {
      if (GROWTH_SHELL_NAV_GROUPS.length === 0) return prev
      const allVisibleGroupsCollapsed = GROWTH_SHELL_NAV_GROUPS.every((group) => prev.has(group.id))
      if (!allVisibleGroupsCollapsed) return prev
      const next = new Set<string>()
      writeWorkspaceSidebarCollapsedSections(WORKSPACE_GROWTH_SIDEBAR_SECTIONS_STORAGE_KEY, next)
      return next
    })
  }, [])

  useEffect(() => {
    setCollapsedGroups((prev) => {
      let mutated = false
      const next = new Set(prev)
      for (const group of GROWTH_SHELL_NAV_GROUPS) {
        if (!next.has(group.id)) continue
        const owns = group.items.some((item) => isGrowthShellNavItemActive(pathname, item))
        if (owns) {
          next.delete(group.id)
          mutated = true
        }
      }
      if (mutated) writeWorkspaceSidebarCollapsedSections(WORKSPACE_GROWTH_SIDEBAR_SECTIONS_STORAGE_KEY, next)
      return mutated ? next : prev
    })
  }, [pathname])

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) =>
      toggleWorkspaceSidebarCollapsedSection(WORKSPACE_GROWTH_SIDEBAR_SECTIONS_STORAGE_KEY, prev, id),
    )
  }

  return (
    <nav
      className={cn(
        "flex-1 overflow-y-auto py-2",
        collapsed ? "flex flex-col items-stretch px-0" : "px-3",
        className,
      )}
      aria-label="AI OS navigation"
    >
      {GROWTH_SHELL_NAV_GROUPS.map((group, groupIndex) => {
        const groupCollapsed = collapsedGroups.has(group.id)
        const groupHasActive = group.items.some((item) => isGrowthShellNavItemActive(pathname, item))

        return (
          <div key={group.id} className={cn("w-full", groupIndex > 0 && "mt-3")}>
            {!collapsed ? (
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={!groupCollapsed}
                aria-controls={`growth-nav-group-${group.id}`}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 pb-1 pt-0.5",
                  WORKSPACE_SIDEBAR_GROUP_HEADER,
                  "select-none rounded-md hover:text-sidebar-foreground/70 transition-colors",
                )}
              >
                <span className="flex items-center gap-1.5">
                  {group.label}
                  {groupCollapsed && groupHasActive ? (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: NAV_SIDEBAR_ACTIVE_INDICATOR }}
                      aria-label="Active route inside collapsed group"
                    />
                  ) : null}
                </span>
                <ChevronDown
                  size={11}
                  className={cn("shrink-0 transition-transform duration-150", groupCollapsed && "-rotate-90")}
                />
              </button>
            ) : groupIndex > 0 ? (
              <div className="my-2 mx-auto w-5 border-t border-sidebar-border" />
            ) : null}

            <div
              id={`growth-nav-group-${group.id}`}
              hidden={!collapsed && groupCollapsed}
              className={cn("space-y-0.5", collapsed && "flex flex-col items-stretch")}
            >
              {group.items.map((item) => {
                const Icon = item.icon
                const active = isGrowthShellNavItemActive(pathname, item)
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 group relative",
                      NAV_PRIMARY_ROW_MOTION,
                      collapsed ? "h-10 w-full min-w-0 justify-center px-0" : WORKSPACE_SIDEBAR_NAV_ROW,
                      active ? NAV_ROW_ACTIVE_SIDEBAR : NAV_ROW_INACTIVE_HOVER_SIDEBAR,
                    )}
                  >
                    {active && !collapsed ? (
                      <span
                        className="absolute left-0 top-1/2 z-[1] -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                        style={{ backgroundColor: NAV_SIDEBAR_ACTIVE_INDICATOR }}
                        aria-hidden
                      />
                    ) : null}
                    {active && collapsed ? (
                      <span
                        className="absolute bottom-1 left-1/2 z-[1] -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: NAV_SIDEBAR_ACTIVE_INDICATOR }}
                        aria-hidden
                      />
                    ) : null}
                    <Icon
                      className={cn(
                        `${WORKSPACE_SIDEBAR_NAV_ICON} shrink-0 transition-all duration-150`,
                        active ? NAV_ICON_ACTIVE_SIDEBAR : NAV_ICON_INACTIVE_SIDEBAR,
                      )}
                    />
                    {!collapsed ? <span className="truncate flex-1 font-medium">{item.label}</span> : null}
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

type GrowthSidebarFooterProps = {
  collapsed: boolean
  onToggleCollapsed: () => void
  showCollapseToggle?: boolean
}

export function GrowthSidebarFooter({
  collapsed,
  onToggleCollapsed,
  showCollapseToggle = true,
}: GrowthSidebarFooterProps) {
  return (
    <div className="mt-auto border-t border-sidebar-border shrink-0">
      {!collapsed ? (
        <div className="px-4 py-3 flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--status-success)" }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground/50 leading-tight truncate">
              {AI_OS_SIDEBAR_WORKSPACE_INDICATOR_LABEL}
            </p>
            <p className="text-[11px] text-sidebar-foreground/30 leading-tight mt-0.5">
              {WORKSPACE_SIDEBAR_GROWTH_ENGINE_LABEL}
            </p>
          </div>
        </div>
      ) : null}
      {showCollapseToggle ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "w-full flex items-center gap-2 py-3 text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors",
            collapsed ? "justify-center px-0" : "px-4 border-t border-sidebar-border",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className={cn("w-4 h-4 shrink-0 transition-transform", collapsed && "rotate-180")} />
          {!collapsed ? <span className="font-medium">Collapse</span> : null}
        </button>
      ) : null}
    </div>
  )
}
