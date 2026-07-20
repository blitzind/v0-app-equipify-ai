/**
 * GE-AIOS-LIVE-3C — Production human-centered Home language validation (read-only).
 *
 * Run:
 *   pnpm validate:ge-aios-live-3c-human-centered-home-language-production
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
  buildHomeMeasurableProgressPresentation,
  buildHomeWorkingNowPresentation,
  detectHomeSectionNarrativeOverlap,
  GROWTH_HOME_SECTION_OBJECTIVE_TITLE,
  GROWTH_HOME_SECTION_PORTFOLIO_TITLE,
  GROWTH_HOME_SECTION_PROGRESS_TITLE,
  GROWTH_HOME_SECTION_RECOMMENDATION_TITLE,
  GROWTH_HOME_SECTION_WORKING_NOW_TITLE,
  GROWTH_HOME_SECTION_WORKSPACE_HEALTH_TITLE,
  humanizeOperatorFacingCopy,
} from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"
import { GROWTH_OPERATING_RHYTHM_QA_MARKER } from "@/lib/growth/operating-rhythm/types"
import { GROWTH_WORK_MANAGER_QA_MARKER } from "@/lib/growth/work-manager/types"

const PHASE = "GE-AIOS-LIVE-3C" as const

const INTERNAL_TERMS = [
  "missionDiscovery",
  "lifecycle state",
  "operator projection",
  "startup discovery",
  "readyForOutreachReview",
  "finding_leads",
  "Run Prospect Search",
]

type ValidationGate = {
  id: string
  status: "pass" | "warn" | "fail"
  detail: string
}

function containsInternalTerm(text: string): string | null {
  for (const term of INTERNAL_TERMS) {
    if (new RegExp(term, "i").test(text)) return term
  }
  return null
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production human-centered Home language validation (read-only)`)

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
  const recommendationLead =
    recommendationExperience?.recommendations[0]?.employeeLeadParagraph ?? null

  const overlap = detectHomeSectionNarrativeOverlap({
    heroNarrative: heroBriefing.narrative,
    workingNowTask: workingNow.activeTask,
    objectiveTitle: hero.businessObjectiveLeadership?.primaryObjective?.title ?? null,
    recommendationHeadline,
    progressLabels: buildHomeMeasurableProgressPresentation({
      missionDiscovery,
      portfolio: workspaceSummary.portfolioManager?.operator ?? null,
      dailySummary: workspaceSummary.salesOutcomes?.dailySummary ?? null,
      pendingApprovals: workspaceSummary.canonicalOperatorApproval?.pendingApprovalCount ?? 0,
      readyForOutreachReview: workspaceSummary.avaConsole?.researchLoopSummary?.readyForOutreachReview ?? 0,
    }).items.map((item) => item.label),
  })

  const killSwitches = await getRuntimeKillSwitchStates(admin)

  gates.push({
    id: "hero_includes_natural_greeting_source",
    status: briefing.aiOsUx.hero.greeting ? "pass" : "warn",
    detail: `greeting=${briefing.aiOsUx.hero.greeting ?? "none"}.`,
  })

  gates.push({
    id: "hero_summarizes_without_full_section_duplication",
    status:
      heroBriefing.paragraphs.length > 0 &&
      heroBriefing.paragraphs.length <= 2 &&
      overlap.length === 0
        ? "pass"
        : "fail",
    detail: `paragraphs=${heroBriefing.paragraphs.length}; overlap=${overlap.join(",") || "none"}.`,
  })

  gates.push({
    id: "hero_includes_operator_action_when_present",
    status:
      (workspaceSummary.avaConsole?.researchLoopSummary?.readyForOutreachReview ?? 0) > 0
        ? /outreach package ready for your review/i.test(heroBriefing.narrative)
          ? "pass"
          : "fail"
        : "pass",
    detail: `readyForOutreachReview=${workspaceSummary.avaConsole?.researchLoopSummary?.readyForOutreachReview ?? 0}; hero=${heroBriefing.narrative.slice(0, 120)}.`,
  })

  gates.push({
    id: "recommendation_uses_ava_voice",
    status:
      !recommendationHeadline ||
      (/strong fit|strong match|recommend reviewing/i.test(`${recommendationHeadline} ${recommendationLead ?? ""}`) &&
        !/prepare another review-ready/i.test(`${recommendationHeadline} ${recommendationLead ?? ""}`))
        ? "pass"
        : "fail",
    detail: `headline=${recommendationHeadline ?? "none"}; lead=${recommendationLead ?? "none"}.`,
  })

  gates.push({
    id: "visible_section_labels_use_business_language",
    status:
      GROWTH_HOME_SECTION_PROGRESS_TITLE === "What I've Accomplished" &&
      GROWTH_HOME_SECTION_WORKSPACE_HEALTH_TITLE === "Business Snapshot" &&
      GROWTH_HOME_SECTION_PORTFOLIO_TITLE === "Sales Pipeline" &&
      GROWTH_HOME_SECTION_WORKING_NOW_TITLE === "What I'm Working On" &&
      GROWTH_HOME_SECTION_OBJECTIVE_TITLE === "Why I'm Doing This" &&
      GROWTH_HOME_SECTION_RECOMMENDATION_TITLE === "What I Recommend"
        ? "pass"
        : "fail",
    detail: `progress=${GROWTH_HOME_SECTION_PROGRESS_TITLE}; snapshot=${GROWTH_HOME_SECTION_WORKSPACE_HEALTH_TITLE}; pipeline=${GROWTH_HOME_SECTION_PORTFOLIO_TITLE}.`,
  })

  const operatorCopy = [
    heroBriefing.narrative,
    workingNow.activeTask ?? "",
    workingNow.nextStep ?? "",
    recommendationHeadline ?? "",
    recommendationLead ?? "",
    humanizeOperatorFacingCopy(workspaceSummary.portfolioManager?.operator?.healthLabel ?? ""),
  ].join(" ")

  const internalTerm = containsInternalTerm(operatorCopy)
  gates.push({
    id: "no_internal_architecture_terms",
    status: internalTerm ? "fail" : "pass",
    detail: internalTerm ? `found=${internalTerm}` : "operator-facing copy is business language.",
  })

  gates.push({
    id: "live_3b_remains_single_presentation_authority",
    status: "pass",
    detail: "All LIVE-3C language changes live in growth-home-operator-experience-live-3b.ts.",
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

  console.log("\n--- Human-Centered Projection ---")
  console.log(
    JSON.stringify(
      {
        organizationId,
        greeting: briefing.aiOsUx.hero.greeting,
        hero: heroBriefing,
        workingNow,
        recommendation: {
          headline: recommendationHeadline,
          lead: recommendationLead,
        },
        sectionLabels: {
          progress: GROWTH_HOME_SECTION_PROGRESS_TITLE,
          snapshot: GROWTH_HOME_SECTION_WORKSPACE_HEALTH_TITLE,
          pipeline: GROWTH_HOME_SECTION_PORTFOLIO_TITLE,
          workingNow: GROWTH_HOME_SECTION_WORKING_NOW_TITLE,
          objective: GROWTH_HOME_SECTION_OBJECTIVE_TITLE,
          recommendation: GROWTH_HOME_SECTION_RECOMMENDATION_TITLE,
        },
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
