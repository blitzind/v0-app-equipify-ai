"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import {
  GROWTH_HOME_EXECUTIVE_BRIEFING_2A_QA_MARKER,
  buildExecutiveSnapshotKpis,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-2a"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type { GrowthWorkspaceRecentView, GrowthWorkspaceContinueItem } from "@/lib/growth/workspace/growth-workspace-activity-memory"
import { formatRelativeTime } from "@/lib/notifications/format-relative"
import { GrowthHomeExecutiveBriefingHeroSection } from "@/components/growth/workspace/executive-briefing/growth-home-executive-briefing-hero-section"
import { GrowthHomeExecutiveSnapshotSection } from "@/components/growth/workspace/executive-briefing/growth-home-executive-snapshot-section"
import { GrowthHomeAiOsWaitingOnYouSection } from "@/components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section"
import { GrowthHomeGrowthStrategySection } from "@/components/growth/workspace/executive-briefing/growth-home-growth-strategy-section"
import { GrowthHomeAvaLiveStatusSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-live-status-section"
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
  const missionCenterRef = useRef<HTMLDivElement>(null)
  const marketingMissionsRef = useRef<HTMLDivElement>(null)
  const dailyWorkRef = useRef<HTMLDivElement>(null)

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
  const executiveSnapshot = useMemo(
    () => buildExecutiveSnapshotKpis({ hero: aiOsUx.hero, aiOsUx, dashboard }),
    [aiOsUx, dashboard],
  )
  const hasCustomerGrowthContent =
    briefing.customerSuccessMissions.length > 0 ||
    briefing.customerHealth.length > 0 ||
    briefing.expansionOpportunities.length > 0 ||
    briefing.renewalsMonitoring.length > 0 ||
    briefing.customerWins.length > 0

  const handleReviewTodaysWork = useCallback(() => {
    setSecondaryOpen(true)
    requestAnimationFrame(() => {
      dailyWorkRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [])

  const handleViewMissionCenter = useCallback(() => {
    missionCenterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const handlePrepareOutreach = useCallback(() => {
    marketingMissionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  return (
    <div
      className="space-y-8"
      data-qa-marker={GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER}
      data-qa-marker-premium-ux={GROWTH_AIOS_HOME_PREMIUM_UX_1A_QA_MARKER}
      data-qa-marker-briefing-2a={GROWTH_HOME_EXECUTIVE_BRIEFING_2A_QA_MARKER}
      data-growth-action-first-order="actions-before-metrics"
      data-qa-marker-action-first={GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER}
    >
      <GrowthHomeExecutiveBriefingHeroSection
        hero={aiOsUx.hero}
        aiOsUx={aiOsUx}
        marketingMissionCount={briefing.marketingMissions.length}
        statusLabel={briefing.checkIn.status.label}
        activityLabel={briefing.checkIn.status.activityLabel}
        lastUpdateLabel={lastUpdateLabel}
        executiveRecommendation={briefing.executiveRecommendation}
        recommendation={briefing.recommendation}
        onReviewTodaysWork={handleReviewTodaysWork}
        onViewMissionCenter={handleViewMissionCenter}
      />

      <GrowthHomeExecutiveSnapshotSection kpis={executiveSnapshot} />

      <GrowthHomeAiOsWaitingOnYouSection aiOsUx={aiOsUx} />

      <div ref={missionCenterRef}>
        <GrowthHomeMissionCenterSection dashboard={dashboard} />
      </div>

      <GrowthHomeGrowthStrategySection
        dailyWorkQueue={aiOsUx.dailyWorkQueue}
        onPrepareOutreach={handlePrepareOutreach}
      />

      <div ref={marketingMissionsRef}>
        <GrowthHomeMarketingMissionsSection missions={briefing.marketingMissions} />
      </div>

      <section
        data-qa-section="home-customer-growth"
        className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 sm:p-6"
      >
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Customer Growth</h2>
          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{GROWTH_HOME_CUSTOMER_GROWTH_SUBTITLE}</p>
        </div>
        <GrowthHomeCustomerSuccessMissionsSection missions={briefing.customerSuccessMissions} />
        {hasCustomerGrowthContent ? (
          <div className="space-y-4">
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

      <section data-qa-section="home-operational-readiness" className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{GROWTH_HOME_OPERATIONAL_READINESS_TITLE}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{GROWTH_HOME_OPERATIONAL_READINESS_SUBTITLE}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <GrowthHomeMailboxDomainHealthSection health={aiOsUx.mailboxDomainHealth} embedded />
          <GrowthHomeAutonomousReadinessSection readiness={aiOsUx.autonomousReadiness} embedded />
        </div>
      </section>

      <Collapsible open={secondaryOpen} onOpenChange={setSecondaryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="gap-2 px-0 text-muted-foreground hover:text-foreground">
            <ChevronDown className={`size-4 transition-transform ${secondaryOpen ? "rotate-180" : ""}`} />
            {secondaryOpen ? "Hide additional tools" : "Show additional tools"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-5 pt-3" data-qa-section="home-everything-else">
          <div ref={dailyWorkRef}>
            <GrowthHomeDailyWorkQueueSection items={aiOsUx.dailyWorkQueue} buckets={aiOsUx.dailyWorkQueueBuckets} />
          </div>
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
