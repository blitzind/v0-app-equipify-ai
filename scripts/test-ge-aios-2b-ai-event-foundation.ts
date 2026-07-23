/**
 * GE-AIOS-2B — AI Event foundation certification.
 * Run: pnpm test:ge-aios-2b-ai-event-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AI_EVENT_CATEGORIES,
  AI_EVENT_SCHEMA_VERSION,
  AI_OS_LOOSE_COUPLING_RULE,
  GROWTH_AIOS_2B_PHASE,
  GROWTH_AI_EVENT_QA_MARKER,
  GROWTH_AI_EVENT_SCHEMA_MIGRATION,
  clampAiEventPriority,
} from "../lib/growth/aios/ai-event-types"
import {
  AI_EVENT_REGISTRY,
  eventTypeMatchesPrefix,
  lookupAiEventRegistryEntry,
  subscriptionMatchesEvent,
} from "../lib/growth/aios/ai-event-registry"
import { aiEventSchemaCatalog } from "../lib/growth/aios/ai-event-repository"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_2B_PHASE}] AI Event foundation certification`)

assert.equal(GROWTH_AI_EVENT_QA_MARKER, "growth-aios-2b-ai-event-v1")
assert.equal(GROWTH_AI_EVENT_SCHEMA_MIGRATION, "20271001130000_growth_aios_2b_ai_events.sql")
assert.equal(AI_EVENT_SCHEMA_VERSION, "1.0")
assert.equal(AI_EVENT_CATEGORIES.length, 15)
assert.ok(AI_EVENT_REGISTRY.some((entry) => entry.eventType === "work_order.created"))
assert.ok(AI_EVENT_REGISTRY.some((entry) => entry.eventType === "decision.approval_expired"))
assert.ok(AI_EVENT_REGISTRY.some((entry) => entry.eventType === "meta_recommender.conflict_resolved"))
assert.equal(clampAiEventPriority(2000), 1000)

const workOrderCreated = lookupAiEventRegistryEntry("work_order.created")
assert.ok(workOrderCreated)
assert.equal(workOrderCreated?.category, "work_order")

assert.equal(
  subscriptionMatchesEvent(
    { categories: ["work_order"], eventTypePrefixes: ["work_order"] },
    { category: "work_order", eventType: "work_order.status_changed" },
  ),
  true,
)
assert.equal(eventTypeMatchesPrefix("work_order.created", "work_order"), true)
assert.equal(
  subscriptionMatchesEvent(
    { categories: ["mission"], eventTypePrefixes: [] },
    { category: "work_order", eventType: "work_order.created" },
  ),
  false,
)

const migration = readSource(`supabase/migrations/${GROWTH_AI_EVENT_SCHEMA_MIGRATION}`)
assert.ok(migration.includes("growth.ai_os_events"))
assert.ok(migration.includes("growth.ai_os_event_subscriptions"))
assert.ok(migration.includes("growth.ai_os_event_deliveries"))
assert.ok(migration.includes("growth.ai_os_event_archive_records"))
assert.ok(migration.includes("correlation_id"))
assert.ok(migration.includes("causation_id"))
assert.ok(migration.includes("replay_key"))
assert.equal(migration.includes("grant update on table growth.ai_os_events"), false)
assert.equal(migration.includes("grant delete on table growth.ai_os_events"), false)

const serviceSource = readSource("lib/growth/aios/ai-event-service.ts")
const bridgeSource = readSource("lib/growth/aios/ai-event-bridge.ts")
const repositorySource = readSource("lib/growth/aios/ai-event-repository.ts")
for (const pattern of ["openai", "anthropic", "apollo", "pdl", "websocket", "executive-brain"]) {
  assert.equal(serviceSource.toLowerCase().includes(pattern), false, `service must not reference ${pattern}`)
  assert.equal(bridgeSource.toLowerCase().includes(pattern), false, `bridge must not reference ${pattern}`)
}
assert.ok(serviceSource.includes("@fuzor/event-bus"))
assert.ok(repositorySource.includes("@fuzor/event-bus"))

const aiosEventFiles = [
  "lib/growth/aios/ai-event-types.ts",
  "lib/growth/aios/ai-event-registry.ts",
  "lib/growth/aios/ai-event-repository.ts",
  "lib/growth/aios/ai-event-service.ts",
  "lib/growth/aios/ai-event-bridge.ts",
  "lib/growth/aios/ai-event-subscriber-registry.ts",
  "lib/growth/aios/ai-event-schema-health.ts",
]
const coreForbidden = [
  "public.invoices",
  "public.quotes",
  "public.customers",
  "blitzpay",
  "from \"@/app/(portal)",
]
for (const file of aiosEventFiles) {
  assertNoCoreTouch(file, coreForbidden)
}

assert.ok(AI_OS_LOOSE_COUPLING_RULE.includes("SHALL NOT directly invoke"))

const catalog = aiEventSchemaCatalog()
assert.equal(catalog.qaMarker, GROWTH_AI_EVENT_QA_MARKER)
assert.equal(catalog.categories.length, 15)

console.log(`[${GROWTH_AIOS_2B_PHASE}] PASS — AI Event foundation certified (local)`)
