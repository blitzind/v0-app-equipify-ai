/**
 * GE-AIOS-GROWTH-1E — Approved Plan Readiness & Audit Trail certification.
 * Run: pnpm test:ge-aios-growth-1e-approved-plan-readiness
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { readGeAiOsCommandCenterUiBundle } from "./ge-aios-command-center-ui-cert-utils"
import {
  GROWTH_AIOS_GROWTH_1E_PHASE,
  GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_QA_MARKER,
  GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_RUNTIME_RULE,
  GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_STATES,
  resolveApprovedPlanReadinessReason,
  resolveApprovedPlanReadinessState,
  resolveFutureExecutionSummary,
} from "../lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"
import { assessGrowthLeadResearchOpportunity } from "../lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { qualifyGrowthLeadResearch } from "../lib/growth/aios/growth/growth-lead-research-workflow-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of ["public.invoices", "public.quotes", "blitzpay", "createAiWorkOrder", "enroll_sequence"]) {
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

console.log(`[${GROWTH_AIOS_GROWTH_1E_PHASE}] Approved Plan Readiness certification`)

assert.equal(GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_QA_MARKER, "growth-aios-growth-1e-approved-plan-readiness-v1")
assert.ok(GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_RUNTIME_RULE.includes("read-only"))
assert.ok(GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_STATES.includes("ready_for_future_execution"))
assert.ok(GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_STATES.includes("blocked_missing_prerequisites"))

const files = [
  "lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types.ts",
  "lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-service.ts",
  "components/growth/ai-os/command-center/growth-ai-os-approved-plan-readiness-section.tsx",
  "lib/growth/aios/ai-os-command-center-service.ts",
  "lib/growth/aios/ai-executive-mission-planning-review-service.ts",
]

for (const file of files) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  assertNoCoreTouch(file)
}

const readinessService = readSource("lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-service.ts")
assert.ok(readinessService.includes("buildGrowthLeadResearchExecutionPlanAuditTrail"))
assert.ok(readinessService.includes("buildGrowthLeadResearchApprovedPlanReadinessQueue"))
assert.equal(readinessService.includes("publishAiOsEvent"), false)
assert.equal(readinessService.includes("createAiWorkOrder"), false)

const panel = readGeAiOsCommandCenterUiBundle()
assert.ok(panel.includes("GrowthAiOsApprovedPlanReadinessSection"))
assert.ok(panel.includes("approvedPlanReadinessQueue"))

const readinessSection = readSource("components/growth/ai-os/command-center/growth-ai-os-approved-plan-readiness-section.tsx")
assert.ok(readinessSection.includes('data-qa-section="approved-plan-readiness"'))
assert.equal(readinessSection.includes("Execute"), false)

const planningReview = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.ok(planningReview.includes("buildGrowthLeadResearchExecutionPlanAuditTrail"))
assert.ok(planningReview.includes("readinessState"))

const qualification = qualifyGrowthLeadResearch({ result: researchResult, researchRunStatus: "succeeded" })
const intelligence = assessGrowthLeadResearchOpportunity({
  result: researchResult,
  qualification: qualification.qualification,
})
const plan = intelligence.executionPlan

const approvedReady = resolveApprovedPlanReadinessState({
  plan: { ...plan, missingPrerequisites: [] },
  approvalStatus: "approved_for_future_execution",
  confidence: 0.86,
})
assert.equal(approvedReady, "ready_for_future_execution")
assert.equal(
  resolveApprovedPlanReadinessState({
    plan,
    approvalStatus: "approved_for_future_execution",
    confidence: 0.86,
  }),
  "blocked_missing_prerequisites",
)
assert.ok(resolveApprovedPlanReadinessReason("blocked_missing_prerequisites", {
  plan,
  approvalStatus: "approved_for_future_execution",
  confidence: 0.86,
}).includes("Missing prerequisites"))

assert.equal(
  resolveApprovedPlanReadinessState({
    plan: { ...plan, missingPrerequisites: [] },
    approvalStatus: "approved_for_future_execution",
    confidence: 0.4,
  }),
  "blocked_low_confidence",
)

const future = resolveFutureExecutionSummary({
  plan: { ...plan, missingPrerequisites: [] },
  readinessState: "ready_for_future_execution",
})
assert.equal(future.eligible, true)
assert.ok(future.summary.includes("Future phase"))

const blockedFuture = resolveFutureExecutionSummary({
  plan,
  readinessState: "blocked_missing_prerequisites",
})
assert.equal(blockedFuture.eligible, false)

console.log(`[${GROWTH_AIOS_GROWTH_1E_PHASE}] PASS — Approved Plan Readiness certified (local)`)
