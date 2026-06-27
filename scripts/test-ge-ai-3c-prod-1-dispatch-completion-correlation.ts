/**
 * GE-AI-3C-PROD-1 — Revenue Director dispatch completion correlation certification.
 * Run: pnpm test:ge-ai-3c-prod-1-dispatch-completion-correlation
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { AI_EVENT_REGISTRY, isRegisteredAiEventType } from "../lib/growth/aios/ai-event-registry"
import {
  GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS,
  growthAiEventBusSubscriberObservesEvent,
} from "../lib/growth/aios/event-bus/growth-ai-event-bus-engine"
import {
  GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES,
} from "../lib/growth/aios/communication/growth-communication-engine-types"
import { GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT } from "../lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import { GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT } from "../lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  extractRevenueDirectorDispatchCorrelationResultReference,
  GROWTH_AIOS_GE_AI_3C_PROD_1_PHASE,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_QA_MARKER,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_RULE,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_SUBSCRIBER_ID,
  matchRevenueDirectorDispatchedWorkflowRequest,
  resolveRevenueDirectorDispatchCorrelationFromEvent,
  resolveRevenueDirectorDispatchCorrelationReadStatus,
} from "../lib/growth/aios/revenue-director/growth-revenue-director-dispatch-correlation-types"
import { parseGrowthProductionEnvFile } from "../lib/growth/qa/reply-flow-env-bootstrap"

const ENV_BUILD_FILE = ".env.build"
const ENV_BUILD_MAX_BYTES = 256 * 1024
const ENV_BUILD_SUPABASE_KEY_WHITELIST = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const

/** Bounded `.env.build` Supabase key audit — key names only, no unbounded shell scans. */
function auditEnvBuildSupabaseKeysIfPresent(): void {
  const envPath = path.join(process.cwd(), ENV_BUILD_FILE)
  if (!fs.existsSync(envPath)) return

  const stat = fs.statSync(envPath)
  assert.ok(stat.size <= ENV_BUILD_MAX_BYTES, `${ENV_BUILD_FILE} exceeds ${ENV_BUILD_MAX_BYTES} byte cap`)

  const raw = fs.readFileSync(envPath, "utf8").slice(0, ENV_BUILD_MAX_BYTES)
  const parsedKeys = Object.keys(parseGrowthProductionEnvFile(envPath, raw))
  const supabaseKeys = parsedKeys.filter((key) => key.includes("SUPABASE")).sort()

  for (const key of supabaseKeys) {
    assert.ok(
      (ENV_BUILD_SUPABASE_KEY_WHITELIST as readonly string[]).includes(key),
      `${ENV_BUILD_FILE} contains unexpected Supabase key: ${key}`,
    )
  }

  for (const requiredKey of ENV_BUILD_SUPABASE_KEY_WHITELIST) {
    assert.ok(parsedKeys.includes(requiredKey), `${ENV_BUILD_FILE} missing required key: ${requiredKey}`)
  }
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

console.log(`[${GROWTH_AIOS_GE_AI_3C_PROD_1_PHASE}] Dispatch completion correlation certification`)

assert.ok(GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_RULE.includes("no polling"))

auditEnvBuildSupabaseKeysIfPresent()

const requiredFiles = [
  "lib/growth/aios/revenue-director/growth-revenue-director-dispatch-correlation-types.ts",
  "lib/growth/aios/revenue-director/growth-revenue-director-dispatch-correlation-service.ts",
  "docs/GE-AI-3C-PROD-1_DISPATCH_COMPLETION_CORRELATION.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const service = readSource("lib/growth/aios/revenue-director/growth-revenue-director-dispatch-correlation-service.ts")
assert.ok(service.includes('import "server-only"'))
assert.ok(service.includes("applyRevenueDirectorDispatchCorrelation"))
assert.ok(service.includes("observeRevenueDirectorDispatchCorrelationEvent"))
assert.equal(service.includes("setInterval"), false)
assert.equal(service.includes("scheduler"), false)
assert.equal(service.includes("runSequenceExecutionJob"), false)

const registry = readSource("lib/growth/aios/event-bus/growth-ai-event-bus-subscriber-registry.ts")
assert.ok(registry.includes("observeRevenueDirectorDispatchCorrelationEvent"))
assert.ok(registry.includes("GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_SUBSCRIBER_ID"))

const ui = readSource("components/growth/ai-os/command-center/growth-ai-os-revenue-director-section.tsx")
assert.ok(ui.includes("Awaiting agent completion"))
assert.ok(ui.includes("Stale dispatch"))
assert.equal(ui.includes("retry"), false)

assert.ok(
  GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS.some(
    (row) => row.subscriberId === GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_SUBSCRIBER_ID,
  ),
)

assert.ok(
  growthAiEventBusSubscriberObservesEvent(GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_SUBSCRIBER_ID, {
    id: "evt-1",
    organizationId: "org-1",
    category: "system",
    eventType: GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
    correlationId: "lead-1",
    entityId: "lead-1",
    entityType: "lead",
    payload: { workflow_status: "research_complete" },
  } as never),
)

for (const eventType of Object.values(GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES)) {
  assert.equal(isRegisteredAiEventType(eventType), true, `${eventType} registered`)
}

const researchResolution = resolveRevenueDirectorDispatchCorrelationFromEvent({
  eventType: GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
  payload: { workflow_status: "research_complete" },
})
assert.equal(researchResolution?.requestTypes[0], "run_research")
assert.equal(researchResolution?.outcome, "completed")

const qualificationResolution = resolveRevenueDirectorDispatchCorrelationFromEvent({
  eventType: GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT,
  payload: { qualification_status: "qualified" },
})
assert.equal(qualificationResolution?.requestTypes[0], "rerun_qualification")

const outreachResolution = resolveRevenueDirectorDispatchCorrelationFromEvent({
  eventType: GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT,
  payload: { package_id: "pkg-1" },
})
assert.equal(outreachResolution?.requestTypes[0], "generate_outreach")

const planResolution = resolveRevenueDirectorDispatchCorrelationFromEvent({
  eventType: GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES.planGenerated,
  payload: { planId: "plan-1" },
})
assert.equal(planResolution?.requestTypes[0], "request_communication_plan")

assert.equal(
  resolveRevenueDirectorDispatchCorrelationFromEvent({
    eventType: "mission.completed",
    payload: {},
  }),
  null,
)

const dispatchedRequest = {
  id: "req-1",
  requestType: "run_research" as const,
  leadId: "lead-1",
  objectiveId: null,
  missionId: null,
  dispatchedAt: "2026-06-25T14:00:00.000Z",
}

const matched = matchRevenueDirectorDispatchedWorkflowRequest({
  requests: [dispatchedRequest],
  resolution: researchResolution!,
  event: {
    eventType: GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
    entityId: "lead-1",
    payload: { workflow_status: "research_complete" },
  },
})
assert.equal(matched?.id, "req-1")

const resultRef = extractRevenueDirectorDispatchCorrelationResultReference({
  eventType: GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES.planGenerated,
  entityId: "lead-1",
  payload: { planId: "plan-abc" },
})
assert.equal(resultRef?.id, "plan-abc")

assert.equal(
  resolveRevenueDirectorDispatchCorrelationReadStatus({
    workflowRequestStatus: "dispatched",
    dispatchedAt: "2026-06-20T14:00:00.000Z",
    generatedAt: "2026-06-25T14:00:00.000Z",
  }),
  "stale",
)

assert.equal(
  resolveRevenueDirectorDispatchCorrelationReadStatus({
    workflowRequestStatus: "completed",
    dispatchedAt: "2026-06-25T13:00:00.000Z",
    generatedAt: "2026-06-25T14:00:00.000Z",
  }),
  "completed",
)

const failureResolution = resolveRevenueDirectorDispatchCorrelationFromEvent({
  eventType: "agent.failed",
  payload: {},
})
assert.equal(failureResolution?.outcome, "failed")

console.log("[GE-AI-3C-PROD-1] Static certification passed — running GE-AI-3C regression")
execSync("pnpm test:ge-ai-3c-revenue-director-active-orchestration", {
  stdio: "inherit",
  timeout: 10 * 60 * 1000,
})

console.log("[GE-AI-3C-PROD-1] Dispatch completion correlation certification PASSED")
