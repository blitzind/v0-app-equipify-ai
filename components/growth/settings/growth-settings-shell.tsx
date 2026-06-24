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
  GROWTH_WORKSPACE_SETTINGS_SHELL_LAYOUT_QA_MARKER,
  GROWTH_WORKSPACE_SETTINGS_SHELL_ROOT,
  GROWTH_WORKSPACE_SETTINGS_SHELL_SIDEBAR,
} from "@/lib/growth/settings/growth-workspace-settings-shell-tokens"
import { cn } from "@/lib/utils"
import { NAV_ROW_ACTIVE_SIDEBAR, NAV_SIDEBAR_ACTIVE_INDICATOR } from "@/lib/navigation-chrome"

type GrowthSettingsShellProps = {
  children: ReactNode
}

export function GrowthSettingsShell({ children }: GrowthSettingsShellProps) {
  const pathname = usePathname()

  return (
    <div
      className={GROWTH_WORKSPACE_SETTINGS_SHELL_ROOT}
      data-qa-marker={GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER}
      data-growth-settings-shell={GROWTH_WORKSPACE_SETTINGS_SHELL_LAYOUT_QA_MARKER}
      data-growth-settings-full-width="true"
    >
      <section className="w-full min-w-0 max-w-none rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
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

      <div className={GROWTH_WORKSPACE_SETTINGS_SHELL_BODY}>
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
                          className={cn(
                            "relative flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
                            active ? NAV_ROW_ACTIVE_SIDEBAR : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          )}
                        >
                          {active ? (
                            <span className={cn("absolute inset-y-1 left-0 w-0.5 rounded-full", NAV_SIDEBAR_ACTIVE_INDICATOR)} />
                          ) : null}
                          <item.icon className="size-4 shrink-0" />
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

        <div className={GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT}>{children}</div>
      </div>
    </div>
  )
}
