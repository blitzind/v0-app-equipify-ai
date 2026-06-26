/**
 * GE-AIOS-4A — Lead Research Pilot certification.
 * Run: pnpm test:ge-aios-4a-lead-research-pilot-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  LEAD_RESEARCH_PILOT_RUNTIME_RULE,
  LEAD_RESEARCH_PILOT_STEPS,
  GROWTH_AIOS_4A_PHASE,
  GROWTH_AI_OS_LEAD_RESEARCH_PILOT_QA_MARKER,
} from "../lib/growth/aios/pilot/lead-research-pilot-types"
import {
  GROWTH_AIOS_LEAD_RESEARCH_PILOT_FEATURE_FLAG,
  isLeadResearchPilotEnabled,
  resolveLeadResearchPilotConfig,
} from "../lib/growth/aios/pilot/lead-research-pilot-config"
import { lookupAiEventRegistryEntry } from "../lib/growth/aios/ai-event-registry"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of ["public.invoices", "public.quotes", "blitzpay", "public.work_orders"]) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_4A_PHASE}] Lead Research Pilot certification`)

assert.equal(GROWTH_AI_OS_LEAD_RESEARCH_PILOT_QA_MARKER, "growth-aios-4a-lead-research-pilot-v1")
assert.equal(LEAD_RESEARCH_PILOT_STEPS.length, 10)
assert.ok(LEAD_RESEARCH_PILOT_RUNTIME_RULE.includes("feature flag"))

assert.equal(isLeadResearchPilotEnabled({ [GROWTH_AIOS_LEAD_RESEARCH_PILOT_FEATURE_FLAG]: "true" }), true)
assert.equal(isLeadResearchPilotEnabled({ [GROWTH_AIOS_LEAD_RESEARCH_PILOT_FEATURE_FLAG]: "false" }), false)
assert.equal(resolveLeadResearchPilotConfig({}).enableAiEvidence, false)

const pilotFiles = [
  "lib/growth/aios/pilot/lead-research-pilot-types.ts",
  "lib/growth/aios/pilot/lead-research-pilot-config.ts",
  "lib/growth/aios/pilot/lead-research-pilot-mission-service.ts",
  "lib/growth/aios/pilot/lead-research-pilot-observability.ts",
  "lib/growth/aios/pilot/lead-research-pilot-orchestrator.ts",
  "lib/growth/aios/pilot/lead-research-agent-executor.ts",
  "app/api/platform/growth/ai-os/pilot/lead-research/[leadId]/route.ts",
  "components/growth/ai-os/growth-ai-os-lead-research-pilot-panel.tsx",
]

for (const file of pilotFiles) {
  assertNoCoreTouch(file)
}

const orchestrator = readSource("lib/growth/aios/pilot/lead-research-pilot-orchestrator.ts")
assert.ok(orchestrator.includes("runExecutiveMissionPlanningTick"))
assert.ok(orchestrator.includes('mode: "create"'))
assert.ok(orchestrator.includes("prepareDecision: true"))
assert.ok(orchestrator.includes("isLeadResearchPilotEnabled"))
assert.ok(orchestrator.includes("executeResearchCompanyWorkOrderViaAiOs"))
for (const forbidden of ["runGrowthLeadResearch", "runAiTask", "runProspectResearch", "enroll_sequence"]) {
  assert.equal(orchestrator.includes(forbidden), false, `orchestrator must not reference ${forbidden}`)
}

const executor = readSource("lib/growth/aios/pilot/lead-research-agent-executor.ts")
assert.ok(executor.includes("claimAiOsWorkOrder"))
assert.ok(executor.includes("assembleAiContextForWorkOrder"))
assert.ok(executor.includes("invokeAiOsProviderWithContextPackage"))
assert.ok(executor.includes("applyGrowthLeadResearchEnrichment"))
assert.ok(executor.includes('toStatus: "completed"'))
for (const forbidden of ["runGrowthLeadResearch", "runAiTask", "invokeCoreProviderAdapter"]) {
  assert.equal(executor.includes(forbidden), false, `executor must not reference ${forbidden}`)
}

const leadRepo = readSource("lib/growth/lead-repository.ts")
assert.ok(leadRepo.includes("scheduleLeadResearchPilotForProspect"))

const pilotApi = readSource("app/api/platform/growth/ai-os/pilot/lead-research/[leadId]/route.ts")
assert.equal(pilotApi.includes("startLeadResearchPilotForProspect"), false)
assert.ok(pilotApi.includes("fetchLeadResearchPilotObservation"))

assert.ok(lookupAiEventRegistryEntry("pilot.lead_research_started"))
assert.ok(lookupAiEventRegistryEntry("pilot.lead_research_completed"))
assert.ok(lookupAiEventRegistryEntry("growth.prospect_created"))

console.log(`[${GROWTH_AIOS_4A_PHASE}] PASS — Lead Research Pilot certified (local)`)
