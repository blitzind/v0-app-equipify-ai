"use client"

import { useEffect, useMemo } from "react"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { useAiEmployeeStatus } from "@/components/growth/ai-teammate/ai-employee-status-provider"
import { GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER } from "@/lib/growth/ava-home/narrative"
import {
  readAvaNarrativeMetricsSnapshot,
  writeAvaNarrativeMetricsSnapshot,
} from "@/lib/growth/ava-home/narrative/context/ava-narrative-snapshot-memory"
import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import {
  readOrganizationalMemoryStore,
  writeOrganizationalMemoryStore,
} from "@/lib/growth/memory/storage/organization-memory-store"
import {
  buildOperatingRhythmMemory,
  readOperatingRhythmMemory,
  writeOperatingRhythmMemory,
} from "@/lib/growth/operating-rhythm/bridges/memory-bridge"
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
import { buildAvaHomeHero } from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import {
  normalizeGrowthHomeAvaHeroViewModel,
  normalizeGrowthHomeAiOsUxViewModel,
} from "@/lib/growth/home/growth-home-runtime-safe-defaults"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type { GrowthWorkspaceRecentView, GrowthWorkspaceContinueItem } from "@/lib/growth/workspace/growth-workspace-activity-memory"
import { formatRelativeTime } from "@/lib/notifications/format-relative"
import { GrowthHomeAvaHeroSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-hero-section"
import { GrowthHomeAvaWorkSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-work-section"
import { GrowthHomeAvaOperatingRhythmSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-operating-rhythm-section"
import { GrowthHomeAvaMemorySection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-memory-section"
import { GrowthHomeAvaSpecialistTeamSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-specialist-team-section"
import { GrowthHomeCollapsibleSection } from "@/components/growth/workspace/executive-briefing/growth-home-collapsible-section"
import { GrowthHomeExecutiveSnapshotSection } from "@/components/growth/workspace/executive-briefing/growth-home-executive-snapshot-section"
import { GrowthHomeAiOsWaitingOnYouSection } from "@/components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section"
import { GrowthHomeStartAvaSetupSection } from "@/components/growth/workspace/executive-briefing/growth-home-start-ava-setup-section"
import { GrowthHomeGrowthStrategySection } from "@/components/growth/workspace/executive-briefing/growth-home-growth-strategy-section"
import { GrowthHomeAvaLiveStatusSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-live-status-section"
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
import { GrowthHomeAvaResearchQueuePanel } from "@/components/growth/workspace/executive-briefing/growth-home-ava-research-queue-panel"

function metricValueFromDashboard(
  dashboard: GrowthWorkspaceDashboardViewModel,
  sectionId: string,
  label: string,
): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

function buildEngineWorkspaceSummary(
  payload: GrowthHomeWorkspaceSummaryPayload,
  avaConsole: GrowthHomeWorkspaceSummaryPayload["avaConsole"] | null,
): BuildAvaHomeHeroEngineSummary {
  return {
    kpis: payload.kpis,
    meetings: payload.meetings,
    inbox: payload.inbox,
    operatorTasks: payload.operatorTasks,
    avaConsole: avaConsole ?? payload.avaConsole,
    dashboard: payload.dashboard,
    relationshipSnapshots: payload.relationshipSnapshots,
    leadPool: payload.leadPool,
  }
}

type BuildAvaHomeHeroEngineSummary = Pick<
  GrowthHomeWorkspaceSummaryPayload,
  "kpis" | "meetings" | "inbox" | "operatorTasks" | "avaConsole" | "dashboard" | "relationshipSnapshots" | "leadPool"
>

type Props = {
  dashboard: GrowthWorkspaceDashboardViewModel
  workspaceSummary: GrowthHomeWorkspaceSummaryPayload | null
  avaConsole: GrowthHomeWorkspaceSummaryPayload["avaConsole"] | null
  recentViews: GrowthWorkspaceRecentView[]
  continueItems: GrowthWorkspaceContinueItem[]
  everythingElse: React.ReactNode
  onResearchLoopCompleted?: () => void
}

export function GrowthHomeExecutiveBriefingDashboard({
  dashboard,
  workspaceSummary,
  avaConsole,
  recentViews,
  continueItems,
  everythingElse,
  onResearchLoopCompleted,
}: Props) {
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
  const aiOsUx = useMemo(() => normalizeGrowthHomeAiOsUxViewModel(briefing.aiOsUx), [briefing.aiOsUx])

  const previousSnapshot = useMemo(() => readAvaNarrativeMetricsSnapshot(), [dashboard.generatedAt])
  const persistedMemoryStore = useMemo(() => readOrganizationalMemoryStore(), [dashboard.generatedAt])
  const operatingRhythmMemory = useMemo(() => readOperatingRhythmMemory(), [dashboard.generatedAt])

  const engineWorkspaceSummary = useMemo(
    () => (workspaceSummary ? buildEngineWorkspaceSummary(workspaceSummary, avaConsole) : undefined),
    [workspaceSummary, avaConsole],
  )

  const avaHero = useMemo(
    () =>
      normalizeGrowthHomeAvaHeroViewModel(
        buildAvaHomeHero({
          greeting: aiOsUx.hero.greeting,
          hour: new Date().getHours(),
          employeeStatus: briefing.employeeStatus,
          aiOsUx,
          researchLoopSummary: avaConsole?.researchLoopSummary ?? null,
          accomplishments: briefing.accomplishments,
          repliesWaiting: metricValueFromDashboard(dashboard, "my-queue", "Inbox requiring replies"),
          workspaceSummary: engineWorkspaceSummary,
          waitingOnYou: aiOsUx.waitingOnYou,
          dailyWorkQueue: aiOsUx.dailyWorkQueue,
          timeline: briefing.timeline,
          previousSnapshot,
          operatingRhythmMemory,
          persistedMemoryStore,
          generatedAt: workspaceSummary?.generatedAt ?? dashboard.generatedAt,
        }),
      ),
    [
      aiOsUx,
      briefing.employeeStatus,
      briefing.accomplishments,
      briefing.timeline,
      avaConsole?.researchLoopSummary,
      dashboard,
      engineWorkspaceSummary,
      previousSnapshot,
      operatingRhythmMemory,
      persistedMemoryStore,
      workspaceSummary?.generatedAt,
    ],
  )

  useEffect(() => {
    const dailyBriefing = avaHero.dailyBriefing
    if (!dailyBriefing) return

    writeAvaNarrativeMetricsSnapshot(dailyBriefing.metrics_snapshot)
    if (dailyBriefing.memory_store) {
      writeOrganizationalMemoryStore(dailyBriefing.memory_store)
    }
    if (avaHero.operatingRhythm && avaHero.workManager) {
      writeOperatingRhythmMemory(
        buildOperatingRhythmMemory({
          rhythm: avaHero.operatingRhythm,
          workResult: avaHero.workManager,
          risks: (dailyBriefing.risks ?? []).map((row) => row.text),
          wins: (dailyBriefing.wins ?? []).map((row) => row.text),
        }),
      )
    }
  }, [avaHero])

  const executiveSnapshot = useMemo(
    () => buildExecutiveSnapshotKpis({ hero: aiOsUx.hero, aiOsUx, dashboard }),
    [aiOsUx, dashboard],
  )

  const relationshipSnapshotCount = useMemo(() => {
    const snapshots = workspaceSummary?.relationshipSnapshots
    if (!snapshots) return 0
    const enriched = snapshots.meta?.enriched ?? 0
    if (enriched > 0) return enriched
    return Object.keys(snapshots.byLeadId ?? {}).length
  }, [workspaceSummary?.relationshipSnapshots])

  const waitingCompanyByLeadId = useMemo(() => {
    const topItems = workspaceSummary?.sources?.dailyRevenueWorkQueueDisplay?.top_items ?? []
    const map: Record<string, string | null> = {}
    for (const item of topItems) {
      const company = item.company_name?.trim()
      if (item.lead_id && company && company !== "Account") {
        map[item.lead_id] = company
      }
    }
    return Object.keys(map).length > 0 ? map : undefined
  }, [workspaceSummary?.sources?.dailyRevenueWorkQueueDisplay?.top_items])

  const hasCustomerGrowthContent =
    briefing.customerSuccessMissions.length > 0 ||
    briefing.customerHealth.length > 0 ||
    briefing.expansionOpportunities.length > 0 ||
    briefing.renewalsMonitoring.length > 0 ||
    briefing.customerWins.length > 0

  return (
    <div
      className="space-y-6"
      data-qa-marker={GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER}
      data-qa-marker-premium-ux={GROWTH_AIOS_HOME_PREMIUM_UX_1A_QA_MARKER}
      data-qa-marker-briefing-2a={GROWTH_HOME_EXECUTIVE_BRIEFING_2A_QA_MARKER}
      data-qa-marker-narrative-10a={GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER}
      data-growth-action-first-order="actions-before-metrics"
      data-qa-marker-action-first={GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER}
    >
      <GrowthHomeAvaHeroSection
        hero={avaHero}
        lastUpdateLabel={lastUpdateLabel}
        leadPool={workspaceSummary?.leadPool ?? null}
        leadsNeedingAction={workspaceSummary?.operatorTasks.leadsNeedingAction ?? 0}
        pendingApprovals={workspaceSummary?.operatorTasks.pendingApprovals ?? 0}
        relationshipSnapshotCount={relationshipSnapshotCount}
      />

      <GrowthHomeAvaWorkSection
        workManager={avaHero.workManager ?? null}
        leadPool={workspaceSummary?.leadPool ?? null}
      />

      <GrowthHomeAvaOperatingRhythmSection operatingRhythm={avaHero.operatingRhythm ?? null} />

      <GrowthHomeAvaMemorySection memorySummary={avaHero.memorySummary ?? null} />

      <GrowthHomeAvaSpecialistTeamSection specialistOrchestrator={avaHero.specialistOrchestrator ?? null} />

      <GrowthHomeAiOsWaitingOnYouSection
        aiOsUx={aiOsUx}
        relationshipSnapshotsById={workspaceSummary?.relationshipSnapshots?.byLeadId}
        waitingCompanyByLeadId={waitingCompanyByLeadId}
      />

      <GrowthHomeExecutiveSnapshotSection kpis={executiveSnapshot} />

      <GrowthHomeAvaResearchQueuePanel
        researchLoopSummary={avaConsole?.researchLoopSummary ?? null}
        onCompleted={onResearchLoopCompleted}
      />

      <GrowthHomeStartAvaSetupSection dashboard={dashboard} />

      <GrowthHomeCollapsibleSection
        sectionId="research-growth-strategy"
        title="Research & Growth Strategy"
        subtitle="Missions I'm running and the outreach I'm preparing."
        defaultOpen
      >
        <GrowthHomeMissionCenterSection dashboard={dashboard} />
        <GrowthHomeGrowthStrategySection dailyWorkQueue={aiOsUx.dailyWorkQueue} />
        <GrowthHomeMarketingMissionsSection missions={briefing.marketingMissions} />
      </GrowthHomeCollapsibleSection>

      <GrowthHomeCollapsibleSection
        sectionId="customer-growth"
        title="Customer Growth"
        subtitle={GROWTH_HOME_CUSTOMER_GROWTH_SUBTITLE}
      >
        <div data-qa-section="home-customer-growth" className="space-y-4">
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
        </div>
      </GrowthHomeCollapsibleSection>

      <GrowthHomeCollapsibleSection
        sectionId="initiatives"
        title="Initiatives"
        subtitle="Recommendations I've prepared for you to consider."
      >
        <GrowthHomeInitiativeRecommendationsSection recommendations={briefing.initiativeRecommendations} />
      </GrowthHomeCollapsibleSection>

      <GrowthHomeCollapsibleSection
        sectionId="ava-accomplished"
        title="What I've accomplished"
        subtitle="A timeline of the work I've completed."
      >
        <GrowthHomeTimelineSection periods={briefing.timeline} />
      </GrowthHomeCollapsibleSection>

      <GrowthHomeCollapsibleSection
        sectionId="operational-readiness"
        title={GROWTH_HOME_OPERATIONAL_READINESS_TITLE}
        subtitle={GROWTH_HOME_OPERATIONAL_READINESS_SUBTITLE}
      >
        <div data-qa-section="home-operational-readiness" className="grid gap-4 lg:grid-cols-2">
          <GrowthHomeMailboxDomainHealthSection health={aiOsUx.mailboxDomainHealth} embedded />
          <GrowthHomeAutonomousReadinessSection readiness={aiOsUx.autonomousReadiness} embedded />
        </div>
      </GrowthHomeCollapsibleSection>

      <GrowthHomeCollapsibleSection
        sectionId="ai-activity"
        title="AI Activity"
        subtitle="Detailed activity, throughput, and diagnostics."
      >
        <div data-qa-section="home-everything-else" className="space-y-5">
          <GrowthHomeAvaLiveStatusSection status={aiOsUx.liveStatus} />
          <GrowthHomeThroughputSection metrics={aiOsUx.throughput} />
          <GrowthHomeCheckInSection checkIn={briefing.checkIn} lastUpdateLabel={lastUpdateLabel} />
          <GrowthHomeMissionHealthSection items={briefing.missionHealth} />
          <GrowthHomeRevenueForecastSection forecast={briefing.revenueForecast} />
          <GrowthHomeBusinessSnapshotSection metrics={briefing.businessSnapshot} />
          <GrowthHomeNeedsReviewSection needsReview={briefing.needsReview} />
          <GrowthHomeWorkSummarySection categories={briefing.workSummary} />
          <GrowthHomeRecommendationCard
            recommendation={null}
            additionalRecommendations={briefing.additionalRecommendations}
          />
          {everythingElse}
        </div>
      </GrowthHomeCollapsibleSection>
    </div>
  )
}
