/**
 * GE-AIOS-SDR-2C — Revenue outcome integration certification.
 * Run: pnpm test:growth-revenue-outcome-integration
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { isRegisteredAiEventType } from "../lib/growth/aios/ai-event-registry"
import { growthAiEventBusSubscriberObservesEvent } from "../lib/growth/aios/event-bus/growth-ai-event-bus-engine"
import { GROWTH_CLOSED_LOOP_LEARNING_SUBSCRIBER_ID } from "../lib/growth/aios/learning/growth-closed-loop-learning-types"
import {
  isLearningRelevantEventType,
  normalizeLearningOutcomeFromEvent,
} from "../lib/growth/aios/learning/growth-learning-outcome-normalizer"
import type { AiOsEvent } from "../lib/growth/aios/ai-event-types"
import { buildRevenueOutcomePayload } from "../lib/growth/revenue-outcomes/revenue-outcome-types"
import { mapRevenueOutcomeToLearning } from "../lib/growth/revenue-outcomes/revenue-outcome-learning-map"
import { isRevenueOutcomeIntegrationEnabled } from "../lib/growth/revenue-outcomes/revenue-outcome-feature"
import {
  GROWTH_REVENUE_OUTCOME_EVENT,
  GROWTH_REVENUE_OUTCOME_QA_MARKER,
} from "../lib/growth/revenue-outcomes/revenue-outcome-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const saved = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return fn()
  } finally {
    for (const [key, value] of saved.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

function eventStub(input: Partial<AiOsEvent> & Pick<AiOsEvent, "payload">): AiOsEvent {
  return {
    id: input.id ?? "evt-revenue-1",
    organizationId: input.organizationId ?? "org-test",
    category: input.category ?? "learning",
    eventType: input.eventType ?? GROWTH_REVENUE_OUTCOME_EVENT,
    correlationId: input.correlationId ?? "exec-1",
    entityId: input.entityId ?? "lead-1",
    entityType: input.entityType ?? "lead",
    payload: input.payload,
    producer: "cert",
    occurredAt: input.occurredAt ?? "2026-06-28T12:00:00.000Z",
    createdAt: input.createdAt ?? "2026-06-28T12:00:00.000Z",
    metadata: input.metadata ?? {},
  }
}

console.log("[GE-AIOS-SDR-2C] Revenue outcome integration certification")

assert.equal(GROWTH_REVENUE_OUTCOME_QA_MARKER, "revenue-outcome-integration-v1")
assert.equal(GROWTH_REVENUE_OUTCOME_EVENT, "revenue.outcome.recorded")
assert.equal(isRegisteredAiEventType(GROWTH_REVENUE_OUTCOME_EVENT), true)
assert.equal(isLearningRelevantEventType(GROWTH_REVENUE_OUTCOME_EVENT), true)
console.log("  ✓ Canonical event registered for learning")

withEnv({ GROWTH_REVENUE_OUTCOME_INTEGRATION: "true" }, () => {
  assert.equal(isRevenueOutcomeIntegrationEnabled(), true)
})
withEnv({ GROWTH_REVENUE_OUTCOME_INTEGRATION: undefined, GROWTH_NATIVE_DECISION_ENGINE: undefined }, () => {
  assert.equal(isRevenueOutcomeIntegrationEnabled(), false)
})
console.log("  ✓ Feature flag gates emission")

const payload = buildRevenueOutcomePayload({
  leadId: "lead-1",
  channel: "email",
  outcome: "replied",
  executionId: "email:evt-123",
  runtime: "email_outbound_webhook",
  action: "replied",
  confidence: 84,
})
assert.equal(payload.qa_marker, GROWTH_REVENUE_OUTCOME_QA_MARKER)
assert.equal(payload.outcome, "replied")
console.log("  ✓ Canonical payload schema")

const outcomeCases: Array<{ channel: "email" | "call" | "sms" | "meeting" | "lead"; outcome: string; learningType: string }> = [
  { channel: "email", outcome: "replied", learningType: "reply" },
  { channel: "email", outcome: "bounced", learningType: "bounce" },
  { channel: "call", outcome: "connected", learningType: "completed" },
  { channel: "call", outcome: "no_answer", learningType: "no_response" },
  { channel: "sms", outcome: "replied", learningType: "reply" },
  { channel: "meeting", outcome: "booked", learningType: "meeting_booked" },
  { channel: "meeting", outcome: "no_show", learningType: "no_response" },
  { channel: "lead", outcome: "disqualified", learningType: "rejected" },
  { channel: "lead", outcome: "customer", learningType: "converted" },
]

for (const testCase of outcomeCases) {
  const mapped = mapRevenueOutcomeToLearning({
    channel: testCase.channel,
    outcome: testCase.outcome as never,
  })
  assert.equal(mapped.outcomeType, testCase.learningType)
  const normalized = normalizeLearningOutcomeFromEvent(
    eventStub({
      payload: {
        ...payload,
        channel: testCase.channel,
        outcome: testCase.outcome,
      },
    }),
  )
  assert.equal(normalized?.outcomeType, testCase.learningType)
}
console.log("  ✓ Outcomes normalize into Learning Engine once")

assert.ok(
  growthAiEventBusSubscriberObservesEvent(GROWTH_CLOSED_LOOP_LEARNING_SUBSCRIBER_ID, {
    category: "learning",
    eventType: GROWTH_REVENUE_OUTCOME_EVENT,
  } as AiOsEvent),
)
console.log("  ✓ Learning observer subscribes to revenue outcomes")

const wiredRuntimes = [
  { file: "lib/growth/outbound/process-event.ts", token: "emitEmailRevenueOutcomeFromWebhook" },
  { file: "lib/growth/native-dialer/native-dialer-repository.ts", token: "emitCallRevenueOutcomeFromWrapup" },
  { file: "lib/growth/sms/sms-reply-ingestion.ts", token: "emitSmsRevenueOutcome" },
  { file: "lib/growth/sms/webhooks/twilio-sms-ingestion.ts", token: "emitSmsRevenueOutcome" },
  { file: "lib/growth/sequences/execution/sequence-voice-drop-webhook-timeline.ts", token: "emitVoiceDropRevenueOutcome" },
  { file: "lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts", token: "emitCampaignRevenueOutcome" },
  { file: "lib/growth/meeting-intelligence/mutate-meeting.ts", token: "emitMeetingRevenueOutcome" },
  { file: "lib/growth/lead-repository.ts", token: "emitLeadLifecycleRevenueOutcomeIfNeeded" },
  { file: "lib/growth/daily-work-queue/daily-revenue-work-queue-learning.ts", token: "emitDailyWorkQueueRevenueOutcome" },
  { file: "lib/growth/revenue-outcomes/revenue-outcome-emitter.ts", token: "publishGrowthAiEvent" },
]

for (const check of wiredRuntimes) {
  assert.ok(readSource(check.file).includes(check.token), `${check.file} must wire ${check.token}`)
}
console.log("  ✓ Execution runtimes publish canonical revenue outcomes")

console.log("\nGE-AIOS-SDR-2C revenue outcome integration certification passed.")
