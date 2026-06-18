"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { useAdmin } from "@/lib/admin-store"
import { getOrganizationPlanDisplay } from "@/lib/billing/get-organization-plan-display"
import { getOrgPermissionsForRole, type OrgMemberRole, type OrgPermissions } from "@/lib/permissions/model"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { useTenant } from "@/lib/tenant-store"
import { cn } from "@/lib/utils"
import {
  NAV_ICON_INACTIVE_CARD,
  NAV_PRIMARY_ROW_MOTION,
  NAV_ROW_ACTIVE_SIDEBAR,
  NAV_ROW_INACTIVE_HOVER_CARD,
  NAV_SIDEBAR_ACTIVE_INDICATOR,
} from "@/lib/navigation-chrome"
import {
  WORKSPACE_SETTINGS_NAV_QA_MARKER,
  buildWorkspaceSettingsRootCategories,
  isWorkspaceSettingsNavItemActive,
  type WorkspaceSettingsNavContext,
} from "@/lib/settings/workspace-settings-navigation"
import {
  isDataAdministrationSettingsNavVisible,
  isGrowthEngineSettingsNavVisible,
} from "@/lib/settings/workspace-settings-visibility"

function resolveSettingsNavPermissions(args: {
  role: OrgMemberRole | null
  status: "loading" | "ready" | "no_org"
}): OrgPermissions {
  if (args.status !== "ready" || !args.role) return getOrgPermissionsForRole("owner")
  return getOrgPermissionsForRole(args.role)
}

type WorkspaceSettingsNavProps = {
  variant: "mobile" | "desktop"
}

export function WorkspaceSettingsNav({ variant }: WorkspaceSettingsNavProps) {
  const pathname = usePathname()
  const { role, status } = useOrgPermissions()
  const { isPlatformAdmin } = useAdmin()
  const { workspace } = useTenant()

  const navPermissions = resolveSettingsNavPermissions({ role, status })

  const planCategoryLabel = useMemo(
    () =>
      getOrganizationPlanDisplay({
        planId: workspace.planId,
        tenantSubscription: workspace.organizationSubscription,
      }),
    [workspace.planId, workspace.organizationSubscription],
  )

  const navContext: WorkspaceSettingsNavContext = useMemo(
    () => ({
      permissions: navPermissions,
      growthEngineNavVisible: isGrowthEngineSettingsNavVisible({ isPlatformAdmin }),
      dataAdministrationNavVisible: isDataAdministrationSettingsNavVisible({ isPlatformAdmin }),
    }),
    [navPermissions, isPlatformAdmin],
  )

  const rootCategories = useMemo(
    () =>
      buildWorkspaceSettingsRootCategories({
        planCategoryLabel,
        ctx: navContext,
      }),
    [planCategoryLabel, navContext],
  )

  if (variant === "mobile") {
    const flatItems = rootCategories.flatMap((category) =>
      category.groups.flatMap((group) => group.items),
    )

    return (
      <nav
        className="md:hidden flex items-center gap-1 overflow-x-auto scrollbar-none border-b border-border bg-card px-3 py-2 -mx-4 sticky top-0 z-20"
        aria-label="Settings navigation"
        data-qa-marker={WORKSPACE_SETTINGS_NAV_QA_MARKER}
        data-workspace-settings-nav-variant="mobile"
      >
        {flatItems.map((item) => {
          const active = isWorkspaceSettingsNavItemActive(pathname, item)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium shrink-0 min-h-[44px]",
                NAV_PRIMARY_ROW_MOTION,
                active ? "bg-primary/10 text-primary" : NAV_ROW_INACTIVE_HOVER_CARD,
              )}
            >
              <Icon size={14} className={active ? "text-primary" : NAV_ICON_INACTIVE_CARD} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav
      className="hidden md:flex w-56 shrink-0 flex-col gap-4 sticky top-4"
      aria-label="Settings navigation"
      data-qa-marker={WORKSPACE_SETTINGS_NAV_QA_MARKER}
      data-workspace-settings-nav-variant="desktop"
      data-workspace-settings-plan-label={planCategoryLabel}
    >
      {rootCategories.map((category) => (
        <div key={category.id} className="space-y-2">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {category.label}
          </p>
          {category.groups.map((group) => (
            <div key={group.id} className="space-y-0.5">
              {category.groups.length > 1 || category.id !== "general" ? (
                <p className="px-2 pt-1 text-[11px] font-medium text-muted-foreground/80">{group.label}</p>
              ) : null}
              {group.items.map((item) => {
                const active = isWorkspaceSettingsNavItemActive(pathname, item)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                      NAV_PRIMARY_ROW_MOTION,
                      active
                        ? cn(NAV_ROW_ACTIVE_SIDEBAR, "font-medium")
                        : NAV_ROW_INACTIVE_HOVER_CARD,
                    )}
                  >
                    {active ? (
                      <span
                        className={cn("absolute inset-y-1 left-0 w-0.5 rounded-full", NAV_SIDEBAR_ACTIVE_INDICATOR)}
                      />
                    ) : null}
                    <item.icon size={15} className={active ? "text-primary" : NAV_ICON_INACTIVE_CARD} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      ))}
    </nav>
  )
}
