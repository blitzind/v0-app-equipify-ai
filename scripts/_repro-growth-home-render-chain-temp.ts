/**
 * AVA-GROWTH-HOME-RENDER-HOTFIX-1A — full home render chain repro against production payload.
 */
import { execSync } from "node:child_process"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { normalizeGrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-runtime-safe-defaults"
import { mintGrowthPlatformAdminBearerToken } from "@/lib/growth/qa/growth-platform-admin-bearer-probe"
import { buildGrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-mapper"
import { synthesizeGrowthHomeExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { buildAvaHomeHero } from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { normalizeGrowthHomeAvaHeroViewModel, normalizeGrowthHomeAiOsUxViewModel } from "@/lib/growth/home/growth-home-runtime-safe-defaults"
import {
  applyHomeNarrativeDedup,
  buildHeroExecutiveBriefing,
  buildHomeCompletedTodayTimeline,
  buildHomeMeasurableProgressPresentation,
  buildHomeWorkingNowPresentation,
  buildHomeWorkspaceHealthPresentation,
  detectHomeSectionNarrativeOverlap,
} from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"

function metricValueFromDashboard(
  dashboard: ReturnType<typeof buildGrowthWorkspaceDashboardViewModel>,
  sectionId: string,
  label: string,
): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

function runStep(label: string, fn: () => void): void {
  try {
    fn()
    console.log(`ok: ${label}`)
  } catch (error) {
    console.log(`THROW: ${label}`)
    console.log(error instanceof Error ? error.message : String(error))
    if (error instanceof Error) console.log(error.stack?.split("\n").slice(0, 12).join("\n"))
    process.exitCode = 1
  }
}

async function main(): Promise<void> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) throw new Error("bootstrap failed")

  const projectRef = boot.url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  if (!projectRef) throw new Error("no project ref")
  const anon = (
    JSON.parse(
      execSync(`supabase projects api-keys --project-ref ${projectRef} -o json`, { encoding: "utf8" }),
    ) as Array<{ name: string; api_key: string }>
  ).find((entry) => entry.name === "anon")?.api_key
  if (!anon) throw new Error("no anon")

  const minted = await mintGrowthPlatformAdminBearerToken({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: anon,
    admin_email: "mike@blitzind.com",
  })
  if (!minted.access_token) throw new Error(minted.error ?? "mint_failed")

  const res = await fetch("https://app.equipify.ai/api/platform/growth/home/workspace-summary", {
    headers: { Authorization: `Bearer ${minted.access_token}` },
  })
  const raw = (await res.json()) as Record<string, unknown>
  const workspaceSummary = normalizeGrowthHomeWorkspaceSummaryPayload(raw)
  const dashboard = workspaceSummary.dashboard ?? buildGrowthWorkspaceDashboardViewModel(workspaceSummary.sources)
  const avaConsole = workspaceSummary.avaConsole ?? null

  console.log("focus_and_approval", {
    topPackageCompany: workspaceSummary.canonicalOperatorApproval?.topPackage?.companyName ?? null,
    canonicalOperatorFocus: workspaceSummary.canonicalOperatorFocus,
  })

  runStep("briefing_input_portfolio", () => {
    void ((workspaceSummary.portfolioManager?.health.needsCount ?? 0) > 0)
  })

  const briefing = synthesizeGrowthHomeExecutiveBriefing({
    dashboard,
    teammate: resolveAiTeammatePresentation("Ava"),
    portfolioBelowTarget: (workspaceSummary.portfolioManager?.health.needsCount ?? 0) > 0,
    portfolioTargetCurrent: workspaceSummary.portfolioManager?.health.counts.activeCompanies ?? null,
    portfolioTargetGoal: workspaceSummary.portfolioManager?.target.targetActiveCompanies ?? null,
    portfolioOperator: workspaceSummary.portfolioManager?.operator ?? null,
    productionMissionAuthority: workspaceSummary.productionMissionAuthority ?? null,
    canonicalOperatorApproval: workspaceSummary.canonicalOperatorApproval ?? null,
    canonicalOperatorTask: workspaceSummary.canonicalOperatorTask ?? null,
    canonicalActiveMissions: workspaceSummary.canonicalActiveMissions ?? null,
    canonicalOperatorFocus: workspaceSummary.canonicalOperatorFocus ?? null,
    supervisedOperatorAttention: workspaceSummary.supervisedOperatorAttention ?? null,
    missionDiscovery: workspaceSummary.missionDiscovery ?? null,
  })

  const aiOsUx = normalizeGrowthHomeAiOsUxViewModel(briefing.aiOsUx)
  const canonicalPendingApprovals = aiOsUx.approveItemsCount ?? 0
  const employeeMode = workspaceSummary.avaActivation?.activated === true

  const avaHero = normalizeGrowthHomeAvaHeroViewModel(
    buildAvaHomeHero({
      greeting: aiOsUx.hero.greeting,
      hour: new Date().getHours(),
      employeeStatus: briefing.employeeStatus,
      aiOsUx,
      researchLoopSummary: avaConsole?.researchLoopSummary ?? null,
      accomplishments: briefing.accomplishments,
      repliesWaiting: metricValueFromDashboard(dashboard, "my-queue", "Inbox requiring replies"),
      workspaceSummary: {
        kpis: workspaceSummary.kpis,
        meetings: workspaceSummary.meetings,
        inbox: workspaceSummary.inbox,
        operatorTasks: workspaceSummary.operatorTasks,
        avaConsole,
        dashboard: workspaceSummary.dashboard,
        relationshipSnapshots: workspaceSummary.relationshipSnapshots,
        leadPool: workspaceSummary.leadPool,
        missionDiscovery: workspaceSummary.missionDiscovery ?? null,
        portfolioLeads: workspaceSummary.portfolioLeads,
        eligibleLeadCount: workspaceSummary.eligibleLeadCount,
        businessObjectiveLeadership: workspaceSummary.businessObjectiveLeadership ?? null,
      },
      waitingOnYou: aiOsUx.waitingOnYou,
      dailyWorkQueue: aiOsUx.dailyWorkQueue,
      timeline: briefing.timeline,
      previousSnapshot: null,
      operatingRhythmMemory: null,
      persistedMemoryStore: null,
      generatedAt: workspaceSummary.generatedAt ?? dashboard.generatedAt,
      salesOutcomes: workspaceSummary.salesOutcomes ?? null,
      organizationalKnowledge: workspaceSummary.organizationalKnowledge?.store.items ?? null,
      canonicalHeroDecision: workspaceSummary.canonicalHeroDecision ?? null,
      strategicAdvisorContext: workspaceSummary.strategicAdvisorContext ?? null,
      overrideRecords: [],
      executiveBriefingCursor: null,
      recommendationPreferences: null,
      outboundDisabled: true,
      outboundWaitingForBusinessHours: false,
      organizationalEvidenceCompleteness: workspaceSummary.organizationalEvidenceCompleteness ?? null,
      organizationId: null,
    }),
  )

  runStep("recommendation_headline_access", () => {
    void (
      avaHero.recommendationExperience?.recommendations[0]?.employeeHeadline ??
      avaHero.recommendationExperience?.recommendations[0]?.headline ??
      null
    )
  })

  runStep("recommendation_section_array_access", () => {
    if (avaHero.recommendationExperience) {
      void avaHero.recommendationExperience.recommendations[0]
      void avaHero.recommendationExperience.recommendations.length
    }
  })

  runStep("operator_experience_useMemo", () => {
    const setupIncomplete = !employeeMode && avaHero.dailyActivityNarrative?.focus === "setup"
    const runtimeTrust = buildGrowthHomeRuntimeTrustViewModel({
      server: workspaceSummary.runtimeTrust ?? null,
      salesOutcomes: workspaceSummary.salesOutcomes ?? null,
      activeWork: avaHero.workManager?.active_work ?? null,
      pendingApprovals: canonicalPendingApprovals,
      setupIncomplete,
      missionDiscovery: workspaceSummary.missionDiscovery ?? null,
      activation: workspaceSummary.avaActivation ?? null,
      generatedAt: workspaceSummary.generatedAt ?? dashboard.generatedAt,
      canonicalOperatorFocus: workspaceSummary.canonicalOperatorFocus ?? null,
      operatorApprovalCompanyName: workspaceSummary.canonicalOperatorApproval?.topPackage?.companyName ?? null,
      portfolioOperator: workspaceSummary.portfolioManager?.operator ?? null,
      productionMissionAuthority: workspaceSummary.productionMissionAuthority ?? null,
      emailsSentToday: workspaceSummary.kpis?.emailsSentToday,
      repliesToday: workspaceSummary.kpis?.repliesToday,
      meetingsToday: workspaceSummary.meetings?.today,
    })
    const workingNow = buildHomeWorkingNowPresentation({
      dailyActivityNarrative: avaHero.dailyActivityNarrative,
      workManager: avaHero.workManager ?? null,
      missionDiscovery: workspaceSummary.missionDiscovery ?? null,
      statusLabel: avaHero.statusLabel,
      runtimeCurrentActivity: runtimeTrust.currentActivity,
    })
    const measurableProgress = buildHomeMeasurableProgressPresentation({
      missionDiscovery: workspaceSummary.missionDiscovery ?? null,
      portfolio: workspaceSummary.portfolioManager?.operator ?? null,
      dailySummary: workspaceSummary.salesOutcomes?.dailySummary ?? null,
      pendingApprovals: canonicalPendingApprovals,
      readyForOutreachReview: avaConsole?.researchLoopSummary?.readyForOutreachReview ?? 0,
    })
    const workspaceHealth = buildHomeWorkspaceHealthPresentation({
      relationshipSnapshotCount: 0,
      totalOpportunities: metricValueFromDashboard(dashboard, "intelligence", "Hot companies"),
      pendingApprovals: canonicalPendingApprovals,
      portfolio: workspaceSummary.portfolioManager?.operator ?? null,
      leadsNeedingAction: workspaceSummary.operatorTasks.leadsNeedingAction ?? 0,
    })
    const heroBriefing = buildHeroExecutiveBriefing({
      statusLabel: avaHero.statusLabel,
      dailyActivityNarrative: avaHero.dailyActivityNarrative,
      missionDiscovery: workspaceSummary.missionDiscovery ?? null,
      pendingApprovals: canonicalPendingApprovals,
      readyForOutreachReview: avaConsole?.researchLoopSummary?.readyForOutreachReview ?? 0,
      discoveryTarget: avaHero.discoveryNarrativeTarget ?? workspaceSummary.missionDiscovery?.audienceName ?? null,
      portfolioOperator: workspaceSummary.portfolioManager?.operator ?? null,
      productionMissionAuthority: workspaceSummary.productionMissionAuthority ?? null,
      primaryMissionLabel: runtimeTrust.primaryMissionLabel,
      currentActivityLabel: runtimeTrust.currentActivityLabel,
      repliesToday: workspaceSummary.kpis?.repliesToday,
      canonicalOperatorFocus: workspaceSummary.canonicalOperatorFocus ?? null,
    })
    detectHomeSectionNarrativeOverlap({
      heroNarrative: heroBriefing.narrative,
      workingNowTask: workingNow.activeTask,
      objectiveTitle: avaHero.businessObjectiveLeadership?.primaryObjective?.title ?? null,
      recommendationHeadline:
        avaHero.recommendationExperience?.recommendations[0]?.employeeHeadline ??
        avaHero.recommendationExperience?.recommendations[0]?.headline ??
        null,
      progressLabels: measurableProgress.items.map((item) => item.label),
    })
    applyHomeNarrativeDedup({
      overlaps: [],
      heroBriefing,
      workingNow,
      recommendationHeadline:
        avaHero.recommendationExperience?.recommendations[0]?.employeeHeadline ??
        avaHero.recommendationExperience?.recommendations[0]?.headline ??
        null,
    })
    void buildHomeCompletedTodayTimeline({
      dailyActivityNarrative: avaHero.dailyActivityNarrative,
      workManager: avaHero.workManager ?? null,
      salesOutcomes: workspaceSummary.salesOutcomes?.outcomes ?? null,
      generatedAt: workspaceSummary.generatedAt ?? dashboard.generatedAt,
    })
    void workspaceHealth
  })

  console.log("recommendationExperience", {
    present: Boolean(avaHero.recommendationExperience),
    recommendationsType: avaHero.recommendationExperience
      ? typeof avaHero.recommendationExperience.recommendations
      : null,
    recommendationsIsArray: avaHero.recommendationExperience
      ? Array.isArray(avaHero.recommendationExperience.recommendations)
      : null,
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
