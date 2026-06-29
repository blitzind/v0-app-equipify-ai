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
  isRenderableWorkspaceSettingsNavItem,
  isWorkspaceSettingsNavItemActive,
  type WorkspaceSettingsNavContext,
  type WorkspaceSettingsNavItem,
} from "@/lib/settings/workspace-settings-navigation"
import { traceWorkspaceSettingsNavigation } from "@/lib/settings/workspace-settings-nav-trace"
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

function shouldTraceWorkspaceSettingsNav(pathname: string): boolean {
  return pathname.startsWith("/settings/growth-engine")
}

type WorkspaceSettingsNavProps = {
  variant: "mobile" | "desktop"
}

export function WorkspaceSettingsNav({ variant }: WorkspaceSettingsNavProps) {
  const pathname = usePathname() ?? ""
  const { role, status } = useOrgPermissions()
  const { isPlatformAdmin } = useAdmin()
  const { workspace } = useTenant()
  const traceNav = shouldTraceWorkspaceSettingsNav(pathname)

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

  const rootCategories = useMemo(() => {
    if (traceNav) {
      traceWorkspaceSettingsNavigation("build_root_categories_before", {
        variant,
        pathname,
        isPlatformAdmin,
        growthEngineNavVisible: navContext.growthEngineNavVisible,
      })
    }

    const categories = buildWorkspaceSettingsRootCategories({
      planCategoryLabel,
      ctx: navContext,
    })

    if (traceNav) {
      traceWorkspaceSettingsNavigation("build_root_categories_after", {
        variant,
        categoryCount: categories.length,
        categoryIds: categories.map((category) => category.id),
        itemCount: categories.reduce(
          (sum, category) => sum + category.groups.reduce((gSum, group) => gSum + group.items.length, 0),
          0,
        ),
      })
    }

    return categories
  }, [planCategoryLabel, navContext, traceNav, variant, pathname, isPlatformAdmin])

  const renderNavItem = (item: WorkspaceSettingsNavItem, iconSize: number) => {
    if (!isRenderableWorkspaceSettingsNavItem(item)) {
      if (traceNav) {
        traceWorkspaceSettingsNavigation("skip_invalid_nav_item", {
          variant,
          itemId: item?.id ?? null,
          href: item?.href ?? null,
          label: item?.label ?? null,
          hasIcon: Boolean(item?.icon),
        })
      }
      return null
    }

    const active = isWorkspaceSettingsNavItemActive(pathname, item)
    const Icon = item.icon

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          variant === "mobile"
            ? "group flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium shrink-0 min-h-[44px]"
            : "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
          NAV_PRIMARY_ROW_MOTION,
          variant === "mobile"
            ? active
              ? "bg-primary/10 text-primary"
              : NAV_ROW_INACTIVE_HOVER_CARD
            : active
              ? cn(NAV_ROW_ACTIVE_SIDEBAR, "font-medium")
              : NAV_ROW_INACTIVE_HOVER_CARD,
        )}
      >
        {variant === "desktop" && active ? (
          <span
            className={cn("absolute inset-y-1 left-0 w-0.5 rounded-full", NAV_SIDEBAR_ACTIVE_INDICATOR)}
          />
        ) : null}
        <Icon size={iconSize} className={active ? "text-primary" : NAV_ICON_INACTIVE_CARD} />
        <span className={variant === "desktop" ? "truncate" : undefined}>{item.label}</span>
      </Link>
    )
  }

  if (variant === "mobile") {
    if (traceNav) {
      traceWorkspaceSettingsNavigation("mobile_flat_items_before", {
        categoryCount: rootCategories.length,
      })
    }

    const flatItems = rootCategories.flatMap((category) =>
      category.groups.flatMap((group) => group.items),
    )

    if (traceNav) {
      traceWorkspaceSettingsNavigation("mobile_flat_items_after", {
        itemCount: flatItems.length,
        hrefs: flatItems.map((item) => item.href),
        labels: flatItems.map((item) => item.label),
      })
    }

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

  if (traceNav) {
    traceWorkspaceSettingsNavigation("desktop_categories_before_render", {
      categoryCount: rootCategories.length,
      categoryIds: rootCategories.map((category) => category.id),
    })
  }

  return (
    <nav
      className="hidden md:flex w-56 shrink-0 flex-col gap-4 sticky top-4 self-start"
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
          {category.groups.map((group) => {
            if (traceNav) {
              traceWorkspaceSettingsNavigation("desktop_group_before_render", {
                categoryId: category.id,
                groupId: group.id,
                itemCount: group.items.length,
                itemHrefs: group.items.map((item) => item.href),
                itemLabels: group.items.map((item) => item.label),
              })
            }

            return (
              <div key={group.id} className="space-y-0.5">
                {category.groups.length > 1 || category.id !== "general" ? (
                  <p className="px-2 pt-1 text-[11px] font-medium text-muted-foreground/80">{group.label}</p>
                ) : null}
                {group.items.map((item) => renderNavItem(item, 15))}
              </div>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
