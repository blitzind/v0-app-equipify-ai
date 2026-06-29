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
  SETTINGS_NAV_ACTIVE_ROW,
  SETTINGS_NAV_GROUP_LABEL,
  SETTINGS_NAV_GROUPS,
  SETTINGS_NAV_LIST,
  SETTINGS_NAV_SIDEBAR_CONTAINER,
  SETTINGS_NAV_SUBGROUP_LABEL,
  settingsNavIconClassName,
} from "@/lib/settings/settings-nav-chrome"
import {
  NAV_PRIMARY_ROW_MOTION,
  NAV_ROW_INACTIVE_HOVER_CARD,
} from "@/lib/navigation-chrome"
import {
  WORKSPACE_SETTINGS_NAV_QA_MARKER,
  buildWorkspaceSettingsRootCategories,
  isRenderableWorkspaceSettingsNavItem,
  isWorkspaceSettingsNavItemActive,
  type WorkspaceSettingsNavContext,
  type WorkspaceSettingsNavItem,
} from "@/lib/settings/workspace-settings-navigation"
import {
  isDataAdministrationSettingsNavVisible,
  isGrowthEngineSettingsNavVisible,
} from "@/lib/settings/workspace-settings-visibility"
import { SettingsNavItemLink } from "@/components/settings/settings-nav-item-link"

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
  const pathname = usePathname() ?? ""
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

  const renderNavItem = (item: WorkspaceSettingsNavItem, iconSize: number) => {
    if (!isRenderableWorkspaceSettingsNavItem(item)) {
      return null
    }

    const active = isWorkspaceSettingsNavItemActive(pathname, item)
    const Icon = item.icon

    if (variant === "desktop") {
      return (
        <SettingsNavItemLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={Icon}
          active={active}
        />
      )
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium min-h-[44px]",
          NAV_PRIMARY_ROW_MOTION,
          active ? SETTINGS_NAV_ACTIVE_ROW : NAV_ROW_INACTIVE_HOVER_CARD,
        )}
      >
        <Icon size={iconSize} className={settingsNavIconClassName(active)} />
        <span>{item.label}</span>
      </Link>
    )
  }

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
        {flatItems.map((item) => renderNavItem(item, 14))}
      </nav>
    )
  }

  return (
    <nav
      className={cn("hidden md:flex flex-col", SETTINGS_NAV_SIDEBAR_CONTAINER)}
      aria-label="Settings navigation"
      data-qa-marker={WORKSPACE_SETTINGS_NAV_QA_MARKER}
      data-workspace-settings-nav-variant="desktop"
      data-workspace-settings-plan-label={planCategoryLabel}
    >
      <div className={SETTINGS_NAV_GROUPS}>
        {rootCategories.map((category) => (
          <div key={category.id}>
            <p className={SETTINGS_NAV_GROUP_LABEL}>{category.label}</p>
            {category.groups.map((group) => (
              <div key={group.id}>
                {category.groups.length > 1 || category.id !== "general" ? (
                  <p className={SETTINGS_NAV_SUBGROUP_LABEL}>{group.label}</p>
                ) : null}
                <div className={SETTINGS_NAV_LIST}>
                  {group.items.map((item) => renderNavItem(item, 15))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </nav>
  )
}
