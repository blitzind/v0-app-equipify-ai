"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { useAiEmployeeStatus } from "@/components/growth/ai-teammate/ai-employee-status-provider"
import { synthesizeGrowthHomeExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER } from "@/lib/growth/workspace/growth-workspace-action-first-1f"
import {
  GROWTH_AIOS_HOME_PREMIUM_UX_1A_QA_MARKER,
  GROWTH_HOME_CUSTOMER_GROWTH_SUBTITLE,
  GROWTH_HOME_OPERATIONAL_READINESS_SUBTITLE,
  GROWTH_HOME_OPERATIONAL_READINESS_TITLE,
} from "@/lib/growth/workspace/executive-briefing/growth-home-premium-ux-1a"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type { GrowthWorkspaceRecentView, GrowthWorkspaceContinueItem } from "@/lib/growth/workspace/growth-workspace-activity-memory"
import { formatRelativeTime } from "@/lib/notifications/format-relative"
import { GrowthHomeExecutiveBriefingHeroSection } from "@/components/growth/workspace/executive-briefing/growth-home-executive-briefing-hero-section"
import { GrowthHomeAiOsWaitingOnYouSection } from "@/components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section"
import { GrowthHomeAvaOpportunityIntelligenceSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-opportunity-intelligence-section"
import { GrowthHomeDatamoonSourcingWorkbenchSection } from "@/components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section"
import { GrowthHomeAvaLiveStatusSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-live-status-section"
import { GrowthHomeBusinessProfileSection } from "@/components/growth/workspace/executive-briefing/growth-home-business-profile-section"
import { GrowthHomeDailyWorkQueueSection } from "@/components/growth/workspace/executive-briefing/growth-home-daily-work-queue-section"
import { GrowthHomeMissionCenterSection } from "@/components/growth/workspace/executive-briefing/growth-home-mission-center-section"
import { GrowthHomeMarketingMissionsSection } from "@/components/growth/workspace/executive-briefing/growth-home-marketing-missions-section"
import { GrowthHomeThroughputSection } from "@/components/growth/workspace/executive-briefing/growth-home-throughput-section"
import { GrowthHomeMailboxDomainHealthSection } from "@/components/growth/workspace/executive-briefing/growth-home-mailbox-domain-health-section"
import { GrowthHomeAutonomousReadinessSection } from "@/components/growth/workspace/executive-briefing/growth-home-autonomous-readiness-section"
import { GrowthHomeCustomerSuccessMissionsSection } from "@/components/growth/workspace/executive-briefing/growth-home-customer-success-missions-section"
import { GrowthHomeCustomerHealthSection } from "@/components/growth/workspace/executive-briefing/growth-home-customer-health-section"
import { GrowthHomeExpansionOpportunitiesSection } from "@/components/growth/workspace/executive-briefing/growth-home-expansion-opportunities-section"
import { GrowthHomeRenewalsMonitoringSection } from "@/components/growth/workspace/executive-briefing/growth-home-renewals-monitoring-section"
import { GrowthHomeCustomerWinsSection } from "@/components/growth/workspace/executive-briefing/growth-home-customer-wins-section"
import { GrowthHomeCustomerGrowthEmptySection } from "@/components/growth/workspace/executive-briefing/growth-home-customer-growth-empty-section"
import { GrowthHomeTimelineSection } from "@/components/growth/workspace/executive-briefing/growth-home-timeline-section"
import { GrowthHomeInitiativeRecommendationsSection } from "@/components/growth/workspace/executive-briefing/growth-home-initiative-recommendations-section"
import { GrowthHomeNeedsReviewSection } from "@/components/growth/workspace/executive-briefing/growth-home-needs-review-section"
import { GrowthHomeWorkSummarySection } from "@/components/growth/workspace/executive-briefing/growth-home-work-summary-section"
import { GrowthHomeRecommendationCard } from "@/components/growth/workspace/executive-briefing/growth-home-recommendation-card"
import { GrowthHomeCheckInSection } from "@/components/growth/workspace/executive-briefing/growth-home-check-in-section"
import { GrowthHomeMissionHealthSection } from "@/components/growth/workspace/executive-briefing/growth-home-mission-health-section"
import { GrowthHomeRevenueForecastSection } from "@/components/growth/workspace/executive-briefing/growth-home-revenue-forecast-section"
import { GrowthHomeBusinessSnapshotSection } from "@/components/growth/workspace/executive-briefing/growth-home-business-snapshot-section"
import { GrowthHomeDailyBriefingSection } from "@/components/growth/workspace/executive-briefing/growth-home-daily-briefing-section"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

type Props = {
  dashboard: GrowthWorkspaceDashboardViewModel
  recentViews: GrowthWorkspaceRecentView[]
  continueItems: GrowthWorkspaceContinueItem[]
  everythingElse: React.ReactNode
}

export function GrowthHomeExecutiveBriefingDashboard({ dashboard, recentViews, continueItems, everythingElse }: Props) {
  const [secondaryOpen, setSecondaryOpen] = useState(false)
  const { teammate } = useAiTeammateIdentity()
  const { setStatus } = useAiEmployeeStatus()

  const briefing = useMemo(
    () => synthesizeGrowthHomeExecutiveBriefing({ dashboard, recentViews, continueItems, teammate }),
    [dashboard, recentViews, continueItems, teammate],
  )

  useEffect(() => {
    setStatus(briefing.employeeStatus)
    return () => setStatus(null)
  }, [briefing.employeeStatus, setStatus])

  const lastUpdateLabel = formatRelativeTime(briefing.generatedAt)
  const { aiOsUx } = briefing
  const hasCustomerGrowthContent =
    briefing.customerSuccessMissions.length > 0 ||
    briefing.customerHealth.length > 0 ||
    briefing.expansionOpportunities.length > 0 ||
    briefing.renewalsMonitoring.length > 0 ||
    briefing.customerWins.length > 0

  return (
    <div
      className="space-y-10"
      data-qa-marker={GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER}
      data-qa-marker-premium-ux={GROWTH_AIOS_HOME_PREMIUM_UX_1A_QA_MARKER}
      data-growth-action-first-order="actions-before-metrics"
      data-qa-marker-action-first={GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER}
    >
      <GrowthHomeExecutiveBriefingHeroSection
        hero={aiOsUx.hero}
        statusLabel={briefing.checkIn.status.label}
        activityLabel={briefing.checkIn.status.activityLabel}
        lastUpdateLabel={lastUpdateLabel}
        executiveRecommendation={briefing.executiveRecommendation}
        recommendation={briefing.recommendation}
      />

      <GrowthHomeAiOsWaitingOnYouSection aiOsUx={aiOsUx} />

      <GrowthHomeMissionCenterSection dashboard={dashboard} />

      <GrowthHomeBusinessProfileSection />

      <GrowthHomeDatamoonSourcingWorkbenchSection />

      <GrowthHomeAvaOpportunityIntelligenceSection dailyWorkQueue={aiOsUx.dailyWorkQueue} />

      <GrowthHomeMarketingMissionsSection missions={briefing.marketingMissions} />

      <section
        data-qa-section="home-customer-growth"
        className="rounded-2xl border border-border/70 bg-card p-6 space-y-5"
      >
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Customer Growth</h2>
          <p className="mt-1 text-sm text-muted-foreground">{GROWTH_HOME_CUSTOMER_GROWTH_SUBTITLE}</p>
        </div>
        <GrowthHomeCustomerSuccessMissionsSection missions={briefing.customerSuccessMissions} />
        {hasCustomerGrowthContent ? (
          <div className="space-y-5">
            <GrowthHomeCustomerHealthSection items={briefing.customerHealth} />
            <GrowthHomeExpansionOpportunitiesSection items={briefing.expansionOpportunities} />
            <GrowthHomeRenewalsMonitoringSection items={briefing.renewalsMonitoring} />
            <GrowthHomeCustomerWinsSection wins={briefing.customerWins} />
          </div>
        ) : (
          <GrowthHomeCustomerGrowthEmptySection />
        )}
      </section>

      <GrowthHomeTimelineSection periods={briefing.timeline} />

      <section data-qa-section="home-operational-readiness" className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{GROWTH_HOME_OPERATIONAL_READINESS_TITLE}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{GROWTH_HOME_OPERATIONAL_READINESS_SUBTITLE}</p>
        </div>
        <div className="space-y-5">
          <GrowthHomeMailboxDomainHealthSection health={aiOsUx.mailboxDomainHealth} />
          <GrowthHomeAutonomousReadinessSection readiness={aiOsUx.autonomousReadiness} />
        </div>
      </section>

      <Collapsible open={secondaryOpen} onOpenChange={setSecondaryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="gap-2 px-0 text-muted-foreground hover:text-foreground">
            <ChevronDown className={`size-4 transition-transform ${secondaryOpen ? "rotate-180" : ""}`} />
            {secondaryOpen ? "Hide additional tools" : "Show additional tools"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-6 pt-4" data-qa-section="home-everything-else">
          <GrowthHomeDailyWorkQueueSection items={aiOsUx.dailyWorkQueue} buckets={aiOsUx.dailyWorkQueueBuckets} />
          <GrowthHomeAvaLiveStatusSection status={aiOsUx.liveStatus} />
          <GrowthHomeThroughputSection metrics={aiOsUx.throughput} />
          <GrowthHomeCheckInSection checkIn={briefing.checkIn} lastUpdateLabel={lastUpdateLabel} />
          <GrowthHomeMissionHealthSection items={briefing.missionHealth} />
          <GrowthHomeRevenueForecastSection forecast={briefing.revenueForecast} />
          <GrowthHomeDailyBriefingSection briefing={briefing.dailyBriefing} />
          <GrowthHomeBusinessSnapshotSection metrics={briefing.businessSnapshot} />
          <GrowthHomeInitiativeRecommendationsSection recommendations={briefing.initiativeRecommendations} />
          <GrowthHomeNeedsReviewSection needsReview={briefing.needsReview} />
          <GrowthHomeWorkSummarySection categories={briefing.workSummary} />
          <GrowthHomeRecommendationCard
            recommendation={null}
            additionalRecommendations={briefing.additionalRecommendations}
          />
          {everythingElse}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
