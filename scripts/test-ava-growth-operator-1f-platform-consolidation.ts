/**
 * AVA-GROWTH-OPERATOR-1F — Platform consolidation & production certification.
 * Run: pnpm test:ava-growth-operator-1f-platform-consolidation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import {
  buildCanonicalRecommendationAuthorityContextFromMap,
} from "../lib/growth/aios/authority/growth-recommendation-authority-gate-1b"
import { buildCanonicalOpportunityAuthorityFromResolution } from "../lib/growth/aios/authority/growth-canonical-opportunity-authority-1b"
import { filterHumanApprovalItemsThroughCanonicalEscalation } from "../lib/growth/aios/approvals/growth-hac-escalation-gate-1f"
import {
  GROWTH_PLATFORM_ADVISORY_ONLY_SYSTEMS,
  GROWTH_PLATFORM_CANONICAL_AUTHORITY_MODULES,
  GROWTH_PLATFORM_CANONICAL_ESCALATION_MODULES,
  GROWTH_PLATFORM_CONSOLIDATION_RULE,
  GROWTH_PLATFORM_SUBSYSTEM_DEFERRAL_AUDIT,
  GROWTH_FUZOR_OS_REFERENCE_PATTERNS,
  GROWTH_FUZOR_OS_PROMOTION_CANDIDATES,
  GROWTH_AIOS_GROWTH_OPERATOR_1F_QA_MARKER,
} from "../lib/growth/aios/platform/growth-platform-consolidation-1f"
import { bindRevenueOperatorOrchestrationToCanonicalAuthority } from "../lib/growth/aios/growth/growth-revenue-operator-canonical-binding-1b"
import type { GrowthCanonicalDecisionResolution } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthCanonicalNextBestDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"

export const AVA_GROWTH_OPERATOR_1F_QA_MARKER = "ava-growth-operator-1f-platform-consolidation-v1" as const

const ROOT = process.cwd()
const LEAD = "11111111-1111-4111-8111-111111111111"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function buildDecision(primaryAction: GrowthCanonicalNextBestDecision["primaryAction"]): GrowthCanonicalNextBestDecision {
  return {
    qaMarker: "ge-aios-decision-engine-1a-v1",
    decisionId: "decision-fixture",
    decisionFingerprint: `fp-${primaryAction}`,
    organizationId: "org-fixture",
    leadId: LEAD,
    generatedAt: "2026-07-23T12:00:00.000Z",
    primaryAction,
    title: `Canonical ${primaryAction}`,
    rationale: ["fixture"],
    urgency: "today",
    confidence: 82,
    recommendedActor: "ava",
    recommendedChannel: "email",
    prerequisites: [],
    blockedBy: [],
    supportingActions: [],
    suppressedActions: [],
    sourceSummary: {},
    operatorReviewRequired: primaryAction === "contact",
    transportBlocked: primaryAction === "contact",
  }
}

function buildResolution(decision: GrowthCanonicalNextBestDecision): GrowthCanonicalDecisionResolution {
  return {
    qaMarker: "ge-aios-decision-engine-1b-v1",
    organizationId: decision.organizationId,
    leadId: decision.leadId,
    generatedAt: decision.generatedAt,
    companyName: "Fixture Co",
    decision,
    operatorCard: {
      qaMarker: "ge-aios-decision-engine-1a-operator-card-layout-v1",
      headline: "Ava's recommendation",
      whatToDo: decision.title,
      why: decision.rationale,
      whenLabel: "Today",
      whoActs: "Ava",
      whoInvolved: null,
      prerequisites: [],
      thenActions: [],
      doNotActions: [],
      confidenceLabel: "High confidence",
      freshnessLabel: "Fresh",
    },
    freshness: {
      qaMarker: "ge-aios-decision-engine-1b-freshness-v1",
      state: "fresh",
      ageHours: 1,
      label: "Recently updated",
    },
  }
}

function runPriorMilestoneRegression(): void {
  const scripts = [
    "test:ava-growth-operator-1b-decision-authority",
    "test:ava-growth-operator-1c-escalation-authority",
    "test:ava-growth-operator-1d-executive-experience",
    "test:ava-growth-operator-1e-growth-intelligence",
  ]
  for (const script of scripts) {
    execSync(`pnpm ${script}`, { cwd: ROOT, stdio: "pipe" })
  }
}

function runCertification(): void {
  console.log(`[${AVA_GROWTH_OPERATOR_1F_QA_MARKER}] AVA-GROWTH-OPERATOR-1F certification`)

  assert.equal(GROWTH_AIOS_GROWTH_OPERATOR_1F_QA_MARKER, AVA_GROWTH_OPERATOR_1F_QA_MARKER)
  assert.ok(GROWTH_PLATFORM_CONSOLIDATION_RULE.includes("One constitutional model"))

  const docPath = path.join(ROOT, "docs/AVA-GROWTH-OPERATOR-1F_PLATFORM_CONSOLIDATION.md")
  assert.ok(fs.existsSync(docPath), "1F documentation must exist")

  const finalCertPath = path.join(ROOT, "docs/AVA-GROWTH-OPERATOR-FINAL-CERTIFICATION-1A.md")
  assert.ok(fs.existsSync(finalCertPath), "Final certification document must exist")

  assert.ok(GROWTH_PLATFORM_SUBSYSTEM_DEFERRAL_AUDIT.length >= 10, "R8 subsystem audit must be populated")
  assert.ok(GROWTH_FUZOR_OS_REFERENCE_PATTERNS.length >= 7, "R9 reference patterns must be populated")
  assert.ok(GROWTH_FUZOR_OS_PROMOTION_CANDIDATES.length >= 5, "Fuzor OS promotion candidates must be documented")

  for (const modulePath of GROWTH_PLATFORM_CANONICAL_AUTHORITY_MODULES) {
    assert.ok(fs.existsSync(path.join(ROOT, modulePath)), `${modulePath} must exist`)
  }
  for (const modulePath of GROWTH_PLATFORM_CANONICAL_ESCALATION_MODULES) {
    assert.ok(fs.existsSync(path.join(ROOT, modulePath)), `${modulePath} must exist`)
  }
  assert.ok(GROWTH_PLATFORM_ADVISORY_ONLY_SYSTEMS.includes("meta_recommender"))

  const resolution = buildResolution(buildDecision("contact"))
  const authority = buildCanonicalOpportunityAuthorityFromResolution(resolution)
  const portfolioContext = buildCanonicalRecommendationAuthorityContextFromMap({
    canonicalAuthorityByLeadId: { [LEAD]: authority },
    canonicalHeroDecision: resolution,
  })
  assert.ok(portfolioContext.authoritativeLeadIds.has(LEAD))

  const roSource = readSource("lib/growth/aios/growth/growth-revenue-operator-orchestration-service.ts")
  assert.match(roSource, /bindRevenueOperatorOrchestrationToCanonicalAuthority/)

  const aslSource = readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts")
  assert.match(aslSource, /runWorkManagerWithPortfolioAuthority/)

  const homeSummarySource = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.match(homeSummarySource, /canonicalPortfolioAuthority/)
  assert.match(homeSummarySource, /hydrateCanonicalPortfolioAuthority/)

  const briefingSource = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts")
  assert.match(briefingSource, /canonicalAuthorityByLeadId/)

  const heroSource = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
  assert.match(heroSource, /canonicalPortfolioAuthority/)

  const queueSource = readSource("lib/growth/ava-home/recommendations/growth-home-ava-recommendation-queue-next-1a.ts")
  assert.match(queueSource, /canonicalAuthorityByLeadId/)

  const hacSource = readSource("lib/growth/aios/approvals/growth-human-approval-center-engine.ts")
  assert.match(hacSource, /filterHumanApprovalItemsThroughCanonicalEscalation/)

  const hacServiceSource = readSource("lib/growth/aios/approvals/growth-human-approval-center-service.ts")
  assert.match(hacServiceSource, /hydrateCanonicalPortfolioAuthority/)
  assert.match(hacServiceSource, /canonicalAuthorityByLeadId/)

  const filtered = filterHumanApprovalItemsThroughCanonicalEscalation({
    items: [
      {
        id: "approval-prep",
        organizationId: "org",
        source: "revenue_operator",
        actionType: "review_recommendation",
        channel: "none",
        subjectType: "lead",
        subjectId: LEAD,
        title: "Prep only",
        summary: "fixture",
        riskLevel: "low",
        priorityScore: 10,
        status: "needs_review",
        evidence: [],
        policy: { requiresHumanApproval: true, enforcementSource: "fixture" },
        createdAt: "2026-07-23T12:00:00.000Z",
      },
    ],
    canonicalAuthorityByLeadId: {
      [LEAD]: {
        ...authority,
        operatorReviewRequired: false,
        transportBlocked: false,
        autonomousEligible: true,
        escalationStatus: "none",
        executionState: "autonomous_eligible",
      },
    },
  })
  assert.equal(filtered.length, 0, "prep-only RO review must not interrupt when authority is autonomous")

  const roBound = bindRevenueOperatorOrchestrationToCanonicalAuthority({
    result: {
      record: {
        orchestrationId: "orch-fixture",
        leadId: LEAD,
        companyId: LEAD,
        companyName: "Fixture Co",
        planId: "plan-fixture",
        owningAgent: "research_agent",
        candidateAgents: ["research_agent"],
        orchestrationDecision: "human_review_required",
        recommendedNextAction: "Legacy RO action",
        escalationLevel: "medium",
        confidence: 0.5,
        reasoning: "fixture",
        blockedReasons: [],
        policyBlockReasons: [],
        evaluationTimestamp: "2026-07-23T12:00:00.000Z",
        handoffSummary: "fixture",
        agentHandoff: null,
      },
      planContext: {
        workflowType: "research",
        approvalStatus: "approved",
        readinessState: "ready",
        orchestrationReasoning: "fixture",
        handoffSummary: "fixture",
      },
    },
    canonicalAuthority: authority,
  })
  assert.equal(roBound.record.recommendedNextAction, authority.nextActionTitle)
  assert.equal(roBound.record.canonicalAuthorityBinding?.authoritative, true)

  console.log(`[${AVA_GROWTH_OPERATOR_1F_QA_MARKER}] prior milestone regression...`)
  runPriorMilestoneRegression()

  console.log(`[${AVA_GROWTH_OPERATOR_1F_QA_MARKER}] PASS`)
}

runCertification()
