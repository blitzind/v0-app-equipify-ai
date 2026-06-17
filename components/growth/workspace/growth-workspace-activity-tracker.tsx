"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import {
  recordGrowthWorkspaceContinueItem,
  recordGrowthWorkspaceRecentView,
  resolveGrowthWorkspaceActivityFromPathname,
} from "@/lib/growth/workspace/growth-workspace-activity-memory"

/** Shell-level pathname tracker for recent activity and continue-working cards. */
export function GrowthWorkspaceActivityTracker() {
  const pathname = usePathname()

  useEffect(() => {
    const resolved = resolveGrowthWorkspaceActivityFromPathname(pathname)
    if (!resolved) return
    if (resolved.recent) recordGrowthWorkspaceRecentView(resolved.recent)
    if (resolved.continueItem) recordGrowthWorkspaceContinueItem(resolved.continueItem)
  }, [pathname])

  return null
}
