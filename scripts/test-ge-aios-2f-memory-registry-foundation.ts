/**
 * GE-AIOS-2F — Memory Registry foundation certification.
 * Run: pnpm test:ge-aios-2f-memory-registry-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { lookupAiEventRegistryEntry } from "../lib/growth/aios/ai-event-registry"
import { aiMemoryRegistrySchemaCatalog } from "../lib/growth/aios/ai-memory-registry-repository"
import {
  AI_MEMORY_REGISTRY_RUNTIME_RULE,
  AI_MEMORY_REGISTRY_TYPES,
  GROWTH_AIOS_2F_PHASE,
  GROWTH_AI_MEMORY_REGISTRY_QA_MARKER,
  GROWTH_AI_MEMORY_REGISTRY_SCHEMA_MIGRATION,
  isAiMemoryRegistryType,
  normalizeMemorySourceRef,
} from "../lib/growth/aios/ai-memory-registry-types"
import {
  aiMemorySourceBindingCatalog,
  lookupAiMemorySourceBinding,
} from "../lib/growth/aios/ai-memory-source-registry"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_2F_PHASE}] Memory Registry foundation certification`)

assert.equal(GROWTH_AI_MEMORY_REGISTRY_QA_MARKER, "growth-aios-2f-memory-registry-v1")
assert.equal(GROWTH_AI_MEMORY_REGISTRY_SCHEMA_MIGRATION, "20271001160000_growth_aios_2f_memory_registry.sql")
assert.equal(AI_MEMORY_REGISTRY_TYPES.length, 11)
assert.ok(isAiMemoryRegistryType("lead"))
assert.equal(isAiMemoryRegistryType("vector_embedding"), false)

const leadBinding = lookupAiMemorySourceBinding("lead")
assert.ok(leadBinding)
assert.equal(leadBinding?.sourceTable, "growth.lead_memory_profiles")

const decisionBinding = lookupAiMemorySourceBinding("decision")
assert.ok(decisionBinding)
assert.equal(decisionBinding?.sourceTable, "growth.ai_decision_records")

const migration = readSource(`supabase/migrations/${GROWTH_AI_MEMORY_REGISTRY_SCHEMA_MIGRATION}`)
assert.ok(migration.includes("growth.ai_memory_registry"))
assert.ok(migration.includes("growth.ai_memory_registry_events"))
assert.ok(migration.includes("memory_type"))
assert.ok(migration.includes("source_system"))
assert.ok(migration.includes("source_table"))
const migrationBody = migration.replace(/^--.*$/gm, "")
assert.equal(migrationBody.toLowerCase().includes("pgvector"), false)
assert.equal(migrationBody.toLowerCase().includes("embedding"), false)
assert.equal(migration.includes("grant delete on table growth.ai_memory_registry_events"), false)

const serviceSource = readSource("lib/growth/aios/ai-memory-registry-service.ts")
for (const pattern of [
  "openai",
  "anthropic",
  "apollo",
  "pdl",
  "llm",
  "executive-brain",
  "learning_engine",
  "runAiTask",
  "summarize",
]) {
  assert.equal(serviceSource.toLowerCase().includes(pattern), false, `service must not reference ${pattern}`)
}
assert.ok(serviceSource.includes("@fuzor/memory"))
assert.ok(serviceSource.includes("linkPlatformMemoryRegistryToWorkOrder"))
assert.ok(serviceSource.includes("registerPlatformMemoryRegistryEntry"))
assert.equal(serviceSource.includes(".insert("), false, "service must not insert into source stores")

const memoryFiles = [
  "lib/growth/aios/ai-memory-registry-types.ts",
  "lib/growth/aios/ai-memory-source-registry.ts",
  "lib/growth/aios/ai-memory-registry-repository.ts",
  "lib/growth/aios/ai-memory-registry-service.ts",
  "lib/growth/aios/ai-memory-registry-schema-health.ts",
]
for (const file of memoryFiles) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

assert.ok(AI_MEMORY_REGISTRY_RUNTIME_RULE.includes("does not summarize"))
assert.ok(lookupAiEventRegistryEntry("memory.registered"))
assert.ok(lookupAiEventRegistryEntry("memory.referenced"))
assert.ok(lookupAiEventRegistryEntry("memory.linked"))
assert.ok(lookupAiEventRegistryEntry("memory.archived"))

const sourceRef = normalizeMemorySourceRef({
  source_system: "lead_memory",
  source_table: "growth.lead_memory_profiles",
  source_record_id: "abc-123",
})
assert.ok(sourceRef)
assert.equal(sourceRef?.sourceSystem, "lead_memory")

assert.equal(aiMemorySourceBindingCatalog().count, 11)
assert.equal(aiMemoryRegistrySchemaCatalog().memoryTypes.length, 11)

console.log(`[${GROWTH_AIOS_2F_PHASE}] PASS — Memory Registry foundation certified (local)`)
