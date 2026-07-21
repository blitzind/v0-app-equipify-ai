/**
 * GE-AIOS-LAUNCH-1A — Production daily-use readiness validation (read-only).
 *
 * Run:
 *   pnpm validate:ge-aios-launch-1a-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { resolveCanonicalApprovalQueueCount } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { synthesizeGrowthHomeExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { buildAiOsUxViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer"
import { buildAvaHomeHero } from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import {
  buildHeroExecutiveBriefing,
  detectHomeSectionNarrativeOverlap,
} from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"
import { buildGrowthSalesOperationsCenterViewModel } from "@/lib/growth/operations-center/build-growth-sales-operations-center-view-model"

const PHASE = "GE-AIOS-LAUNCH-1A" as const

type Gate = {
  id: string
  status: "pass" | "warn" | "fail"
  detail: string
}

function pushGate(gates: Gate[], gate: Gate): void {
  gates.push(gate)
  const icon = gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : "✗"
  console.log(`  ${icon} [${gate.id}] ${gate.detail}`)
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production launch readiness validation (read-only)`)

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
  const gates: Gate[] = []

  const workspaceSummary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: bootstrap.operatorEmail,
    actorUserId: bootstrap.actorUserId,
  })

  const briefing = synthesizeGrowthHomeExecutiveBriefing({
    dashboard: workspaceSummary.dashboard,
    sources: workspaceSummary.sources,
    canonicalApprovalSnapshot: workspaceSummary.canonicalOperatorApproval,
    canonicalOperatorTask: workspaceSummary.canonicalOperatorTask,
    canonicalActiveMissions: workspaceSummary.canonicalActiveMissions,
    canonicalOperatorFocus: workspaceSummary.canonicalOperatorFocus,
    missionDiscovery: workspaceSummary.missionDiscovery,
    portfolioTargetCurrent: workspaceSummary.portfolioManager?.operator?.currentActiveCompanies ?? null,
    portfolioTargetGoal: workspaceSummary.portfolioManager?.operator?.targetActiveCompanies ?? null,
  })

  const aiOsUx = buildAiOsUxViewModel({
    dashboard: workspaceSummary.dashboard,
    executiveBrief: briefing.executiveBrief,
    waitingOnYou: briefing.waitingOnYou,
    waitingOnYouOverflow: briefing.waitingOnYouOverflow,
    needsReview: briefing.needsReview,
    canonicalApprovalSnapshot: workspaceSummary.canonicalOperatorApproval,
    canonicalOperatorTask: workspaceSummary.canonicalOperatorTask,
    canonicalActiveMissions: workspaceSummary.canonicalActiveMissions,
    canonicalOperatorFocus: workspaceSummary.canonicalOperatorFocus,
    missionDiscovery: workspaceSummary.missionDiscovery,
    portfolioTargetCurrent: workspaceSummary.portfolioManager?.operator?.currentActiveCompanies ?? null,
    portfolioTargetGoal: workspaceSummary.portfolioManager?.operator?.targetActiveCompanies ?? null,
  })

  const canonicalApprovalCount = resolveCanonicalApprovalQueueCount(
    workspaceSummary.canonicalOperatorApproval,
    0,
  )
  const readyForOutreachReview = workspaceSummary.avaConsole?.researchLoopSummary?.readyForOutreachReview ?? 0

  pushGate(gates, {
    id: "approval_count_home_ops_agree",
    status:
      aiOsUx.approveItemsCount === canonicalApprovalCount &&
      workspaceSummary.kpis.approvalQueueCount === canonicalApprovalCount
        ? "pass"
        : "fail",
    detail: `canonical=${canonicalApprovalCount}; aiOsUx=${aiOsUx.approveItemsCount}; kpis=${workspaceSummary.kpis.approvalQueueCount}`,
  })

  const heroBriefing = buildHeroExecutiveBriefing({
    statusLabel: "Active",
    dailyActivityNarrative: null,
    missionDiscovery: workspaceSummary.missionDiscovery,
    pendingApprovals: canonicalApprovalCount,
    readyForOutreachReview,
  })

  const heroClaimsPackageReview =
    /ready for your review|packages ready|opportunity packages ready/i.test(heroBriefing.narrative)
  const waitingClaimsEmpty = canonicalApprovalCount === 0

  pushGate(gates, {
    id: "hero_waiting_package_truth",
    status:
      heroClaimsPackageReview && waitingClaimsEmpty
        ? "fail"
        : heroClaimsPackageReview === (canonicalApprovalCount > 0)
          ? "pass"
          : "warn",
    detail: `heroClaimsReview=${heroClaimsPackageReview}; canonicalPackages=${canonicalApprovalCount}; preparing=${readyForOutreachReview}`,
  })

  pushGate(gates, {
    id: "evidence_completeness_wired",
    status: workspaceSummary.organizationalEvidenceCompleteness ? "pass" : "warn",
    detail: workspaceSummary.organizationalEvidenceCompleteness
      ? `admission=${workspaceSummary.organizationalEvidenceCompleteness.admissionEvidence.completeness}`
      : "organizationalEvidenceCompleteness null on workspace-summary",
  })

  const hero = buildAvaHomeHero({
    greeting: aiOsUx.hero.greeting,
    hour: new Date().getHours(),
    employeeStatus: briefing.employeeStatus,
    aiOsUx,
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
      leadPool: workspaceSummary.leadPool,
      missionDiscovery: workspaceSummary.missionDiscovery,
      portfolioLeads: workspaceSummary.portfolioLeads ?? null,
      eligibleLeadCount: workspaceSummary.eligibleLeadCount ?? null,
      businessObjectiveLeadership: workspaceSummary.businessObjectiveLeadership ?? null,
      strategicAdvisorContext: workspaceSummary.strategicAdvisorContext ?? null,
      canonicalHeroDecision: workspaceSummary.canonicalHeroDecision ?? null,
    },
    waitingOnYou: aiOsUx.waitingOnYou,
    dailyWorkQueue: aiOsUx.dailyWorkQueue,
    timeline: briefing.timeline,
    generatedAt: workspaceSummary.generatedAt,
    salesOutcomes: workspaceSummary.salesOutcomes,
    organizationalKnowledge: workspaceSummary.organizationalKnowledge?.store.items ?? null,
    canonicalHeroDecision: workspaceSummary.canonicalHeroDecision ?? null,
    strategicAdvisorContext: workspaceSummary.strategicAdvisorContext ?? null,
    organizationalEvidenceCompleteness: workspaceSummary.organizationalEvidenceCompleteness ?? null,
    organizationId,
    outboundDisabled: true,
  })

  pushGate(gates, {
    id: "executive_reasoning_primary",
    status: hero.executiveReasoning?.primary?.topic ? "pass" : "warn",
    detail: hero.executiveReasoning?.primary?.topic ?? "no primary reasoning block",
  })

  pushGate(gates, {
    id: "strategic_insight_available",
    status: hero.strategicLeadership?.hasInsight ? "pass" : "warn",
    detail: hero.strategicLeadership?.hasInsight
      ? String(hero.strategicLeadership.insight?.kind ?? "insight")
      : "no strategic insight this load",
  })

  pushGate(gates, {
    id: "recommendation_has_why_reasons",
    status:
      (hero.recommendationExperience?.recommendations[0]?.whyReasons.length ?? 0) > 0
        ? "pass"
        : hero.recommendationExperience?.hasRecommendations
          ? "warn"
          : "pass",
    detail: `recommendations=${hero.recommendationExperience?.recommendations.length ?? 0}; why=${hero.recommendationExperience?.recommendations[0]?.whyReasons.length ?? 0}`,
  })

  const overlap = detectHomeSectionNarrativeOverlap({
    heroNarrative: heroBriefing.narrative,
    workingNowTask: hero.dailyActivityNarrative?.working_now[0] ?? null,
    objectiveTitle: hero.businessObjectiveLeadership?.primaryObjective?.title ?? null,
    recommendationHeadline:
      hero.recommendationExperience?.recommendations[0]?.employeeHeadline ??
      hero.recommendationExperience?.recommendations[0]?.headline ??
      null,
    progressLabels: [],
  })

  pushGate(gates, {
    id: "narrative_overlap",
    status: overlap.length === 0 ? "pass" : overlap.length <= 1 ? "warn" : "fail",
    detail: overlap.length > 0 ? overlap.join(", ") : "none",
  })

  if (hero.dailyBriefing?.work_manager_result) {
    const opsView = buildGrowthSalesOperationsCenterViewModel({
      dailyBriefing: hero.dailyBriefing,
      decisionContext: {
        workspaceSummary: {
          kpis: workspaceSummary.kpis,
          meetings: workspaceSummary.meetings,
          inbox: workspaceSummary.inbox,
          operatorTasks: workspaceSummary.operatorTasks,
          avaConsole: workspaceSummary.avaConsole,
          dashboard: workspaceSummary.dashboard,
          leadPool: workspaceSummary.leadPool,
          missionDiscovery: workspaceSummary.missionDiscovery,
          portfolioLeads: workspaceSummary.portfolioLeads ?? null,
          eligibleLeadCount: workspaceSummary.eligibleLeadCount ?? null,
        },
        waitingOnYou: aiOsUx.waitingOnYou,
        dailyWorkQueue: aiOsUx.dailyWorkQueue,
        accomplishments: briefing.accomplishments,
        timeline: briefing.timeline,
      },
      missionDiscovery: workspaceSummary.missionDiscovery ?? null,
      generatedAt: workspaceSummary.generatedAt,
    })

    pushGate(gates, {
      id: "operations_decision_explanation",
      status: opsView.decisionExplanation?.headline ? "pass" : "warn",
      detail: opsView.decisionExplanation?.headline ?? "no decision explanation",
    })
  } else {
    pushGate(gates, {
      id: "operations_decision_explanation",
      status: "warn",
      detail: "work_manager_result unavailable this load",
    })
  }

  const engineeringTerms =
    /qa marker|canonical projection|lifecycle state|datamoon|operator projection|baseline snapshot/i
  const heroText = heroBriefing.paragraphs.join(" ")
  pushGate(gates, {
    id: "no_engineering_language_hero",
    status: engineeringTerms.test(heroText) ? "fail" : "pass",
    detail: engineeringTerms.test(heroText) ? "engineering terms detected in hero copy" : "clean",
  })

  const failCount = gates.filter((row) => row.status === "fail").length
  const warnCount = gates.filter((row) => row.status === "warn").length
  const passCount = gates.filter((row) => row.status === "pass").length
  const launchScore = Math.round((passCount / gates.length) * 100)

  console.log("")
  console.log(`[${PHASE}] Summary: pass=${passCount} warn=${warnCount} fail=${failCount}`)
  console.log(`[${PHASE}] Launch readiness score: ${launchScore}/100`)
  console.log(JSON.stringify({ phase: PHASE, organizationId, gates, launchScore }, null, 2))

  if (failCount > 0) process.exit(1)
}

main().catch((error) => {
  console.error(`[${PHASE}] Fatal`, error)
  process.exit(1)
})
