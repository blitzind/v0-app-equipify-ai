"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { GrowthAvaCompletedWorkPanel } from "@/components/growth/ai-os/approvals/growth-ava-completed-work-panel"
import { isGrowthWorkspaceFirstUx1aEnabledClient } from "@/lib/growth/navigation/growth-workspace-first-ux-1a-feature"
import { GROWTH_REVIEW_PAGE_HREF } from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"

export default function GrowthAvaCompletedWorkPage() {
  const router = useRouter()
  const ux1aActive = isGrowthWorkspaceFirstUx1aEnabledClient()

  useEffect(() => {
    if (!ux1aActive) return
    router.replace(GROWTH_REVIEW_PAGE_HREF)
  }, [router, ux1aActive])

  if (ux1aActive) {
    return <p className="text-sm text-muted-foreground">Opening Review…</p>
  }

  return <GrowthAvaCompletedWorkPanel />
}
