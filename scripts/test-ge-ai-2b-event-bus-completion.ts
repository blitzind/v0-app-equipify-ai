/**
 * GE-AI-2B — AI Revenue OS Event Bus completion certification.
 * Run: pnpm test:ge-ai-2b-event-bus-completion
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { clearAiOsEventHandlersForTests } from "../lib/growth/aios/ai-event-subscriber-registry"
import { AI_EVENT_REGISTRY } from "../lib/growth/aios/ai-event-registry"
import { GROWTH_AI_EVENT_QA_MARKER } from "../lib/growth/aios/ai-event-types"
import {
  GROWTH_AI_EVENT_BUS_BRIDGE_SOURCES_WIRED,
  GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS,
  growthAiEventBusSubscriberObservesEvent,
  resetGrowthAiEventBusObservationForTests,
  resolveWorkflowLifecycleAlias,
  synthesizeGrowthAiEventBusHealthReadModel,
} from "../lib/growth/aios/event-bus/growth-ai-event-bus-engine"
import {
  aiOsEventToGrowthAiEvent,
  GROWTH_AIOS_GE_AI_2B_PHASE,
  GROWTH_AI_EVENT_BUS_QA_MARKER,
  GROWTH_AI_EVENT_BUS_RULE,
  GROWTH_AI_WORKFLOW_LIFECYCLE_ALIASES,
  growthAiEventToAiOsPublishInput,
} from "../lib/growth/aios/event-bus/growth-ai-event-bus-types"
import {
  clearGrowthAiEventBusSubscribersForTests,
  ensureGrowthAiEventBusInProcessSubscribers,
  listGrowthAiEventBusRegisteredSubscribers,
} from "../lib/growth/aios/event-bus/growth-ai-event-bus-subscriber-registry"
import { mapAiOsEventTypeToAgentEventType } from "../lib/growth/aios/growth/growth-agent-event-engine"
import { GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT } from "../lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import { GROWTH_AUTONOMOUS_PLANNING_EXECUTION_PLAN_GENERATED_EVENT } from "../lib/growth/aios/growth/growth-autonomous-planning-pilot-types"
import { GROWTH_AUTONOMOUS_EXECUTION_ENQUEUED_EVENT } from "../lib/growth/aios/growth/growth-autonomous-execution-pilot-types"
import { GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { GROWTH_AUTONOMOUS_MEETING_PREPARED_EVENT } from "../lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"
import type { AiOsEvent } from "../lib/growth/aios/ai-event-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

function sampleAiOsEvent(overrides: Partial<AiOsEvent> = {}): AiOsEvent {
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
    correlationId: "corr-abc",
    causationId: null,
    priority: 500,
    producer: "growth_lead_research_workflow",
    source: "growth_lead_research_workflow_service",
    payload: { agent_kind: "research_agent" },
    metadata: { trace_id: "trace-abc" },
    auditMetadata: {},
    lifecycle: "published",
    replayable: true,
    replayKey: null,
    occurredAt: "2026-06-25T12:00:00.000Z",
    createdAt: "2026-06-25T12:00:00.000Z",
    qaMarker: GROWTH_AI_EVENT_QA_MARKER,
    ...overrides,
  }
}

console.log(`[${GROWTH_AIOS_GE_AI_2B_PHASE}] Event Bus completion certification`)

assert.equal(GROWTH_AI_EVENT_BUS_QA_MARKER, "growth-ge-ai-2b-event-bus-completion-v1")
assert.ok(GROWTH_AI_EVENT_BUS_RULE.includes("subscribe without direct agent coupling"))

const requiredFiles = [
  "lib/growth/aios/event-bus/growth-ai-event-bus-types.ts",
  "lib/growth/aios/event-bus/growth-ai-event-bus-engine.ts",
  "lib/growth/aios/event-bus/growth-ai-event-bus-service.ts",
  "lib/growth/aios/event-bus/growth-ai-event-bus-subscriber-registry.ts",
  "docs/GE-AI-2B_EVENT_BUS_COMPLETION.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const serviceSource = readSource("lib/growth/aios/event-bus/growth-ai-event-bus-service.ts")
assert.ok(serviceSource.includes('import "server-only"'))
assert.ok(serviceSource.includes("publishGrowthAiEvent"))
assert.ok(serviceSource.includes("bridgeAiWorkOrderAuditToEventBus"))
assert.ok(serviceSource.includes("bridgeObjectiveSourceToEventBus"))
assert.ok(serviceSource.includes("bridgeRealtimeEnvelopeToEventBus"))

const workOrderService = readSource("lib/growth/aios/ai-work-order-service.ts")
assert.ok(workOrderService.includes("bridgeAiWorkOrderAuditToEventBus"))

const objectiveRouter = readSource("lib/growth/objectives/growth-objective-event-router.ts")
assert.ok(objectiveRouter.includes("bridgeObjectiveSourceToEventBus"))

const realtimeService = readSource("lib/growth/realtime-events/realtime-events-service.ts")
assert.ok(realtimeService.includes("bridgeRealtimeEnvelopeToEventBus"))

const subscriberRegistry = readSource("lib/growth/aios/ai-event-subscriber-registry.ts")
assert.ok(subscriberRegistry.includes("failures"))

const commandCenterService = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenterService.includes("eventBusHealth"))
assert.ok(commandCenterService.includes("ensureGrowthAiEventBusForOrganization"))

const commandCenterTypes = readSource("lib/growth/aios/ai-os-command-center-types.ts")
assert.ok(commandCenterTypes.includes("eventBusHealth: GrowthAiEventBusHealthReadModel"))

const operationsDashboard = readSource("lib/growth/aios/ai-os-operations-dashboard-synthesizer.ts")
assert.ok(operationsDashboard.includes('id: "event-bus"'))

const coreForbidden = [
  "public.invoices",
  "public.quotes",
  "public.customers",
  "blitzpay",
  'from "@/app/(portal)',
]
for (const file of [
  "lib/growth/aios/event-bus/growth-ai-event-bus-types.ts",
  "lib/growth/aios/event-bus/growth-ai-event-bus-engine.ts",
  "lib/growth/aios/event-bus/growth-ai-event-bus-service.ts",
  "lib/growth/aios/event-bus/growth-ai-event-bus-subscriber-registry.ts",
]) {
  assertNoCoreTouch(file, coreForbidden)
}

assert.equal(GROWTH_AI_EVENT_BUS_BRIDGE_SOURCES_WIRED.length, 3)
assert.ok(GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS.length >= 7)

const workflowAgentEvents = [
  GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT,
  GROWTH_AUTONOMOUS_PLANNING_EXECUTION_PLAN_GENERATED_EVENT,
  GROWTH_AUTONOMOUS_EXECUTION_ENQUEUED_EVENT,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT,
  GROWTH_AUTONOMOUS_MEETING_PREPARED_EVENT,
  "growth.workflow.status_changed",
  "growth.execution_plan.review_changed",
]
for (const eventType of workflowAgentEvents) {
  assert.ok(
    AI_EVENT_REGISTRY.some((entry) => entry.eventType === eventType),
    `${eventType} must be registered`,
  )
}

assert.equal(resolveWorkflowLifecycleAlias("growth.workflow.status_changed"), "ResearchCompleted")
assert.equal(resolveWorkflowLifecycleAlias("growth.qualification.completed"), "QualificationCompleted")
assert.equal(mapAiOsEventTypeToAgentEventType("growth.qualification.completed"), "qualification_completed")
assert.equal(mapAiOsEventTypeToAgentEventType("growth.outreach.prepared"), "human_review_requested")

const publishInput = growthAiEventToAiOsPublishInput({
  organizationId: "org-1",
  eventType: "growth.workflow.status_changed",
  category: "workflow",
  producer: "test",
  source: "cert",
  correlationId: "corr-xyz",
  metadata: { traceId: "trace-xyz", workflowAgent: "research_agent" },
})
assert.equal(publishInput.correlationId, "corr-xyz")
assert.equal(publishInput.metadata?.trace_id, "trace-xyz")

const growthEvent = aiOsEventToGrowthAiEvent(sampleAiOsEvent())
assert.equal(growthEvent.metadata.correlationId, "corr-abc")
assert.equal(growthEvent.metadata.traceId, "trace-abc")
assert.equal(growthEvent.aiOs.category, "system")

assert.ok(
  growthAiEventBusSubscriberObservesEvent(
    "meta_recommender_observer",
    sampleAiOsEvent({ category: "decision", eventType: "decision.recorded" }),
  ),
)
assert.ok(
  growthAiEventBusSubscriberObservesEvent(
    "revenue_operator_observer",
    sampleAiOsEvent({ category: "agent", eventType: "agent.wake" }),
  ),
)
assert.ok(
  growthAiEventBusSubscriberObservesEvent(
    "human_approval_center_observer",
    sampleAiOsEvent({ category: "approval", eventType: "growth.execution_plan.review_changed" }),
  ),
)

clearAiOsEventHandlersForTests()
clearGrowthAiEventBusSubscribersForTests()
resetGrowthAiEventBusObservationForTests()
ensureGrowthAiEventBusInProcessSubscribers()
const registered = listGrowthAiEventBusRegisteredSubscribers()
assert.ok(registered.includes("meta_recommender_observer"))
assert.ok(registered.includes("revenue_operator_observer"))
assert.ok(registered.includes("human_approval_center_observer"))

const health = synthesizeGrowthAiEventBusHealthReadModel({
  generatedAt: "2026-06-25T12:00:00.000Z",
  recentEvents: [sampleAiOsEvent()],
})
assert.equal(health.readOnly, true)
assert.equal(health.recentEventCount, 1)
assert.equal(health.lastEventType, "growth.workflow.status_changed")
assert.ok(health.subscriberHealth.length >= 8)

assert.ok(Object.keys(GROWTH_AI_WORKFLOW_LIFECYCLE_ALIASES).length >= 10)

console.log(`[${GROWTH_AIOS_GE_AI_2B_PHASE}] Running regression certifications...`)

const regressions = [
  "test:ge-ai-2h-human-approval-center",
  "test:ge-ai-2e-priority-engine-binding",
  "test:ge-ai-2f-meta-recommender",
  "test:prod-regression-6-command-center-import-stability",
  "test:ge-aios-5c-command-center-read-model-foundation",
  "test:ge-aios-2b-ai-event-foundation",
  "test:ge-aios-growth-4c-agent-events",
]

for (const script of regressions) {
  execSync(`pnpm ${script}`, { stdio: "inherit", cwd: process.cwd() })
}

console.log(`[${GROWTH_AIOS_GE_AI_2B_PHASE}] PASS — Event Bus completion certified (local)`)
