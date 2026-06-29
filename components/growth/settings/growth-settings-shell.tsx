"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings2 } from "lucide-react"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER,
  isGrowthWorkspaceSettingsNavItemActive,
} from "@/lib/growth/navigation/growth-workspace-settings-navigation"
import {
  GROWTH_WORKSPACE_SETTINGS_SHELL_BODY,
  GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT,
  GROWTH_WORKSPACE_SETTINGS_SHELL_HEADER,
  GROWTH_WORKSPACE_SETTINGS_SHELL_LAYOUT_QA_MARKER,
  GROWTH_WORKSPACE_SETTINGS_SHELL_ROOT,
  GROWTH_WORKSPACE_SETTINGS_SHELL_SIDEBAR,
} from "@/lib/growth/settings/growth-workspace-settings-shell-tokens"
import { GrowthSettingsShellWidthEnforcer } from "@/components/growth/settings/growth-settings-shell-width-enforcer"
import { cn } from "@/lib/utils"
import { NAV_PRIMARY_ROW_MOTION, NAV_ROW_INACTIVE_HOVER_CARD, NAV_SIDEBAR_ACTIVE_INDICATOR } from "@/lib/navigation-chrome"

type GrowthSettingsShellProps = {
  children: ReactNode
}

const GROWTH_SETTINGS_NAV_ACTIVE_ROW =
  "border border-primary/40 bg-muted/90 font-semibold text-foreground shadow-sm dark:border-primary/55 dark:bg-muted/70"

const GROWTH_SETTINGS_NAV_ACTIVE_ICON = "text-primary dark:text-primary"

export function GrowthSettingsShell({ children }: GrowthSettingsShellProps) {
  const pathname = usePathname() ?? ""

  return (
    <div
      className={GROWTH_WORKSPACE_SETTINGS_SHELL_ROOT}
      data-qa-marker={GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER}
      data-growth-settings-shell={GROWTH_WORKSPACE_SETTINGS_SHELL_LAYOUT_QA_MARKER}
      data-growth-settings-layout-root
      data-growth-settings-full-width="true"
    >
      <GrowthSettingsShellWidthEnforcer />
      <section
        className={GROWTH_WORKSPACE_SETTINGS_SHELL_HEADER}
        data-growth-settings-header
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-muted dark:text-foreground">
            <Settings2 size={17} />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Operator-facing Growth preferences — mailboxes, DNS, warmup, and outbound readiness live under Communications.
            </p>
          </div>
        </div>
      </section>

      <div className={GROWTH_WORKSPACE_SETTINGS_SHELL_BODY} data-growth-settings-body>
        <nav
          aria-label="Growth settings sections"
          className={GROWTH_WORKSPACE_SETTINGS_SHELL_SIDEBAR}
        >
          <div className="space-y-4">
            {GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.map((group) => (
              <div key={group.id}>
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                <ul className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const active = isGrowthWorkspaceSettingsNavItemActive(pathname, item)
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "relative flex items-center gap-2 rounded-lg px-2 py-2 pl-3 text-sm transition-colors",
                            NAV_PRIMARY_ROW_MOTION,
                            active ? GROWTH_SETTINGS_NAV_ACTIVE_ROW : cn("text-muted-foreground", NAV_ROW_INACTIVE_HOVER_CARD),
                          )}
                        >
                          {active ? (
                            <span
                              aria-hidden
                              className="absolute inset-y-1.5 left-0 w-1 rounded-full"
                              style={{ backgroundColor: NAV_SIDEBAR_ACTIVE_INDICATOR }}
                            />
                          ) : null}
                          <item.icon
                            className={cn("size-4 shrink-0", active ? GROWTH_SETTINGS_NAV_ACTIVE_ICON : "text-muted-foreground")}
                          />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className={GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT} data-growth-settings-content>
          {children}
        </div>
      </div>
    </div>
  )
}
