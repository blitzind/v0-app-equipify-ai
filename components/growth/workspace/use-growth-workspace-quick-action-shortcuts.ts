"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS,
  GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTION_QA_MARKER,
} from "@/lib/growth/workspace/growth-workspace-dashboard-quick-actions"
import { recordGrowthWorkspaceQuickActionUsage } from "@/lib/growth/workspace/growth-workspace-activity-memory"

export function useGrowthWorkspaceQuickActionShortcuts(enabled: boolean) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return

      const action = GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS.find((item) => item.shortcut === event.key)
      if (!action) return
      event.preventDefault()
      recordGrowthWorkspaceQuickActionUsage(action.id)
      router.push(action.href)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, router])
}

export { GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTION_QA_MARKER }
