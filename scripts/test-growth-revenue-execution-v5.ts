/**
 * Regression checks for Sprint 5 — Revenue Execution & Pipeline Advancement.
 * Run: pnpm test:growth-revenue-execution-v5
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
  GROWTH_REVENUE_PLAYBOOK_KEYS,
  GROWTH_REVENUE_COMMAND_CENTER_VIEWS,
  GROWTH_OPPORTUNITY_REVIEW_ACTIONS,
} from "../lib/growth/revenue-execution/revenue-execution-types"
import { listRevenuePlaybooks, resolveRevenuePlaybook } from "../lib/growth/revenue-execution/revenue-playbooks"
import {
  generateSalesExecutionPlan,
  mergeSalesExecutionPlanEdits,
} from "../lib/growth/revenue-execution/sales-execution-plan"

assert.equal(GROWTH_REVENUE_EXECUTION_QA_MARKER, "growth-revenue-execution-v5")
assert.equal(GROWTH_REVENUE_PLAYBOOK_KEYS.length, 7)
assert.equal(GROWTH_REVENUE_COMMAND_CENTER_VIEWS.length, 6)
assert.deepEqual(GROWTH_OPPORTUNITY_REVIEW_ACTIONS, ["accept", "reject", "snooze", "request_research"])

const playbooks = listRevenuePlaybooks()
assert.equal(playbooks.length, 7)
for (const playbook of playbooks) {
  assert.equal(playbook.qaMarker, GROWTH_REVENUE_EXECUTION_QA_MARKER)
  assert.ok(playbook.recommendedActions.length > 0)
  assert.ok(playbook.successCriteria.length > 0)
}
const humanGuardrailText = playbooks
  .flatMap((p) => [p.summary, p.recommendedNextStep, ...p.recommendedActions.map((a) => a.description)])
  .join(" ")
assert.match(humanGuardrailText, /human|operator|manual|no auto/i)

const pricingPlaybook = resolveRevenuePlaybook({
  signalTypes: ["pricing_interest"],
  recommendationTypes: ["pause_sequence"],
  unresolvedObjectionCount: 0,
  commitmentCount: 1,
  engagementTrend: "warming",
  relationshipStage: "prospect",
  hasCompetitiveSignal: false,
  isExistingCustomer: false,
})
assert.equal(pricingPlaybook?.key, "pricing_requested")

const objectionPlaybook = resolveRevenuePlaybook({
  signalTypes: [],
  recommendationTypes: [],
  unresolvedObjectionCount: 2,
  commitmentCount: 0,
  engagementTrend: "stable",
  relationshipStage: "prospect",
  hasCompetitiveSignal: false,
  isExistingCustomer: false,
})
assert.equal(objectionPlaybook?.key, "objection_recovery")

const plan = generateSalesExecutionPlan({
  leadId: "lead-test",
  revenueReadinessScore: 72,
  revenueReadinessTier: "sales_ready",
  recommendationType: "create_opportunity",
  recommendationStage: "proposal",
  hasMeetingIntent: true,
  hasPricingIntent: true,
  hasProposalIntent: true,
  unresolvedObjectionCount: 1,
  hasPositiveReply: true,
  connectedCallCount: 0,
  playbookKey: "proposal_requested",
})
assert.equal(plan.qaMarker, GROWTH_REVENUE_EXECUTION_QA_MARKER)
assert.equal(plan.requiresHumanApproval, true)
assert.equal(plan.editable, true)
assert.ok(plan.steps.some((step) => step.title.includes("Call prospect")))
assert.ok(plan.steps.some((step) => step.title.includes("Send pricing")))
assert.ok(plan.steps.some((step) => step.title.includes("Create opportunity")))

const merged = mergeSalesExecutionPlanEdits(plan, {
  summary: "Updated by operator",
  steps: plan.steps.map((step, index) => (index === 0 ? { ...step, completed: true } : step)),
})
assert.equal(merged.summary, "Updated by operator")
assert.equal(merged.steps[0]?.completed, true)

const reviewRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/revenue-execution/review/route.ts"),
  "utf8",
)
assert.match(reviewRoute, /requireGrowthEnginePlatformAccess/)
assert.doesNotMatch(reviewRoute, /auto.?send|autonomous|createOpportunity/i)

const snoozeRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/revenue-execution/recommendations/[id]/snooze/route.ts"),
  "utf8",
)
assert.match(snoozeRoute, /humanApprovalConfirmed.*true/)
assert.match(snoozeRoute, /no autonomous action/i)

const executionPlanRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/revenue-execution/execution-plan/route.ts"),
  "utf8",
)
assert.match(executionPlanRoute, /humanApprovalConfirmed/)

const forecastEvidenceSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/revenue-execution/forecast-evidence.ts"),
  "utf8",
)
assert.doesNotMatch(forecastEvidenceSource, /recomputeGrowthLeadRevenueReadiness|computeRevenueProbability/)

const reviewWorkspace = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-revenue-execution-review-workspace.tsx"),
  "utf8",
)
assert.match(reviewWorkspace, /humanApproved/)
assert.match(reviewWorkspace, /Accept Recommendation/)
assert.match(reviewWorkspace, /Reject Recommendation/)
assert.match(reviewWorkspace, /Snooze Recommendation/)
assert.match(reviewWorkspace, /Request More Research/)
assert.match(reviewWorkspace, /Recommended messaging|GrowthRevenuePlaybookGuidance/)
assert.match(reviewWorkspace, /BuyingSignalsList|evidenceSnippet/)

const dismissRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/opportunities/recommendations/[id]/dismiss/route.ts"),
  "utf8",
)
assert.match(dismissRoute, /humanApprovalConfirmed.*true/)

const reviewService = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/revenue-execution/opportunity-review-service.ts"),
  "utf8",
)
assert.match(reviewService, /fetchOpportunityRecommendationById/)
assert.match(reviewService, /fetchLeadReplyExecutionContext/)
assert.match(reviewService, /persistPlaybookSuggestion/)
assert.match(reviewService, /evidence_snippet/)
assert.doesNotMatch(reviewService, /listOpportunityRecommendations/)

const commandCenterSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/revenue-execution/revenue-command-center.ts"),
  "utf8",
)
assert.match(commandCenterSource, /collectCommandCenterCandidateLeadIds/)
assert.match(commandCenterSource, /isRevenueReady/)

const meetingPlaybook = resolveRevenuePlaybook({
  signalTypes: [],
  recommendationTypes: [],
  classification: "meeting_intent",
  unresolvedObjectionCount: 0,
  commitmentCount: 0,
  engagementTrend: "stable",
  relationshipStage: "prospect",
  hasCompetitiveSignal: false,
  isExistingCustomer: false,
})
assert.equal(meetingPlaybook?.key, "meeting_requested")

const planWithoutReply = generateSalesExecutionPlan({
  leadId: "lead-test",
  revenueReadinessScore: 50,
  revenueReadinessTier: "qualified",
  recommendationType: null,
  recommendationStage: null,
  hasMeetingIntent: false,
  hasPricingIntent: false,
  hasProposalIntent: false,
  unresolvedObjectionCount: 0,
  hasPositiveReply: false,
  connectedCallCount: 0,
  playbookKey: null,
})
assert.ok(!planWithoutReply.steps.some((step) => step.title.includes("Call prospect")))

console.log("growth revenue execution v5 tests passed")
