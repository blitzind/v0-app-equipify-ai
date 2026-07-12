/**
 * GE-AIOS-AUTONOMY-1B — Canonical Wake Wiring certification.
 * Run: pnpm test:ge-aios-autonomy-1b-canonical-wake-wiring
 *
 * Certifies: Draft Factory bus observer, objective-scheduler due/capacity sub-tick,
 * completion emitters, reuse of existing runtime (no new engine).
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AI_EVENT_QA_MARKER } from "../lib/growth/aios/ai-event-types"
import { AI_EVENT_REGISTRY, isRegisteredAiEventType } from "../lib/growth/aios/ai-event-registry"
import {
  GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS,
  growthAiEventBusSubscriberObservesEvent,
} from "../lib/growth/aios/event-bus/growth-ai-event-bus-engine"
import {
  GROWTH_AI_EVENT_BUS_SUBSCRIBER_IDS,
} from "../lib/growth/aios/event-bus/growth-ai-event-bus-types"
import {
  clearGrowthAiEventBusSubscribersForTests,
  ensureGrowthAiEventBusInProcessSubscribers,
  listGrowthAiEventBusRegisteredSubscribers,
} from "../lib/growth/aios/event-bus/growth-ai-event-bus-subscriber-registry"
import { clearAiOsEventHandlersForTests } from "../lib/growth/aios/ai-event-subscriber-registry"
import { mapAiOsEventToDraftFactoryWakePlans } from "../lib/growth/draft-factory/draft-factory-wake-event-mapper"
import {
  GROWTH_AIOS_AUTONOMY_1B_PHASE,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
  GROWTH_DRAFT_FACTORY_WAKE_BUS_QA_MARKER,
  GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID,
  GROWTH_DRAFT_FACTORY_WAKE_EVENT_TYPES,
} from "../lib/growth/draft-factory/draft-factory-wake-event-types"
import type { AiOsEvent } from "../lib/growth/aios/ai-event-types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleEvent(overrides: Partial<AiOsEvent> = {}): AiOsEvent {
  return {
    id: "evt-1",
    eventType: "growth.workflow.status_changed",
    eventVersion: 1,
    schemaVersion: "1.0",
    category: "system",
    organizationId: "org-1",
    missionId: null,
    workOrderId: null,
    agentOwner: null,
    entityType: "lead",
    entityId: "lead-1",
    correlationId: "corr-1",
    causationId: null,
    priority: 500,
    producer: "test",
    source: "test",
    payload: { workflow_status: "research_complete", research_run_id: "run-1" },
    metadata: {},
    auditMetadata: {},
    lifecycle: "published",
    replayable: true,
    replayKey: null,
    occurredAt: "2026-07-12T20:00:00.000Z",
    createdAt: "2026-07-12T20:00:00.000Z",
    qaMarker: GROWTH_AI_EVENT_QA_MARKER,
    ...overrides,
  }
}

console.log(`[${GROWTH_AIOS_AUTONOMY_1B_PHASE}] Canonical Wake Wiring certification`)

assert.equal(GROWTH_DRAFT_FACTORY_WAKE_BUS_QA_MARKER, "ge-aios-autonomy-1b-draft-factory-wake-bus-v1")
assert.equal(GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID, "draft_factory_wake_observer")
assert.equal(GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER, "ge-aios-autonomy-1b-draft-factory-due-scheduler-v1")

const requiredFiles = [
  "lib/growth/draft-factory/draft-factory-wake-event-types.ts",
  "lib/growth/draft-factory/draft-factory-wake-event-mapper.ts",
  "lib/growth/draft-factory/draft-factory-wake-bus-observer.ts",
  "lib/growth/draft-factory/draft-factory-wake-emitters.ts",
  "lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts",
  "docs/GE-AIOS-AUTONOMY-1B_CANONICAL_WAKE_WIRING.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}
console.log("  ✓ required modules + docs present")

// Subscriber registered on existing bus — not a parallel system
assert.ok(GROWTH_AI_EVENT_BUS_SUBSCRIBER_IDS.includes("draft_factory_wake_observer"))
assert.ok(
  GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS.some(
    (row) => row.subscriberId === "draft_factory_wake_observer",
  ),
)

clearAiOsEventHandlersForTests()
clearGrowthAiEventBusSubscribersForTests()
ensureGrowthAiEventBusInProcessSubscribers()
assert.ok(listGrowthAiEventBusRegisteredSubscribers().includes("draft_factory_wake_observer"))
assert.equal(
  growthAiEventBusSubscriberObservesEvent(
    "draft_factory_wake_observer",
    sampleEvent(),
  ),
  true,
)
console.log("  ✓ draft_factory_wake_observer registered on AI OS Event Bus")

// Mapper: research complete → one lead wake
const researchPlans = mapAiOsEventToDraftFactoryWakePlans(sampleEvent())
assert.equal(researchPlans.length, 1)
assert.equal(researchPlans[0]?.kind, "lead")
if (researchPlans[0]?.kind === "lead") {
  assert.equal(researchPlans[0].wakeType, "research_completed")
  assert.equal(researchPlans[0].leadId, "lead-1")
  assert.equal(researchPlans[0].sourceId, "run-1")
}

const approvalPlans = mapAiOsEventToDraftFactoryWakePlans(
  sampleEvent({
    eventType: "growth.execution_plan.review_changed",
    category: "approval",
    payload: { lead_id: "lead-1", review_action: "approve", plan_id: "plan-1" },
  }),
)
assert.equal(approvalPlans[0]?.kind, "lead")
if (approvalPlans[0]?.kind === "lead") {
  assert.equal(approvalPlans[0].wakeType, "approval_approved")
}

const capacityPlans = mapAiOsEventToDraftFactoryWakePlans(
  sampleEvent({
    eventType: "growth.capacity.available",
    entityType: "system",
    entityId: "org-1",
    payload: {},
  }),
)
assert.equal(capacityPlans[0]?.kind, "org_capacity")

const ignored = mapAiOsEventToDraftFactoryWakePlans(
  sampleEvent({ eventType: "agent.heartbeat", category: "agent", payload: {} }),
)
assert.equal(ignored.length, 0)
console.log("  ✓ event → wake mapper (one stage per lead plan)")

// Registry coverage for new wake events
for (const eventType of GROWTH_DRAFT_FACTORY_WAKE_EVENT_TYPES) {
  assert.ok(isRegisteredAiEventType(eventType), `${eventType} must be registered`)
}
assert.ok(AI_EVENT_REGISTRY.some((row) => row.eventType === "growth.company_intelligence.completed"))
console.log("  ✓ wake event types registered in AI OS event registry")

// Scheduler sub-tick (no new cron)
const scheduler = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
assert.ok(scheduler.includes("tickDraftFactoryDueStatesForScheduler"))
assert.ok(scheduler.includes("listDueDraftFactoryStates") === false) // tick module owns the call
assert.ok(scheduler.includes("draftFactoryDue"))

const dueTick = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
assert.ok(dueTick.includes("listDueDraftFactoryStates"))
assert.ok(dueTick.includes("advanceDraftFactoryCapacityWake"))
assert.ok(dueTick.includes("planWakeEvaluationBatch"))
assert.ok(dueTick.includes("getRuntimeKillSwitchStates"))

const vercel = readSource("vercel.json")
assert.ok(!vercel.includes("draft-factory"))
assert.ok(!vercel.includes("draft_factory"))
console.log("  ✓ due/capacity sub-tick on objective runtime scheduler (no new cron)")

// Emitters wired
const emitters = [
  ["lib/growth/company-intelligence/company-intelligence-queue.ts", "publishDraftFactoryCompanyIntelligenceCompleted"],
  ["lib/growth/datamoon-decision-maker/datamoon-dm-service.ts", "publishDraftFactoryDatamoonPersonCompleted"],
  ["lib/growth/contact-discovery/company-contact-repository.ts", "publishDraftFactoryContactVerified"],
  ["lib/growth/personalization/dashboard.ts", "publishDraftFactoryPersonalizationCompleted"],
  ["lib/growth/objectives/growth-objective-service.ts", "publishDraftFactoryMissionChanged"],
  ["lib/growth/business-profile/business-profile-service.ts", "publishDraftFactoryCompanyProfileChanged"],
  ["lib/growth/runtime-guardrails/growth-runtime-budget-service.ts", "publishDraftFactoryBudgetWindowReset"],
  ["lib/growth/research/growth-lead-research-execution-service.ts", "publishDraftFactoryResearchBecameStale"],
]
for (const [file, token] of emitters) {
  assert.ok(readSource(file).includes(token), `${file} must emit ${token}`)
}
console.log("  ✓ completion emitters wired")

// Reuse constraints — no new engines
const observer = readSource("lib/growth/draft-factory/draft-factory-wake-bus-observer.ts")
assert.ok(observer.includes("wakeDraftFactoryFromCompletionEvent"))
assert.ok(observer.includes("advanceDraftFactoryCapacityWake"))
assert.ok(!observer.includes("createEventBus"))
assert.ok(!observer.includes("new Scheduler"))

const forbiddenNewSystems = [
  "Inngest",
  "Trigger.dev",
  "BullMQ",
  "createWakeDispatcherEngine",
]
for (const token of forbiddenNewSystems) {
  assert.ok(!observer.includes(token), `must not introduce ${token}`)
  assert.ok(!dueTick.includes(token), `must not introduce ${token}`)
}
console.log("  ✓ no parallel event bus / scheduler / orchestration engine")

// Research path uses bus, not direct wake
const research = readSource("lib/growth/research/growth-lead-research-execution-service.ts")
assert.ok(!research.includes("wakeDraftFactoryFromCompletionEvent"))
assert.ok(research.includes("GE-AIOS-AUTONOMY-1B"))

console.log(`[${GROWTH_AIOS_AUTONOMY_1B_PHASE}] PASS`)
