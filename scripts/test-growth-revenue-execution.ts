/**
 * Regression checks for Growth Revenue Execution slice 6.31A.
 * Run: pnpm test:growth-revenue-execution
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeExecutionPriorityScore,
  EXECUTION_SIGNAL_WEIGHTS,
  resolveExecutionPriorityBand,
} from "../lib/growth/execution/execution-priority-score"
import {
  buildExecutionQueueItem,
  rankExecutionQueueItems,
  type ExecutionLeadContext,
} from "../lib/growth/execution/execution-priority-engine"
import {
  buildRevenueProtectionQueue,
  sumRevenueProtected,
} from "../lib/growth/execution/execution-revenue-protection"
import { buildExpansionOpportunity } from "../lib/growth/execution/execution-opportunity-engine"
import {
  buildExecutionSprintPlan,
  buildRecommendedExecutionSprints,
} from "../lib/growth/execution/execution-sprint-engine"
import { computeExecutionOperatorScore } from "../lib/growth/execution/execution-operator-score"
import { computeExecutionCapacity } from "../lib/growth/execution/execution-capacity-engine"
import { GROWTH_REVENUE_EXECUTION_QA_MARKER } from "../lib/growth/execution/execution-priority-types"

assert.equal(GROWTH_REVENUE_EXECUTION_QA_MARKER, "revenue-execution-v1")

const criticalScore = computeExecutionPriorityScore({
  deal_risk_increase: true,
  competitor_detected: true,
  meeting_follow_up_overdue: true,
  unanswered_reply: true,
  high_confidence_close_window: true,
  renewal_risk: true,
  stalled_opportunity: true,
})
assert.equal(criticalScore.priorityBand, "critical")
assert.ok(criticalScore.executionPriorityScore >= 80)
assert.ok(criticalScore.signals.length >= 5)

const mediumScore = computeExecutionPriorityScore({
  stalled_opportunity: true,
  missing_follow_up: true,
  provider_failure: true,
  calendar_conflict: true,
})
assert.equal(resolveExecutionPriorityBand(mediumScore.executionPriorityScore), "medium")

const baseLead: ExecutionLeadContext = {
  id: "lead-1",
  companyName: "Acme HVAC",
  assignedTo: null,
  followUpAt: new Date(Date.now() - 86400000).toISOString(),
  workflowHealth: "stalled",
  nextBestAction: "call_prospect",
  revenueTrajectory: "at_risk",
  dealRiskScore: 72,
  closeWindow: "this_week",
  closeProbability: 62,
  callOverallScore: 35,
  callNextStepScore: 30,
  callCompetitorRisk: 60,
  callBuyingSignals: 1,
  callObjections: 2,
  meetingFollowUpOverdue: true,
  unansweredReplies: 1,
  isStaleOpportunity: true,
  competitorDetected: true,
  buyingSignalDetected: true,
  renewalRisk: false,
  expansionCandidate: false,
  openObjections: true,
  onboardingStalled: false,
  providerFailure: false,
  calendarConflict: false,
  callQualityDecline: true,
  opportunityAmount: 85000,
}

const queueItem = buildExecutionQueueItem(baseLead)
assert.ok(queueItem)
assert.equal(queueItem!.priorityBand, "critical")
assert.match(queueItem!.ctaHref, /\/admin\/growth\//)

const ranked = rankExecutionQueueItems([
  queueItem!,
  { ...queueItem!, id: "exec:lead-1:renewal", leadId: "lead-1", executionPriorityScore: 70 },
  { ...queueItem!, id: "exec:lead-2:deal_closing", leadId: "lead-2", executionPriorityScore: 90 },
])
assert.ok(ranked.length >= 2)
assert.ok(ranked.filter((item) => item.leadId === "lead-1").length <= 2)

const protection = buildRevenueProtectionQueue([
  {
    kind: "renewal_risk",
    leadId: "lead-1",
    companyName: "Acme HVAC",
    why: "Renewal overdue",
    ctaHref: "/admin/growth/customer-lifecycle",
    revenueAtRisk: 12000,
  },
])
assert.ok(protection[0]!.executionPriorityScore >= EXECUTION_SIGNAL_WEIGHTS.renewal_risk)
assert.ok(sumRevenueProtected(protection) >= 12000)

const expansion = buildExpansionOpportunity({
  leadId: "lead-2",
  customerProfileId: "cust-1",
  companyName: "Beta Plumbing",
  healthScore: 82,
  lifecycleStage: "expansion_candidate",
  expansionScore: 78,
  engagementTier: "high",
  contactsEngaged: 3,
  meetingQualityScore: 75,
  callOverallScore: 72,
  renewalPosture: "strong",
  reviewStatus: "review_pending",
  referralStatus: "referral_eligible",
})
assert.ok(expansion)
assert.ok(["upsell", "cross_sell", "referral_ask", "case_study_candidate", "review_ask"].includes(expansion!.recommendation))

const sprint = buildExecutionSprintPlan({
  sprintType: "meeting_completion",
  durationMinutes: 30,
  queueItems: ranked,
})
assert.ok(sprint.taskCount > 0)
assert.ok(sprint.estimatedEffortMinutes <= 30)
assert.ok(sprint.expectedRevenueImpact > 0)

const recommended = buildRecommendedExecutionSprints(ranked)
assert.ok(recommended.length > 0)

const operatorScore = computeExecutionOperatorScore([
  { eventType: "follow_up_completed", occurredAt: new Date().toISOString() },
  { eventType: "meeting_completed", occurredAt: new Date().toISOString() },
  { eventType: "research_completed", occurredAt: new Date().toISOString() },
])
assert.ok(operatorScore.current.score >= 0 && operatorScore.current.score <= 100)
assert.ok(operatorScore.trend7Day.score >= 0)
assert.ok(operatorScore.trend30Day.score >= 0)

const capacity = computeExecutionCapacity(ranked)
assert.ok(capacity.executionPressure >= 0)
assert.match(capacity.executionPressureLabel, /load|pressure|Manageable|Critical/i)

const dashboardRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/execution/dashboard/route.ts"),
  "utf8",
)
assert.match(dashboardRoute, /requireGrowthEnginePlatformAccess/)

const queueRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/execution/queue/route.ts"),
  "utf8",
)
assert.match(queueRoute, /requireGrowthEnginePlatformAccess/)

const sprintsRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/execution/sprints/route.ts"),
  "utf8",
)
assert.match(sprintsRoute, /requireGrowthEnginePlatformAccess/)

const startRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/execution/sprints/start/route.ts"),
  "utf8",
)
assert.match(startRoute, /requireGrowthEnginePlatformAccess/)
assert.doesNotMatch(startRoute, /auto.?send|autonomous/i)

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270311120000_growth_engine_revenue_execution.sql"),
  "utf8",
)
assert.match(migrationSource, /execution_sprints/)

const repoSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/execution/execution-dashboard-repository.ts"),
  "utf8",
)
assert.doesNotMatch(repoSource, /openai|anthropic/i)

const masterContext = fs.readFileSync(path.join(process.cwd(), "lib/admin/master-context.ts"), "utf8")
assert.match(masterContext, /6\.31A.*Revenue Execution|revenue-execution-v1/i)

console.log("growth revenue execution tests passed")
