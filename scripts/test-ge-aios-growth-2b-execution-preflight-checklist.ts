/**
 * GE-AIOS-GROWTH-2B — Execution Guardrail Preflight Checklist certification.
 * Run: pnpm test:ge-aios-growth-2b-execution-preflight-checklist
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES } from "../lib/growth/aios/growth/growth-lead-research-execution-plan"
import {
  auditWorkflowBoundary,
  buildAllWorkflowBoundaryReports,
} from "../lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import { buildFutureExecutionHandoffContract } from "../lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import {
  buildAllWorkflowPreflightChecklists,
  buildExecutionPreflightSystemSummary,
  buildPlanPreflightChecklist,
  buildWorkflowPreflightChecklist,
  GROWTH_AIOS_GROWTH_2B_PHASE,
  GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_RUNTIME_RULE,
  GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_STATUSES,
  resolveWorkflowPreflightStatus,
  summarizePlanPreflightChecklist,
} from "../lib/growth/aios/growth/growth-lead-research-execution-preflight-types"
import { assessGrowthLeadResearchOpportunity } from "../lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { qualifyGrowthLeadResearch } from "../lib/growth/aios/growth/growth-lead-research-workflow-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoExecutionPaths(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of [
    "createAiWorkOrder",
    "enroll_sequence",
    "invokeAiOsProvider",
    "public.invoices",
    "public.quotes",
    "sendEmail",
    "sendSms",
  ]) {
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
  decisionMakerCandidates: [
    {
      fullName: "Jane Doe",
      title: "Ops Director",
      email: null,
      phone: null,
      linkedinUrl: null,
      confidence: 0.7,
      evidenceExcerpt: null,
    },
  ],
  estimatedAnnualRevenue: "$1.2M",
  estimatedEmployeeCount: "40-60",
  fleetSizeEstimate: "35 trucks",
  crmDetected: null,
  fieldServiceStackDetected: null,
}

console.log(`[${GROWTH_AIOS_GROWTH_2B_PHASE}] Execution Preflight Checklist certification`)

assert.equal(
  GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_QA_MARKER,
  "growth-aios-growth-2b-execution-preflight-checklist-v1",
)
assert.ok(GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_RUNTIME_RULE.includes("audit-only"))
assert.equal(GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_STATUSES.length, 10)

const files = [
  "lib/growth/aios/growth/growth-lead-research-execution-preflight-types.ts",
  "lib/growth/aios/growth/growth-lead-research-execution-preflight-service.ts",
  "components/growth/ai-os/command-center/growth-ai-os-execution-preflight-checklist-section.tsx",
  "lib/growth/aios/ai-os-command-center-service.ts",
  "docs/GE-AIOS-GROWTH_EXECUTION_PREFLIGHT_CHECKLIST.md",
]

for (const file of files) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  if (!file.endsWith(".md")) assertNoExecutionPaths(file)
}

const preflightService = readSource("lib/growth/aios/growth/growth-lead-research-execution-preflight-service.ts")
assert.ok(preflightService.includes("buildGrowthLeadResearchExecutionPreflightChecklist"))
assert.equal(preflightService.includes("createAiWorkOrder"), false)
assert.equal(preflightService.includes("evaluateAiOsProviderHealth"), false)

const panel = readSource("components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx")
assert.ok(panel.includes("GrowthAiOsExecutionPreflightChecklistSection"))
assert.ok(panel.includes("executionPreflightChecklist"))

const preflightSection = readSource(
  "components/growth/ai-os/command-center/growth-ai-os-execution-preflight-checklist-section.tsx",
)
assert.ok(preflightSection.includes('data-qa-section="execution-preflight-checklist"'))
assert.equal(preflightSection.includes("Launch"), false)
assert.equal(preflightSection.includes("Start"), false)
assert.equal(/\bRun workflow\b/.test(preflightSection), false)

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.ok(missionPlanning.includes("buildPlanPreflightChecklist"))
assert.ok(missionPlanning.includes("preflightStatus"))

const boundaries = buildAllWorkflowBoundaryReports(readyInfrastructure)
const checklistsA = buildAllWorkflowPreflightChecklists({ boundaries, infrastructure: readyInfrastructure })
const checklistsB = buildAllWorkflowPreflightChecklists({ boundaries, infrastructure: readyInfrastructure })
assert.deepEqual(checklistsA, checklistsB, "preflight checklists must be deterministic")
assert.equal(checklistsA.length, GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES.length)

for (const workflowType of GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES) {
  const row = checklistsA.find((checklist) => checklist.workflowType === workflowType)
  assert.ok(row, `preflight report must exist for ${workflowType}`)
  assert.ok(row!.preflightSummary.length > 0)
}

const systemSummary = buildExecutionPreflightSystemSummary({ workflowChecklists: checklistsA })
assert.ok(systemSummary.headline.includes("8 workflow preflight checklists"))

const blockedInfra = { ...readyInfrastructure, workflowFeatureEnabled: false }
const verifyBoundary = auditWorkflowBoundary("verify_email", blockedInfra)
const blocked = resolveWorkflowPreflightStatus({ boundary: verifyBoundary, infrastructure: blockedInfra })
assert.equal(blocked.status, "preflight_blocked_missing_feature_flag")
assert.ok(blocked.missingRequirements[0]?.includes("Feature flag"))

const approvalBoundary = auditWorkflowBoundary("approval", readyInfrastructure)
const notAllowed = resolveWorkflowPreflightStatus({ boundary: approvalBoundary, infrastructure: readyInfrastructure })
assert.equal(notAllowed.status, "preflight_not_allowed")

const qualification = qualifyGrowthLeadResearch({ result: researchResult, researchRunStatus: "succeeded" })
const intelligence = assessGrowthLeadResearchOpportunity({
  result: researchResult,
  qualification: qualification.qualification,
})
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

const workflowChecklist = buildWorkflowPreflightChecklist({
  boundary: auditWorkflowBoundary("verify_email", readyInfrastructure),
  infrastructure: readyInfrastructure,
})
const planChecklist = buildPlanPreflightChecklist({ handoff, workflowChecklist: workflowChecklist })
assert.ok(summarizePlanPreflightChecklist(planChecklist).length > 0)

const providerBlockedInfra = { ...readyInfrastructure, providerReady: false, availableProviderIds: [] as string[] }
const outreachBoundary = auditWorkflowBoundary("outreach_generation", providerBlockedInfra)
const outreachBlocked = resolveWorkflowPreflightStatus({
  boundary: outreachBoundary,
  infrastructure: providerBlockedInfra,
})
assert.equal(outreachBlocked.status, "preflight_blocked_provider_unavailable")

console.log(`[${GROWTH_AIOS_GROWTH_2B_PHASE}] PASS — Execution Preflight Checklist certified (local)`)

