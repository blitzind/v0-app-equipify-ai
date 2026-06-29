"use client"

import { useEffect, useMemo } from "react"
import type { AiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-types"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { useAiEmployeeStatus } from "@/components/growth/ai-teammate/ai-employee-status-provider"
import { synthesizeGrowthAiOsOperatorExperience } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-synthesizer"
import { GROWTH_AI_OS_OPERATOR_EXPERIENCE_QA_MARKER } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"
import { formatRelativeTime } from "@/lib/notifications/format-relative"
import { GrowthAiOsExecutiveBriefSection } from "@/components/growth/ai-os/operator-experience/growth-ai-os-executive-brief-section"
import { GrowthAiOsNeedsAttentionSection } from "@/components/growth/ai-os/operator-experience/growth-ai-os-needs-attention-section"
import { GrowthAiOsAiWorkingSection } from "@/components/growth/ai-os/operator-experience/growth-ai-os-ai-working-section"
import { GrowthAiOsBusinessSnapshotSection } from "@/components/growth/ai-os/operator-experience/growth-ai-os-business-snapshot-section"
import { GrowthAiOsAiTimelineSection } from "@/components/growth/ai-os/operator-experience/growth-ai-os-ai-timeline-section"
import { GrowthAiOsOperatorSystemStatusCard } from "@/components/growth/ai-os/operator-experience/growth-ai-os-operator-system-status-card"
import { GrowthAiOsOperatorRevenueDirectorCard } from "@/components/growth/ai-os/operator-experience/growth-ai-os-operator-revenue-director-card"
import { GrowthAiOsOperatorApprovalsSummary } from "@/components/growth/ai-os/operator-experience/growth-ai-os-operator-approvals-summary"
import { GrowthAiOsOperatorCommunicationCard } from "@/components/growth/ai-os/operator-experience/growth-ai-os-operator-communication-card"
import { GrowthAiOsOperatorAiImprovementsSection } from "@/components/growth/ai-os/operator-experience/growth-ai-os-operator-ai-improvements-section"
import { GrowthAiOsDailyWorkQueueSection } from "@/components/growth/ai-os/operator-experience/growth-ai-os-daily-work-queue-section"

type Props = {
  model: AiOsCommandCenterReadModel
}

export function GrowthAiOsOperatorDashboard({ model }: Props) {
  const { teammate } = useAiTeammateIdentity()
  const { setStatus } = useAiEmployeeStatus()

  const view = useMemo(
    () =>
      synthesizeGrowthAiOsOperatorExperience({
        dashboard: model.operationsDashboard,
        dailyBriefing: model.dailyBriefing,
        needsAttention: model.needsAttention,
        revenueDirector: model.revenueDirector,
        humanApprovalCenter: model.humanApprovalCenter,
        communicationEngine: model.communicationEngine,
        boundedAutonomousOutbound: model.boundedAutonomousOutbound,
        adaptiveCalibration: model.adaptiveCalibration,
        closedLoopLearning: model.closedLoopLearning,
        teammate,
      }),
    [model, teammate],
  )

  useEffect(() => {
    const pending = view.approvalSummary?.totalPending ?? 0
    if (pending > 0) {
      setStatus({
        kind: "waiting_for_approval",
        label: "Waiting for approval",
        activityLabel: "waiting for your approval on prepared outreach",
      })
    } else if (view.needsAttention.length > 0) {
      setStatus({
        kind: "monitoring_replies",
        label: "Monitoring replies",
        activityLabel: "watching items that need your attention",
      })
    } else {
      setStatus({
        kind: "working",
        label: "Working",
        activityLabel: "advancing your revenue priorities",
      })
    }
    return () => setStatus(null)
  }, [view.approvalSummary?.totalPending, view.needsAttention.length, setStatus])

  const lastUpdateLabel = formatRelativeTime(view.generatedAt)

  return (
    <div className="space-y-12" data-qa-marker={GROWTH_AI_OS_OPERATOR_EXPERIENCE_QA_MARKER}>
      <GrowthAiOsExecutiveBriefSection brief={view.executiveBrief} lastUpdateLabel={lastUpdateLabel} />

      <GrowthAiOsDailyWorkQueueSection
        queue={model.dailyRevenueWorkQueue}
        display={model.dailyRevenueWorkQueueDisplay}
      />

      <GrowthAiOsOperatorRevenueDirectorCard
        recommendation={view.revenueRecommendation}
        revenueDirector={model.revenueDirector}
      />

      <GrowthAiOsOperatorApprovalsSummary
        summary={view.approvalSummary}
        humanApprovalCenter={model.humanApprovalCenter}
      />

      <GrowthAiOsNeedsAttentionSection items={view.needsAttention} />

      <GrowthAiOsOperatorCommunicationCard
        recommendation={view.outreachRecommendation}
        communicationEngine={model.communicationEngine}
      />

      <GrowthAiOsOperatorAiImprovementsSection items={view.aiImprovements} />

      <GrowthAiOsAiWorkingSection items={view.aiWorking} />

      <GrowthAiOsBusinessSnapshotSection metrics={view.businessSnapshot} />

      <GrowthAiOsAiTimelineSection items={view.timeline} />

      <GrowthAiOsOperatorSystemStatusCard status={view.systemStatus} />
    </div>
  )
}
