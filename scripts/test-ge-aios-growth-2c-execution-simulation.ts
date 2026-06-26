/**
 * GE-AIOS-GROWTH-2C — Execution Simulation Engine certification.
 * Run: pnpm test:ge-aios-growth-2c-execution-simulation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { readGeAiOsCommandCenterUiBundle } from "./ge-aios-command-center-ui-cert-utils"
import { GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES } from "../lib/growth/aios/growth/growth-lead-research-execution-plan"
import {
  auditWorkflowBoundary,
  buildAllWorkflowBoundaryReports,
} from "../lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import { buildFutureExecutionHandoffContract } from "../lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import {
  buildAllWorkflowPreflightChecklists,
  buildPlanPreflightChecklist,
  buildWorkflowPreflightChecklist,
} from "../lib/growth/aios/growth/growth-lead-research-execution-preflight-types"
import {
  buildAllWorkflowExecutionSimulations,
  buildExecutionSimulationId,
  buildExecutionSimulationSystemSummary,
  buildPlanExecutionSimulation,
  buildWorkflowExecutionSimulation,
  GROWTH_AIOS_GROWTH_2C_PHASE,
  GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_RUNTIME_RULE,
  GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_STATUSES,
  resolveSimulatedExecutionStatus,
  summarizePlanExecutionSimulation,
} from "../lib/growth/aios/growth/growth-lead-research-execution-simulation-types"
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
    "publishAiOsEvent",
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

console.log(`[${GROWTH_AIOS_GROWTH_2C_PHASE}] Execution Simulation Engine certification`)

assert.equal(
  GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_QA_MARKER,
  "growth-aios-growth-2c-execution-simulation-v1",
)
assert.ok(GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_RUNTIME_RULE.includes("in-memory"))
assert.equal(GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_STATUSES.length, 6)

const files = [
  "lib/growth/aios/growth/growth-lead-research-execution-simulation-types.ts",
  "lib/growth/aios/growth/growth-lead-research-execution-simulation-service.ts",
  "components/growth/ai-os/command-center/growth-ai-os-execution-simulation-section.tsx",
  "lib/growth/aios/ai-os-command-center-service.ts",
  "docs/GE-AIOS-GROWTH_EXECUTION_SIMULATION.md",
]

for (const file of files) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  if (!file.endsWith(".md")) assertNoExecutionPaths(file)
}

const simulationService = readSource("lib/growth/aios/growth/growth-lead-research-execution-simulation-service.ts")
assert.ok(simulationService.includes("buildGrowthLeadResearchExecutionSimulation"))
assert.equal(simulationService.includes("createAiWorkOrder"), false)

const panel = readGeAiOsCommandCenterUiBundle()
assert.ok(panel.includes("GrowthAiOsExecutionSimulationSection"))
assert.ok(panel.includes("executionSimulation"))

const simulationSection = readSource(
  "components/growth/ai-os/command-center/growth-ai-os-execution-simulation-section.tsx",
)
assert.ok(simulationSection.includes('data-qa-section="execution-simulation"'))
assert.equal(simulationSection.includes("Launch"), false)
assert.equal(/\bRun workflow\b/.test(simulationSection), false)

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.ok(missionPlanning.includes("buildPlanExecutionSimulation"))
assert.ok(missionPlanning.includes("simulationStatus"))

const boundaries = buildAllWorkflowBoundaryReports(readyInfrastructure)
const workflowPreflights = buildAllWorkflowPreflightChecklists({ boundaries, infrastructure: readyInfrastructure })
const simulationsA = buildAllWorkflowExecutionSimulations({ boundaries, workflowPreflights })
const simulationsB = buildAllWorkflowExecutionSimulations({ boundaries, workflowPreflights })
assert.deepEqual(simulationsA, simulationsB, "workflow simulations must be deterministic")
assert.equal(simulationsA.length, GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES.length)

for (const workflowType of GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES) {
  const row = simulationsA.find((sim) => sim.workflowType === workflowType)
  assert.ok(row, `simulation must exist for ${workflowType}`)
  assert.ok(row!.predictedTimeline.length > 0)
  assert.ok(row!.simulationSummary.length > 0)
}

const approvalSim = simulationsA.find((sim) => sim.workflowType === "approval")
assert.equal(approvalSim?.simulatedExecutionStatus, "simulation_not_allowed")

const verifyBoundary = auditWorkflowBoundary("verify_email", readyInfrastructure)
const verifyPreflight = buildWorkflowPreflightChecklist({ boundary: verifyBoundary, infrastructure: readyInfrastructure })
const verifySim = buildWorkflowExecutionSimulation({ boundary: verifyBoundary, workflowPreflight: verifyPreflight })
assert.ok(verifySim.predictedWorkOrders.includes("verify_email"))
assert.equal(verifySim.predictedOutboundActions[0], "none — Growth-scoped mutation only")

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
const planPreflight = buildPlanPreflightChecklist({ handoff, workflowChecklist: verifyPreflight })
const planSim = buildPlanExecutionSimulation({
  plan,
  planId: handoff.planId,
  leadId: handoff.leadId,
  companyName: handoff.companyName,
  approvalState: handoff.approvalState,
  readinessState: handoff.readinessState,
  boundary: verifyBoundary,
  workflowPreflight: verifyPreflight,
  planPreflight,
  handoff,
  observationHref: handoff.observationHref,
})
assert.equal(buildExecutionSimulationId({ planId: handoff.planId, workflowType: "verify_email" }), planSim.simulationId)
assert.ok(summarizePlanExecutionSimulation(planSim).length > 0)
assert.ok(planSim.confidence > 0)

const blockedStatus = resolveSimulatedExecutionStatus({
  plan,
  approvalState: "pending_review",
  readinessState: "blocked_missing_approval",
  boundary: verifyBoundary,
  workflowPreflight: verifyPreflight,
  planPreflight,
  handoff,
  failurePointCount: 0,
})
assert.equal(blockedStatus, "simulation_blocked")

const systemSummary = buildExecutionSimulationSystemSummary({ simulations: simulationsA })
assert.ok(systemSummary.headline.includes("8 execution simulations"))

console.log(`[${GROWTH_AIOS_GROWTH_2C_PHASE}] PASS — Execution Simulation Engine certified (local)`)

