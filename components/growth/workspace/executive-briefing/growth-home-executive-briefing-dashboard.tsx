"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { useAiEmployeeStatus } from "@/components/growth/ai-teammate/ai-employee-status-provider"
import { synthesizeGrowthHomeExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type { GrowthWorkspaceRecentView, GrowthWorkspaceContinueItem } from "@/lib/growth/workspace/growth-workspace-activity-memory"
import { formatRelativeTime } from "@/lib/notifications/format-relative"
import { GrowthHomeCheckInSection } from "@/components/growth/workspace/executive-briefing/growth-home-check-in-section"
import { GrowthHomeActiveRevenueMissionsSection } from "@/components/growth/workspace/executive-briefing/growth-home-active-revenue-missions-section"
import { GrowthHomeMarketingMissionsSection } from "@/components/growth/workspace/executive-briefing/growth-home-marketing-missions-section"
import { GrowthHomeCampaignPerformanceSection } from "@/components/growth/workspace/executive-briefing/growth-home-campaign-performance-section"
import { GrowthHomeContentPreparingSection } from "@/components/growth/workspace/executive-briefing/growth-home-content-preparing-section"
import { GrowthHomeAudienceIntelligenceSection } from "@/components/growth/workspace/executive-briefing/growth-home-audience-intelligence-section"
import { GrowthHomeMarketingContributionSection } from "@/components/growth/workspace/executive-briefing/growth-home-marketing-contribution-section"
import { GrowthHomeCustomerSuccessMissionsSection } from "@/components/growth/workspace/executive-briefing/growth-home-customer-success-missions-section"
import { GrowthHomeCustomerHealthSection } from "@/components/growth/workspace/executive-briefing/growth-home-customer-health-section"
import { GrowthHomeExpansionOpportunitiesSection } from "@/components/growth/workspace/executive-briefing/growth-home-expansion-opportunities-section"
import { GrowthHomeRenewalsMonitoringSection } from "@/components/growth/workspace/executive-briefing/growth-home-renewals-monitoring-section"
import { GrowthHomeCustomerWinsSection } from "@/components/growth/workspace/executive-briefing/growth-home-customer-wins-section"
import { GrowthHomeCsContributionSection } from "@/components/growth/workspace/executive-briefing/growth-home-cs-contribution-section"
import { GrowthHomeServiceMissionsSection } from "@/components/growth/workspace/executive-briefing/growth-home-service-missions-section"
import { GrowthHomeServiceHealthSection } from "@/components/growth/workspace/executive-briefing/growth-home-service-health-section"
import { GrowthHomeTechnicianAwarenessSection } from "@/components/growth/workspace/executive-briefing/growth-home-technician-awareness-section"
import { GrowthHomeServiceFollowUpsSection } from "@/components/growth/workspace/executive-briefing/growth-home-service-follow-ups-section"
import { GrowthHomeOperationalInsightsSection } from "@/components/growth/workspace/executive-briefing/growth-home-operational-insights-section"
import { GrowthHomeServiceContributionSection } from "@/components/growth/workspace/executive-briefing/growth-home-service-contribution-section"
import { GrowthHomeMissionHealthSection } from "@/components/growth/workspace/executive-briefing/growth-home-mission-health-section"
import { isGrowthHomeServiceOperatorVisible } from "@/lib/workspace/ai-os-v1-product-alignment"
import { GrowthHomeRevenueForecastSection } from "@/components/growth/workspace/executive-briefing/growth-home-revenue-forecast-section"
import { GrowthHomeNextPlannedActionsSection } from "@/components/growth/workspace/executive-briefing/growth-home-next-planned-actions-section"
import { GrowthHomeMissionTimelineSection } from "@/components/growth/workspace/executive-briefing/growth-home-mission-timeline-section"
import { GrowthHomeDailyBriefingSection } from "@/components/growth/workspace/executive-briefing/growth-home-daily-briefing-section"
import { GrowthHomeSinceWeLastMetSection } from "@/components/growth/workspace/executive-briefing/growth-home-since-we-last-met-section"
import { GrowthHomeWhatChangedSection } from "@/components/growth/workspace/executive-briefing/growth-home-what-changed-section"
import { GrowthHomeRecommendationContinuitySection } from "@/components/growth/workspace/executive-briefing/growth-home-recommendation-continuity-section"
import { GrowthHomeOurProgressSection } from "@/components/growth/workspace/executive-briefing/growth-home-our-progress-section"
import { GrowthHomeMilestonesSection } from "@/components/growth/workspace/executive-briefing/growth-home-milestones-section"
import { GrowthHomeTrustSection } from "@/components/growth/workspace/executive-briefing/growth-home-trust-section"
import { GrowthHomeWaitingOnYouSection } from "@/components/growth/workspace/executive-briefing/growth-home-waiting-on-you-section"
import { GrowthHomeMyPrioritiesSection } from "@/components/growth/workspace/executive-briefing/growth-home-my-priorities-section"
import { GrowthHomeWeeklyGoalsSection } from "@/components/growth/workspace/executive-briefing/growth-home-weekly-goals-section"
import { GrowthHomeAccomplishmentsSection } from "@/components/growth/workspace/executive-briefing/growth-home-accomplishments-section"
import { GrowthHomeBiggestWinSection } from "@/components/growth/workspace/executive-briefing/growth-home-biggest-win-section"
import { GrowthHomeBiggestRiskSection } from "@/components/growth/workspace/executive-briefing/growth-home-biggest-risk-section"
import { GrowthHomeThingsNoticedSection } from "@/components/growth/workspace/executive-briefing/growth-home-things-noticed-section"
import { GrowthHomeAiWorkloadSection } from "@/components/growth/workspace/executive-briefing/growth-home-ai-workload-section"
import { GrowthHomeWatchingSection } from "@/components/growth/workspace/executive-briefing/growth-home-watching-section"
import { GrowthHomeBusinessSnapshotSection } from "@/components/growth/workspace/executive-briefing/growth-home-business-snapshot-section"
import { GrowthHomeTimelineSection } from "@/components/growth/workspace/executive-briefing/growth-home-timeline-section"
import { GrowthHomeExecutiveRecommendationSection } from "@/components/growth/workspace/executive-briefing/growth-home-executive-recommendation-section"
import { GrowthHomeInitiativeRecommendationsSection } from "@/components/growth/workspace/executive-briefing/growth-home-initiative-recommendations-section"
import { GrowthHomeRecommendationCard } from "@/components/growth/workspace/executive-briefing/growth-home-recommendation-card"
import { GrowthHomeNeedsReviewSection } from "@/components/growth/workspace/executive-briefing/growth-home-needs-review-section"
import { GrowthHomeWorkSummarySection } from "@/components/growth/workspace/executive-briefing/growth-home-work-summary-section"
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
  const showDeliveryIntelligence = isGrowthHomeServiceOperatorVisible()

  return (
    <div className="space-y-10" data-qa-marker={GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER}>
      <GrowthHomeCheckInSection checkIn={briefing.checkIn} lastUpdateLabel={lastUpdateLabel} />

      <GrowthHomeActiveRevenueMissionsSection missions={briefing.activeRevenueMissions} />

      <GrowthHomeMissionHealthSection items={briefing.missionHealth} />

      <GrowthHomeRevenueForecastSection forecast={briefing.revenueForecast} />

      <GrowthHomeNextPlannedActionsSection actions={briefing.nextPlannedActions} />

      <GrowthHomeMissionTimelineSection items={briefing.missionTimeline} />

      <GrowthHomeMarketingMissionsSection missions={briefing.marketingMissions} />

      <GrowthHomeCampaignPerformanceSection items={briefing.campaignPerformance} />

      <GrowthHomeContentPreparingSection items={briefing.contentPreparing} />

      <GrowthHomeAudienceIntelligenceSection items={briefing.audienceIntelligence} />

      <GrowthHomeMarketingContributionSection contribution={briefing.marketingContribution} />

      <GrowthHomeCustomerSuccessMissionsSection missions={briefing.customerSuccessMissions} />

      <GrowthHomeCustomerHealthSection items={briefing.customerHealth} />

      <GrowthHomeExpansionOpportunitiesSection items={briefing.expansionOpportunities} />

      <GrowthHomeRenewalsMonitoringSection items={briefing.renewalsMonitoring} />

      <GrowthHomeCustomerWinsSection wins={briefing.customerWins} />

      <GrowthHomeCsContributionSection contribution={briefing.csContribution} />

      {showDeliveryIntelligence ? (
        <>
          <GrowthHomeServiceMissionsSection missions={briefing.serviceMissions} />

          <GrowthHomeServiceHealthSection items={briefing.serviceHealth} />

          <GrowthHomeTechnicianAwarenessSection items={briefing.technicianAwareness} />

          <GrowthHomeServiceFollowUpsSection items={briefing.serviceFollowUps} />

          <GrowthHomeOperationalInsightsSection items={briefing.operationalInsights} />

          <GrowthHomeServiceContributionSection contribution={briefing.serviceContribution} />
        </>
      ) : null}

      <GrowthHomeDailyBriefingSection briefing={briefing.dailyBriefing} />

      <GrowthHomeSinceWeLastMetSection items={briefing.sinceWeLastMet} />

      <GrowthHomeWhatChangedSection items={briefing.whatChanged} />

      <GrowthHomeRecommendationContinuitySection items={briefing.recommendationContinuity} />

      <GrowthHomeMilestonesSection milestones={briefing.milestones} />

      <GrowthHomeOurProgressSection periods={briefing.ourProgress} />

      <GrowthHomeTrustSection items={briefing.trustExplanations} />

      <GrowthHomeWaitingOnYouSection
        items={briefing.waitingOnYou}
        overflowCount={briefing.waitingOnYouOverflow}
      />

      <GrowthHomeMyPrioritiesSection priorities={briefing.myPriorities} />

      <GrowthHomeWeeklyGoalsSection goals={briefing.weeklyGoals} />

      <GrowthHomeAccomplishmentsSection groups={briefing.accomplishments} />

      <div className="grid gap-10 lg:grid-cols-2">
        <GrowthHomeBiggestWinSection win={briefing.biggestWin} />
        <GrowthHomeBiggestRiskSection risk={briefing.biggestRiskFeatured} />
      </div>

      <GrowthHomeAiWorkloadSection items={briefing.aiWorkload} />

      <GrowthHomeThingsNoticedSection items={briefing.thingsNoticed} />

      <GrowthHomeWatchingSection items={briefing.watching} />

      <GrowthHomeBusinessSnapshotSection metrics={briefing.businessSnapshot} />

      <GrowthHomeTimelineSection periods={briefing.timeline} />

      <GrowthHomeExecutiveRecommendationSection recommendation={briefing.executiveRecommendation} />

      <Collapsible open={secondaryOpen} onOpenChange={setSecondaryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="gap-2 px-0 text-muted-foreground hover:text-foreground">
            <ChevronDown className={`size-4 transition-transform ${secondaryOpen ? "rotate-180" : ""}`} />
            {secondaryOpen ? "Hide additional tools" : "Show additional tools"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-6 pt-4" data-qa-section="home-everything-else">
          <GrowthHomeInitiativeRecommendationsSection recommendations={briefing.initiativeRecommendations} />
          <GrowthHomeNeedsReviewSection needsReview={briefing.needsReview} />
          <GrowthHomeWorkSummarySection categories={briefing.workSummary} />
          <GrowthHomeRecommendationCard
            recommendation={briefing.recommendation}
            additionalRecommendations={briefing.additionalRecommendations}
          />
          {everythingElse}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
