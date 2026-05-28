"use client"

import { useCallback, useEffect, type ReactNode } from "react"
import { useWorkspaceAppearance } from "@/lib/workspace-appearance-context"

/** Wraps main workspace (sidebar excluded). Ref target for Radix/Vaul portals (`portalContainer`). */
export function DashboardWorkspaceShell({ children }: { children: ReactNode }) {
  const { setPortalContainer } = useWorkspaceAppearance()

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      setPortalContainer(node)
    },
    [setPortalContainer],
  )

  useEffect(() => {
    return () => setPortalContainer(null)
  }, [setPortalContainer])

  return (
    <div ref={ref} className="flex min-h-0 flex-1 flex-col min-w-0 bg-background text-foreground">
      <div className="flex min-h-0 flex-1 flex-col min-w-0 overflow-hidden">{children}</div>
    </div>
  )
}
