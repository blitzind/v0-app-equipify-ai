"use client"

import { useEffect, useMemo, useState } from "react"
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
import { readGrowthHomeAvaStrategicOverrideRecords } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-override-memory-next-1c"
import {
  readGrowthHomeAvaExecutiveBriefingCursor,
  recordGrowthHomeAvaExecutiveBriefingGenerated,
  recordGrowthHomeAvaExecutiveBriefingHomeVisit,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a"
import { readGrowthHomeAvaRecommendationPreferences } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-preference-memory-next-1a"
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
import { GrowthHomeAvaRecommendationExperienceSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-recommendation-experience-section"
import { GrowthHomeAvaStrategicInsightSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-strategic-insight-section"
import { GrowthHomeAvaBusinessObjectiveSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-business-objective-section"
import { GrowthHomeAvaWorkingNowSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-working-now-section"
import { GrowthHomeCompletedTodayTimelineSection } from "@/components/growth/workspace/executive-briefing/growth-home-completed-today-timeline-section"
import { GrowthHomeWorkspaceHealthSection } from "@/components/growth/workspace/executive-briefing/growth-home-workspace-health-section"
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
import { GrowthHomeAvaActivationSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-activation-section"
import { GrowthHomeAvaRuntimeTrustSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-runtime-trust-section"
import { GROWTH_AVA_ACTIVATION_1C_QA_MARKER } from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER } from "@/lib/growth/home/growth-home-runtime-trust-types-1b"
import {
  GROWTH_HOME_OPERATOR_CLOSURE_1A_QA_MARKER,
  GROWTH_HOME_OPERATOR_CLOSURE_WORK_DETAILS_SUBTITLE,
  GROWTH_HOME_OPERATOR_CLOSURE_WORK_DETAILS_TITLE,
} from "@/lib/growth/home/growth-home-operator-closure-1a"
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
import {
  applyHomeNarrativeDedup,
  buildHeroExecutiveBriefing,
  buildHomeCompletedTodayTimeline,
  buildHomeMeasurableProgressPresentation,
  buildHomeWorkingNowPresentation,
  buildHomeWorkspaceHealthPresentation,
  detectHomeSectionNarrativeOverlap,
  GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER,
  GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3C_QA_MARKER,
} from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"

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
    businessObjectiveLeadership: payload.businessObjectiveLeadership ?? null,
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
  | "businessObjectiveLeadership"
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
        missionDiscovery: workspaceSummary?.missionDiscovery ?? null,
        portfolioBelowTarget: (workspaceSummary?.portfolioManager?.health.needsCount ?? 0) > 0,
        portfolioTargetCurrent: workspaceSummary?.portfolioManager?.health.counts.activeCompanies ?? null,
        portfolioTargetGoal: workspaceSummary?.portfolioManager?.target.targetActiveCompanies ?? null,
        canonicalOperatorApproval: workspaceSummary?.canonicalOperatorApproval ?? null,
        canonicalOperatorTask: workspaceSummary?.canonicalOperatorTask ?? null,
        canonicalActiveMissions: workspaceSummary?.canonicalActiveMissions ?? null,
        canonicalOperatorFocus: workspaceSummary?.canonicalOperatorFocus ?? null,
      }),
    [dashboard, recentViews, continueItems, teammate, operatorDisplayName, workspaceSummary?.canonicalOperatorApproval, workspaceSummary?.canonicalOperatorTask, workspaceSummary?.canonicalActiveMissions, workspaceSummary?.canonicalOperatorFocus, workspaceSummary?.missionDiscovery, workspaceSummary?.portfolioManager],
  )

  useEffect(() => {
    setStatus(briefing.employeeStatus)
    return () => setStatus(null)
  }, [briefing.employeeStatus, setStatus])

  const lastUpdateLabel = formatRelativeTime(briefing.generatedAt)
  const aiOsUx = useMemo(() => normalizeGrowthHomeAiOsUxViewModel(briefing.aiOsUx), [briefing.aiOsUx])
  const [homeRefreshVersion, setHomeRefreshVersion] = useState(0)

  const canonicalPendingApprovals = aiOsUx.approveItemsCount ?? 0
  const employeeMode = workspaceSummary?.avaActivation?.activated === true
  const operatorClosureMode = employeeMode

  const previousSnapshot = useMemo(() => readAvaNarrativeMetricsSnapshot(), [dashboard.generatedAt, homeRefreshVersion])
  const persistedMemoryStore = useMemo(
    () =>
      resolvePersistedOrganizationalMemoryStore({
        serverMemory: workspaceSummary?.organizationalMemory ?? null,
      }),
    [workspaceSummary?.organizationalMemory],
  )
  const operatingRhythmMemory = useMemo(() => readOperatingRhythmMemory(), [dashboard.generatedAt])
  const strategicOverrideRecords = useMemo(
    () => readGrowthHomeAvaStrategicOverrideRecords(sessionIdentity?.authUserId),
    [sessionIdentity?.authUserId, workspaceSummary?.generatedAt],
  )
  const [briefingCursorVersion, setBriefingCursorVersion] = useState(0)
  const executiveBriefingCursor = useMemo(
    () => readGrowthHomeAvaExecutiveBriefingCursor(sessionIdentity?.authUserId),
    [sessionIdentity?.authUserId, workspaceSummary?.generatedAt, briefingCursorVersion],
  )
  const recommendationPreferences = useMemo(
    () => readGrowthHomeAvaRecommendationPreferences(sessionIdentity?.authUserId),
    [sessionIdentity?.authUserId, workspaceSummary?.generatedAt],
  )

  useEffect(() => {
    recordGrowthHomeAvaExecutiveBriefingHomeVisit({
      organizationId: sessionIdentity?.authUserId ?? null,
    })
  }, [sessionIdentity?.authUserId])

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
          strategicAdvisorContext: workspaceSummary?.strategicAdvisorContext ?? null,
          overrideRecords: strategicOverrideRecords,
          executiveBriefingCursor,
          recommendationPreferences,
          outboundDisabled: true,
          outboundWaitingForBusinessHours: false,
          organizationalEvidenceCompleteness:
            workspaceSummary?.organizationalEvidenceCompleteness ?? null,
          organizationId: sessionIdentity?.authUserId ?? null,
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
      workspaceSummary?.organizationalEvidenceCompleteness,
      workspaceSummary?.canonicalHeroDecision,
      workspaceSummary?.strategicAdvisorContext,
      operatorDisplayName,
      strategicOverrideRecords,
      executiveBriefingCursor,
      recommendationPreferences,
      briefingCursorVersion,
    ],
  )

  useEffect(() => {
    if (avaHero.continuousExecutiveBriefing) {
      recordGrowthHomeAvaExecutiveBriefingGenerated({
        organizationId: sessionIdentity?.authUserId ?? null,
      })
    }
  }, [avaHero.continuousExecutiveBriefing?.openingLine, sessionIdentity?.authUserId])

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

  const companyCandidates = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of workspaceSummary?.sources?.dailyRevenueWorkQueueDisplay?.top_items ?? []) {
      const company = item.company_name?.trim()
      if (item.lead_id && company) map.set(item.lead_id, company)
    }
    for (const pkg of aiOsUx.canonicalApprovalSnapshot?.packages ?? []) {
      if (pkg.leadId && pkg.companyName) map.set(pkg.leadId, pkg.companyName)
    }
    for (const row of aiOsUx.dailyWorkQueue) {
      if (row.href) {
        const match = row.href.match(/[?&]open=([^&]+)/)
        const leadId = match?.[1]
        if (leadId && row.companyName) map.set(leadId, row.companyName)
      }
    }
    return [...map.entries()].map(([leadId, companyName]) => ({ leadId, companyName }))
  }, [
    workspaceSummary?.sources?.dailyRevenueWorkQueueDisplay?.top_items,
    aiOsUx.canonicalApprovalSnapshot?.packages,
    aiOsUx.dailyWorkQueue,
  ])

  const setupIncomplete = !employeeMode && avaHero.dailyActivityNarrative?.focus === "setup"
  const setupMessage =
    avaHero.dailyActivityNarrative?.working_next[0] ??
    avaHero.dailyActivityNarrative?.waiting_on_you[0] ??
    null

  const operatorExperience = useMemo(() => {
    const missionDiscovery = workspaceSummary?.missionDiscovery ?? null
    const activeWork = avaHero.workManager?.active_work ?? null
    const runtimeTrust = buildGrowthHomeRuntimeTrustViewModel({
      server: workspaceSummary?.runtimeTrust ?? null,
      salesOutcomes: workspaceSummary?.salesOutcomes ?? null,
      activeWork,
      pendingApprovals: canonicalPendingApprovals,
      setupIncomplete,
      missionDiscovery,
      activation: workspaceSummary?.avaActivation ?? null,
      generatedAt: workspaceSummary?.generatedAt ?? dashboard.generatedAt,
      canonicalFocusCompanyName: workspaceSummary?.canonicalOperatorFocus?.companyName ?? null,
    })
    const workingNow = buildHomeWorkingNowPresentation({
      dailyActivityNarrative: avaHero.dailyActivityNarrative,
      workManager: avaHero.workManager ?? null,
      missionDiscovery,
      statusLabel: avaHero.statusLabel,
      runtimeCurrentActivity: runtimeTrust.currentActivity,
    })
    const measurableProgress = buildHomeMeasurableProgressPresentation({
      missionDiscovery,
      portfolio: workspaceSummary?.portfolioManager?.operator ?? null,
      dailySummary: workspaceSummary?.salesOutcomes?.dailySummary ?? null,
      pendingApprovals: canonicalPendingApprovals,
      readyForOutreachReview: avaConsole?.researchLoopSummary?.readyForOutreachReview ?? 0,
    })
    const completedToday = buildHomeCompletedTodayTimeline({
      dailyActivityNarrative: avaHero.dailyActivityNarrative,
      workManager: avaHero.workManager ?? null,
      salesOutcomes: workspaceSummary?.salesOutcomes?.outcomes ?? null,
      generatedAt: workspaceSummary?.generatedAt ?? dashboard.generatedAt,
    })
    const workspaceHealth = buildHomeWorkspaceHealthPresentation({
      relationshipSnapshotCount,
      totalOpportunities: metricValueFromDashboard(dashboard, "intelligence", "Hot companies"),
      pendingApprovals: canonicalPendingApprovals,
      portfolio: workspaceSummary?.portfolioManager?.operator ?? null,
      leadsNeedingAction: workspaceSummary?.operatorTasks.leadsNeedingAction ?? 0,
    })
    const heroBriefing = buildHeroExecutiveBriefing({
      statusLabel: avaHero.statusLabel,
      dailyActivityNarrative: avaHero.dailyActivityNarrative,
      missionDiscovery,
      pendingApprovals: canonicalPendingApprovals,
      readyForOutreachReview: avaConsole?.researchLoopSummary?.readyForOutreachReview ?? 0,
      discoveryTarget: avaHero.discoveryNarrativeTarget ?? missionDiscovery?.audienceName ?? null,
    })
    const narrativeOverlap = detectHomeSectionNarrativeOverlap({
      heroNarrative: heroBriefing.narrative,
      workingNowTask: workingNow.activeTask,
      objectiveTitle: avaHero.businessObjectiveLeadership?.primaryObjective?.title ?? null,
      recommendationHeadline:
        avaHero.recommendationExperience?.recommendations[0]?.employeeHeadline ??
        avaHero.recommendationExperience?.recommendations[0]?.headline ??
        null,
      progressLabels: measurableProgress.items.map((item) => item.label),
    })
    const deduped = applyHomeNarrativeDedup({
      overlaps: narrativeOverlap,
      heroBriefing,
      workingNow,
      recommendationHeadline:
        avaHero.recommendationExperience?.recommendations[0]?.employeeHeadline ??
        avaHero.recommendationExperience?.recommendations[0]?.headline ??
        null,
    })
    return {
      workingNow: deduped.workingNow,
      measurableProgress,
      completedToday,
      workspaceHealth,
      heroBriefing: deduped.heroBriefing,
      narrativeOverlap,
      suppressRecommendationHeadline: deduped.suppressRecommendationHeadline,
      runtimeTrust,
    }
  }, [
    avaHero.businessObjectiveLeadership?.primaryObjective?.title,
    avaHero.dailyActivityNarrative,
    avaHero.discoveryNarrativeTarget,
    avaHero.recommendationExperience?.recommendations,
    avaHero.statusLabel,
    avaHero.workManager,
    avaConsole?.researchLoopSummary?.readyForOutreachReview,
    canonicalPendingApprovals,
    dashboard,
    relationshipSnapshotCount,
    setupIncomplete,
    workspaceSummary?.generatedAt,
    workspaceSummary?.missionDiscovery,
    workspaceSummary?.operatorTasks.leadsNeedingAction,
    workspaceSummary?.portfolioManager?.operator,
    workspaceSummary?.avaActivation,
    workspaceSummary?.runtimeTrust,
    workspaceSummary?.salesOutcomes,
  ])

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
      data-qa-marker-live-3b={GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER}
      data-qa-marker-live-3c={GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3C_QA_MARKER}
      data-qa-marker-launch-1b={GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER}
      data-qa-marker-launch-1c={GROWTH_AVA_ACTIVATION_1C_QA_MARKER}
      data-qa-marker-closure-1a={GROWTH_HOME_OPERATOR_CLOSURE_1A_QA_MARKER}
      data-employee-mode={employeeMode ? "true" : "false"}
      data-operator-closure-mode={operatorClosureMode ? "true" : "false"}
      data-home-narrative-overlap={operatorExperience.narrativeOverlap.join(",") || "none"}
    >
      <div data-qa-section="home-canonical-surface" className="space-y-6">
        <GrowthHomeAvaHeroSection
          hero={avaHero}
          executiveBriefing={operatorExperience.heroBriefing}
          lastUpdateLabel={lastUpdateLabel}
          pendingApprovals={canonicalPendingApprovals}
          readyForOutreachReview={avaConsole?.researchLoopSummary?.readyForOutreachReview ?? 0}
          missionDiscovery={workspaceSummary?.missionDiscovery ?? null}
          organizationId={sessionIdentity?.authUserId ?? null}
          onBriefingAcknowledged={() => setBriefingCursorVersion((value) => value + 1)}
          compact={operatorClosureMode}
        />

        {workspaceSummary?.avaActivation ? (
          <GrowthHomeAvaActivationSection
            activation={workspaceSummary.avaActivation}
            onActivated={() => {
              setHomeRefreshVersion((value) => value + 1)
              onResearchLoopCompleted?.()
            }}
          />
        ) : null}

        <GrowthHomeAvaRuntimeTrustSection
          runtimeTrust={operatorExperience.runtimeTrust}
          operatorClosureMode={operatorClosureMode}
          onActivated={() => {
            setHomeRefreshVersion((value) => value + 1)
            onResearchLoopCompleted?.()
          }}
        />

        <GrowthHomeAiOsWaitingOnYouSection
          aiOsUx={aiOsUx}
          relationshipSnapshotsById={workspaceSummary?.relationshipSnapshots?.byLeadId}
          waitingCompanyByLeadId={waitingCompanyByLeadId}
          operatorClosureMode={operatorClosureMode}
        />

        {!operatorClosureMode && avaHero.recommendationExperience ? (
          <GrowthHomeAvaRecommendationExperienceSection
            experience={avaHero.recommendationExperience}
            organizationId={sessionIdentity?.authUserId ?? null}
            companyCandidates={companyCandidates}
            activeMissionLabel={workspaceSummary?.missionDiscovery?.audienceName ?? workspaceSummary?.missionDiscovery?.activityLabel ?? null}
            strategicAdvisorContext={workspaceSummary?.strategicAdvisorContext ?? null}
            executiveReasoning={avaHero.executiveReasoning ?? null}
            suppressPrimaryHeadline={operatorExperience.suppressRecommendationHeadline}
          />
        ) : null}

        {!operatorClosureMode && avaHero.strategicLeadership?.hasInsight && avaHero.strategicLeadership.insight ? (
          <GrowthHomeAvaStrategicInsightSection leadership={avaHero.strategicLeadership} />
        ) : null}

        {!operatorClosureMode ? (
          <GrowthHomeAvaWorkingNowSection presentation={operatorExperience.workingNow} />
        ) : null}

        {!operatorClosureMode && avaHero.businessObjectiveLeadership ? (
          <GrowthHomeAvaBusinessObjectiveSection leadership={avaHero.businessObjectiveLeadership} />
        ) : null}

        {!operatorClosureMode ? (
          <>
            <GrowthHomeAvaWorkSection
              progress={operatorExperience.measurableProgress}
              eligibleLeadCount={workspaceSummary?.eligibleLeadCount ?? null}
            />

            <GrowthHomePortfolioManagerSection
              portfolio={workspaceSummary?.portfolioManager?.operator ?? null}
            />

            <GrowthHomeCompletedTodayTimelineSection entries={operatorExperience.completedToday} />

            <GrowthHomeWorkspaceHealthSection presentation={operatorExperience.workspaceHealth} />

            <GrowthHomeCanonicalMissionsSection
              missions={aiOsUx.canonicalActiveMissions?.missions ?? []}
              overflowMissionCount={aiOsUx.canonicalActiveMissions?.overflowMissionCount ?? 0}
              totalMissionCount={aiOsUx.canonicalActiveMissions?.totalMissionCount}
            />

            <GrowthHomeAvaMemorySection memorySummary={avaHero.memorySummary ?? null} />
          </>
        ) : (
          <GrowthHomeCollapsibleSection
            sectionId="operator-work-details"
            title={GROWTH_HOME_OPERATOR_CLOSURE_WORK_DETAILS_TITLE}
            subtitle={GROWTH_HOME_OPERATOR_CLOSURE_WORK_DETAILS_SUBTITLE}
          >
            <div className="space-y-5">
              <GrowthHomeAvaWorkSection
                progress={operatorExperience.measurableProgress}
                eligibleLeadCount={workspaceSummary?.eligibleLeadCount ?? null}
              />
              <GrowthHomeCompletedTodayTimelineSection entries={operatorExperience.completedToday} />
              <GrowthHomeAvaMemorySection memorySummary={avaHero.memorySummary ?? null} />
              <GrowthHomePortfolioManagerSection
                portfolio={workspaceSummary?.portfolioManager?.operator ?? null}
              />
              {avaHero.recommendationExperience ? (
                <GrowthHomeAvaRecommendationExperienceSection
                  experience={avaHero.recommendationExperience}
                  organizationId={sessionIdentity?.authUserId ?? null}
                  companyCandidates={companyCandidates}
                  activeMissionLabel={workspaceSummary?.missionDiscovery?.audienceName ?? workspaceSummary?.missionDiscovery?.activityLabel ?? null}
                  strategicAdvisorContext={workspaceSummary?.strategicAdvisorContext ?? null}
                  executiveReasoning={null}
                  suppressPrimaryHeadline={operatorExperience.suppressRecommendationHeadline}
                />
              ) : null}
              {avaHero.strategicLeadership?.hasInsight && avaHero.strategicLeadership.insight ? (
                <GrowthHomeAvaStrategicInsightSection leadership={avaHero.strategicLeadership} />
              ) : null}
              {avaHero.businessObjectiveLeadership ? (
                <GrowthHomeAvaBusinessObjectiveSection leadership={avaHero.businessObjectiveLeadership} />
              ) : null}
              <GrowthHomeCanonicalMissionsSection
                missions={aiOsUx.canonicalActiveMissions?.missions ?? []}
                overflowMissionCount={aiOsUx.canonicalActiveMissions?.overflowMissionCount ?? 0}
                totalMissionCount={aiOsUx.canonicalActiveMissions?.totalMissionCount}
              />
            </div>
          </GrowthHomeCollapsibleSection>
        )}

        {!employeeMode ? (
          <GrowthHomeTrainingSetupCta setupIncomplete={setupIncomplete} setupMessage={setupMessage} />
        ) : null}

        {!employeeMode ? <GrowthHomeLaunchCompleteBanner setupIncomplete={setupIncomplete} /> : null}

        {!operatorClosureMode ? (
          <GrowthHomeBriefingCrossLinks
            pendingApprovals={canonicalPendingApprovals}
          />
        ) : null}

        {!employeeMode ? (
          <GrowthHomeFirstWeekGuide
            setupIncomplete={setupIncomplete}
            waitingOnYou={aiOsUx.waitingOnYou}
            workManager={avaHero.workManager ?? null}
            pendingApprovals={canonicalPendingApprovals}
            emailsSentToday={workspaceSummary?.kpis.emailsSentToday ?? 0}
            outreachPreparedToday={workspaceSummary?.salesOutcomes?.outreach_prepared ?? 0}
            organizationalKnowledgeCount={
              workspaceSummary?.organizationalKnowledge?.store.items.filter((row) => row.active && !row.superseded_by)
                .length ?? 0
            }
            learnedTodayCount={avaHero.dailyActivityNarrative?.learned_today.length ?? 0}
          />
        ) : null}
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
          {!employeeMode ? <GrowthHomeStartAvaSetupSection dashboard={dashboard} placement="secondary" /> : null}

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
