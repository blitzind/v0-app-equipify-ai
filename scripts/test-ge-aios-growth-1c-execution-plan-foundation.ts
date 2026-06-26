/**
 * GE-AIOS-GROWTH-1C — Next Best Action Workflow Planner certification.
 * Run: pnpm test:ge-aios-growth-1c-execution-plan-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_GROWTH_1C_PHASE,
  GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES,
  GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_RUNTIME_RULE,
  planGrowthLeadResearchExecution,
} from "../lib/growth/aios/growth/growth-lead-research-execution-plan"
import { assessGrowthLeadResearchOpportunity } from "../lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { qualifyGrowthLeadResearch } from "../lib/growth/aios/growth/growth-lead-research-workflow-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of ["public.invoices", "public.quotes", "blitzpay", "public.work_orders"]) {
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

console.log(`[${GROWTH_AIOS_GROWTH_1C_PHASE}] Execution Plan certification`)

assert.equal(GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_QA_MARKER, "growth-aios-growth-1c-execution-plan-v1")
assert.ok(GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_RUNTIME_RULE.includes("planning-only"))
assert.ok(GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES.includes("verify_email"))
assert.ok(GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES.includes("buying_committee"))

const files = [
  "lib/growth/aios/growth/growth-lead-research-execution-plan.ts",
  "lib/growth/aios/growth/growth-lead-research-opportunity-assessment.ts",
  "lib/growth/aios/growth/growth-lead-research-workflow-service.ts",
  "lib/growth/aios/pilot/lead-research-agent-executor.ts",
  "lib/growth/aios/ai-executive-mission-planning-review-service.ts",
  "components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section.tsx",
  "components/growth/ai-os/command-center/growth-ai-os-growth-lead-research-workflow-section.tsx",
  "components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-review-dashboard.tsx",
]

for (const file of files) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  assertNoCoreTouch(file)
}

const executor = readSource("lib/growth/aios/pilot/lead-research-agent-executor.ts")
assert.ok(executor.includes("executionPlan: intelligence.executionPlan"))
assert.equal(executor.includes("enroll_sequence"), false)

const service = readSource("lib/growth/aios/growth/growth-lead-research-workflow-service.ts")
assert.ok(service.includes("serializeExecutionPlan"))
assert.ok(service.includes("parseExecutionPlan"))
assert.ok(service.includes("executionReadiness"))

const planningReview = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.ok(planningReview.includes("listLeadResearchExecutionPlansForMission"))
assert.ok(planningReview.includes("leadResearchExecutionPlans"))

const dashboard = readSource("components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-review-dashboard.tsx")
assert.ok(dashboard.includes("lead-research-planning-review"))
assert.ok(dashboard.includes("GrowthAiOsLeadResearchExecutionPlanSection"))

const qualification = qualifyGrowthLeadResearch({ result: researchResult, researchRunStatus: "succeeded" })
const intelligence = assessGrowthLeadResearchOpportunity({
  result: researchResult,
  qualification: qualification.qualification,
})
const planA = intelligence.executionPlan
const planB = planGrowthLeadResearchExecution({
  nextBestAction: intelligence.nextBestAction,
  opportunityAssessment: intelligence.opportunityAssessment,
  evidenceSummary: intelligence.evidenceSummary,
  qualification: qualification.qualification,
})
assert.deepEqual(planA, planB, "execution plan must be deterministic")
assert.ok(planA.requiredWorkOrders.length >= 0)
assert.ok(planA.estimatedSteps.length > 0)
assert.ok(planA.successCriteria.length > 0)
assert.ok(planA.failureConditions.length > 0)
assert.equal(typeof planA.approvalRequired, "boolean")

console.log(`[${GROWTH_AIOS_GROWTH_1C_PHASE}] PASS — Execution Plan certified (local)`)
