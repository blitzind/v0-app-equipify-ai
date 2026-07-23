/**
 * AVA-GROWTH-OPERATOR-1B — Decision authority unification certification.
 * Run: pnpm test:ava-growth-operator-1b-decision-authority
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildCanonicalOpportunityAuthorityFromResolution,
  buildCanonicalOpportunityAuthorityMap,
  GROWTH_AIOS_GROWTH_OPERATOR_1B_QA_MARKER,
  GROWTH_CANONICAL_OPPORTUNITY_AUTHORITY_RULE,
  resolveCanonicalAuthorityRequiresOperator,
} from "../lib/growth/aios/authority/growth-canonical-opportunity-authority-1b"
import {
  buildCanonicalRecommendationAuthorityContext,
  shouldSuppressDailyQueueItem,
  shouldSuppressWorkManagerQueueItem,
} from "../lib/growth/aios/authority/growth-recommendation-authority-gate-1b"
import { authorizeSpendForInvestmentState } from "../lib/growth/resource-allocation/resource-allocation-facade-engine"
import { bindRevenueOperatorOrchestrationToCanonicalAuthority } from "../lib/growth/aios/growth/growth-revenue-operator-canonical-binding-1b"
import { buildRevenueOperatorOrchestration } from "../lib/growth/aios/growth/growth-revenue-operator-orchestration-engine"
import { GROWTH_META_RECOMMENDER_AUTHORITY_ROLE } from "../lib/growth/aios/recommendations/growth-meta-recommender-types"
import type { GrowthCanonicalDecisionResolution } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthCanonicalNextBestDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"
import {
  applyCanonicalAuthorityToWorkItem,
  detectCanonicalAuthorityConflicts,
  nextBestActionToWorkItem,
} from "../lib/growth/work-manager"
import { runWorkManager } from "../lib/growth/work-manager/manager/run-work-manager"
import type { NextBestAction } from "../lib/growth/decision-engine/types"

export const AVA_GROWTH_OPERATOR_1B_QA_MARKER = "ava-growth-operator-1b-decision-authority-v1" as const

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

const LEAD_FIXTURE = "11111111-1111-4111-8111-111111111111"
const LEAD_REPLY = "22222222-2222-4222-8222-222222222222"

function buildDecision(
  primaryAction: GrowthCanonicalNextBestDecision["primaryAction"],
  overrides: Partial<GrowthCanonicalNextBestDecision> = {},
): GrowthCanonicalNextBestDecision {
  return {
    qaMarker: "ge-aios-decision-engine-1a-v1",
    decisionId: "decision-fixture",
    decisionFingerprint: `fp-${primaryAction}`,
    organizationId: "org-fixture",
    leadId: LEAD_FIXTURE,
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
    operatorReviewRequired: false,
    transportBlocked: primaryAction === "contact",
    ...overrides,
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
      confidenceLabel: "82% confidence",
      operatorReviewRequired: decision.operatorReviewRequired,
      transportBlocked: decision.transportBlocked,
    },
    freshness: {
      state: "current",
      label: "Current",
      packageGeneratedAt: null,
      approvalAt: null,
      materialEventAt: null,
      decisionFingerprint: decision.decisionFingerprint,
      packageFingerprint: null,
      strategyChangedSincePackage: false,
      stalePackageRelativeToDecision: false,
    },
    suppressionHints: {
      suppressColdOutreach: false,
      suppressSequenceSends: false,
      suppressDuplicatePackage: false,
      suppressTransport: decision.transportBlocked,
      reasons: [],
    },
    inputDegraded: [],
  }
}

function baseNextBestAction(overrides: Partial<NextBestAction> = {}): NextBestAction {
  return {
    id: "nba-fixture",
    kind: "prepare_outreach",
    title: "10B prepare outreach",
    reason: [{ code: "fixture", label: "Portfolio queue" }],
    overall_score: 88,
    score_breakdown: {
      revenue_impact: 80,
      customer_impact: 70,
      urgency: 60,
      confidence: 75,
      business_understanding: 50,
      dependencies: 40,
      effort: 30,
      approval_gate: 90,
    },
    depends_on: [],
    blocked_by: ["operator_approval"],
    estimated_time_minutes: 10,
    requires_operator: true,
    confidence: 0.75,
    href: `/growth/leads/${LEAD_FIXTURE}`,
    company_name: "Fixture Co",
    source_id: LEAD_FIXTURE,
    ...overrides,
  }
}

function workspaceSummaryFixture() {
  return {
    kpis: { emailsSentToday: 0, repliesToday: 0, callsToday: 0, approvalQueueCount: 0 },
    meetings: { upcoming: [], today: [] },
    inbox: { unreadCount: 0, highPriorityCount: 0 },
    operatorTasks: { pendingApprovals: 0, leadsNeedingAction: 0 },
    avaConsole: { researchLoopSummary: null, waitingForApproval: null },
    dashboard: {
      generatedAt: "2026-07-23T12:00:00.000Z",
      briefing: null,
      sections: [],
      operatorActionCards: [],
      dailyRevenueWorkQueueEnabled: false,
      dailyRevenueWorkQueue: null,
      dailyRevenueWorkQueueDisplay: null,
    },
    leadPool: { total: 1, visible: 1, truncated: false },
    missionDiscovery: null,
  }
}

console.log("AVA-GROWTH-OPERATOR-1B certification")

assert.equal(GROWTH_AIOS_GROWTH_OPERATOR_1B_QA_MARKER, "ava-growth-operator-1b-canonical-opportunity-authority-v1")
assert.match(GROWTH_CANONICAL_OPPORTUNITY_AUTHORITY_RULE, /sole per-opportunity execution authority/)

const prepResolution = buildResolution(
  buildDecision("contact", {
    recommendedActor: "ava",
    operatorReviewRequired: false,
    transportBlocked: true,
  }),
)
const prepAuthority = buildCanonicalOpportunityAuthorityFromResolution(prepResolution)
assert.equal(prepAuthority.owner, "ava")
assert.equal(prepAuthority.currentStage, "approval")
assert.equal(prepAuthority.autonomousEligible, true)
assert.equal(prepAuthority.escalationStatus, "none")
assert.equal(resolveCanonicalAuthorityRequiresOperator(prepAuthority), false)

const replyResolution = buildResolution(
  buildDecision("reply", {
    leadId: LEAD_REPLY,
    decisionFingerprint: "fp-reply",
    recommendedActor: "operator",
    operatorReviewRequired: true,
  }),
)
const replyAuthority = buildCanonicalOpportunityAuthorityFromResolution(replyResolution)
assert.equal(replyAuthority.owner, "operator")
assert.equal(replyAuthority.escalationStatus, "operator_required")
assert.equal(replyAuthority.autonomousEligible, false)

const authorityMap = buildCanonicalOpportunityAuthorityMap([prepResolution, replyResolution])
assert.ok(authorityMap[LEAD_FIXTURE])
assert.ok(authorityMap[LEAD_REPLY])
assert.equal(Object.keys(authorityMap).length, 2)

const conflictingItem = nextBestActionToWorkItem(
  baseNextBestAction(),
  "2026-07-23T12:00:00.000Z",
)
assert.equal(conflictingItem.requires_operator, true)
assert.equal(conflictingItem.can_execute_autonomously, false)

const boundItem = nextBestActionToWorkItem(
  baseNextBestAction(),
  "2026-07-23T12:00:00.000Z",
  authorityMap,
)
assert.equal(boundItem.requires_operator, false)
assert.equal(boundItem.can_execute_autonomously, true)
assert.equal(boundItem.authority_bound, true)
assert.equal(boundItem.canonical_decision_fingerprint, "fp-contact")
assert.equal(boundItem.canonical_authority_owner, "ava")
assert.deepEqual(detectCanonicalAuthorityConflicts([conflictingItem], authorityMap).length, 1)
assert.deepEqual(detectCanonicalAuthorityConflicts([boundItem], authorityMap).length, 0)

const wmResult = runWorkManager({
  workspaceSummary: workspaceSummaryFixture(),
  waitingOnYou: [
    {
      id: "approval:1",
      label: "Review outreach package",
      detail: "Ready for review",
      href: `/growth/leads/${LEAD_FIXTURE}`,
      severity: 90,
    },
  ],
  dailyWorkQueue: [
    {
      id: "queue:1",
      companyName: "Fixture Co",
      actionLabel: "Prepare outreach",
      reason: "Ready",
      href: `/growth/leads/${LEAD_FIXTURE}`,
      priority: "high",
      requiresHumanApproval: true,
      confidencePercent: 80,
      estimatedMinutes: 10,
    },
  ],
  accomplishments: [],
  timeline: [],
  generatedAt: "2026-07-23T12:00:00.000Z",
  canonicalAuthorityByLeadId: authorityMap,
})
assert.ok(wmResult.all_work_items.some((row) => row.authority_bound === true))

const roBase = buildRevenueOperatorOrchestration({
  leadId: LEAD_FIXTURE,
  workflowType: "research_company",
  approvalStatus: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
})
const roBound = bindRevenueOperatorOrchestrationToCanonicalAuthority({
  result: roBase,
  canonicalAuthority: prepAuthority,
})
assert.equal(roBound.record.recommendedNextAction, prepAuthority.nextActionTitle)
assert.equal(roBound.record.canonicalAuthorityBinding?.authoritative, true)
assert.equal(roBound.record.canonicalAuthorityBinding?.decisionFingerprint, "fp-contact")

assert.match(GROWTH_META_RECOMMENDER_AUTHORITY_ROLE, /never per-opportunity execution authority/)

const recommendationAuthority = buildCanonicalRecommendationAuthorityContext({
  canonicalHeroDecision: prepResolution,
})
assert.ok(recommendationAuthority.authoritativeLeadIds.has(LEAD_FIXTURE))
assert.equal(
  shouldSuppressWorkManagerQueueItem(
    {
      ...boundItem,
      type: "outreach",
    },
    recommendationAuthority.authoritativeLeadIds,
  ),
  true,
)
assert.equal(
  shouldSuppressDailyQueueItem(
    {
      id: "queue:1",
      companyName: "Fixture Co",
      actionLabel: "Prepare outreach",
      reason: "Ready",
      href: `/growth/leads/${LEAD_FIXTURE}`,
      priority: "high",
      requiresHumanApproval: true,
      confidencePercent: 80,
      estimatedMinutes: 10,
    },
    recommendationAuthority.authoritativeLeadIds,
  ),
  true,
)

assert.equal(authorizeSpendForInvestmentState("increase_investment", "outbound"), false)
assert.equal(authorizeSpendForInvestmentState("increase_investment", "billable"), true)

const requiredSources = [
  "lib/growth/aios/authority/growth-canonical-opportunity-authority-1b.ts",
  "lib/growth/work-manager/bridges/canonical-authority-work-manager-bridge-1b.ts",
  "lib/growth/aios/growth/growth-revenue-operator-canonical-binding-1b.ts",
  "lib/growth/aios/authority/growth-recommendation-authority-gate-1b.ts",
  "lib/growth/work-manager/bridges/decision-engine-bridge.ts",
  "lib/growth/work-manager/manager/run-work-manager.ts",
]
for (const relativePath of requiredSources) {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `missing ${relativePath}`)
}

const bridgeSource = readSource("lib/growth/work-manager/bridges/decision-engine-bridge.ts")
assert.match(bridgeSource, /applyCanonicalAuthorityToNextBestAction/)
assert.match(bridgeSource, /authorityByLeadId/)

const wmSource = readSource("lib/growth/work-manager/manager/run-work-manager.ts")
assert.match(wmSource, /canonicalAuthorityByLeadId/)

const roTypesSource = readSource("lib/growth/aios/growth/growth-revenue-operator-orchestration-types.ts")
assert.match(roTypesSource, /canonicalAuthorityBinding/)

console.log("PASS — AVA-GROWTH-OPERATOR-1B decision authority unification certified")
console.log(JSON.stringify({ qaMarker: AVA_GROWTH_OPERATOR_1B_QA_MARKER, verdict: "CERTIFIED" }, null, 2))
