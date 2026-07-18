"use client"

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PlayCircle } from "lucide-react"
import { GeV15AutomationRuntimeApprovalInbox } from "@/components/growth/automation/ge-v1-5-automation-runtime-approval-inbox"
import { GrowthSequenceExecutionPanels } from "@/components/growth/sequences/growth-sequence-execution-panels"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { isGrowthWorkspaceFirstUx1aEnabledClient } from "@/lib/growth/navigation/growth-workspace-first-ux-1a-feature"
import { buildGrowthReviewHref } from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"

function SequenceExecutionFallback() {
  return <p className="text-sm text-muted-foreground">Loading sequence execution…</p>
}

export default function GrowthCampaignsSequenceExecutionPage() {
  const router = useRouter()
  const ux1aActive = isGrowthWorkspaceFirstUx1aEnabledClient()

  useEffect(() => {
    if (!ux1aActive) return
    router.replace(buildGrowthReviewHref({ tab: "sends" }))
  }, [router, ux1aActive])

  if (ux1aActive) {
    return (
      <GrowthWorkspacePageContent>
        <p className="text-sm text-muted-foreground">Opening Review…</p>
      </GrowthWorkspacePageContent>
    )
  }

  return (
    <GrowthWorkspacePageContent data-growth-workspace-sequence-execution="v1">
      <GrowthWorkspacePageHeader
        title="Sequence Execution"
        description="Guided enrollments with human approval at every step — no autonomous send."
        icon={PlayCircle}
        iconClassName="bg-emerald-50 text-emerald-600"
      />

      <div className="space-y-6">
      <GeV15AutomationRuntimeApprovalInbox limit={10} />

      <Suspense fallback={<SequenceExecutionFallback />}>
        <GrowthSequenceExecutionPanels />
      </Suspense>
      </div>
    </GrowthWorkspacePageContent>
  )
}
