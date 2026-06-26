/**
 * GE-AIOS-GROWTH-2A — Execution Runtime Boundary Audit certification.
 * Run: pnpm test:ge-aios-growth-2a-execution-boundary-audit
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES } from "../lib/growth/aios/growth/growth-lead-research-execution-plan"
import {
  auditWorkflowBoundary,
  buildAllWorkflowBoundaryReports,
  buildExecutionBoundarySystemSummary,
  buildPlanExecutionBoundaryStatus,
  GROWTH_AIOS_GROWTH_2A_PHASE,
  GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_AUDIT_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_AUDIT_RUNTIME_RULE,
  GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_CLASSIFICATIONS,
  GROWTH_LEAD_RESEARCH_WORKFLOW_BOUNDARY_CATALOG,
  summarizePlanBoundaryStatus,
} from "../lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import { listAuditedWorkflowTypes } from "../lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-service"
import { buildFutureExecutionHandoffContract } from "../lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import { assessGrowthLeadResearchOpportunity } from "../lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { qualifyGrowthLeadResearch } from "../lib/growth/aios/growth/growth-lead-research-workflow-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of ["createAiWorkOrder", "enroll_sequence", "invokeAiOsProvider", "public.invoices", "public.quotes"]) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

const readyInfrastructure = {
  providerReady: true,
  availableProviderIds: ["openai"],
  autonomyEnabled: true,
  emergencyStopActive: false,
  workflowFeatureEnabled: true,
}

const researchResult = {
  companySummary: "Regional commercial HVAC contractor.",
  websiteSummary: "Commercial HVAC.",
  likelyServiceCategory: "HVAC",
  serviceAreaClues: ["Midwest"],
  companySizeEstimate: "40-60",
  equipmentServiceIndicators: ["fleet dispatch"],
  equipifyPainPoints: ["dispatch efficiency"],
  equipifyFitScore: 78,
  outreachAngles: ["fleet optimization"],
  recommendedNextAction: "Verify contacts",
  researchConfidence: 0.86,
  sourceUrls: ["https://example.com"],
  caveats: [],
  fitModelVersion: "v3",
  decisionMakerCandidates: [{ fullName: "Jane Doe", title: "Ops Director", email: null, phone: null, linkedinUrl: null, confidence: 0.7, evidenceExcerpt: null }],
  estimatedAnnualRevenue: "$1.2M",
  estimatedEmployeeCount: "40-60",
  fleetSizeEstimate: "35 trucks",
  crmDetected: null,
  fieldServiceStackDetected: null,
}

console.log(`[${GROWTH_AIOS_GROWTH_2A_PHASE}] Execution Boundary Audit certification`)

assert.equal(GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_AUDIT_QA_MARKER, "growth-aios-growth-2a-execution-boundary-audit-v1")
assert.ok(GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_AUDIT_RUNTIME_RULE.includes("read-only"))
assert.ok(GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_CLASSIFICATIONS.includes("outbound_requires_human_approval"))

const files = [
  "lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types.ts",
  "lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-service.ts",
  "components/growth/ai-os/command-center/growth-ai-os-execution-boundary-audit-section.tsx",
  "lib/growth/aios/ai-os-command-center-service.ts",
  "docs/GE-AIOS-GROWTH_EXECUTION_BOUNDARY_MATRIX.md",
]

for (const file of files) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  if (!file.endsWith(".md")) assertNoCoreTouch(file)
}

const auditService = readSource("lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-service.ts")
assert.ok(auditService.includes("buildGrowthLeadResearchExecutionBoundaryAudit"))
assert.equal(auditService.includes("evaluateAiOsProviderHealth"), false)
assert.equal(auditService.includes("createAiWorkOrder"), false)

const panel = readSource("components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx")
assert.ok(panel.includes("GrowthAiOsExecutionBoundaryAuditSection"))
assert.ok(panel.includes("executionBoundaryAudit"))

const boundarySection = readSource("components/growth/ai-os/command-center/growth-ai-os-execution-boundary-audit-section.tsx")
assert.ok(boundarySection.includes('data-qa-section="execution-boundary-audit"'))
assert.equal(boundarySection.includes("Launch"), false)
assert.equal(boundarySection.includes("Start"), false)
assert.equal(boundarySection.includes("Run"), false)

assert.deepEqual(
  listAuditedWorkflowTypes().sort(),
  [...GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES].sort(),
  "all canonical workflow types must have boundary definitions",
)

for (const workflowType of GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES) {
  assert.ok(GROWTH_LEAD_RESEARCH_WORKFLOW_BOUNDARY_CATALOG[workflowType], `catalog must include ${workflowType}`)
}

const reportsA = buildAllWorkflowBoundaryReports(readyInfrastructure)
const reportsB = buildAllWorkflowBoundaryReports(readyInfrastructure)
assert.deepEqual(reportsA, reportsB, "boundary reports must be deterministic")
assert.equal(reportsA.length, 8)

assert.equal(
  GROWTH_LEAD_RESEARCH_WORKFLOW_BOUNDARY_CATALOG.outreach_generation.classification,
  "outbound_requires_human_approval",
)
assert.equal(GROWTH_LEAD_RESEARCH_WORKFLOW_BOUNDARY_CATALOG.approval.futureExecutionAllowed, false)

const systemSummary = buildExecutionBoundarySystemSummary({ workflowReports: reportsA, infrastructure: readyInfrastructure })
assert.ok(systemSummary.headline.includes("8 workflow boundaries audited"))

const qualification = qualifyGrowthLeadResearch({ result: researchResult, researchRunStatus: "succeeded" })
const intelligence = assessGrowthLeadResearchOpportunity({ result: researchResult, qualification: qualification.qualification })
const plan = { ...intelligence.executionPlan, missingPrerequisites: [] as string[] }
const handoff = buildFutureExecutionHandoffContract({
  planId: "glr-ep:lead:verify_email:verify_email",
  leadId: "lead-1",
  companyName: "Acme",
  plan,
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  readinessReason: "Ready",
  futureExecutionEligible: true,
  evidenceSummary: intelligence.evidenceSummary,
  auditTrail: { leadId: "lead-1", planId: "p1", entries: [] },
  infrastructure: readyInfrastructure,
  generatedAt: "2026-06-25T12:00:00.000Z",
  observationHref: "/growth/os/pilot/lead-research/lead-1",
})

const verifyReport = auditWorkflowBoundary("verify_email", readyInfrastructure)
const planBoundary = buildPlanExecutionBoundaryStatus({ handoff, workflowReport: verifyReport })
assert.ok(summarizePlanBoundaryStatus(planBoundary).length > 0)

const blockedInfra = { ...readyInfrastructure, providerReady: false, availableProviderIds: [] as string[] }
const outreachBlocked = auditWorkflowBoundary("outreach_generation", blockedInfra)
assert.ok(outreachBlocked.missingGuardrails.length > 0)
assert.equal(outreachBlocked.outboundRisk, "high")

console.log(`[${GROWTH_AIOS_GROWTH_2A_PHASE}] PASS — Execution Boundary Audit certified (local)`)

