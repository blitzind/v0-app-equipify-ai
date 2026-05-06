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
    <div
      ref={ref}
      className="flex flex-col flex-1 min-w-0 overflow-hidden bg-background text-foreground"
    >
      {children}
    </div>
  )
}
