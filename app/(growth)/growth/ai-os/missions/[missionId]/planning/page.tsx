"use client"

import { use } from "react"
import { ClipboardCheck } from "lucide-react"
import {
  GrowthAiOsMissionPlanningInvalidMissionEmptyState,
  GrowthAiOsMissionPlanningReviewPanel,
} from "@/components/growth/ai-os/growth-ai-os-mission-planning-review-panel"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { resolveAiOsMissionIdParam } from "@/lib/growth/aios/ai-os-mission-route-params"

type PageProps = {
  params: Promise<{ missionId: string }>
}

export default function GrowthAiOsMissionPlanningReviewPage({ params }: PageProps) {
  const { missionId: rawMissionId } = use(params)
  const missionIdResult = resolveAiOsMissionIdParam(rawMissionId)

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Mission Planning Review"
        description="Inspect Executive Mission Planning dry-run proposals before explicitly creating Work Orders."
        icon={ClipboardCheck}
        iconClassName="bg-indigo-50 text-indigo-600"
      />
      {!missionIdResult.ok ? (
        <GrowthAiOsMissionPlanningInvalidMissionEmptyState reason={missionIdResult.reason} missionId={rawMissionId} />
      ) : (
        <GrowthAiOsMissionPlanningReviewPanel missionId={missionIdResult.missionId} />
      )}
    </GrowthWorkspacePageContent>
  )
}
