/**
 * GE-AIOS-GROWTH-1D — Execution Plan Approval Queue certification.
 * Run: pnpm test:ge-aios-growth-1d-execution-plan-approval-queue
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { readGeAiOsCommandCenterUiBundle } from "./ge-aios-command-center-ui-cert-utils"
import {
  buildGrowthLeadResearchExecutionPlanId,
  GROWTH_AIOS_GROWTH_1D_PHASE,
  GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_APPROVAL_STATUSES,
  GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_RUNTIME_RULE,
  mapExecutionPlanReviewActionToStatus,
  resolveEffectiveExecutionPlanApprovalStatus,
  resolveInitialExecutionPlanApprovalStatus,
} from "../lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { assessGrowthLeadResearchOpportunity } from "../lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { qualifyGrowthLeadResearch } from "../lib/growth/aios/growth/growth-lead-research-workflow-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of ["public.invoices", "public.quotes", "blitzpay", "public.work_orders", "createAiWorkOrder", "enroll_sequence"]) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

const researchResult = {
  companySummary: "Regional commercial HVAC contractor with active fleet operations.",
  websiteSummary: "Commercial HVAC install and service.",
  likelyServiceCategory: "HVAC",
  serviceAreaClues: ["Midwest"],
  companySizeEstimate: "40-60 employees",
  equipmentServiceIndicators: ["fleet dispatch", "commercial install"],
  equipifyPainPoints: ["dispatch efficiency", "technician utilization"],
  equipifyFitScore: 78,
  outreachAngles: ["fleet optimization", "dispatch automation"],
  recommendedNextAction: "Verify decision makers before outreach",
  researchConfidence: 0.86,
  sourceUrls: ["https://example.com/about"],
  caveats: [],
  fitModelVersion: "v3",
  decisionMakerCandidates: [{ fullName: "Jane Doe", title: "Ops Director", email: null, phone: null, linkedinUrl: null, confidence: 0.7, evidenceExcerpt: null }],
  estimatedAnnualRevenue: "$1.2M–$2.4M",
  estimatedEmployeeCount: "40-60",
  fleetSizeEstimate: "35 trucks",
  crmDetected: null,
  fieldServiceStackDetected: null,
}

console.log(`[${GROWTH_AIOS_GROWTH_1D_PHASE}] Execution Plan Approval Queue certification`)

assert.equal(GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_QA_MARKER, "growth-aios-growth-1d-execution-plan-review-v1")
assert.ok(GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_RUNTIME_RULE.includes("planning state only"))
assert.ok(GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_APPROVAL_STATUSES.includes("pending_review"))
assert.ok(GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_APPROVAL_STATUSES.includes("approved_for_future_execution"))

const files = [
  "lib/growth/aios/growth/growth-lead-research-execution-plan-review-types.ts",
  "lib/growth/aios/growth/growth-lead-research-execution-plan-review-service.ts",
  "app/api/platform/growth/ai-os/execution-plan-review/[leadId]/action/route.ts",
  "components/growth/ai-os/command-center/growth-ai-os-execution-plan-review-section.tsx",
  "lib/growth/aios/ai-os-command-center-service.ts",
  "lib/growth/aios/ai-executive-mission-planning-review-service.ts",
]

for (const file of files) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  assertNoCoreTouch(file)
}

const reviewService = readSource("lib/growth/aios/growth/growth-lead-research-execution-plan-review-service.ts")
assert.ok(reviewService.includes("buildGrowthLeadResearchExecutionPlanApprovalQueue"))
assert.ok(reviewService.includes("submitGrowthLeadResearchExecutionPlanReviewAction"))
assert.ok(reviewService.includes("GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_EVENT"))
assert.equal(reviewService.includes("createAiWorkOrder"), false)

const route = readSource("app/api/platform/growth/ai-os/execution-plan-review/[leadId]/action/route.ts")
assert.ok(route.includes("submitGrowthLeadResearchExecutionPlanReviewAction"))
assert.ok(route.includes("planningOnly: true"))
assert.equal(route.includes("transitionAiWorkOrder"), false)

const panel = readGeAiOsCommandCenterUiBundle()
assert.ok(panel.includes("GrowthAiOsExecutionPlanReviewSection"))
assert.ok(panel.includes("executionPlanReviewQueue"))

const reviewSection = readSource("components/growth/ai-os/command-center/growth-ai-os-execution-plan-review-section.tsx")
assert.ok(reviewSection.includes('data-qa-section="execution-plan-review"'))
assert.equal(reviewSection.includes("Execute"), false)

const commandCenter = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenter.includes("buildGrowthLeadResearchExecutionPlanApprovalQueue"))
assert.ok(commandCenter.includes("executionPlanReviewQueue"))

const planningReview = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.ok(planningReview.includes("fetchLatestExecutionPlanReviewForLead"))
assert.ok(planningReview.includes("approvalStatus"))

const qualification = qualifyGrowthLeadResearch({ result: researchResult, researchRunStatus: "succeeded" })
const intelligence = assessGrowthLeadResearchOpportunity({
  result: researchResult,
  qualification: qualification.qualification,
})
const plan = intelligence.executionPlan
const leadId = "lead-cert-001"
const planId = buildGrowthLeadResearchExecutionPlanId({ leadId, plan })

const initialA = resolveInitialExecutionPlanApprovalStatus(plan)
const initialB = resolveInitialExecutionPlanApprovalStatus(plan)
assert.equal(initialA, initialB)
assert.ok(GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_APPROVAL_STATUSES.includes(initialA))

assert.equal(
  mapExecutionPlanReviewActionToStatus("approve_for_future_execution"),
  "approved_for_future_execution",
)
assert.equal(
  resolveEffectiveExecutionPlanApprovalStatus({
    plan,
    planId,
    review: {
      planId,
      leadId,
      approvalStatus: "approved_for_future_execution",
      action: "approve_for_future_execution",
      operatorUserId: "user-1",
      note: null,
      reviewedAt: "2026-06-25T12:00:00.000Z",
    },
  }),
  "approved_for_future_execution",
)

assert.equal(
  resolveEffectiveExecutionPlanApprovalStatus({
    plan,
    planId,
    review: {
      planId: "stale-plan-id",
      leadId,
      approvalStatus: "approved_for_future_execution",
      action: "approve_for_future_execution",
      operatorUserId: "user-1",
      note: null,
      reviewedAt: "2026-06-25T12:00:00.000Z",
    },
  }),
  initialA,
)

console.log(`[${GROWTH_AIOS_GROWTH_1D_PHASE}] PASS — Execution Plan Approval Queue certified (local)`)
