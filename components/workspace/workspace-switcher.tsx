"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-registry"

export const WORKSPACE_SWITCHER_QA_MARKER = "workspace-switcher-v1" as const

const WORKSPACES = [
  { id: "core", label: "Equipify Core", href: "/" as const },
  { id: "growth", label: "Growth Engine", href: GROWTH_WORKSPACE_BASE_PATH },
] as const

type WorkspaceSwitcherProps = {
  compact?: boolean
  className?: string
}

export function WorkspaceSwitcher({ compact = false, className }: WorkspaceSwitcherProps) {
  const pathname = usePathname()
  const growthActive = pathname === GROWTH_WORKSPACE_BASE_PATH || pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/`)

  return (
    <nav
      aria-label="Workspace switcher"
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/40 p-1",
        compact ? "text-[11px]" : "text-xs",
        className,
      )}
      data-qa-marker={WORKSPACE_SWITCHER_QA_MARKER}
    >
      {WORKSPACES.map((workspace) => {
        const active = workspace.id === "growth" ? growthActive : !growthActive
        return (
          <Link
            key={workspace.id}
            href={workspace.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {workspace.label}
          </Link>
        )
      })}
    </nav>
  )
}
