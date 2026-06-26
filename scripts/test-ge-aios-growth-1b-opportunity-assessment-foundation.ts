/**
 * GE-AIOS-GROWTH-1B — Opportunity Assessment & Next Best Action certification.
 * Run: pnpm test:ge-aios-growth-1b-opportunity-assessment-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_GROWTH_1B_PHASE,
  GROWTH_LEAD_RESEARCH_OPPORTUNITY_ASSESSMENT_QA_MARKER,
  GROWTH_LEAD_RESEARCH_OPPORTUNITY_RUNTIME_RULE,
  GROWTH_OPPORTUNITY_RECOMMENDATIONS,
  assessGrowthLeadResearchOpportunity,
} from "../lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { GROWTH_LEAD_RESEARCH_WORKFLOW_STATUSES } from "../lib/growth/aios/growth/growth-lead-research-workflow-types"
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

console.log(`[${GROWTH_AIOS_GROWTH_1B_PHASE}] Opportunity Assessment certification`)

assert.equal(GROWTH_LEAD_RESEARCH_OPPORTUNITY_ASSESSMENT_QA_MARKER, "growth-aios-growth-1b-opportunity-assessment-v1")
assert.ok(GROWTH_LEAD_RESEARCH_OPPORTUNITY_RUNTIME_RULE.includes("advisory"))
assert.ok(GROWTH_LEAD_RESEARCH_WORKFLOW_STATUSES.includes("assessed"))
assert.equal(GROWTH_OPPORTUNITY_RECOMMENDATIONS.length, 7)

const files = [
  "lib/growth/aios/growth/growth-lead-research-opportunity-assessment.ts",
  "lib/growth/aios/growth/growth-lead-research-workflow-types.ts",
  "lib/growth/aios/growth/growth-lead-research-workflow-service.ts",
  "lib/growth/aios/pilot/lead-research-agent-executor.ts",
  "components/growth/ai-os/command-center/growth-ai-os-growth-lead-research-workflow-section.tsx",
  "components/growth/ai-os/growth-ai-os-lead-research-pilot-panel.tsx",
]

for (const file of files) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  assertNoCoreTouch(file)
}

const executor = readSource("lib/growth/aios/pilot/lead-research-agent-executor.ts")
assert.ok(executor.includes("assessGrowthLeadResearchOpportunity"))
assert.ok(executor.includes('workflowStatus: "assessed"'))
assert.equal(executor.includes("enroll_sequence"), false)

const panel = readSource("components/growth/ai-os/command-center/growth-ai-os-growth-lead-research-workflow-section.tsx")
assert.ok(panel.includes("Opportunity assessments"))
assert.ok(panel.includes("Next best actions"))
assert.ok(panel.includes("GROWTH_LEAD_RESEARCH_OPPORTUNITY_ASSESSMENT_QA_MARKER"))
assert.equal(panel.includes("<Button"), false)

const qualification = qualifyGrowthLeadResearch({ result: researchResult, researchRunStatus: "succeeded" })
assert.equal(qualification.terminalStatus, "qualified")

const assessmentA = assessGrowthLeadResearchOpportunity({
  result: researchResult,
  qualification: qualification.qualification,
})
const assessmentB = assessGrowthLeadResearchOpportunity({
  result: researchResult,
  qualification: qualification.qualification,
})
assert.deepEqual(assessmentA, assessmentB, "assessment must be deterministic")
assert.ok(assessmentA.opportunityAssessment.opportunityScore >= 50)
assert.ok(GROWTH_OPPORTUNITY_RECOMMENDATIONS.includes(assessmentA.opportunityAssessment.recommendation))
assert.ok(assessmentA.nextBestAction.label.length > 0)
assert.ok(assessmentA.evidenceSummary.verifiedEvidence.length > 0)
assert.ok(assessmentA.executionPlan.workflowType.length > 0)

console.log(`[${GROWTH_AIOS_GROWTH_1B_PHASE}] PASS — Opportunity Assessment certified (local)`)
