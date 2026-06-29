"use client"

import type { ReactNode } from "react"
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
import { SettingsNavItemLink } from "@/components/settings/settings-nav-item-link"
import {
  SETTINGS_NAV_GROUP_LABEL,
  SETTINGS_NAV_GROUPS,
  SETTINGS_NAV_LIST,
} from "@/lib/settings/settings-nav-chrome"

type GrowthSettingsShellProps = {
  children: ReactNode
}

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
          <div className={SETTINGS_NAV_GROUPS}>
            {GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.map((group) => (
              <div key={group.id}>
                <p className={SETTINGS_NAV_GROUP_LABEL}>{group.label}</p>
                <ul className={SETTINGS_NAV_LIST}>
                  {group.items.map((item) => {
                    const active = isGrowthWorkspaceSettingsNavItemActive(pathname, item)
                    return (
                      <li key={item.id}>
                        <SettingsNavItemLink
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          active={active}
                        />
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
