/**
 * GE-AIOS-GROWTH-1F — Future Execution Handoff Contract certification.
 * Run: pnpm test:ge-aios-growth-1f-future-execution-handoff
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildFutureExecutionHandoffContract,
  GROWTH_AIOS_GROWTH_1F_PHASE,
  GROWTH_LEAD_RESEARCH_FUTURE_EXECUTION_HANDOFF_QA_MARKER,
  GROWTH_LEAD_RESEARCH_FUTURE_EXECUTION_HANDOFF_RUNTIME_RULE,
  GROWTH_LEAD_RESEARCH_FUTURE_EXECUTION_HANDOFF_STATES,
  requiredProviderCapabilitiesForWorkflow,
  requiredGuardrailsForHandoff,
  resolveFutureExecutionHandoffState,
  summarizeFutureExecutionHandoffContract,
} from "../lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import { assessGrowthLeadResearchOpportunity } from "../lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { buildGrowthLeadResearchExecutionPlanId } from "../lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
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

const readyInfrastructure = {
  providerReady: true,
  availableProviderIds: ["openai"],
  autonomyEnabled: true,
  emergencyStopActive: false,
  workflowFeatureEnabled: true,
}

const blockedInfrastructure = {
  providerReady: false,
  availableProviderIds: [],
  autonomyEnabled: false,
  emergencyStopActive: true,
  workflowFeatureEnabled: true,
}

console.log(`[${GROWTH_AIOS_GROWTH_1F_PHASE}] Future Execution Handoff certification`)

assert.equal(GROWTH_LEAD_RESEARCH_FUTURE_EXECUTION_HANDOFF_QA_MARKER, "growth-aios-growth-1f-future-execution-handoff-v1")
assert.ok(GROWTH_LEAD_RESEARCH_FUTURE_EXECUTION_HANDOFF_RUNTIME_RULE.includes("read-only"))
assert.ok(GROWTH_LEAD_RESEARCH_FUTURE_EXECUTION_HANDOFF_STATES.includes("handoff_ready"))

const files = [
  "lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types.ts",
  "lib/growth/aios/growth/growth-lead-research-future-execution-handoff-service.ts",
  "components/growth/ai-os/command-center/growth-ai-os-future-execution-handoff-section.tsx",
  "lib/growth/aios/ai-os-command-center-service.ts",
  "lib/growth/aios/ai-executive-mission-planning-review-service.ts",
]

for (const file of files) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  assertNoCoreTouch(file)
}

const handoffService = readSource("lib/growth/aios/growth/growth-lead-research-future-execution-handoff-service.ts")
assert.ok(handoffService.includes("buildGrowthLeadResearchFutureExecutionHandoffContracts"))
assert.ok(handoffService.includes("resolveFutureExecutionHandoffInfrastructure"))
assert.equal(handoffService.includes("createAiWorkOrder"), false)
assert.equal(handoffService.includes("publishAiOsEvent"), false)

const panel = readSource("components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx")
assert.ok(panel.includes("GrowthAiOsFutureExecutionHandoffSection"))
assert.ok(panel.includes("futureExecutionHandoffContracts"))

const handoffSection = readSource("components/growth/ai-os/command-center/growth-ai-os-future-execution-handoff-section.tsx")
assert.ok(handoffSection.includes('data-qa-section="future-execution-handoff"'))
assert.equal(handoffSection.includes("Start"), false)
assert.equal(handoffSection.includes("Launch"), false)
assert.equal(handoffSection.includes("Run"), false)
assert.equal(handoffSection.includes("Create Work Order"), false)

const qualification = qualifyGrowthLeadResearch({ result: researchResult, researchRunStatus: "succeeded" })
const intelligence = assessGrowthLeadResearchOpportunity({
  result: researchResult,
  qualification: qualification.qualification,
})
const plan = { ...intelligence.executionPlan, missingPrerequisites: [] as string[] }
const leadId = "lead-cert-handoff"
const planId = buildGrowthLeadResearchExecutionPlanId({ leadId, plan })

assert.ok(requiredProviderCapabilitiesForWorkflow("verify_email").includes("ai_os_provider_ready"))
assert.ok(requiredGuardrailsForHandoff().includes("no_autonomous_outbound"))

assert.equal(
  resolveFutureExecutionHandoffState({
    approvalState: "approved_for_future_execution",
    readinessState: "ready_for_future_execution",
    infrastructure: readyInfrastructure,
  }),
  "handoff_ready",
)

assert.equal(
  resolveFutureExecutionHandoffState({
    approvalState: "pending_review",
    readinessState: "ready_for_future_execution",
    infrastructure: readyInfrastructure,
  }),
  "handoff_blocked_missing_approval",
)

assert.equal(
  resolveFutureExecutionHandoffState({
    approvalState: "approved_for_future_execution",
    readinessState: "ready_for_future_execution",
    infrastructure: blockedInfrastructure,
  }),
  "handoff_blocked_provider_unavailable",
)

const contractA = buildFutureExecutionHandoffContract({
  planId,
  leadId,
  companyName: "Acme HVAC",
  plan,
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  readinessReason: "Ready",
  futureExecutionEligible: true,
  evidenceSummary: intelligence.evidenceSummary,
  auditTrail: { leadId, planId, entries: [{ eventId: "evt-1", eventType: "growth.workflow.status_changed", occurredAt: "2026-06-25T12:00:00.000Z", summary: "Assessed", detail: null }] },
  infrastructure: readyInfrastructure,
  generatedAt: "2026-06-25T12:00:00.000Z",
  observationHref: "/growth/os/pilot/lead-research/lead-cert-handoff",
})

const contractB = buildFutureExecutionHandoffContract({
  planId,
  leadId,
  companyName: "Acme HVAC",
  plan,
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  readinessReason: "Ready",
  futureExecutionEligible: true,
  evidenceSummary: intelligence.evidenceSummary,
  auditTrail: { leadId, planId, entries: [{ eventId: "evt-1", eventType: "growth.workflow.status_changed", occurredAt: "2026-06-25T12:00:00.000Z", summary: "Assessed", detail: null }] },
  infrastructure: readyInfrastructure,
  generatedAt: "2026-06-25T12:00:00.000Z",
  observationHref: "/growth/os/pilot/lead-research/lead-cert-handoff",
})

assert.deepEqual(contractA, contractB, "handoff contract must be deterministic")
assert.equal(contractA.handoffState, "handoff_ready")
assert.ok(contractA.requiredGuardrails.length > 0)
assert.ok(contractA.auditReferences.includes("evt-1"))
assert.ok(summarizeFutureExecutionHandoffContract(contractA).includes("Handoff contract ready"))

const blockedContract = buildFutureExecutionHandoffContract({
  planId,
  leadId,
  companyName: "Acme HVAC",
  plan: intelligence.executionPlan,
  approvalState: "approved_for_future_execution",
  readinessState: "blocked_missing_prerequisites",
  readinessReason: "Missing prerequisites",
  futureExecutionEligible: false,
  evidenceSummary: intelligence.evidenceSummary,
  auditTrail: { leadId, planId, entries: [] },
  infrastructure: readyInfrastructure,
  generatedAt: "2026-06-25T12:00:00.000Z",
  observationHref: "/growth/os/pilot/lead-research/lead-cert-handoff",
})
assert.ok(blockedContract.blockedReasons.length > 0)
assert.equal(blockedContract.futureExecutionEligible, false)

console.log(`[${GROWTH_AIOS_GROWTH_1F_PHASE}] PASS — Future Execution Handoff certified (local)`)
