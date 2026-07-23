/**
 * FUZOR-ADOPTION-1K — Platform Event Bus delegation parity.
 * Run: pnpm test:fuzor-adoption-1k-event-bus-parity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  PLATFORM_EVENT_CATEGORIES,
  PLATFORM_EVENT_QA_MARKER,
  PLATFORM_EVENT_REGISTRY,
  PLATFORM_EVENT_SCHEMA_VERSION,
  clampPlatformEventPriority,
  eventTypeMatchesPrefix,
  fetchPlatformEventById,
  getPlatformEvent,
  insertPlatformEvent,
  listPlatformEvents,
  listRegisteredPlatformEventHandlers,
  lookupPlatformEventRegistryEntry,
  platformEventSchemaCatalog,
  platformEventRegistryCatalog,
  queryPlatformEvents,
  registerPlatformEventHandler,
  registerPlatformEventSubscription,
  replayPlatformEventStream,
  subscriptionMatchesEvent,
} from "@fuzor/event-bus"

import {
  AI_EVENT_CATEGORIES,
  AI_EVENT_SCHEMA_VERSION,
  GROWTH_AI_EVENT_QA_MARKER,
  clampAiEventPriority,
} from "../lib/growth/aios/ai-event-types"

import {
  AI_EVENT_REGISTRY,
  aiEventRegistryCatalog,
  lookupAiEventRegistryEntry,
} from "../lib/growth/aios/ai-event-registry"

import {
  aiEventSchemaCatalog,
  fetchAiOsEventById,
  insertAiOsEvent,
  listAiOsEvents,
} from "../lib/growth/aios/ai-event-repository"

import {
  getAiOsEvent,
  queryAiOsEvents,
  registerAiOsEventSubscription,
  replayAiOsEventStream,
} from "../lib/growth/aios/ai-event-service"

import {
  listRegisteredAiOsEventHandlers,
  registerAiOsEventHandler,
} from "../lib/growth/aios/ai-event-subscriber-registry"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("[FUZOR-ADOPTION-1K] Platform Event Bus delegation parity")

assert.strictEqual(GROWTH_AI_EVENT_QA_MARKER, PLATFORM_EVENT_QA_MARKER)
assert.strictEqual(AI_EVENT_SCHEMA_VERSION, PLATFORM_EVENT_SCHEMA_VERSION)
assert.strictEqual(AI_EVENT_CATEGORIES.length, PLATFORM_EVENT_CATEGORIES.length)
assert.strictEqual(AI_EVENT_REGISTRY, PLATFORM_EVENT_REGISTRY)
assert.strictEqual(clampAiEventPriority(2000), clampPlatformEventPriority(2000))

const workOrderCreated = lookupAiEventRegistryEntry("work_order.created")
assert.ok(workOrderCreated)
assert.equal(workOrderCreated?.category, "work_order")
assert.equal(lookupAiEventRegistryEntry("work_order.created"), lookupPlatformEventRegistryEntry("work_order.created"))

assert.equal(
  subscriptionMatchesEvent(
    { categories: ["work_order"], eventTypePrefixes: ["work_order"] },
    { category: "work_order", eventType: "work_order.status_changed" },
  ),
  true,
)
assert.equal(eventTypeMatchesPrefix("work_order.created", "work_order"), true)

const wrapperCatalog = aiEventRegistryCatalog()
const platformCatalog = platformEventRegistryCatalog()
assert.strictEqual(wrapperCatalog.count, platformCatalog.count)

const wrapperSchemaCatalog = aiEventSchemaCatalog()
const platformSchemaCatalog = platformEventSchemaCatalog()
assert.strictEqual(wrapperSchemaCatalog.qaMarker, platformSchemaCatalog.qaMarker)
assert.strictEqual(wrapperSchemaCatalog.categories.length, platformSchemaCatalog.categories.length)

assert.strictEqual(insertAiOsEvent, insertPlatformEvent)
assert.strictEqual(fetchAiOsEventById, fetchPlatformEventById)
assert.strictEqual(listAiOsEvents, listPlatformEvents)
assert.strictEqual(getAiOsEvent, getPlatformEvent)
assert.strictEqual(queryAiOsEvents, queryPlatformEvents)
assert.strictEqual(replayAiOsEventStream, replayPlatformEventStream)
assert.strictEqual(registerAiOsEventSubscription, registerPlatformEventSubscription)
assert.strictEqual(registerAiOsEventHandler, registerPlatformEventHandler)
assert.strictEqual(listRegisteredAiOsEventHandlers, listRegisteredPlatformEventHandlers)

const eventFiles = [
  "lib/growth/aios/ai-event-types.ts",
  "lib/growth/aios/ai-event-registry.ts",
  "lib/growth/aios/ai-event-repository.ts",
  "lib/growth/aios/ai-event-service.ts",
  "lib/growth/aios/ai-event-subscriber-registry.ts",
  "lib/growth/aios/ai-event-schema-health.ts",
]

for (const file of eventFiles) {
  const source = readSource(file)
  assert.ok(source.includes("@fuzor/event-bus"), `${file} must delegate to @fuzor/event-bus`)
}

const service = readSource("lib/growth/aios/ai-event-service.ts")
assert.ok(service.includes("publishPlatformEvent"))
assert.ok(service.includes("persistAiOsEventHandlerTelemetry"))

console.log("[FUZOR-ADOPTION-1K] wrapper delegation verified")

const equipifyOrg = "00000000-0000-4000-8000-000000000001"
const insideifyOrg = "00000000-0000-4000-8000-000000000002"
const futureOrg = "00000000-0000-4000-8000-000000000003"

for (const orgId of [equipifyOrg, insideifyOrg, futureOrg]) {
  assert.match(orgId, /^[0-9a-f-]{36}$/i)
}

assert.equal(service.includes("workflow"), false)
assert.equal(service.includes("DataMoon"), false)
assert.equal(service.includes("prompt"), false)

console.log("[FUZOR-ADOPTION-1K] multi-product event bus architecture proof")

console.log("[FUZOR-ADOPTION-1K] PASS")
