"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft } from "lucide-react"
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

  return (
    <nav
      className={cn("flex-1 overflow-y-auto px-2 py-3", className)}
      aria-label="Growth Engine navigation"
    >
      {GROWTH_SHELL_NAV_GROUPS.map((group, groupIndex) => (
        <div key={group.id} className={cn(groupIndex > 0 && (collapsed ? "mt-2" : "mt-1"))}>
          {!collapsed ? (
            <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 select-none">
              {group.label}
            </p>
          ) : groupIndex > 0 ? (
            <div className="my-2 mx-auto w-5 border-t border-sidebar-border" />
          ) : null}
          <ul className={cn("space-y-0.5", collapsed && "flex flex-col items-stretch")}>
            {group.items.map((item) => {
              const Icon = item.icon
              const active = isGrowthShellNavItemActive(pathname, item)
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 group relative",
                      NAV_PRIMARY_ROW_MOTION,
                      collapsed ? "h-10 w-full min-w-0 justify-center px-0" : "h-10 px-3",
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
                        "w-[17px] h-[17px] shrink-0 transition-all duration-150",
                        active ? NAV_ICON_ACTIVE_SIDEBAR : NAV_ICON_INACTIVE_SIDEBAR,
                      )}
                    />
                    {!collapsed ? <span className="truncate flex-1 font-medium">{item.label}</span> : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
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
    <div className="border-t border-sidebar-border shrink-0">
      {!collapsed ? (
        <div className="px-4 py-3 flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--status-success)" }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground/50 leading-tight truncate">
              Workspace Active
            </p>
            <p className="text-[11px] text-sidebar-foreground/30 leading-tight mt-0.5">Growth Engine</p>
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
