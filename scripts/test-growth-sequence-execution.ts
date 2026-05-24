/**
 * Regression checks for Growth Engine guided sequence execution (slice 6.7A).
 * Run: pnpm test:growth-sequence-execution
 */
import assert from "node:assert/strict"
import {
  computeEnrollmentHealthScore,
  computeStepExecutionConfidence,
  detectSequenceDrift,
} from "../lib/growth/sequence-enrollment/sequence-enrollment-health"
import type {
  GrowthSequenceEnrollment,
  GrowthSequenceEnrollmentStep,
} from "../lib/growth/sequence-enrollment-types"
import type { GrowthLead } from "../lib/growth/types"

const NOW = Date.now()
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString()

const baseLead = (partial: Partial<GrowthLead> = {}): GrowthLead =>
  ({
    id: "lead-1",
    companyName: "Acme",
    status: "qualified",
    contactEmail: "ops@acme.test",
    contactPhone: "555-0100",
    engagementScore: 72,
    recommendedSequenceConfidence: 68,
    operationalCapacityTier: "healthy",
    sequenceFatigueRisk: "low",
    ...partial,
  }) as GrowthLead

const baseEnrollment = (partial: Partial<GrowthSequenceEnrollment> = {}): GrowthSequenceEnrollment => ({
  id: "enrollment-1",
  leadId: "lead-1",
  sequencePatternId: "pattern-1",
  sequenceVersion: 1,
  status: "active",
  currentStepOrder: 1,
  enrollmentHealthScore: 70,
  enrollmentStalled: false,
  ownerUserId: "user-1",
  pauseReason: null,
  startedAt: daysAgo(10),
  completedAt: null,
  cancelledAt: null,
  cancelledReason: null,
  metadata: {},
  createdBy: "user-1",
  createdAt: daysAgo(10),
  updatedAt: daysAgo(1),
  ...partial,
})

const baseStep = (partial: Partial<GrowthSequenceEnrollmentStep> = {}): GrowthSequenceEnrollmentStep => ({
  id: "step-1",
  enrollmentId: "enrollment-1",
  leadId: "lead-1",
  sequencePatternStepId: "pattern-step-1",
  stepOrder: 2,
  channel: "email",
  generationType: "follow_up_email",
  scheduledFor: daysAgo(8),
  status: "pending",
  stepExecutionConfidence: 62,
  outreachQueueId: null,
  generationId: null,
  completedAt: null,
  failureReason: null,
  createdAt: daysAgo(10),
  updatedAt: daysAgo(1),
  ...partial,
})

const confidence = computeStepExecutionConfidence({ lead: baseLead(), channel: "email" })
assert.ok(confidence >= 0 && confidence <= 100)

const lowConfidence = computeStepExecutionConfidence({
  lead: baseLead({ contactEmail: null, operationalCapacityTier: "critical", sequenceFatigueRisk: "high" }),
  channel: "email",
})
assert.ok(lowConfidence < confidence)

const healthy = computeEnrollmentHealthScore({
  enrollment: baseEnrollment(),
  steps: [
    baseStep({ stepOrder: 1, status: "executed" }),
    baseStep({ id: "step-2", stepOrder: 2, status: "pending", scheduledFor: daysAgo(1) }),
  ],
  totalSteps: 2,
})
assert.ok(healthy.healthScore >= 0 && healthy.healthScore <= 100)
assert.equal(healthy.stalled, false)

const stalled = computeEnrollmentHealthScore({
  enrollment: baseEnrollment({ currentStepOrder: 1 }),
  steps: [
    baseStep({ stepOrder: 1, status: "executed" }),
    baseStep({ id: "step-2", stepOrder: 2, status: "queued", scheduledFor: daysAgo(10) }),
  ],
  totalSteps: 2,
})
assert.equal(stalled.stalled, true)
assert.ok(stalled.healthScore < healthy.healthScore)

const drift = detectSequenceDrift({
  enrollmentId: "enrollment-1",
  leadId: "lead-1",
  companyName: "Acme",
  patternKey: "email_then_call",
  steps: [
    baseStep({ stepOrder: 1, channel: "manual_call", status: "failed", failureReason: "queue rejected" }),
    baseStep({ id: "step-2", stepOrder: 2, status: "skipped" }),
  ],
  patternSteps: [
    { id: "ps-1", patternId: "pattern-1", stepOrder: 1, channel: "email", delayDaysMin: 0, delayDaysMax: 0, generationType: "cold_email", playbookCategory: null, requiredHumanApproval: true, expectedSignal: "reply" },
    { id: "ps-2", patternId: "pattern-1", stepOrder: 2, channel: "manual_call", delayDaysMin: 3, delayDaysMax: 7, generationType: null, playbookCategory: null, requiredHumanApproval: true, expectedSignal: "call_interested" },
  ],
})
assert.ok(drift.some((signal) => signal.driftKind === "channel_mismatch"))
assert.ok(drift.some((signal) => signal.driftKind === "queue_failed"))
assert.ok(drift.some((signal) => signal.driftKind === "skipped_gap"))

console.log("growth-sequence-execution: all assertions passed")
