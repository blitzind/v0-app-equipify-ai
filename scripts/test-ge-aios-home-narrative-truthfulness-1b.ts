/**
 * GE-AIOS-HOME-NARRATIVE-TRUTHFULNESS-1B — Executive briefing semantic correctness.
 *
 * Run: pnpm test:ge-aios-home-narrative-truthfulness-1b
 */
import assert from "node:assert/strict"
import { GROWTH_MISSION_PURPOSE_1A_QA_MARKER } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import type { GrowthProductionMissionAuthority } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import { buildProductionMissionAuthority } from "@/lib/growth/mission-purpose/growth-production-mission-authority-1a"
import { GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import type { GrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import { resolveRuntimeExecutionPresentation } from "@/lib/growth/home/growth-home-runtime-execution-presentation-1b"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { buildHeroExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"
import {
  formatAdmissionReviewBacklogSummary,
  GROWTH_HOME_NARRATIVE_TRUTHFULNESS_1B_QA_MARKER,
  heroNarrativeMustNotClaimApprovalWhenPendingZero,
  narrativeClaimsOperatorApprovalPending,
  sanitizeMissionSummaryLineForPresentation,
} from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-truthfulness-1b"

const PHASE = "GE-AIOS-HOME-NARRATIVE-TRUTHFULNESS-1B" as const

function portfolioManager(partial: Partial<GrowthPortfolioManagerSnapshot["health"]["counts"]> = {}): GrowthPortfolioManagerSnapshot {
  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    target: {
      targetActiveCompanies: 25,
      minimumHealthyCompanies: 15,
      maximumQueuedAdmissions: 50,
      source: "defaults",
    },
    health: {
      qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
      healthState: "needs_replenishment",
      counts: {
        activeCompanies: 8,
        researching: 0,
        awaitingAdmission: 0,
        awaitingReview: 23,
        qualified: 0,
        archived: 0,
        rejected: 0,
        invalid: 0,
        discoveryRemaining: 17,
        ...partial,
      },
      needsCount: 17,
      approvedProfilePresent: true,
      discoveryRunning: true,
      researchRunning: false,
      admissionsPending: 23,
    },
    replenishment: {
      shouldReplenish: true,
      shouldResumeActiveDiscovery: true,
      blockedByQueueLimit: false,
      batchSize: 25,
    },
    operator: {
      qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
      targetActiveCompanies: 25,
      currentActiveCompanies: 8,
      minimumHealthyCompanies: 15,
      needsCount: 17,
      healthState: "needs_replenishment",
      healthLabel: "Portfolio needs more qualified companies.",
      discoveryRunning: true,
      discoveryRunningCount: 0,
      discoveryStatusDisplay: "Next batch: 25",
      nextBatchSize: 25,
      showEstimatedHealthy: false,
      researchRunning: false,
      researchRunningCount: 0,
      admissionsPending: 23,
      projectedCompletionLabel: null,
      manualFindOptions: [10, 25, 50, 100],
    },
  }
}

function productionAuthority(
  partial: Partial<GrowthProductionMissionAuthority> = {},
): GrowthProductionMissionAuthority {
  return {
    qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
    title: "Equipify Growth Mission",
    objectiveStatement: "Maintain portfolio capacity.",
    portfolioBelowTarget: true,
    discoveryActive: true,
    operatorSummaryLines: ["23 companies require admission review."],
    primaryFocus: "admission",
    ...partial,
  }
}

function runGate(label: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${label}`)
  } catch (error) {
    console.error(`  ✗ ${label}`)
    throw error
  }
}

function main(): void {
  console.log(`[${PHASE}] Home narrative truthfulness certification`)

  runGate("QA marker exported", () => {
    assert.equal(GROWTH_HOME_NARRATIVE_TRUTHFULNESS_1B_QA_MARKER, "ge-aios-home-narrative-truthfulness-1b-v1")
  })

  runGate("Mission authority uses admission-review wording for awaitingReview", () => {
    const authority = buildProductionMissionAuthority({
      portfolioManager: portfolioManager(),
    })
    assert.ok(
      authority.operatorSummaryLines.some((line) => /require admission review/i.test(line)),
      authority.operatorSummaryLines.join(" | "),
    )
    assert.ok(
      !authority.operatorSummaryLines.some((line) => /outreach packages are ready/i.test(line)),
      authority.operatorSummaryLines.join(" | "),
    )
    assert.notEqual(authority.primaryFocus, "approvals")
  })

  runGate("awaitingReview > 0 and pendingApprovalCount == 0 — hero must not claim review-ready packages", () => {
    const runtime = resolveRuntimeExecutionPresentation({
      pendingApprovals: 0,
      portfolioOperator: portfolioManager().operator,
      productionMissionAuthority: productionAuthority(),
    })
    const briefing = buildHeroExecutiveBriefing({
      statusLabel: "Finding Leads",
      pendingApprovals: 0,
      readyForOutreachReview: 0,
      portfolioOperator: portfolioManager().operator,
      productionMissionAuthority: productionAuthority(),
      primaryMissionLabel: runtime.primaryMissionLabel,
      currentActivityLabel: runtime.currentActivityLabel,
      repliesToday: 1,
    })
    assert.match(briefing.paragraphs[0] ?? "", /below target/i)
    assert.doesNotMatch(briefing.paragraphs[0] ?? "", /outreach packages are ready/i)
    assert.match(briefing.paragraphs[1] ?? "", /don't currently need anything from you/i)
    assert.ok(heroNarrativeMustNotClaimApprovalWhenPendingZero(briefing.narrative, 0))
  })

  runGate("pendingApprovalCount > 0 — hero requests operator review", () => {
    const briefing = buildHeroExecutiveBriefing({
      statusLabel: "Preparing outreach",
      pendingApprovals: 2,
      readyForOutreachReview: 0,
    })
    assert.match(briefing.paragraphs[0] ?? "", /ready for your review/i)
    assert.match(briefing.paragraphs[1] ?? "", /need your review on 2 outreach packages/i)
  })

  runGate("package preparation uses in-progress terminology", () => {
    const briefing = buildHeroExecutiveBriefing({
      statusLabel: "Preparing outreach",
      pendingApprovals: 0,
      readyForOutreachReview: 3,
    })
    assert.match(briefing.paragraphs[0] ?? "", /in preparation/i)
    assert.doesNotMatch(briefing.paragraphs[0] ?? "", /for your review/i)
    assert.match(briefing.paragraphs[2] ?? "", /ready for your review/i)
  })

  runGate("sanitizeMissionSummaryLine drops misleading package-ready mission lines", () => {
    assert.equal(
      sanitizeMissionSummaryLineForPresentation("23 outreach packages are ready.", 0),
      null,
    )
    assert.equal(
      sanitizeMissionSummaryLineForPresentation("23 companies require admission review.", 0),
      "23 companies require admission review.",
    )
  })

  runGate("Runtime Trust matches hero when pending approvals are zero", () => {
    const runtime = resolveRuntimeExecutionPresentation({
      pendingApprovals: 0,
      portfolioOperator: portfolioManager().operator,
      productionMissionAuthority: productionAuthority(),
    })
    assert.doesNotMatch(runtime.currentActivityLabel ?? "", /outreach packages are ready/i)
    const vm = buildGrowthHomeRuntimeTrustViewModel({
      server: null,
      salesOutcomes: null,
      activeWork: null,
      pendingApprovals: 0,
      setupIncomplete: false,
      portfolioOperator: portfolioManager().operator,
      productionMissionAuthority: productionAuthority(),
    })
    assert.notEqual(vm.operatorState, "waiting")
  })

  runGate("approval phrasing reserved for canonical pending count", () => {
    assert.equal(narrativeClaimsOperatorApprovalPending("2 outreach packages are ready for your review"), true)
    assert.equal(formatAdmissionReviewBacklogSummary(23), "23 companies require admission review.")
    assert.equal(narrativeClaimsOperatorApprovalPending("23 companies require admission review."), false)
  })

  console.log(`[${PHASE}] PASS`)
}

main()
