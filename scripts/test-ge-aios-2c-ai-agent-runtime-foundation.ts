/**
 * GE-AIOS-2C — AI Agent Runtime foundation certification.
 * Run: pnpm test:ge-aios-2c-ai-agent-runtime-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { aiAgentCapabilityCatalog } from "../lib/growth/aios/ai-agent-runtime-capabilities"
import { aiAgentRuntimeSchemaCatalog } from "../lib/growth/aios/ai-agent-runtime-repository"
import {
  AI_OS_AGENT_RUNTIME_COUPLING_RULE,
  AI_OS_AGENT_RUNTIME_STATUSES,
  AI_OS_RUNTIME_AGENTS,
  GROWTH_AIOS_2C_PHASE,
  GROWTH_AI_AGENT_RUNTIME_QA_MARKER,
  GROWTH_AI_AGENT_RUNTIME_SCHEMA_MIGRATION,
  isAgentHeartbeatStale,
} from "../lib/growth/aios/ai-agent-runtime-types"
import {
  buildClaimTransitionPath,
  canAgentRuntimeClaimWorkOrderStatus,
} from "../lib/growth/aios/ai-agent-runtime-work-order"
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

console.log(`[${GROWTH_AIOS_2C_PHASE}] AI Agent Runtime foundation certification`)

assert.equal(GROWTH_AI_AGENT_RUNTIME_QA_MARKER, "growth-aios-2c-ai-agent-runtime-v1")
assert.equal(GROWTH_AI_AGENT_RUNTIME_SCHEMA_MIGRATION, "20271001140000_growth_aios_2c_ai_agent_runtime.sql")
assert.equal(AI_OS_RUNTIME_AGENTS.length, 16)
assert.equal(AI_OS_AGENT_RUNTIME_STATUSES.length, 9)
assert.ok(AI_OS_RUNTIME_AGENTS.includes("research"))
assert.equal(AI_OS_RUNTIME_AGENTS.includes("executive_brain" as never), false)

assert.deepEqual(buildClaimTransitionPath("issued"), ["planning", "awaiting_decision", "executing"])
assert.deepEqual(buildClaimTransitionPath("awaiting_approval"), ["executing"])
assert.equal(canAgentRuntimeClaimWorkOrderStatus("executing"), false)
assert.equal(canAgentRuntimeClaimWorkOrderStatus("issued"), true)

assert.equal(isAgentHeartbeatStale(new Date(Date.now() - 10 * 60 * 1000).toISOString()), true)
assert.equal(isAgentHeartbeatStale(new Date().toISOString()), false)

const migration = readSource(`supabase/migrations/${GROWTH_AI_AGENT_RUNTIME_SCHEMA_MIGRATION}`)
assert.ok(migration.includes("ai_os_agent_registrations"))
assert.ok(migration.includes("ai_os_agent_capabilities"))
assert.ok(migration.includes("ai_os_agent_leases"))
assert.ok(migration.includes("ai_os_agent_heartbeat_events"))
assert.equal(migration.includes("executive_brain"), false)

const serviceSource = readSource("lib/growth/aios/ai-agent-runtime-service.ts")
for (const pattern of ["openai", "anthropic", "apollo", "pdl", "llm", "executive-brain", "agent-orchestration"]) {
  assert.equal(serviceSource.toLowerCase().includes(pattern), false, `service must not reference ${pattern}`)
}
assert.ok(serviceSource.includes("publishAiOsEvent"))
assert.equal(serviceSource.includes("fetchGrowthAgentOrchestration"), false)

const runtimeFiles = [
  "lib/growth/aios/ai-agent-runtime-types.ts",
  "lib/growth/aios/ai-agent-runtime-capabilities.ts",
  "lib/growth/aios/ai-agent-runtime-work-order.ts",
  "lib/growth/aios/ai-agent-runtime-repository.ts",
  "lib/growth/aios/ai-agent-runtime-service.ts",
  "lib/growth/aios/ai-agent-runtime-health.ts",
  "lib/growth/aios/ai-agent-runtime-schema-health.ts",
]
for (const file of runtimeFiles) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

assert.ok(AI_OS_AGENT_RUNTIME_COUPLING_RULE.includes("SHALL NOT call other agents directly"))
assert.ok(lookupAiEventRegistryEntry("agent.lease_claimed"))
assert.ok(lookupAiEventRegistryEntry("agent.unhealthy"))

const capabilityCatalog = aiAgentCapabilityCatalog()
assert.ok(capabilityCatalog.mappings.research.includes("research_company"))

const schemaCatalog = aiAgentRuntimeSchemaCatalog()
assert.equal(schemaCatalog.runtimeAgents.length, 16)

console.log(`[${GROWTH_AIOS_2C_PHASE}] PASS — AI Agent Runtime foundation certified (local)`)
