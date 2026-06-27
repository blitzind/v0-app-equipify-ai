"use client"

import Link from "next/link"
import { useMemo } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-registry"
import {
  AI_OS_WORKSPACE_LABEL,
  getSubscriptionPlanShortDisplay,
} from "@/lib/workspace/ai-os-workspace-branding"
import { useTenant } from "@/lib/tenant-store"

const AI_OS_WORKSPACE = {
  id: "ai-os",
  label: AI_OS_WORKSPACE_LABEL,
  href: GROWTH_WORKSPACE_BASE_PATH,
} as const

type WorkspaceSwitcherProps = {
  compact?: boolean
  className?: string
}

export function WorkspaceSwitcher({ compact = false, className }: WorkspaceSwitcherProps) {
  const pathname = usePathname()
  const aiOsActive = pathname === GROWTH_WORKSPACE_BASE_PATH || pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/`)
  const { workspace } = useTenant()

  const planLabel = useMemo(
    () =>
      getSubscriptionPlanShortDisplay({
        planId: workspace.planId,
        tenantSubscription: workspace.organizationSubscription,
      }),
    [workspace.planId, workspace.organizationSubscription],
  )

  const workspaces = useMemo(
    () => [
      { id: "plan" as const, label: planLabel, href: "/" as const },
      AI_OS_WORKSPACE,
    ],
    [planLabel],
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
        const active = workspaceItem.id === "ai-os" ? aiOsActive : !aiOsActive
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
