/**
 * GE-AIOS-GROWTH-1A — Growth Lead Research workflow normalization certification.
 * Run: pnpm test:ge-aios-growth-1a-growth-workflow-normalization-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { readGeAiOsCommandCenterUiBundle } from "./ge-aios-command-center-ui-cert-utils"
import {
  GROWTH_AIOS_GROWTH_1A_PHASE,
  GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
  GROWTH_LEAD_RESEARCH_WORKFLOW_QA_MARKER,
  GROWTH_LEAD_RESEARCH_WORKFLOW_RUNTIME_RULE,
  GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
  deriveGrowthLeadResearchWorkflowStatus,
  qualifyGrowthLeadResearch,
} from "../lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_FEATURE_FLAG,
  GROWTH_AIOS_LEAD_RESEARCH_PILOT_FEATURE_FLAG,
  isGrowthLeadResearchWorkflowEnabled,
  isLeadResearchPilotEnabled,
  resolveGrowthLeadResearchWorkflowConfig,
} from "../lib/growth/aios/pilot/lead-research-pilot-config"
import { lookupAiEventRegistryEntry } from "../lib/growth/aios/ai-event-registry"
import { LEAD_RESEARCH_PILOT_STEPS } from "../lib/growth/aios/pilot/lead-research-pilot-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of ["public.invoices", "public.quotes", "blitzpay", "public.work_orders"]) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_GROWTH_1A_PHASE}] Growth workflow normalization certification`)

assert.equal(GROWTH_LEAD_RESEARCH_WORKFLOW_KEY, "growth_lead_research")
assert.equal(GROWTH_LEAD_RESEARCH_WORKFLOW_QA_MARKER, "growth-aios-growth-1a-lead-research-workflow-v1")
assert.ok(GROWTH_LEAD_RESEARCH_WORKFLOW_RUNTIME_RULE.includes("human-supervised"))

assert.equal(
  isGrowthLeadResearchWorkflowEnabled({ [GROWTH_AIOS_LEAD_RESEARCH_PILOT_FEATURE_FLAG]: "true" }),
  true,
)
assert.equal(
  isGrowthLeadResearchWorkflowEnabled({ [GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_FEATURE_FLAG]: "true" }),
  true,
)
assert.equal(isGrowthLeadResearchWorkflowEnabled({}), false)
assert.equal(
  isLeadResearchPilotEnabled({ [GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_FEATURE_FLAG]: "true" }),
  true,
)
assert.equal(
  resolveGrowthLeadResearchWorkflowConfig({ [GROWTH_AIOS_LEAD_RESEARCH_PILOT_FEATURE_FLAG]: "true" }).workflowKey,
  "growth_lead_research",
)

const files = [
  "lib/growth/aios/growth/growth-lead-research-workflow-types.ts",
  "lib/growth/aios/growth/growth-lead-research-workflow-service.ts",
  "lib/growth/aios/pilot/lead-research-pilot-config.ts",
  "lib/growth/aios/pilot/lead-research-pilot-orchestrator.ts",
  "lib/growth/aios/pilot/lead-research-agent-executor.ts",
  "lib/growth/aios/pilot/lead-research-pilot-observability.ts",
  "lib/growth/aios/ai-os-command-center-service.ts",
  "components/growth/ai-os/command-center/growth-ai-os-growth-lead-research-workflow-section.tsx",
  "components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx",
]

for (const file of files) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  assertNoCoreTouch(file)
}

const orchestrator = readSource("lib/growth/aios/pilot/lead-research-pilot-orchestrator.ts")
assert.ok(orchestrator.includes("publishGrowthLeadResearchWorkflowStatus"))
assert.ok(orchestrator.includes('workflowStatus: "scheduled"'))
assert.ok(orchestrator.includes('workflowStatus: "researching"'))
for (const forbidden of ["enroll_sequence", "generate_email", "runGrowthLeadResearch"]) {
  assert.equal(orchestrator.includes(forbidden), false, `orchestrator must not reference ${forbidden}`)
}

const executor = readSource("lib/growth/aios/pilot/lead-research-agent-executor.ts")
assert.ok(executor.includes("qualifyGrowthLeadResearch"))
assert.ok(executor.includes("publishGrowthLeadResearchWorkflowStatus"))
assert.ok(executor.includes("applyGrowthLeadResearchEnrichment"))
assert.ok(executor.includes('workflowStatus: "research_complete"'))

const commandCenter = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenter.includes("buildGrowthLeadResearchWorkflowCommandCenterSummary"))
assert.ok(commandCenter.includes("growthLeadResearchWorkflow"))

const panel = readGeAiOsCommandCenterUiBundle()
assert.ok(panel.includes("GrowthAiOsGrowthLeadResearchWorkflowSection"))
assert.ok(panel.includes("model.growthLeadResearchWorkflow"))

assert.ok(lookupAiEventRegistryEntry(GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT))
assert.ok(lookupAiEventRegistryEntry("pilot.lead_research_completed"))

const qualification = qualifyGrowthLeadResearch({
  result: {
    companySummary: "Regional HVAC contractor with 40 trucks.",
    websiteSummary: "Services commercial HVAC.",
    likelyServiceCategory: "HVAC",
    serviceAreaClues: ["Midwest"],
    companySizeEstimate: "40-60 employees",
    equipmentServiceIndicators: ["fleet"],
    equipifyPainPoints: ["dispatch"],
    equipifyFitScore: 72,
    outreachAngles: ["fleet efficiency"],
    recommendedNextAction: "Verify decision makers before outreach",
    researchConfidence: 0.82,
    sourceUrls: ["https://example.com"],
    caveats: [],
    fitModelVersion: "v3",
    decisionMakerCandidates: [],
    estimatedAnnualRevenue: null,
    estimatedEmployeeCount: null,
    fleetSizeEstimate: null,
    crmDetected: null,
    fieldServiceStackDetected: null,
  },
  researchRunStatus: "succeeded",
})
assert.equal(qualification.terminalStatus, "qualified")
assert.ok(qualification.qualification.fitScore >= 55)
assert.ok(qualification.qualification.recommendedNextAction.length > 0)

const pendingSteps = LEAD_RESEARCH_PILOT_STEPS.map((stepId) => ({
  stepId,
  label: stepId,
  status: "pending" as const,
  occurredAt: null,
  detail: null,
  metadata: {},
}))
assert.equal(deriveGrowthLeadResearchWorkflowStatus({ steps: pendingSteps }), "not_started")

console.log(`[${GROWTH_AIOS_GROWTH_1A_PHASE}] PASS — Growth workflow normalization certified (local)`)
