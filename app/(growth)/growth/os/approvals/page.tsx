"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { GrowthAvaCompletedWorkPanel } from "@/components/growth/ai-os/approvals/growth-ava-completed-work-panel"
import { isGrowthWorkspaceFirstUx1aEnabledClient } from "@/lib/growth/navigation/growth-workspace-first-ux-1a-feature"
import { remapLegacyHrefToGrowthReview } from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"

export default function GrowthAvaCompletedWorkPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ux1aActive = isGrowthWorkspaceFirstUx1aEnabledClient()

  useEffect(() => {
    if (!ux1aActive) return
    const query = searchParams.toString()
    const legacyHref = query ? `/growth/os/approvals?${query}` : "/growth/os/approvals"
    router.replace(remapLegacyHrefToGrowthReview(legacyHref))
  }, [router, searchParams, ux1aActive])

  if (ux1aActive) {
    return <p className="text-sm text-muted-foreground">Opening Review…</p>
  }

  return <GrowthAvaCompletedWorkPanel />
}
