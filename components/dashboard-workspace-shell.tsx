"use client"

import { useCallback, useEffect, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useWorkspaceAppearance } from "@/lib/workspace-appearance-context"

/**
 * Wraps main workspace (sidebar excluded). Applies Tailwind `dark` variant scope + portal mount target.
 */
export function DashboardWorkspaceShell({ children }: { children: ReactNode }) {
  const { resolved, setPortalContainer } = useWorkspaceAppearance()

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
      className={cn(
        "flex flex-col flex-1 min-w-0 overflow-hidden bg-background text-foreground",
        resolved === "dark" && "dark",
      )}
    >
      {children}
    </div>
  )
}
