"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import { ApolloPrimaryContactEnrollmentApprovalQueuePanel } from "@/components/growth/apollo-primary-contact-enrollment-approval-queue-panel"
import {
  ApolloEnrollmentAutomationQueuePanel,
  ApolloEnrollmentFunnelDashboard,
} from "@/components/growth/apollo-enrollment-automation-panel"
import {
  ApolloVoiceDropAutomationQueuePanel,
  ApolloVoiceDropFunnelDashboard,
} from "@/components/growth/apollo-voice-drop-automation-panel"
import {
  ApolloMultichannelOrchestrationQueuePanel,
  ApolloMultichannelOrchestrationFunnelDashboard,
} from "@/components/growth/apollo-multichannel-orchestration-panel"
import {
  ApolloSequenceExecutionAutomationQueuePanel,
  ApolloSequenceExecutionFunnelDashboard,
} from "@/components/growth/apollo-sequence-execution-automation-panel"
import { ApolloOperatorScalePanel } from "@/components/growth/apollo-operator-scale-panel"
import { ApolloPilotOperationsPanel } from "@/components/growth/apollo-pilot-operations-panel"
import { GrowthEnrollmentExecutionContext } from "@/components/growth/growth-enrollment-execution-context"
import { GrowthSequenceExecutionFoundationDashboard } from "@/components/growth/growth-sequence-execution-foundation-dashboard"
import { GrowthSequenceSafeExecutionDashboard } from "@/components/growth/growth-sequence-safe-execution-dashboard"
import { AidenOperatorGuidePanel } from "@/components/growth/aiden-operator-guide-panel"
import { OutboundLaunchContextBanner } from "@/components/growth/outbound-launch/outbound-launch-context-banner"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"

export function GrowthSequenceExecutionPanels() {
  const searchParams = useSearchParams()
  const highlightEnrollmentId = searchParams.get("highlight")
  const filterLeadId = searchParams.get("leadId")
  const contextEnrollmentId = searchParams.get("enrollmentId")
  const sequencePatternId = searchParams.get("sequencePatternId")
  const highlightJobId = searchParams.get("highlightJobId")
  const [safeExecutionRefreshKey, setSafeExecutionRefreshKey] = useState(0)

  const onSchedulerComplete = useCallback(() => {
    setSafeExecutionRefreshKey((value) => value + 1)
  }, [])

  return (
    <GrowthSectionLayout>
      <AidenOperatorGuidePanel className="mb-6" pinned />
      <ApolloPilotOperationsPanel className="mb-6" />
      <ApolloOperatorScalePanel className="mb-6" />
      <OutboundLaunchContextBanner className="mb-4" />
      <GrowthEnrollmentExecutionContext
        enrollmentId={contextEnrollmentId}
        leadId={filterLeadId}
        sequencePatternId={sequencePatternId}
        onSchedulerComplete={onSchedulerComplete}
      />
      <ApolloEnrollmentFunnelDashboard className="mb-6" />
      <ApolloEnrollmentAutomationQueuePanel className="mb-6" />
      <ApolloVoiceDropFunnelDashboard className="mb-6" />
      <ApolloVoiceDropAutomationQueuePanel className="mb-6" />
      <ApolloMultichannelOrchestrationFunnelDashboard className="mb-6" />
      <ApolloMultichannelOrchestrationQueuePanel className="mb-6" />
      <ApolloSequenceExecutionFunnelDashboard className="mb-6" />
      <ApolloSequenceExecutionAutomationQueuePanel className="mb-6" />
      <ApolloPrimaryContactEnrollmentApprovalQueuePanel className="mb-6" />
      <GrowthSequenceSafeExecutionDashboard
        key={safeExecutionRefreshKey}
        highlightJobId={highlightJobId}
        enrollmentId={contextEnrollmentId}
      />
      <div className="mt-8">
        <GrowthSequenceExecutionFoundationDashboard
          highlightEnrollmentId={highlightEnrollmentId ?? contextEnrollmentId}
          filterLeadId={filterLeadId}
        />
      </div>
    </GrowthSectionLayout>
  )
}
