/**
 * GE-AIOS-2G — Executive Brain foundation certification.
 * Run: pnpm test:ge-aios-2g-executive-brain-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { AI_OS_RUNTIME_AGENTS } from "../lib/growth/aios/ai-agent-runtime-types"
import { aiExecutiveBrainSchemaCatalog } from "../lib/growth/aios/ai-executive-brain-repository"
import {
  AI_EXECUTIVE_BRAIN_RUNTIME_RULE,
  AI_EXECUTIVE_BRAIN_SUBSCRIBER_ID,
  GROWTH_AIOS_2G_PHASE,
  GROWTH_AI_EXECUTIVE_BRAIN_QA_MARKER,
  GROWTH_AI_EXECUTIVE_BRAIN_SCHEMA_MIGRATION,
  isExecutiveBrainHeartbeatStale,
} from "../lib/growth/aios/ai-executive-brain-types"
import {
  classifyExecutiveWorkOrderCounts,
  executiveWorkOrderDispatchPlan,
  isExecutiveMissionComplete,
  resolveExecutiveAgentForWorkOrderType,
} from "../lib/growth/aios/ai-executive-work-order-dispatcher"
import { lookupAiEventRegistryEntry } from "../lib/growth/aios/ai-event-registry"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_2G_PHASE}] Executive Brain foundation certification`)

assert.equal(GROWTH_AI_EXECUTIVE_BRAIN_QA_MARKER, "growth-aios-2g-executive-brain-v1")
assert.equal(GROWTH_AI_EXECUTIVE_BRAIN_SCHEMA_MIGRATION, "20271001170000_growth_aios_2g_executive_brain.sql")
assert.equal(AI_EXECUTIVE_BRAIN_SUBSCRIBER_ID, "executive_brain")
assert.equal(AI_OS_RUNTIME_AGENTS.includes("executive_brain" as never), false)

const dispatch = executiveWorkOrderDispatchPlan({ workOrderType: "verify_email" })
assert.equal(dispatch.ownerAgent, "executive_brain")
assert.equal(dispatch.assignedAgent, "qualification")
assert.equal(resolveExecutiveAgentForWorkOrderType("research_company"), "research")

const counts = classifyExecutiveWorkOrderCounts({
  statuses: ["issued", "executing", "completed", "completed"],
})
assert.equal(counts.pending, 1)
assert.equal(counts.active, 1)
assert.equal(counts.completed, 2)
assert.equal(isExecutiveMissionComplete({ pending: 0, active: 0, totalDelegations: 2 }), true)

assert.equal(isExecutiveBrainHeartbeatStale(new Date(Date.now() - 10 * 60 * 1000).toISOString()), true)
assert.equal(isExecutiveBrainHeartbeatStale(new Date().toISOString()), false)

const migration = readSource(`supabase/migrations/${GROWTH_AI_EXECUTIVE_BRAIN_SCHEMA_MIGRATION}`)
assert.ok(migration.includes("ai_executive_brain_runtime"))
assert.ok(migration.includes("ai_executive_mission_state"))
assert.ok(migration.includes("ai_executive_delegations"))
assert.ok(migration.includes("ai_executive_heartbeat_events"))
assert.ok(migration.includes("ai_executive_event_observations"))
assert.equal(migration.includes("'executive_brain'"), false)

const serviceSource = readSource("lib/growth/aios/ai-executive-brain-service.ts")
for (const pattern of [
  "openai",
  "anthropic",
  "apollo",
  "pdl",
  "llm",
  "runAiTask",
  "claimAiOsWorkOrder",
  "advanceWorkOrderToExecuting",
  "agent-orchestration",
  "growth-objective-runtime",
]) {
  assert.equal(serviceSource.toLowerCase().includes(pattern.toLowerCase()), false, `service must not reference ${pattern}`)
}
assert.ok(serviceSource.includes("createAiWorkOrder"))
assert.ok(serviceSource.includes("executive.delegated"))
assert.equal(serviceSource.includes("claimAiOsWorkOrder"), false)

const executiveFiles = [
  "lib/growth/aios/ai-executive-brain-types.ts",
  "lib/growth/aios/ai-executive-work-order-dispatcher.ts",
  "lib/growth/aios/ai-executive-brain-repository.ts",
  "lib/growth/aios/ai-executive-brain-service.ts",
  "lib/growth/aios/ai-executive-brain-event-handler.ts",
  "lib/growth/aios/ai-executive-brain-health.ts",
  "lib/growth/aios/ai-executive-brain-schema-health.ts",
]
for (const file of executiveFiles) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

assert.ok(AI_EXECUTIVE_BRAIN_RUNTIME_RULE.includes("never claims"))
assert.ok(lookupAiEventRegistryEntry("executive.started"))
assert.ok(lookupAiEventRegistryEntry("executive.delegated"))
assert.ok(lookupAiEventRegistryEntry("executive.monitored"))
assert.ok(lookupAiEventRegistryEntry("executive.escalated"))
assert.ok(lookupAiEventRegistryEntry("executive.completed"))

assert.equal(aiExecutiveBrainSchemaCatalog().qaMarker, GROWTH_AI_EXECUTIVE_BRAIN_QA_MARKER)

console.log(`[${GROWTH_AIOS_2G_PHASE}] PASS — Executive Brain foundation certified (local)`)
