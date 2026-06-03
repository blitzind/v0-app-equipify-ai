/**
 * Sprint 4 — Revenue Workflow Automation regression checks.
 * Run: pnpm test:growth-revenue-workflow
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { computeGrowthCallPriority } from "../lib/growth/call-priority"
import { generateOpportunityRecommendations } from "../lib/growth/opportunity-intelligence/opportunity-recommendation"
import { scoreOpportunityRecommendation } from "../lib/growth/revenue-workflow/opportunity-recommendation-engine"
import { computeCallQueueRevenueWorkflowBoost } from "../lib/growth/revenue-workflow/call-queue-prioritization"
import { computeRevenueReadiness } from "../lib/growth/revenue-workflow/revenue-readiness-score"
import {
  GROWTH_REVENUE_WORKFLOW_QA_MARKER,
  revenueReadinessTierFromScore,
} from "../lib/growth/revenue-workflow/revenue-workflow-types"

const root = process.cwd()

const scoring = scoreOpportunityRecommendation({
  signals: [
    {
      signalType: "meeting_interest",
      confidence: "high",
      evidenceSnippet: "Can we schedule a demo next week?",
      source: "inbox",
    },
    {
      signalType: "pricing_interest",
      confidence: "medium",
      evidenceSnippet: "What does pricing look like for 50 units?",
      source: "inbox",
    },
  ],
  memory: {
    available: true,
    relationshipStage: "evaluating",
    unresolvedObjectionCount: 0,
    riskFlags: [],
    commitmentSummaries: ["Send pricing breakdown by Friday"],
    memoryCoverageScore: 55,
    topObjections: [],
    engagementTrend: "stable",
  },
  engagement: { replyCount30d: 2, hasPositiveReply: true, connectedCallCount: 1 },
})

assert.ok(scoring.opportunityScore >= 50, "expected meaningful opportunity score")
assert.ok(scoring.confidence >= 40, "expected confidence")
assert.ok(["evaluation", "proposal", "qualified"].includes(scoring.recommendedStage))
assert.ok(scoring.recommendedValueMax >= scoring.recommendedValueMin)

const readiness = computeRevenueReadiness({
  relationshipStage: "evaluating",
  engagementTrend: "stable",
  memoryCoverageScore: 60,
  replyCount30d: 2,
  buyingSignalCount: 2,
  meetingIntentSignals: 1,
  pricingIntentSignals: 1,
  unresolvedObjectionCount: 0,
  commitmentCount: 1,
  connectedCallCount: 1,
  meetingActivityCount: 1,
  opportunityReadinessScore: 70,
  revenueProbabilityScore: null,
  hasPositiveReply: true,
  workflowHealth: "healthy",
})

assert.ok(readiness.score >= 45)
assert.equal(readiness.qaMarker, GROWTH_REVENUE_WORKFLOW_QA_MARKER)
assert.equal(revenueReadinessTierFromScore(82), "revenue_ready")

const basePriority = computeGrowthCallPriority({
  researchPriority: "normal",
  score: 70,
  status: "qualified",
  lastResearchedAt: "2026-05-17T12:00:00.000Z",
  recommendedNextAction: null,
  leadNotes: null,
  manualResearchNotes: null,
  callDisposition: null,
  followUpAt: null,
  callPriorityOverride: null,
  revenueReadinessScore: 75,
  opportunityRecommendationScore: 68,
  replyUrgencyBoost: 8,
  engagementTrend: "stable",
  meetingIntentPending: true,
})

const plainPriority = computeGrowthCallPriority({
  researchPriority: "normal",
  score: 70,
  status: "qualified",
  lastResearchedAt: "2026-05-17T12:00:00.000Z",
  recommendedNextAction: null,
  leadNotes: null,
  manualResearchNotes: null,
  callDisposition: null,
  followUpAt: null,
  callPriorityOverride: null,
})

assert.ok(basePriority.computedScore > plainPriority.computedScore, "revenue workflow should boost call priority")
assert.match(basePriority.whySummary, /revenue readiness|opportunity rec|meeting intent/i)

const boost = computeCallQueueRevenueWorkflowBoost({
  revenueReadinessScore: 80,
  revenueReadinessTier: "sales_ready",
  opportunityRecommendationScore: 70,
  replyUrgencyBoost: 8,
})
assert.ok(boost.boostPoints > 0)
assert.ok(boost.priorityReason)

const recommendations = generateOpportunityRecommendations({
  signals: [
    {
      signalType: "proposal_request",
      confidence: "high",
      evidenceSnippet: "Please send a formal proposal.",
      source: "inbox",
    },
  ],
  hasOwner: true,
  memory: {
    available: true,
    relationshipStage: "opportunity",
    unresolvedObjectionCount: 0,
    riskFlags: [],
    commitmentSummaries: [],
    memoryCoverageScore: 40,
    topObjections: [],
    engagementTrend: "stable",
  },
})
assert.ok(recommendations.length > 0)
assert.ok(recommendations[0]?.scoring?.opportunityScore != null)

const recomputeSource = fs.readFileSync(path.join(root, "lib/growth/recompute-lead-next-best-action.ts"), "utf8")
const workflowFn = recomputeSource.slice(recomputeSource.indexOf("export async function recomputeGrowthLeadWorkflowSignals"))
assert.match(workflowFn, /recomputeGrowthLeadRevenueReadiness/)
assert.match(workflowFn, /recomputeGrowthLeadCallPriority/)
assert.ok(
  workflowFn.indexOf("recomputeGrowthLeadRevenueReadiness") <
    workflowFn.indexOf("recomputeGrowthLeadCallPriority"),
  "call priority should run after revenue readiness",
)

const callQueueSource = fs.readFileSync(path.join(root, "lib/growth/call-queue-repository.ts"), "utf8")
assert.match(callQueueSource, /callPriorityScore/)
assert.match(callQueueSource, /sortCallQueueByRevenueWorkflow/)
assert.doesNotMatch(callQueueSource, /computeGrowthCallPriority\(/)

const workspaceSource = fs.readFileSync(path.join(root, "lib/growth/revenue-workflow/revenue-workflow-workspace.ts"), "utf8")
assert.match(workspaceSource, /readGrowthLeadRevenueReadinessSnapshot/)
assert.doesNotMatch(workspaceSource, /fetchGrowthLeadRevenueReadinessSnapshot/)

const crmSource = fs.readFileSync(path.join(root, "lib/growth/opportunity-intelligence/crm-intelligence.ts"), "utf8")
assert.match(crmSource, /recomputeGrowthLeadRevenueReadiness/)
assert.match(crmSource, /stop_sequence/)
assert.match(crmSource, /recommendationMetadata\(stopRecommendation/)
assert.match(crmSource, /requiresHumanApproval: true/)

const forecastTypes = fs.readFileSync(path.join(root, "lib/growth/revenue-forecast-types.ts"), "utf8")
assert.match(forecastTypes, /revenueReadinessScore/)
assert.match(forecastTypes, /opportunityRecommendationScore/)

const forecastScore = fs.readFileSync(path.join(root, "lib/growth/revenue-forecast-score.ts"), "utf8")
assert.doesNotMatch(forecastScore, /revenue_readiness/, "forecast math must remain unchanged in Sprint 4")

console.log("growth-revenue-workflow: all checks passed")
