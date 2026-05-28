/**
 * Regression checks for Growth Engine outreach execution (6.4A).
 * Run: pnpm test:growth-outreach-execution
 */
import assert from "node:assert/strict"
import {
  computeOutreachApprovalRate,
  computeOutreachExecutionConfidence,
  computeOutreachExecutionRate,
  computeOutreachRegenerationHotspots,
  deriveOutreachQueuePriority,
} from "../lib/growth/outreach/outreach-analytics"
import { resolveScheduledFor } from "../lib/growth/outreach/outreach-scheduling"
import type { GrowthOutreachQueueItem } from "../lib/growth/outreach/outreach-queue-types"
import { defaultStubExecute, defaultValidateExecution } from "../lib/growth/outbound/providers/types"

assert.equal(deriveOutreachQueuePriority({ callPriorityTier: "critical", executivePriorityTier: null }), "high")
assert.equal(
  deriveOutreachQueuePriority({ callPriorityTier: null, executivePriorityTier: "executive_now" }),
  "critical",
)

const confidence = computeOutreachExecutionConfidence({
  leadScore: 80,
  engagementScore: 70,
  capacityTier: "healthy",
  channel: "email",
})
assert.ok(confidence >= 50 && confidence <= 100)

const criticalConfidence = computeOutreachExecutionConfidence({
  leadScore: 80,
  engagementScore: 70,
  capacityTier: "critical",
  channel: "email",
})
assert.ok(criticalConfidence < confidence)

const sendNow = resolveScheduledFor({
  sendNow: true,
  respectBusinessHours: false,
  timezone: "America/New_York",
  startMinutes: 540,
  endMinutes: 1020,
})
assert.equal(sendNow.status, "approved")
assert.ok(sendNow.scheduledFor)

const items: GrowthOutreachQueueItem[] = [
  {
    id: "1",
    leadId: "lead-1",
    generationId: "gen-1",
    campaignId: null,
    channel: "email",
    status: "executed",
    priority: "normal",
    executionConfidence: 70,
    scheduledFor: null,
    approvedAt: new Date(Date.now() - 3600000).toISOString(),
    approvedBy: "user",
    approvalNote: null,
    executedAt: new Date().toISOString(),
    failedAt: null,
    failureReason: null,
    providerConnectionId: null,
    outboundMessageId: null,
    payloadSnapshot: {},
    generationVersion: 1,
    parentQueueId: null,
    sequencePatternId: null,
    sequenceEnrollmentStepId: null,
    retryCount: 0,
    failureClass: null,
    deadLetterAt: null,
    lastRetryAt: null,
    processingStartedAt: null,
    deliveryAttemptId: null,
    createdBy: "user",
    cancelledAt: null,
    cancelledBy: null,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    leadId: "lead-1",
    generationId: "gen-2",
    campaignId: null,
    channel: "email",
    status: "cancelled",
    priority: "normal",
    executionConfidence: 60,
    scheduledFor: null,
    approvedAt: null,
    approvedBy: null,
    approvalNote: null,
    executedAt: null,
    failedAt: null,
    failureReason: null,
    providerConnectionId: null,
    outboundMessageId: null,
    payloadSnapshot: {},
    generationVersion: 2,
    parentQueueId: "1",
    sequencePatternId: null,
    sequenceEnrollmentStepId: null,
    retryCount: 0,
    failureClass: null,
    deadLetterAt: null,
    lastRetryAt: null,
    processingStartedAt: null,
    deliveryAttemptId: null,
    createdBy: "user",
    cancelledAt: new Date().toISOString(),
    cancelledBy: "user",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

assert.equal(computeOutreachApprovalRate(items), 50)
assert.equal(computeOutreachExecutionRate(items), 100)
assert.equal(computeOutreachRegenerationHotspots(items).length, 1)

const validation = defaultValidateExecution()
assert.equal(validation.ok, true)

const executePromise = defaultStubExecute("smartlead", {
  to: "test@example.com",
  subject: "Hello",
  body: "Body",
})
void executePromise.then((execute) => {
  assert.equal(execute.ok, true)
  if (execute.ok) {
    assert.ok(execute.providerMessageId.includes("smartlead:msg:"))
  }
  console.log("test-growth-outreach-execution: OK")
})
