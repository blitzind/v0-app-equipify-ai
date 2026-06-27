/**
 * GE-AI-3D — Closed-Loop Learning Foundation certification.
 * Run: pnpm test:ge-ai-3d-closed-loop-learning-foundation
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { isRegisteredAiEventType } from "../lib/growth/aios/ai-event-registry"
import {
  GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS,
  growthAiEventBusSubscriberObservesEvent,
} from "../lib/growth/aios/event-bus/growth-ai-event-bus-engine"
import { GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES } from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import { GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES } from "../lib/growth/aios/revenue-director/growth-revenue-director-dispatch-correlation-types"
import { GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_EVENT } from "../lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT } from "../lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import { GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT } from "../lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  GROWTH_AIOS_GE_AI_3D_PHASE,
  GROWTH_CLOSED_LOOP_LEARNING_EVENT_TYPES,
  GROWTH_CLOSED_LOOP_LEARNING_QA_MARKER,
  GROWTH_CLOSED_LOOP_LEARNING_RULE,
  GROWTH_CLOSED_LOOP_LEARNING_SUBSCRIBER_ID,
  GROWTH_LEARNING_MIN_SAMPLE_SIZE,
  type GrowthLearningOutcome,
} from "../lib/growth/aios/learning/growth-closed-loop-learning-types"
import {
  buildGrowthClosedLoopLearningReadModel,
  enrichCommunicationEngineWithLearningInsights,
  enrichRevenueDirectorWithLearningInsights,
  ingestLearningOutcome,
  resetGrowthClosedLoopLearningStoreForTests,
  seedLearningOutcomeForTests,
} from "../lib/growth/aios/learning/growth-closed-loop-learning-service"
import {
  generateApprovalFrictionInsight,
  generateChannelPerformanceInsight,
  synthesizeGrowthLearningInsights,
} from "../lib/growth/aios/learning/growth-learning-insight-engine"
import { normalizeLearningOutcomeFromEvent } from "../lib/growth/aios/learning/growth-learning-outcome-normalizer"
import type { AiOsEvent } from "../lib/growth/aios/ai-event-types"
import { GROWTH_COMMUNICATION_ENGINE_QA_MARKER } from "../lib/growth/aios/communication/growth-communication-engine-types"
import { GROWTH_REVENUE_DIRECTOR_QA_MARKER } from "../lib/growth/aios/revenue-director/growth-revenue-director-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function eventStub(input: Partial<AiOsEvent> & Pick<AiOsEvent, "eventType" | "payload">): AiOsEvent {
  return {
    id: input.id ?? "evt-test",
    organizationId: input.organizationId ?? "org-test",
    category: input.category ?? "system",
    eventType: input.eventType,
    correlationId: input.correlationId ?? "lead-1",
    entityId: input.entityId ?? "lead-1",
    entityType: input.entityType ?? "lead",
    payload: input.payload,
    producer: "cert",
    occurredAt: input.occurredAt ?? "2026-06-27T12:00:00.000Z",
    createdAt: input.createdAt ?? "2026-06-27T12:00:00.000Z",
    metadata: input.metadata ?? {},
  }
}

function outcomeSeed(partial: Partial<GrowthLearningOutcome> & Pick<GrowthLearningOutcome, "source" | "outcomeType">): GrowthLearningOutcome {
  return {
    id: partial.id ?? `outcome-${partial.source}-${partial.outcomeType}`,
    organizationId: partial.organizationId ?? "org-test",
    source: partial.source,
    outcomeType: partial.outcomeType,
    subject: partial.subject ?? { type: "lead", id: "lead-1" },
    related: partial.related ?? {},
    signalStrength: partial.signalStrength ?? 0.8,
    confidence: partial.confidence ?? 0.85,
    dimensions: partial.dimensions ?? {},
    evidence: partial.evidence ?? [],
    occurredAt: partial.occurredAt ?? "2026-06-27T12:00:00.000Z",
    createdAt: partial.createdAt ?? "2026-06-27T12:00:00.000Z",
  }
}

process.env.GROWTH_LEARNING_IN_MEMORY_STORE = "1"

console.log(`[${GROWTH_AIOS_GE_AI_3D_PHASE}] Closed-Loop Learning Foundation certification`)

resetGrowthClosedLoopLearningStoreForTests()

assert.ok(GROWTH_CLOSED_LOOP_LEARNING_RULE.includes("no automatic"))

const requiredFiles = [
  "lib/growth/aios/learning/growth-closed-loop-learning-types.ts",
  "lib/growth/aios/learning/growth-learning-outcome-normalizer.ts",
  "lib/growth/aios/learning/growth-learning-insight-engine.ts",
  "lib/growth/aios/learning/growth-closed-loop-learning-service.ts",
  "docs/GE-AI-3D_CLOSED_LOOP_LEARNING_FOUNDATION.md",
  "components/growth/ai-os/command-center/growth-ai-os-closed-loop-learning-section.tsx",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const service = readSource("lib/growth/aios/learning/growth-closed-loop-learning-service.ts")
assert.ok(service.includes('import "server-only"'))
assert.equal(service.includes("setInterval"), false)
assert.equal(service.includes("runSequenceExecutionJob"), false)
assert.equal(service.includes("updateGrowthAutonomy"), false)
assert.equal(service.includes("mutateIcp"), false)

const registry = readSource("lib/growth/aios/event-bus/growth-ai-event-bus-subscriber-registry.ts")
assert.ok(registry.includes("observeClosedLoopLearningEventForBus"))
assert.ok(registry.includes("GROWTH_CLOSED_LOOP_LEARNING_SUBSCRIBER_ID"))

const ui = readSource("components/growth/ai-os/command-center/growth-ai-os-closed-loop-learning-section.tsx")
assert.ok(ui.includes("Read-only outcome observation"))
assert.equal(ui.includes("Apply"), false)
assert.equal(ui.includes("retry"), false)

assert.ok(
  GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS.some(
    (row) => row.subscriberId === GROWTH_CLOSED_LOOP_LEARNING_SUBSCRIBER_ID,
  ),
)

assert.ok(
  growthAiEventBusSubscriberObservesEvent(GROWTH_CLOSED_LOOP_LEARNING_SUBSCRIBER_ID, {
    id: "evt-1",
    organizationId: "org-1",
    category: "executive",
    eventType: GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES.completed,
    correlationId: "req-1",
    entityId: "req-1",
    entityType: "workflow_request",
    payload: { workflowRequestId: "req-1" },
  } as never),
)

for (const eventType of Object.values(GROWTH_CLOSED_LOOP_LEARNING_EVENT_TYPES)) {
  assert.equal(isRegisteredAiEventType(eventType), true, `${eventType} registered`)
}

// 1–8 Outcome normalization coverage
const revenueOutcome = normalizeLearningOutcomeFromEvent(
  eventStub({
    eventType: GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES.completed,
    payload: { workflowRequestId: "req-1" },
  }),
)
assert.equal(revenueOutcome?.source, "revenue_director")
assert.equal(revenueOutcome?.outcomeType, "completed")

const workflowOutcome = normalizeLearningOutcomeFromEvent(
  eventStub({
    eventType: GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
    payload: { workflow_status: "research_complete" },
  }),
)
assert.equal(workflowOutcome?.source, "workflow_agent")

const outboundOutcome = normalizeLearningOutcomeFromEvent(
  eventStub({
    eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.actionCompleted,
    payload: { scopeId: "scope-1", actionId: "act-1", channel: "email" },
  }),
)
assert.equal(outboundOutcome?.source, "autonomous_outbound")

const emailReply = normalizeLearningOutcomeFromEvent(
  eventStub({
    eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.stopConditionTriggered,
    payload: { stopCondition: "on_reply", channel: "email" },
  }),
)
assert.equal(emailReply?.source, "email")
assert.equal(emailReply?.outcomeType, "reply")

const smsReply = normalizeLearningOutcomeFromEvent(
  eventStub({
    eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.stopConditionTriggered,
    payload: { stopCondition: "on_reply", channel: "sms" },
  }),
)
assert.equal(smsReply?.source, "sms")

const approvalOutcome = normalizeLearningOutcomeFromEvent(
  eventStub({
    eventType: GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_EVENT,
    payload: { review_status: "approved_for_future_execution" },
  }),
)
assert.equal(approvalOutcome?.source, "human_approval")
assert.equal(approvalOutcome?.outcomeType, "approved")

const rejectOutcome = normalizeLearningOutcomeFromEvent(
  eventStub({
    eventType: GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_EVENT,
    payload: { review_status: "needs_changes" },
  }),
)
assert.equal(rejectOutcome?.outcomeType, "rejected")

const meetingOutcome = normalizeLearningOutcomeFromEvent(
  eventStub({
    eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.stopConditionTriggered,
    payload: { stopCondition: "on_meeting_booked" },
  }),
)
assert.equal(meetingOutcome?.outcomeType, "meeting_booked")

const bounceOutcome = normalizeLearningOutcomeFromEvent(
  eventStub({
    eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.stopConditionTriggered,
    payload: { stopCondition: "on_bounce", channel: "email" },
  }),
)
assert.equal(bounceOutcome?.outcomeType, "bounce")

const unsubOutcome = normalizeLearningOutcomeFromEvent(
  eventStub({
    eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.stopConditionTriggered,
    payload: { stopCondition: "on_unsubscribe" },
  }),
)
assert.equal(unsubOutcome?.outcomeType, "unsubscribe")

const optOutOutcome = normalizeLearningOutcomeFromEvent(
  eventStub({
    eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.stopConditionTriggered,
    payload: { stopCondition: "on_opt_out", channel: "sms" },
  }),
)
assert.equal(optOutOutcome?.outcomeType, "opt_out")

assert.equal(
  normalizeLearningOutcomeFromEvent(
    eventStub({ eventType: "mission.completed", payload: {} }),
  ),
  null,
)

// 9–12 Insights
const lowSampleInsight = generateChannelPerformanceInsight({
  organizationId: "org-test",
  generatedAt: "2026-06-27T12:00:00.000Z",
  outcomes: [outcomeSeed({ source: "email", outcomeType: "reply", dimensions: { channel: "email" } })],
})
assert.equal(lowSampleInsight.status, "not_enough_data")
assert.ok(lowSampleInsight.sampleSize < GROWTH_LEARNING_MIN_SAMPLE_SIZE)

for (const row of [
  outcomeSeed({ source: "sms", outcomeType: "reply", dimensions: { channel: "sms" } }),
  outcomeSeed({ id: "sms-2", source: "sms", outcomeType: "positive_intent", dimensions: { channel: "sms" } }),
  outcomeSeed({ id: "sms-3", source: "sms", outcomeType: "meeting_booked", dimensions: { channel: "sms" } }),
  outcomeSeed({ source: "email", outcomeType: "reply", dimensions: { channel: "email" } }),
]) {
  seedLearningOutcomeForTests(row)
}

const channelInsight = generateChannelPerformanceInsight({
  organizationId: "org-test",
  generatedAt: "2026-06-27T12:00:00.000Z",
  outcomes: [
    outcomeSeed({ source: "sms", outcomeType: "reply", dimensions: { channel: "sms" } }),
    outcomeSeed({ id: "a", source: "sms", outcomeType: "positive_intent", dimensions: { channel: "sms" } }),
    outcomeSeed({ id: "b", source: "sms", outcomeType: "meeting_booked", dimensions: { channel: "sms" } }),
    outcomeSeed({ source: "email", outcomeType: "reply", dimensions: { channel: "email" } }),
  ],
})
assert.equal(channelInsight.insightType, "channel_performance")
assert.ok(channelInsight.sampleSize >= GROWTH_LEARNING_MIN_SAMPLE_SIZE)
assert.ok(channelInsight.confidence > 0)

const approvalInsight = generateApprovalFrictionInsight({
  organizationId: "org-test",
  generatedAt: "2026-06-27T12:00:00.000Z",
  outcomes: [
    outcomeSeed({ source: "human_approval", outcomeType: "rejected" }),
    outcomeSeed({ id: "ap-2", source: "human_approval", outcomeType: "rejected" }),
    outcomeSeed({ id: "ap-3", source: "human_approval", outcomeType: "approved" }),
  ],
})
assert.equal(approvalInsight.insightType, "approval_friction")

// 13–18 Safety — no mutation paths in learning layer
const learningPaths = [
  "lib/growth/aios/learning/growth-closed-loop-learning-service.ts",
  "lib/growth/aios/learning/growth-learning-insight-engine.ts",
  "lib/growth/aios/learning/growth-learning-outcome-normalizer.ts",
]
for (const relativePath of learningPaths) {
  const source = readSource(relativePath)
  assert.equal(source.includes("runSequenceExecutionJob"), false, relativePath)
  assert.equal(source.includes("updateIcp"), false, relativePath)
  assert.equal(source.includes("setChannelWeight"), false, relativePath)
  assert.equal(source.includes("mutateGrowthAutonomy"), false, relativePath)
}

// 19–21 Read-only integrations
const readModel = buildGrowthClosedLoopLearningReadModel({
  organizationId: "org-test",
  generatedAt: "2026-06-27T12:00:00.000Z",
})
assert.equal(readModel.readOnly, true)
assert.equal(readModel.advisoryOnly, true)
assert.equal(readModel.persistenceMode, "in_memory_test")
assert.equal(readModel.qaMarker, GROWTH_CLOSED_LOOP_LEARNING_QA_MARKER)

const revenueEnriched = enrichRevenueDirectorWithLearningInsights({
  revenueDirector: {
    readOnly: true,
    qaMarker: GROWTH_REVENUE_DIRECTOR_QA_MARKER,
    generatedAt: "2026-06-27T12:00:00.000Z",
    rule: "rule",
    rankingFormula: "formula",
    executiveSummary: {
      revenueHealth: "on_pace",
      onPace: true,
      primaryFocus: null,
      headline: "test",
      shouldPauseOutbound: false,
      shouldIntervene: false,
    },
    objectiveHealth: [],
    kpis: {
      approvalBacklog: 0,
      activeAutonomousScopes: 0,
      blockedAutonomousScopes: 0,
      activeMissions: 0,
      stalledMissions: 0,
      humanReviewRequired: 0,
      communicationPlansGenerated: 0,
      eventBusHealthy: true,
    },
    resourceAllocation: {
      topObjectiveId: null,
      topObjectiveTitle: null,
      starvedBindingCount: 0,
      outboundActionsToday: 0,
      outboundDailyLimit: null,
      communicationTopChannel: null,
    },
    workflowRequests: [],
    bottlenecks: [],
    risks: [],
    escalations: [],
    recommendations: [],
    health: {
      agentHealthStatus: "healthy",
      eventBusStatus: "healthy",
      autonomyStatus: "enabled",
    },
    eventObservation: {
      subscriberId: "revenue_director_observer",
      eventsReceived: 0,
      lastEventType: null,
    },
  },
  learning: readModel,
})
assert.ok(revenueEnriched.learningAdvisory)

const communicationEnriched = enrichCommunicationEngineWithLearningInsights({
  communicationEngine: {
    readOnly: true,
    qaMarker: GROWTH_COMMUNICATION_ENGINE_QA_MARKER,
    generatedAt: "2026-06-27T12:00:00.000Z",
    rule: "rule",
    rankingFormula: "formula",
    summary: {
      plansGenerated: 1,
      primaryStrategy: "email_first",
      blockedChannelCount: 0,
      averageConfidence: 80,
      topChannel: "email",
    },
    plans: [],
  },
  learning: readModel,
})
assert.equal(communicationEnriched.readOnly, true)

// Idempotent ingest without admin
resetGrowthClosedLoopLearningStoreForTests()
const normalizedQual = normalizeLearningOutcomeFromEvent(
  eventStub({
    id: "evt-dup",
    eventType: GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT,
    payload: { qualification_status: "qualified" },
  }),
)
assert.ok(normalizedQual)
assert.equal(ingestLearningOutcome(normalizedQual!), true)
assert.equal(ingestLearningOutcome(normalizedQual!), false)

const insights = synthesizeGrowthLearningInsights({
  organizationId: "org-test",
  generatedAt: "2026-06-27T12:00:00.000Z",
  outcomes: [normalizedQual!],
})
assert.ok(insights.length >= 4)

console.log("[GE-AI-3D] Static certification passed — running PROD-1 regression")
execSync("pnpm test:ge-ai-3c-prod-1-dispatch-completion-correlation", {
  stdio: "inherit",
  timeout: 12 * 60 * 1000,
})

console.log("[GE-AI-3D] Closed-Loop Learning Foundation certification PASSED")
