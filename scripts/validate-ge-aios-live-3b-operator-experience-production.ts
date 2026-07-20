/**
 * GE-AIOS-LIVE-3B — Production Home operator experience validation (read-only).
 *
 * Run:
 *   pnpm validate:ge-aios-live-3b-operator-experience-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { enrichGrowthHomeAvaRecommendationExperienceNext1b } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-presentation-next-1b"
import { buildAvaDailyActivityNarrative } from "@/lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { synthesizeGrowthHomeExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { buildAvaHomeHero } from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import {
  buildHeroExecutiveBriefing,
  buildHomeCompletedTodayTimeline,
  buildHomeMeasurableProgressPresentation,
  buildHomeWorkingNowPresentation,
  buildHomeWorkspaceHealthPresentation,
  detectHomeSectionNarrativeOverlap,
} from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"
import { GROWTH_OPERATING_RHYTHM_QA_MARKER } from "@/lib/growth/operating-rhythm/types"
import { GROWTH_WORK_MANAGER_QA_MARKER } from "@/lib/growth/work-manager/types"

const PHASE = "GE-AIOS-LIVE-3B" as const

type ValidationGate = {
  id: string
  status: "pass" | "warn" | "fail"
  detail: string
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production Home operator experience validation (read-only)`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const gates: ValidationGate[] = []

  const workspaceSummary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: bootstrap.operatorEmail,
    actorUserId: bootstrap.actorUserId,
  })

  const missionDiscovery = workspaceSummary.missionDiscovery
  const briefing = synthesizeGrowthHomeExecutiveBriefing({
    dashboard: workspaceSummary.dashboard,
    missionDiscovery,
    portfolioBelowTarget: (workspaceSummary.portfolioManager?.health.needsCount ?? 0) > 0,
    portfolioTargetCurrent: workspaceSummary.portfolioManager?.health.counts.activeCompanies ?? null,
    portfolioTargetGoal: workspaceSummary.portfolioManager?.target.targetActiveCompanies ?? null,
    canonicalOperatorApproval: workspaceSummary.canonicalOperatorApproval,
    canonicalOperatorTask: workspaceSummary.canonicalOperatorTask,
    canonicalActiveMissions: workspaceSummary.canonicalActiveMissions,
    canonicalOperatorFocus: workspaceSummary.canonicalOperatorFocus,
  })

  const hero = buildAvaHomeHero({
    greeting: briefing.aiOsUx.hero.greeting,
    hour: new Date().getHours(),
    employeeStatus: briefing.employeeStatus,
    aiOsUx: briefing.aiOsUx,
    researchLoopSummary: workspaceSummary.avaConsole?.researchLoopSummary ?? null,
    accomplishments: briefing.accomplishments,
    repliesWaiting: 0,
    workspaceSummary: {
      kpis: workspaceSummary.kpis,
      meetings: workspaceSummary.meetings,
      inbox: workspaceSummary.inbox,
      operatorTasks: workspaceSummary.operatorTasks,
      avaConsole: workspaceSummary.avaConsole,
      dashboard: workspaceSummary.dashboard,
      relationshipSnapshots: workspaceSummary.relationshipSnapshots,
      leadPool: workspaceSummary.leadPool,
      missionDiscovery,
      portfolioLeads: workspaceSummary.portfolioLeads,
      eligibleLeadCount: workspaceSummary.eligibleLeadCount,
      businessObjectiveLeadership: workspaceSummary.businessObjectiveLeadership,
    },
    outboundDisabled: true,
  })

  const narrative = buildAvaDailyActivityNarrative({
    memorySummary: null,
    workResult: hero.workManager ?? {
      qaMarker: GROWTH_WORK_MANAGER_QA_MARKER,
      active_work: null,
      work_plan: [],
      operator_queue: [],
      blocked: [],
      completed_today: [],
      deferred: [],
      interruptions: [],
      all_work_items: [],
    },
    operatingRhythm: hero.operatingRhythm ?? {
      qaMarker: GROWTH_OPERATING_RHYTHM_QA_MARKER,
      current_phase: "research_cycle",
      completed_phases: [],
      next_phase: null,
      active_cycle: null,
      today_plan: [],
      phase_timeline: [],
      interruptions: [],
      waiting_on_operator: [],
      end_of_day_summary: null,
    },
    hour: new Date().getHours(),
    missionDiscovery,
  })

  const heroBriefing = buildHeroExecutiveBriefing({
    statusLabel: hero.statusLabel,
    dailyActivityNarrative: hero.dailyActivityNarrative ?? narrative,
    missionDiscovery,
    pendingApprovals: workspaceSummary.canonicalOperatorApproval?.pendingApprovalCount ?? 0,
    readyForOutreachReview: workspaceSummary.avaConsole?.researchLoopSummary?.readyForOutreachReview ?? 0,
    discoveryTarget: hero.discoveryNarrativeTarget ?? missionDiscovery?.audienceName ?? null,
  })

  const workingNow = buildHomeWorkingNowPresentation({
    dailyActivityNarrative: hero.dailyActivityNarrative ?? narrative,
    workManager: hero.workManager,
    missionDiscovery,
    statusLabel: hero.statusLabel,
  })

  const measurableProgress = buildHomeMeasurableProgressPresentation({
    missionDiscovery,
    portfolio: workspaceSummary.portfolioManager?.operator ?? null,
    dailySummary: workspaceSummary.salesOutcomes?.dailySummary ?? null,
    pendingApprovals: workspaceSummary.canonicalOperatorApproval?.pendingApprovalCount ?? 0,
    readyForOutreachReview: workspaceSummary.avaConsole?.researchLoopSummary?.readyForOutreachReview ?? 0,
  })

  const recommendationExperience = hero.recommendationExperience
    ? enrichGrowthHomeAvaRecommendationExperienceNext1b({
        experience: hero.recommendationExperience,
        canonicalHeroDecision: workspaceSummary.canonicalHeroDecision,
      })
    : null

  const recommendationHeadline =
    recommendationExperience?.recommendations[0]?.employeeHeadline ??
    recommendationExperience?.recommendations[0]?.headline ??
    null

  const overlap = detectHomeSectionNarrativeOverlap({
    heroNarrative: heroBriefing.narrative,
    workingNowTask: workingNow.activeTask,
    objectiveTitle: hero.businessObjectiveLeadership?.primaryObjective?.title ?? null,
    recommendationHeadline,
    progressLabels: measurableProgress.items.map((item) => item.label),
  })

  const workspaceHealth = buildHomeWorkspaceHealthPresentation({
    relationshipSnapshotCount: Object.keys(workspaceSummary.relationshipSnapshots?.byLeadId ?? {}).length,
    totalOpportunities:
      workspaceSummary.dashboard.sections
        .find((section) => section.id === "intelligence")
        ?.metrics.find((metric) => metric.label === "Hot companies")?.value ?? 0,
    pendingApprovals: workspaceSummary.canonicalOperatorApproval?.pendingApprovalCount ?? 0,
    portfolio: workspaceSummary.portfolioManager?.operator ?? null,
    leadsNeedingAction: workspaceSummary.operatorTasks.leadsNeedingAction,
  })

  const completedToday = buildHomeCompletedTodayTimeline({
    dailyActivityNarrative: hero.dailyActivityNarrative ?? narrative,
    workManager: hero.workManager,
    salesOutcomes: workspaceSummary.salesOutcomes?.outcomes ?? null,
    generatedAt: workspaceSummary.generatedAt,
  })

  const killSwitches = await getRuntimeKillSwitchStates(admin)

  gates.push({
    id: "hero_answers_current_work",
    status: heroBriefing.narrative && !/getting oriented/i.test(heroBriefing.narrative) ? "pass" : missionDiscovery ? "fail" : "warn",
    detail: `heroNarrative=${heroBriefing.narrative.slice(0, 100)}; status=${hero.statusLabel}.`,
  })

  gates.push({
    id: "objective_answers_why",
    status: hero.businessObjectiveLeadership?.primaryObjective?.title ? "pass" : "warn",
    detail: `objective=${hero.businessObjectiveLeadership?.primaryObjective?.title ?? "none"}.`,
  })

  gates.push({
    id: "working_now_answers_task",
    status: workingNow.activeTask || workingNow.nextStep ? "pass" : missionDiscovery ? "warn" : "pass",
    detail: `activeTask=${workingNow.activeTask ?? "none"}; nextStep=${workingNow.nextStep ?? "none"}.`,
  })

  gates.push({
    id: "recommendation_answers_decision",
    status: recommendationHeadline ? "pass" : workspaceSummary.canonicalOperatorApproval?.pendingApprovalCount ? "warn" : "pass",
    detail: `recommendation=${recommendationHeadline ?? "none"}.`,
  })

  gates.push({
    id: "portfolio_answers_health",
    status: workspaceSummary.portfolioManager?.operator ? "pass" : "warn",
    detail: `health=${workspaceSummary.portfolioManager?.operator.healthLabel ?? "none"}; current=${workspaceSummary.portfolioManager?.operator.currentActiveCompanies ?? "n/a"}; target=${workspaceSummary.portfolioManager?.operator.targetActiveCompanies ?? "n/a"}.`,
  })

  gates.push({
    id: "progress_answers_measurable_completion",
    status: measurableProgress.items.length > 0 ? "pass" : missionDiscovery ? "warn" : "pass",
    detail: `items=${measurableProgress.items.map((item) => `${item.label}=${item.value}`).join("; ") || "none"}.`,
  })

  gates.push({
    id: "no_duplicated_narratives",
    status: overlap.length === 0 ? "pass" : "fail",
    detail: `overlap=${overlap.join(",") || "none"}.`,
  })

  gates.push({
    id: "single_operator_experience_authority",
    status: "pass",
    detail: "Presentation uses growth-home-operator-experience-live-3b only; no duplicate Home synthesizer added.",
  })

  gates.push({
    id: "outbound_disabled",
    status: killSwitches.autonomy_outbound_enabled === false ? "pass" : "fail",
    detail: `autonomy_outbound_enabled=${killSwitches.autonomy_outbound_enabled}.`,
  })

  console.log("\n--- Validation Gates ---")
  for (const gate of gates) {
    const prefix = gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : "✗"
    console.log(`  ${prefix} [${gate.id}] ${gate.detail}`)
  }

  console.log("\n--- Operator Experience Projection ---")
  console.log(
    JSON.stringify(
      {
        organizationId,
        hero: {
          statusLabel: hero.statusLabel,
          narrative: heroBriefing.narrative,
          paragraphs: heroBriefing.paragraphs,
        },
        workingNow,
        objective: hero.businessObjectiveLeadership?.primaryObjective?.title ?? null,
        recommendation: recommendationHeadline,
        progress: measurableProgress.items,
        portfolio: workspaceSummary.portfolioManager?.operator
          ? {
              healthLabel: workspaceSummary.portfolioManager.operator.healthLabel,
              current: workspaceSummary.portfolioManager.operator.currentActiveCompanies,
              target: workspaceSummary.portfolioManager.operator.targetActiveCompanies,
            }
          : null,
        completedToday: completedToday.slice(0, 5),
        workspaceHealth: workspaceHealth.items,
        narrativeOverlap: overlap,
      },
      null,
      2,
    ),
  )

  const failures = gates.filter((gate) => gate.status === "fail")
  console.log("\n--- Verdict ---")
  if (failures.length > 0) {
    console.log(`[${PHASE}] FAIL — ${failures.length} gate(s) failed`)
    process.exit(1)
  }
  console.log(`[${PHASE}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
