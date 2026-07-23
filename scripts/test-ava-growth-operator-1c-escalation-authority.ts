/**
 * AVA-GROWTH-OPERATOR-1C — Escalation & autonomous authority certification.
 * Run: pnpm test:ava-growth-operator-1c-escalation-authority
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateCanonicalEscalation,
  GROWTH_AIOS_GROWTH_OPERATOR_1C_QA_MARKER,
  GROWTH_CANONICAL_ESCALATION_AUTHORITY_RULE,
  isAutonomousTerminalRejectReason,
  recordEscalationAgreementRow,
  buildEscalationAgreementSnapshot,
} from "../lib/growth/aios/authority/growth-canonical-escalation-authority-1c"
import { buildConstitutionalEscalationMapFromPortfolioLeads } from "../lib/growth/aios/authority/growth-constitutional-portfolio-escalation-1c"
import { buildCanonicalOpportunityAuthorityFromResolution } from "../lib/growth/aios/authority/growth-canonical-opportunity-authority-1b"
import { applyResearchSufficiencyAdmissionPolicy } from "../lib/growth/revenue-workflow/growth-admission-policy-1a"
import { assessGrowthLeadResearchOpportunity } from "../lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { authorizeSpendForInvestmentState } from "../lib/growth/resource-allocation/resource-allocation-facade-engine"
import type { GrowthCanonicalDecisionResolution } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthCanonicalNextBestDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"
import { buildDecisionContext } from "../lib/growth/decision-engine/context/build-decision-context"
import { nextBestActionToWorkItem } from "../lib/growth/work-manager"

export const AVA_GROWTH_OPERATOR_1C_QA_MARKER = "ava-growth-operator-1c-escalation-authority-v1" as const

const ROOT = process.cwd()
const LEAD_FIXTURE = "11111111-1111-4111-8111-111111111111"
const LEAD_REJECTED = "22222222-2222-4222-8222-222222222222"

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

console.log("AVA-GROWTH-OPERATOR-1C certification")

assert.equal(GROWTH_AIOS_GROWTH_OPERATOR_1C_QA_MARKER, "ava-growth-operator-1c-canonical-escalation-authority-v1")
assert.match(GROWTH_CANONICAL_ESCALATION_AUTHORITY_RULE, /One canonical escalation policy/)

assert.equal(isAutonomousTerminalRejectReason("known_icp_mismatch:consumer"), true)
assert.equal(isAutonomousTerminalRejectReason("profile_aligned"), false)

const prepAuthority = buildCanonicalOpportunityAuthorityFromResolution(
  buildResolution(buildDecision("contact", { recommendedActor: "ava", transportBlocked: true })),
)
const prepEscalation = evaluateCanonicalEscalation({
  requestKind: "prepare_outreach",
  opportunityAuthority: prepAuthority,
})
assert.equal(prepEscalation.interruptOperator, false)
assert.equal(prepEscalation.accomplishmentOnly, true)

const sendEscalation = evaluateCanonicalEscalation({
  requestKind: "outbound_send_ready",
  opportunityAuthority: prepAuthority,
  signals: { sendReady: true, packagePendingApproval: true },
})
assert.equal(sendEscalation.interruptOperator, true)
assert.equal(sendEscalation.category, "always_escalate")

const terminalEscalation = evaluateCanonicalEscalation({
  requestKind: "admission_terminal_reject",
  signals: {
    admissionState: "rejected",
    terminalRejectReasons: ["known_icp_mismatch:insurance"],
  },
})
assert.equal(terminalEscalation.interruptOperator, false)
assert.equal(terminalEscalation.category, "never_escalate")

const suppressedReview = evaluateCanonicalEscalation({ requestKind: "request_human_review" })
assert.equal(suppressedReview.interruptOperator, false)
assert.equal(suppressedReview.suppressionApplied, true)

const admission = applyResearchSufficiencyAdmissionPolicy({
  base: {
    state: "review",
    reasons: ["profile_disqualifier:insurance_carrier"],
    allowLeadCreation: true,
    allowAutoResearch: false,
    leadStatus: "new",
    requiresHumanReview: true,
    blockers: ["admission_review_required"],
    sanitized: {},
  },
  sufficiency: {
    decision: "terminal_reject",
    fitScore: 20,
    confidence: 0.2,
    disqualifiers: ["fit_below_terminal_threshold"],
    missingMaterialEvidence: [],
    optionalEvidenceMissing: [],
    ambiguity: [],
  },
})
assert.equal(admission.state, "rejected")
assert.equal(admission.requiresHumanReview, false)

const continueResearchNba = assessGrowthLeadResearchOpportunity({
  result: {
    companySummary: "Fixture",
    equipifyFitScore: 55,
    researchConfidence: 0.5,
    sourceUrls: [],
    outreachAngles: [],
    equipmentServiceIndicators: [],
    equipifyPainPoints: [],
    decisionMakerCandidates: [],
    fitModelVersion: "fixture",
  } as never,
  qualification: {
    fitScore: 55,
    confidence: 0.5,
    reason: "Need more evidence",
    missingEvidence: ["verified_company_identity"],
    recommendedNextAction: "continue_research",
    recommendedWorkOrderType: "research_company",
  },
}).nextBestAction
assert.equal(continueResearchNba.kind, "continue_research")

const constitutionalMap = buildConstitutionalEscalationMapFromPortfolioLeads([
  {
    id: LEAD_REJECTED,
    companyName: "Bad Fit Inc",
    status: "disqualified",
    metadata: { admission_state: "rejected", admission_reasons: ["known_icp_mismatch:utility"] },
  } as never,
])
assert.equal(constitutionalMap[LEAD_REJECTED]?.interruptOperator, false)

const decisionContext = buildDecisionContext({
  workspaceSummary: {
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
  },
  waitingOnYou: [],
  dailyWorkQueue: [
    {
      id: "queue-prep",
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
  portfolioLeads: [
    {
      id: LEAD_FIXTURE,
      companyName: "Fixture Co",
      status: "new",
      metadata: { admission_state: "accepted" },
    } as never,
  ],
  canonicalAuthorityByLeadId: {
    [LEAD_FIXTURE]: prepAuthority,
  },
})
const prepCandidate = decisionContext.opportunities.find((row) => row.id === "queue-prep")
assert.ok(prepCandidate)
assert.equal(prepCandidate?.requiresHumanApproval, false)

const boundItem = nextBestActionToWorkItem(
  {
    id: "nba-prep",
    kind: "prepare_outreach",
    title: "Prepare outreach",
    reason: [{ code: "fixture", label: "fixture" }],
    overall_score: 80,
    score_breakdown: {
      revenue_impact: 70,
      customer_impact: 60,
      urgency: 50,
      confidence: 60,
      business_understanding: 40,
      dependencies: 30,
      effort: 20,
      approval_gate: 90,
    },
    depends_on: [],
    blocked_by: ["operator_approval"],
    estimated_time_minutes: 10,
    requires_operator: true,
    confidence: 0.7,
    href: `/growth/leads/${LEAD_FIXTURE}`,
    company_name: "Fixture Co",
    source_id: LEAD_FIXTURE,
  },
  "2026-07-23T12:00:00.000Z",
  { [LEAD_FIXTURE]: prepAuthority },
)
assert.equal(boundItem.requires_operator, false)
assert.equal(boundItem.can_execute_autonomously, true)

const telemetry = buildEscalationAgreementSnapshot({
  generatedAt: "2026-07-23T12:00:00.000Z",
  rows: [
    recordEscalationAgreementRow({
      leadId: LEAD_FIXTURE,
      subsystem: "work_manager",
      requestKind: "prepare_outreach",
      subsystemWouldInterrupt: true,
      opportunityAuthority: prepAuthority,
    }),
  ],
})
assert.equal(telemetry.unexpectedOverrideCount, 1)
assert.ok(telemetry.autonomousExecutionPercent >= 0)

assert.equal(authorizeSpendForInvestmentState("increase_investment", "outbound"), false)

for (const relativePath of [
  "lib/growth/aios/authority/growth-canonical-escalation-authority-1c.ts",
  "lib/growth/aios/authority/growth-canonical-portfolio-authority-hydration-server-1c.ts",
  "lib/growth/aios/authority/growth-constitutional-portfolio-escalation-1c.ts",
]) {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `missing ${relativePath}`)
}

console.log("PASS — AVA-GROWTH-OPERATOR-1C escalation authority certified")
console.log(JSON.stringify({ qaMarker: AVA_GROWTH_OPERATOR_1C_QA_MARKER, verdict: "CERTIFIED" }, null, 2))
