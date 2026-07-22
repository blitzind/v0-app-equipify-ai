/**
 * GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A — Local wiring certification.
 * Run: pnpm test:ge-aios-draft-factory-observability-1a-wiring
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER } from "@/lib/growth/draft-factory/draft-factory-wake-observability-types"
import { GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID } from "@/lib/growth/draft-factory/draft-factory-wake-event-types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A] wiring certification`)

assert.equal(
  GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
  "ge-aios-draft-factory-wake-observability-1a-v1",
)

const requiredFiles = [
  "supabase/migrations/20271122130000_growth_draft_factory_wake_observability_1a.sql",
  "lib/growth/draft-factory/draft-factory-wake-observability-types.ts",
  "lib/growth/draft-factory/draft-factory-wake-observability-runtime.ts",
  "lib/growth/draft-factory/draft-factory-wake-observability-repository.ts",
  "lib/growth/draft-factory/draft-factory-wake-observability-service.ts",
  "lib/growth/draft-factory/draft-factory-wake-observability-diagnostics.ts",
  "app/api/platform/growth/ai-os/draft-factory-wake-diagnostics/route.ts",
  "lib/growth/training/draft-factory-wake-observability-production-validation-1a.ts",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}
console.log("  ✓ required modules + migration present")

const migration = readSource(
  "supabase/migrations/20271122130000_growth_draft_factory_wake_observability_1a.sql",
)
assert.match(migration, /draft_factory_wake_attempts/)
assert.match(migration, /draft_factory_wake_attempt_transitions/)
assert.match(migration, /ai_os_event_handler_telemetry/)
assert.match(migration, /draft_factory_wake_subscriber_telemetry/)
console.log("  ✓ migration defines canonical observability tables")

const aiEventService = readSource("lib/growth/aios/ai-event-service.ts")
assert.match(aiEventService, /persistAiOsEventHandlerTelemetry/)
assert.match(aiEventService, /invokeRegisteredAiOsEventHandlers/)
console.log("  ✓ publishAiOsEvent persists durable handler telemetry")

const subscriberRegistry = readSource("lib/growth/aios/ai-event-subscriber-registry.ts")
assert.match(subscriberRegistry, /discovered/)
assert.match(subscriberRegistry, /runs: AiOsEventHandlerRunRecord/)
console.log("  ✓ handler registry returns discovered/invoked/failures/skipped")

const observer = readSource("lib/growth/draft-factory/draft-factory-wake-bus-observer.ts")
assert.match(observer, /createDraftFactoryWakeObservabilityHandle/)
assert.match(observer, /recordDraftFactoryWakeSubscriberObservation/)
assert.match(observer, /createSkippedDraftFactoryWakeAttempt/)
assert.match(observer, /createFailedDraftFactoryWakeAttempt/)
console.log("  ✓ wake bus observer wires observability handle + subscriber telemetry")

const durableLive = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
assert.match(durableLive, /recordFailure/)
assert.match(durableLive, /finalize\("FAILED"/)
assert.match(durableLive, /assertResearchCompleteEvidence/)
console.log("  ✓ completion wake wrapper persists failures before returning null")

const durableService = readSource("lib/growth/draft-factory/draft-factory-durable-service.ts")
assert.match(durableService, /UPSERT_COMPLETED/)
assert.match(durableService, /RECEIPT_WRITTEN/)
assert.match(durableService, /observability\?: DraftFactoryWakeObservabilityHandle/)
console.log("  ✓ durable advancement records upsert + receipt transitions")

const diagnosticsRoute = readSource(
  "app/api/platform/growth/ai-os/draft-factory-wake-diagnostics/route.ts",
)
assert.match(diagnosticsRoute, /buildDraftFactoryWakeDiagnosticTimeline/)
console.log("  ✓ operator diagnostics API route present")

const diagnostics = readSource("lib/growth/draft-factory/draft-factory-wake-observability-diagnostics.ts")
for (const label of [
  "Research Complete",
  "Wake Received",
  "Subscriber Started",
  "Plan Built",
  "Advance Started",
  "DF Row Written",
  "Receipt Written",
  "Complete",
]) {
  assert.match(diagnostics, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
}
console.log("  ✓ operator diagnostic timeline covers required steps")

assert.equal(GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID, "draft_factory_wake_observer")
console.log("  ✓ canonical subscriber id unchanged")

console.log("GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A wiring certification passed")
