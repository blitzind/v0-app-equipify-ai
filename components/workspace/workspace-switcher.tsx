"use client"

import Link from "next/link"
import { useMemo } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-registry"
import { getOrganizationPlanDisplay } from "@/lib/billing/get-organization-plan-display"
import { useTenant } from "@/lib/tenant-store"

const GROWTH_WORKSPACE = {
  id: "growth",
  label: "Growth Engine",
  href: GROWTH_WORKSPACE_BASE_PATH,
} as const

type WorkspaceSwitcherProps = {
  compact?: boolean
  className?: string
}

export function WorkspaceSwitcher({ compact = false, className }: WorkspaceSwitcherProps) {
  const pathname = usePathname()
  const growthActive = pathname === GROWTH_WORKSPACE_BASE_PATH || pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/`)
  const { workspace } = useTenant()

  const coreWorkspaceLabel = useMemo(
    () =>
      getOrganizationPlanDisplay({
        planId: workspace.planId,
        tenantSubscription: workspace.organizationSubscription,
      }),
    [workspace.planId, workspace.organizationSubscription],
  )

  const workspaces = useMemo(
    () => [
      { id: "core" as const, label: coreWorkspaceLabel, href: "/" as const },
      GROWTH_WORKSPACE,
    ],
    [coreWorkspaceLabel],
  )

  return (
    <nav
      aria-label="Workspace switcher"
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/40 p-1",
        compact ? "text-[11px]" : "text-xs",
        className,
      )}
      data-qa-marker="workspace-switcher-v1"
    >
      {workspaces.map((workspaceItem) => {
        const active = workspaceItem.id === "growth" ? growthActive : !growthActive
        return (
          <Link
            key={workspaceItem.id}
            href={workspaceItem.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {workspaceItem.label}
          </Link>
        )
      })}
    </nav>
  )
}
