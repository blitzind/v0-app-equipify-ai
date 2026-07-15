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
  writeOrganizationalMemoryStore,
  resolvePersistedOrganizationalMemoryStore,
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
  GROWTH_HOME_ADVANCED_OPERATIONS_SUBTITLE,
  GROWTH_HOME_ADVANCED_OPERATIONS_TITLE,
  GROWTH_HOME_SETUP_DIAGNOSTICS_SUBTITLE,
  GROWTH_HOME_SETUP_DIAGNOSTICS_TITLE,
  GROWTH_HOME_SURFACE_CONSOLIDATION_17F_QA_MARKER,
} from "@/lib/growth/home/growth-home-surface-consolidation-17f"
import { GROWTH_HOME_CLEANUP_19C_2G_QA_MARKER } from "@/lib/growth/home/growth-home-cleanup-19c-2g"
import {
  normalizeGrowthHomeAvaHeroViewModel,
  normalizeGrowthHomeAiOsUxViewModel,
} from "@/lib/growth/home/growth-home-runtime-safe-defaults"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type { GrowthWorkspaceRecentView, GrowthWorkspaceContinueItem } from "@/lib/growth/workspace/growth-workspace-activity-memory"
import { formatRelativeTime } from "@/lib/notifications/format-relative"
import { GrowthHomeAvaHeroSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-hero-section"
import { GrowthHomeAiOsWaitingOnYouSection } from "@/components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section"
import { GrowthHomeAvaWorkSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-work-section"
import { GrowthHomePortfolioManagerSection } from "@/components/growth/workspace/executive-briefing/growth-home-portfolio-manager-section"
import { GrowthHomeAvaOperatingRhythmSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-operating-rhythm-section"
import { GrowthHomeAvaMemorySection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-memory-section"
import { GrowthHomeBriefingCrossLinks } from "@/components/growth/workspace/executive-briefing/growth-home-briefing-cross-links"
import { GrowthHomeTrainingSetupCta } from "@/components/growth/workspace/executive-briefing/growth-home-training-setup-cta"
import { GrowthHomeLaunchCompleteBanner } from "@/components/growth/workspace/executive-briefing/growth-home-launch-complete-banner"
import { GrowthHomeFirstWeekGuide } from "@/components/growth/workspace/executive-briefing/growth-home-first-week-guide"
import { GrowthHomeCollapsibleSection } from "@/components/growth/workspace/executive-briefing/growth-home-collapsible-section"
import { GrowthHomeExecutiveSnapshotSection } from "@/components/growth/workspace/executive-briefing/growth-home-executive-snapshot-section"
import { GrowthHomeCanonicalMissionsSection } from "@/components/growth/workspace/executive-briefing/growth-home-canonical-missions-section"
import { GrowthHomeStartAvaSetupSection } from "@/components/growth/workspace/executive-briefing/growth-home-start-ava-setup-section"
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
import { useAdmin } from "@/lib/admin-store"

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
    missionDiscovery: payload.missionDiscovery ?? null,
    portfolioLeads: payload.portfolioLeads,
    eligibleLeadCount: payload.eligibleLeadCount,
  }
}

type BuildAvaHomeHeroEngineSummary = Pick<
  GrowthHomeWorkspaceSummaryPayload,
  | "kpis"
  | "meetings"
  | "inbox"
  | "operatorTasks"
  | "avaConsole"
  | "dashboard"
  | "relationshipSnapshots"
  | "leadPool"
  | "missionDiscovery"
  | "portfolioLeads"
  | "eligibleLeadCount"
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
  const { sessionIdentity } = useAdmin()
  const { setStatus } = useAiEmployeeStatus()
  const operatorDisplayName = sessionIdentity?.displayName ?? null

  const briefing = useMemo(
    () =>
      synthesizeGrowthHomeExecutiveBriefing({
        dashboard,
        recentViews,
        continueItems,
        teammate,
        operatorDisplayName,
        canonicalOperatorApproval: workspaceSummary?.canonicalOperatorApproval ?? null,
        canonicalOperatorTask: workspaceSummary?.canonicalOperatorTask ?? null,
        canonicalActiveMissions: workspaceSummary?.canonicalActiveMissions ?? null,
        canonicalOperatorFocus: workspaceSummary?.canonicalOperatorFocus ?? null,
      }),
    [dashboard, recentViews, continueItems, teammate, operatorDisplayName, workspaceSummary?.canonicalOperatorApproval, workspaceSummary?.canonicalOperatorTask, workspaceSummary?.canonicalActiveMissions, workspaceSummary?.canonicalOperatorFocus],
  )

  useEffect(() => {
    setStatus(briefing.employeeStatus)
    return () => setStatus(null)
  }, [briefing.employeeStatus, setStatus])

  const lastUpdateLabel = formatRelativeTime(briefing.generatedAt)
  const aiOsUx = useMemo(() => normalizeGrowthHomeAiOsUxViewModel(briefing.aiOsUx), [briefing.aiOsUx])

  const previousSnapshot = useMemo(() => readAvaNarrativeMetricsSnapshot(), [dashboard.generatedAt])
  const persistedMemoryStore = useMemo(
    () =>
      resolvePersistedOrganizationalMemoryStore({
        serverMemory: workspaceSummary?.organizationalMemory ?? null,
      }),
    [workspaceSummary?.organizationalMemory],
  )
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
          salesOutcomes: workspaceSummary?.salesOutcomes ?? null,
          organizationalKnowledge: workspaceSummary?.organizationalKnowledge?.store.items ?? null,
          operatorDisplayName,
          canonicalHeroDecision: workspaceSummary?.canonicalHeroDecision ?? null,
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
      workspaceSummary?.organizationalKnowledge,
      workspaceSummary?.canonicalHeroDecision,
      operatorDisplayName,
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

  const setupIncomplete = avaHero.dailyActivityNarrative?.focus === "setup"
  const setupMessage =
    avaHero.dailyActivityNarrative?.working_next[0] ??
    avaHero.dailyActivityNarrative?.waiting_on_you[0] ??
    null

  return (
    <div
      className="space-y-6"
      data-qa-marker={GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER}
      data-qa-marker-premium-ux={GROWTH_AIOS_HOME_PREMIUM_UX_1A_QA_MARKER}
      data-qa-marker-briefing-2a={GROWTH_HOME_EXECUTIVE_BRIEFING_2A_QA_MARKER}
      data-qa-marker-narrative-10a={GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER}
      data-qa-marker-17f={GROWTH_HOME_SURFACE_CONSOLIDATION_17F_QA_MARKER}
      data-qa-marker-19c-2g={GROWTH_HOME_CLEANUP_19C_2G_QA_MARKER}
      data-growth-action-first-order="actions-before-metrics"
      data-qa-marker-action-first={GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER}
    >
      <div data-qa-section="home-canonical-surface" className="space-y-6">
        <GrowthHomeAvaHeroSection
          hero={avaHero}
          lastUpdateLabel={lastUpdateLabel}
          leadPool={workspaceSummary?.leadPool ?? null}
          leadsNeedingAction={workspaceSummary?.operatorTasks.leadsNeedingAction ?? 0}
          pendingApprovals={workspaceSummary?.operatorTasks.pendingApprovals ?? 0}
          relationshipSnapshotCount={relationshipSnapshotCount}
        />

        <GrowthHomeTrainingSetupCta setupIncomplete={setupIncomplete} setupMessage={setupMessage} />

        <GrowthHomeLaunchCompleteBanner setupIncomplete={setupIncomplete} />

        <GrowthHomeBriefingCrossLinks
          pendingApprovals={workspaceSummary?.operatorTasks.pendingApprovals ?? 0}
        />

        <GrowthHomeFirstWeekGuide
          setupIncomplete={setupIncomplete}
          waitingOnYou={aiOsUx.waitingOnYou}
          workManager={avaHero.workManager ?? null}
          pendingApprovals={workspaceSummary?.operatorTasks.pendingApprovals ?? 0}
          emailsSentToday={workspaceSummary?.kpis.emailsSentToday ?? 0}
          outreachPreparedToday={workspaceSummary?.salesOutcomes?.outreach_prepared ?? 0}
          organizationalKnowledgeCount={
            workspaceSummary?.organizationalKnowledge?.store.items.filter((row) => row.active && !row.superseded_by)
              .length ?? 0
          }
          learnedTodayCount={avaHero.dailyActivityNarrative?.learned_today.length ?? 0}
        />

        <GrowthHomeCanonicalMissionsSection
          missions={aiOsUx.canonicalActiveMissions?.missions ?? []}
          overflowMissionCount={aiOsUx.canonicalActiveMissions?.overflowMissionCount ?? 0}
          totalMissionCount={aiOsUx.canonicalActiveMissions?.totalMissionCount}
        />

        <GrowthHomeAiOsWaitingOnYouSection
          aiOsUx={aiOsUx}
          relationshipSnapshotsById={workspaceSummary?.relationshipSnapshots?.byLeadId}
          waitingCompanyByLeadId={waitingCompanyByLeadId}
        />

        <GrowthHomePortfolioManagerSection
          portfolio={workspaceSummary?.portfolioManager?.operator ?? null}
          marketIntelligence={workspaceSummary?.portfolioManager?.marketIntelligence ?? null}
        />

        <GrowthHomeAvaWorkSection
          workManager={avaHero.workManager ?? null}
          leadPool={workspaceSummary?.leadPool ?? null}
          progress={aiOsUx.canonicalOperatorProgress}
          eligibleLeadCount={workspaceSummary?.eligibleLeadCount ?? null}
        />

        <GrowthHomeAvaMemorySection memorySummary={avaHero.memorySummary ?? null} />
      </div>

      <GrowthHomeCollapsibleSection
        sectionId="advanced-operations"
        title={GROWTH_HOME_ADVANCED_OPERATIONS_TITLE}
        subtitle={GROWTH_HOME_ADVANCED_OPERATIONS_SUBTITLE}
      >
        <div data-qa-section="home-advanced-operations" className="space-y-5">
          <GrowthHomeExecutiveSnapshotSection kpis={executiveSnapshot} />

          <GrowthHomeAvaOperatingRhythmSection operatingRhythm={avaHero.operatingRhythm ?? null} />

          <GrowthHomeAvaResearchQueuePanel
            researchLoopSummary={avaConsole?.researchLoopSummary ?? null}
            onCompleted={onResearchLoopCompleted}
          />

          <GrowthHomeCollapsibleSection
            sectionId="research-growth-strategy"
            title="Missions & outreach"
            subtitle="Active missions and campaign work I'm running."
          >
            <GrowthHomeMissionCenterSection dashboard={dashboard} />
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
        </div>
      </GrowthHomeCollapsibleSection>

      <GrowthHomeCollapsibleSection
        sectionId="setup-diagnostics"
        title={GROWTH_HOME_SETUP_DIAGNOSTICS_TITLE}
        subtitle={GROWTH_HOME_SETUP_DIAGNOSTICS_SUBTITLE}
      >
        <div data-qa-section="home-setup-diagnostics" className="space-y-5">
          <GrowthHomeStartAvaSetupSection dashboard={dashboard} placement="secondary" />

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
      </GrowthHomeCollapsibleSection>
    </div>
  )
}
