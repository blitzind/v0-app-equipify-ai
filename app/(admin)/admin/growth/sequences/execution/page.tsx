"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import { PlayCircle } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
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
import { GrowthEnrollmentExecutionContext } from "@/components/growth/growth-enrollment-execution-context"
import { GrowthSequenceExecutionFoundationDashboard } from "@/components/growth/growth-sequence-execution-foundation-dashboard"
import { GrowthSequenceSafeExecutionDashboard } from "@/components/growth/growth-sequence-safe-execution-dashboard"
import { OutboundLaunchContextBanner } from "@/components/growth/outbound-launch/outbound-launch-context-banner"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthSequenceExecutionPage() {
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

  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <PlayCircle size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Sequence Execution</h1>
              <p className="text-sm text-muted-foreground">
                Guided enrollments with human approval at every step — no autonomous send.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
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
      </div>
    </PlatformAdminPageShell>
  )
}
