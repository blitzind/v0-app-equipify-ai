"use client"

import { useCallback, useEffect, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useWorkspaceAppearance } from "@/lib/workspace-appearance-context"

/** Platform admin routes: same workspace appearance + portal container as dashboard. */
export function AdminWorkspaceShell({ children }: { children: ReactNode }) {
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
        "min-h-screen bg-background text-foreground",
        resolved === "dark" && "dark",
      )}
    >
      {children}
    </div>
  )
}
