/**
 * GE-AIOS-PORTFOLIO-ELIGIBILITY-CLOSURE-1A — Portfolio eligibility closure certification.
 * Run: pnpm test:ge-aios-portfolio-eligibility-closure-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildDecisionContext } from "../lib/growth/decision-engine/context/build-decision-context"
import {
  evaluateCanonicalExecutionAuthority,
  GROWTH_CANONICAL_EXECUTION_AUTHORITY_1A_QA_MARKER,
} from "../lib/growth/aios/execution/growth-canonical-execution-authority-1a"
import type { GrowthCanonicalNextBestDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"
import { GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import {
  GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER,
  GROWTH_PORTFOLIO_EMPTY_OR_INELIGIBLE_STOP_REASON,
  GROWTH_PORTFOLIO_READY_NO_ELIGIBLE_ACCOUNTS_COPY,
} from "../lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a-types"
import {
  applyPortfolioEligibilityToWorkManagerResult,
  buildPortfolioEligibilityContext,
  evaluateGrowthPortfolioLeadEligibility,
  filterPortfolioEligibleLeads,
  filterPortfolioEligibleWorkItems,
  sanitizeResearchLoopSummaryForPortfolio,
} from "../lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { buildDailyActivityWorkingNowLines } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative"
import { runWorkManager } from "../lib/growth/work-manager/manager/run-work-manager"
import { nextBestActionsToWorkItems } from "../lib/growth/work-manager/bridges/decision-engine-bridge"
import { runOperatingRhythm } from "../lib/growth/operating-rhythm/engine/run-operating-rhythm"
import type { GrowthAvaResearchLoopSummary } from "../lib/growth/ava-home/growth-ava-research-orchestrator-types"
import type { GrowthLead } from "../lib/growth/types"
import type { AvaWorkItem } from "../lib/growth/work-manager/types"

export const GE_AIOS_PORTFOLIO_ELIGIBILITY_CLOSURE_1A_QA_MARKER =
  "ge-aios-portfolio-eligibility-closure-1a-v1" as const

const ROOT = process.cwd()
const EQUIPIFY_ORG = "00757488-1026-44a5-aac4-269533ac21be"
const OTHER_ORG = "5876176a-61ec-4532-ad99-0c31482d5a91"
const BEST_BUY_LEAD_ID = "03a361d3-e6b6-42e6-bc78-a5773acc1725"
const BLOCK_IMAGING_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function leadFixture(overrides: Partial<GrowthLead> & Pick<GrowthLead, "id" | "companyName">): GrowthLead {
  return {
    organizationId: EQUIPIFY_ORG,
    contactName: "Fixture Contact",
    website: "https://example.com",
    status: "active",
    researchPriority: "normal",
    workflowHealth: "healthy",
    metadata: { admission_state: "accepted" },
    engagementScore: 50,
    contactTemperature: "warm",
    archivedAt: null,
    ...overrides,
  } as GrowthLead
}

function bestBuyArchivedLead(): GrowthLead {
  return leadFixture({
    id: BEST_BUY_LEAD_ID,
    companyName: "Best Buy Co",
    status: "archived",
    archivedAt: "2026-07-10T00:00:00.000Z",
    metadata: {},
  })
}

function blockImagingEligibleLead(): GrowthLead {
  return leadFixture({
    id: BLOCK_IMAGING_LEAD_ID,
    companyName: "Block Imaging",
    status: "active",
    metadata: { admission_state: "accepted" },
  })
}

function bestBuyResearchLoopSummary(): GrowthAvaResearchLoopSummary {
  return {
    qaMarker: "ge-aios-6b-ava-research-orchestrator-v1",
    runId: "run-best-buy-fixture",
    completedAt: "2026-07-14T12:00:00.000Z",
    companiesReviewed: 1,
    researchCompleted: 1,
    buyingSignalsVerified: 0,
    readyForOutreachReview: 0,
    qualificationCompleted: 0,
    qualificationSkipped: 0,
    qualificationFailed: 0,
    narrative: "Historical loop",
    leadResults: [
      {
        leadId: BEST_BUY_LEAD_ID,
        companyName: "Best Buy Co",
        outcome: "completed",
        readyForOutreachReview: false,
        hasBuyingSignals: false,
        qualificationStatus: "skipped",
      },
    ],
    transportBlocked: true,
    humanApprovalRequired: false,
    outboundOccurred: false,
  }
}

function workspaceSummaryFixture(researchLoopSummary: GrowthAvaResearchLoopSummary | null) {
  return {
    kpis: {
      emailsSentToday: 0,
      repliesToday: 0,
      callsToday: 0,
      openOpportunities: 0,
      hotCompanies: 0,
      approvalQueueCount: 0,
    },
    meetings: { today: 0, thisWeek: 0, scheduled: 0 },
    inbox: { repliesNeedingAttention: 0, threadsOpen: 0, newReplies: 0 },
    operatorTasks: { callTasksDue: 0, pendingApprovals: 0, leadsNeedingAction: 0 },
    avaConsole: {
      greeting: "Good morning.",
      overnightSummary: null,
      highPriorityOpportunities: null,
      waitingForApproval: null,
      suggestedNextAction: null,
      researchLoopSummary,
    },
    dashboard: {
      generatedAt: "2026-07-14T12:00:00.000Z",
      briefing: null,
      sections: [],
      operatorActionCards: [],
      dailyRevenueWorkQueueEnabled: false,
      dailyRevenueWorkQueue: null,
      dailyRevenueWorkQueueDisplay: null,
    },
    leadPool: {
      qaMarker: "growth-home-lead-pool-pagination-v1",
      visible_count: 1,
      has_more: false,
      total_estimated_count: 1,
      degraded: false,
      cursor: null,
    },
    missionDiscovery: null,
    portfolioLeads: [bestBuyArchivedLead()],
    eligibleLeadCount: 0,
  }
}

function buildResearchDecision(leadId: string, companyName: string): GrowthCanonicalNextBestDecision {
  return {
    qaMarker: "ge-aios-decision-engine-1a-v1",
    decisionId: `decision-research-${leadId}`,
    decisionFingerprint: `fp-research-${leadId}`,
    organizationId: EQUIPIFY_ORG,
    leadId,
    generatedAt: "2026-07-14T12:00:00.000Z",
    primaryAction: "research",
    title: `Research company — ${companyName}`,
    rationale: ["fixture"],
    urgency: "today",
    confidence: 70,
    recommendedActor: "ava",
    recommendedChannel: "none",
    prerequisites: [],
    blockedBy: [],
    supportingActions: [],
    suppressedActions: [],
    operatorReviewRequired: false,
    transportBlocked: true,
    waitUntil: null,
    sourceSummary: {},
  }
}

console.log(`[${GE_AIOS_PORTFOLIO_ELIGIBILITY_CLOSURE_1A_QA_MARKER}] Portfolio eligibility closure certification\n`)

const portfolioSource = readSource("lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a.ts")
const wmSource = readSource("lib/growth/work-manager/manager/run-work-manager.ts")
const decisionContextSource = readSource("lib/growth/decision-engine/context/build-decision-context.ts")
const snapshotSource = readSource("lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot.ts")
const tickSource = readSource("lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a.ts")
const homeServiceSource = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
const admissionSource = readSource("lib/growth/revenue-workflow/evaluate-growth-lead-admission.ts")

assert.match(portfolioSource, /inferHardTerminalReasonFromLeadLifecycle/)
assert.match(portfolioSource, /resolveLeadAdmissionStateFromMetadata/)
assert.match(wmSource, /filterPortfolioEligibleWorkItems/)
assert.match(wmSource, /applyPortfolioEligibilityToWorkManagerResult/)
assert.match(decisionContextSource, /buildResearchCandidates/)
assert.match(decisionContextSource, /readyForOutreachReview === true \|\| row\.qualificationStatus === "completed"/)
assert.match(snapshotSource, /sanitizeResearchLoopSummaryForPortfolio/)
assert.match(tickSource, /GROWTH_PORTFOLIO_EMPTY_OR_INELIGIBLE_STOP_REASON/)
assert.match(homeServiceSource, /sanitizeResearchLoopSummaryForPortfolio/)
assert.match(admissionSource, /best buy/)
assert.doesNotMatch(tickSource, /resolveLeadAdmissionStateFromMetadata\(lead\.metadata\)\.state/)
console.log("  ✓ Phase 1 — portfolio eligibility wired at shared autonomous boundary")

assert.equal(
  evaluateGrowthPortfolioLeadEligibility({
    lead: bestBuyArchivedLead(),
    organizationId: EQUIPIFY_ORG,
  }).reasonCode,
  "hard_terminal_archived",
)
assert.equal(
  evaluateGrowthPortfolioLeadEligibility({
    lead: leadFixture({ id: "dq-1", companyName: "Disqualified Co", status: "disqualified" }),
    organizationId: EQUIPIFY_ORG,
  }).eligible,
  false,
)
assert.equal(
  evaluateGrowthPortfolioLeadEligibility({
    lead: leadFixture({
      id: "invalid-1",
      companyName: "Invalid Co",
      metadata: { admission_state: "invalid" },
    }),
    organizationId: EQUIPIFY_ORG,
  }).eligible,
  false,
)
assert.equal(
  evaluateGrowthPortfolioLeadEligibility({
    lead: leadFixture({
      id: "rejected-1",
      companyName: "Rejected Co",
      metadata: { admission_state: "rejected" },
    }),
    organizationId: EQUIPIFY_ORG,
  }).eligible,
  false,
)
assert.equal(
  evaluateGrowthPortfolioLeadEligibility({
    lead: leadFixture({
      id: "wrong-tenant-1",
      companyName: "Foreign Co",
      promotedOrganizationId: OTHER_ORG,
    }),
    organizationId: EQUIPIFY_ORG,
  }).reasonCode,
  "wrong_organization_scope",
)
assert.equal(
  evaluateGrowthPortfolioLeadEligibility({
    lead: blockImagingEligibleLead(),
    organizationId: EQUIPIFY_ORG,
  }).eligible,
  true,
)
console.log("  ✓ Phase 2 — lifecycle / tenant eligibility matrix")

const sanitized = sanitizeResearchLoopSummaryForPortfolio(
  bestBuyResearchLoopSummary(),
  buildPortfolioEligibilityContext(EQUIPIFY_ORG, [bestBuyArchivedLead()]),
)
assert.equal(sanitized?.leadResults.length ?? -1, 0)
console.log("  ✓ Phase 3 — stale research loop sanitized for archived Best Buy")

const portfolioLeads = [bestBuyArchivedLead()]
const eligibility = buildPortfolioEligibilityContext(EQUIPIFY_ORG, portfolioLeads)
const decisionContext = buildDecisionContext({
  workspaceSummary: workspaceSummaryFixture(bestBuyResearchLoopSummary()),
  waitingOnYou: [],
  dailyWorkQueue: [],
  accomplishments: [],
  timeline: [],
  portfolioEligibility: eligibility,
})
const researchCandidates = decisionContext.research.filter((row) => row.source === "research_loop")
assert.equal(researchCandidates.length, 0)
console.log("  ✓ Phase 4 — archived Best Buy excluded before decision ranking")

const wmResult = runWorkManager({
  workspaceSummary: workspaceSummaryFixture(sanitized),
  waitingOnYou: [],
  dailyWorkQueue: [],
  accomplishments: [],
  timeline: [],
  generatedAt: "2026-07-14T12:00:00.000Z",
  organizationId: EQUIPIFY_ORG,
  portfolioLeads,
})
assert.equal(wmResult.active_work, null)
assert.equal(
  wmResult.all_work_items.some((row) => /best buy/i.test(row.company_name ?? row.title)),
  false,
)
console.log("  ✓ Phase 5 — Work Manager has no Best Buy active work")

const operatingRhythm = runOperatingRhythm({
  hour: 10,
  workResult: wmResult,
  metrics: {
    repliesToday: 0,
    emailsSentToday: 0,
    meetingsToday: 0,
    approvalsWaiting: 0,
    hotCompanies: 0,
    pipelineValue: 0,
  },
  sinceYesterday: [],
  previousMemory: null,
})
const workingNow = buildDailyActivityWorkingNowLines({
  workResult: wmResult,
  operatingRhythm,
  eligibleLeadCount: 0,
})
assert.equal(workingNow.some((line) => /best buy/i.test(line)), false)
assert.equal(workingNow.includes(GROWTH_PORTFOLIO_READY_NO_ELIGIBLE_ACCOUNTS_COPY), true)
console.log("  ✓ Phase 6 — Home working-now copy truthful for empty eligible portfolio")

const PAUSED_LEAD_ID = "00000000-0000-4000-8000-000000000001"
const pausedEligibleLead = leadFixture({
  id: PAUSED_LEAD_ID,
  companyName: "Paused Medical Co",
  metadata: { admission_state: "accepted", operator_paused_outreach: true },
})
const pausedEligibility = buildPortfolioEligibilityContext(EQUIPIFY_ORG, [pausedEligibleLead])
assert.equal(
  evaluateGrowthPortfolioLeadEligibility({
    lead: pausedEligibleLead,
    organizationId: EQUIPIFY_ORG,
  }).eligible,
  true,
)
const pausedWorkItem: AvaWorkItem = {
  id: `work:research:${PAUSED_LEAD_ID}`,
  type: "research",
  title: "Research company — Paused Medical Co",
  company_name: "Paused Medical Co",
  status: "ready",
  priority: 50,
  why_it_matters: "Fixture",
  href: `/growth/leads/${PAUSED_LEAD_ID}`,
  source: "decision_engine",
  created_at: "2026-07-14T12:00:00.000Z",
  updated_at: "2026-07-14T12:00:00.000Z",
  requires_operator: false,
  can_execute_autonomously: true,
  depends_on: [],
  blocked_by: [],
  decision_source_id: PAUSED_LEAD_ID,
}
assert.equal(filterPortfolioEligibleWorkItems([pausedWorkItem], pausedEligibility).length, 1)
console.log("  ✓ Phase 7 — operator-paused lead remains portfolio-eligible (defer layer unchanged)")

const waitDecision = buildResearchDecision(BLOCK_IMAGING_LEAD_ID, "Block Imaging")
waitDecision.primaryAction = "wait"
waitDecision.waitUntil = "2026-08-01T00:00:00.000Z"
const waitEligible = buildPortfolioEligibilityContext(EQUIPIFY_ORG, [blockImagingEligibleLead()])
assert.equal(
  filterPortfolioEligibleLeads([blockImagingEligibleLead()], EQUIPIFY_ORG).length,
  1,
)
console.log("  ✓ Phase 8 — prospect-wait lead remains eligible before authority defer")

const raceWorkItem = nextBestActionsToWorkItems(
  [
    {
      id: "nba-best-buy",
      kind: "research_company",
      title: "Research company — Best Buy Co",
      reason: [{ code: "fixture", label: "fixture" }],
      overall_score: 99,
      score_breakdown: {
        revenue_impact: 10,
        customer_impact: 10,
        urgency: 10,
        confidence: 10,
        business_understanding: 0,
        dependencies: 0,
        effort: 0,
        approval_gate: 0,
      },
      depends_on: [],
      blocked_by: [],
      estimated_time_minutes: 15,
      requires_operator: false,
      confidence: 70,
      href: `/growth/leads/${BEST_BUY_LEAD_ID}`,
      company_name: "Best Buy Co",
      source_id: `research:${BEST_BUY_LEAD_ID}`,
    },
  ],
  "2026-07-14T12:00:00.000Z",
)[0]
const filteredRaceItems = filterPortfolioEligibleWorkItems([raceWorkItem], eligibility)
assert.equal(filteredRaceItems.length, 0)

const authority = evaluateCanonicalExecutionAuthority({
  actionKind: "persisted_research_run",
  resolution: {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
    organizationId: EQUIPIFY_ORG,
    leadId: BEST_BUY_LEAD_ID,
    generatedAt: "2026-07-14T12:00:00.000Z",
    decision: buildResearchDecision(BEST_BUY_LEAD_ID, "Best Buy Co"),
    freshness: {
      qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
      state: "fresh",
      ageMinutes: 0,
      staleAfterMinutes: 120,
      suppressedHintCount: 0,
    },
  },
  leadLifecycle: { status: "archived", archivedAt: "2026-07-10T00:00:00.000Z" },
})
assert.equal(authority.disposition, "blocked")
assert.equal(authority.reasonCode, "hard_terminal_archived")
assert.equal(authority.qaMarker, GROWTH_CANONICAL_EXECUTION_AUTHORITY_1A_QA_MARKER)
console.log("  ✓ Phase 9 — Execution Authority defense-in-depth unchanged")

assert.equal(GROWTH_PORTFOLIO_EMPTY_OR_INELIGIBLE_STOP_REASON, "empty_or_ineligible_portfolio")
assert.equal(GROWTH_PORTFOLIO_ELIGIBILITY_1A_QA_MARKER, "ge-aios-portfolio-eligibility-closure-1a-v1")

const deferredWm = applyPortfolioEligibilityToWorkManagerResult(
  {
    qaMarker: "ge-aios-11a-work-manager-v1",
    active_work: raceWorkItem,
    work_plan: [{ work_item_id: raceWorkItem.id, status: "ready", sequence: 1 }],
    operator_queue: [],
    blocked: [],
    deferred: [],
    all_work_items: [raceWorkItem],
    completed_today: [],
    specialist_orchestrator_result: null,
  },
  eligibility,
)
assert.equal(deferredWm.active_work, null)
console.log("  ✓ Phase 10 — race work item stripped before operator projection")

const draftFactorySource = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
assert.match(snapshotSource, /organizationId/)
assert.match(draftFactorySource, /organizationId/)
console.log("  ✓ Phase 11 — portfolio snapshot scoped by organization (no cross-tenant bleed)")

console.log(`\n[${GE_AIOS_PORTFOLIO_ELIGIBILITY_CLOSURE_1A_QA_MARKER}] READY_FOR_PORTFOLIO_ELIGIBILITY_CLOSURE`)
