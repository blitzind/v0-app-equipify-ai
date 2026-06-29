/**
 * GE-AIOS-SDR-2B — Daily Revenue Work Queue runtime integration certification.
 * Run: pnpm test:growth-daily-revenue-work-queue-integration
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { normalizeLearningOutcomeFromEvent } from "../lib/growth/aios/learning/growth-learning-outcome-normalizer"
import type { AiOsEvent } from "../lib/growth/aios/ai-event-types"
import { buildDailyRevenueWorkQueue } from "../lib/growth/daily-work-queue/daily-revenue-work-queue-engine"
import {
  boostNotificationPriorityWithDailyWorkQueue,
  buildDailyRevenueWorkQueueIndex,
  buildEnrollmentPreviewQueueReason,
  GROWTH_DAILY_REVENUE_WORK_QUEUE_INTEGRATION_QA_MARKER,
  rankItemsWithDailyWorkQueue,
  resolveLeadDailyWorkQueueStatus,
  sortCallQueueRowsByDailyWorkQueue,
} from "../lib/growth/daily-work-queue/daily-revenue-work-queue-integration"
import {
  GROWTH_REVENUE_OUTCOME_EVENT,
} from "../lib/growth/revenue-outcomes/revenue-outcome-types"
import type { DailyRevenueWorkQueueCandidate } from "../lib/growth/daily-work-queue/daily-revenue-work-queue-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function candidate(
  leadId: string,
  overrides: Partial<DailyRevenueWorkQueueCandidate> = {},
): DailyRevenueWorkQueueCandidate {
  const companyId = `company-${leadId}`
  return {
    leadId,
    companyId,
    qualification: {
      version: 1,
      companyId,
      generatedAt: "2026-06-28T00:00:00.000Z",
      qualification: "qualified",
      overallScore: 80,
      fitScore: 78,
      contactScore: 82,
      engagementScore: 70,
      buyingCommitteeCoverage: 60,
      confidence: 80,
      strengths: [],
      risks: [],
      blockers: [],
      recommendations: [],
      nextAction: "enroll_sequence",
    },
    sequenceRecommendation: {
      version: 1,
      companyId,
      generatedAt: "2026-06-28T00:00:00.000Z",
      recommendedSequence: { type: "executive_cold_outbound", name: "Executive Cold Outbound" },
      preferredChannel: "email",
      enrollmentReadiness: "ready",
      confidence: 84,
      cadence: { intensity: "standard", suggestedTouchCount: 5, suggestedDurationDays: 21 },
      reasons: [],
      risks: [],
      blockers: [],
      nextAction: "enroll_sequence",
      personalizationInputs: {},
    },
    nextBestAction: {
      version: 1,
      companyId,
      generatedAt: "2026-06-28T00:00:00.000Z",
      action: "enroll_sequence",
      priority: "high",
      confidence: 84,
      executionReadiness: "ready",
      recommendedChannel: "email",
      recommendedDelayHours: 0,
      reasons: [],
      blockers: [],
      dependencies: [],
      warnings: [],
    },
    revenueExecutionPlan: {
      version: 1,
      companyId,
      generatedAt: "2026-06-28T00:00:00.000Z",
      executionState: "ready",
      executionMode: "approval_required",
      recommendedWorkflow: "sequence_enrollment",
      executionSteps: [],
      prerequisites: [],
      approvalsRequired: [],
      estimatedDurationMinutes: 10,
      confidence: 84,
      risks: [],
      blockers: [],
    },
    communicationStrategy: {
      version: 1,
      qa_marker: "communication-strategy-engine-v1",
      companyId,
      generatedAt: "2026-06-28T00:00:00.000Z",
      primaryChannel: "email",
      fallbackChannels: ["phone"],
      recommendedAction: "send_email",
      reasoning: ["Email follow-up due"],
      escalationPlan: [],
      stopConditions: [],
      waitConditions: [],
      confidence: 78,
      requiresHumanApproval: false,
      communicationPlanId: "plan-001",
      source: "communication_strategy_engine",
      ...overrides.communicationStrategy,
    },
    ...overrides,
  }
}

console.log("[GE-AIOS-SDR-2B] Daily Revenue Work Queue runtime integration certification")

assert.equal(
  GROWTH_DAILY_REVENUE_WORK_QUEUE_INTEGRATION_QA_MARKER,
  "daily-revenue-work-queue-integration-v1",
)

const queue = buildDailyRevenueWorkQueue({
  candidates: [
    candidate("lead-1"),
    candidate("lead-2", {
      communicationStrategy: {
        version: 1,
        qa_marker: "communication-strategy-engine-v1",
        companyId: "company-lead-2",
        generatedAt: "2026-06-28T00:00:00.000Z",
        primaryChannel: "phone",
        fallbackChannels: ["email"],
        recommendedAction: "place_call",
        reasoning: ["Phone follow-up due"],
        escalationPlan: [],
        stopConditions: [],
        waitConditions: [],
        confidence: 78,
        requiresHumanApproval: false,
        communicationPlanId: "plan-002",
        source: "communication_strategy_engine",
      },
    }),
    candidate("lead-3"),
  ],
})

const index = buildDailyRevenueWorkQueueIndex(queue)
assert.equal(index.get("lead-1")?.queuePosition, 1)
assert.equal(index.get("lead-3")?.queuePosition, 3)
assert.equal(index.size, 3)
console.log("  ✓ Queue index is deterministic")

const leadStatus = resolveLeadDailyWorkQueueStatus(queue, "lead-2")
assert.equal(leadStatus.in_queue, true)
assert.equal(leadStatus.queue_position, 2)
assert.equal(leadStatus.action_label, "Place call")
console.log("  ✓ Lead detail queue status resolves from queue")

type InboxRow = { id: string; leadId: string; source: string }
const inboxRows: InboxRow[] = [
  { id: "row-3", leadId: "lead-3", source: "inbox_thread" },
  { id: "row-1", leadId: "lead-1", source: "cadence" },
  { id: "row-2", leadId: "lead-2", source: "cadence" },
]
const inboxSorted = rankItemsWithDailyWorkQueue({
  items: inboxRows,
  queue,
  resolveLeadId: (row) => row.leadId,
  resolveInterrupt: (row) => row.source === "inbox_thread" || row.source === "human_approval",
})
assert.equal(inboxSorted[0]?.id, "row-3", "reply interrupts queue")
assert.equal(inboxSorted[1]?.leadId, "lead-1")
assert.equal(inboxSorted[2]?.leadId, "lead-2")
console.log("  ✓ Inbox merges reply interrupts with queue order")

const callRows = sortCallQueueRowsByDailyWorkQueue(
  [
    { leadId: "lead-3", id: "call-3" },
    { leadId: "lead-2", id: "call-2" },
    { leadId: "lead-9", id: "call-9" },
  ],
  queue,
)
assert.equal(callRows[0]?.leadId, "lead-2")
assert.equal(callRows[1]?.leadId, "lead-3")
console.log("  ✓ Call queue consumes high-priority call work order")

const highBoost = boostNotificationPriorityWithDailyWorkQueue({
  leadId: "lead-1",
  basePriorityScore: 10,
  queue,
})
const lowBoost = boostNotificationPriorityWithDailyWorkQueue({
  leadId: "lead-3",
  basePriorityScore: 10,
  queue,
})
assert.ok(highBoost > lowBoost)
console.log("  ✓ Notifications boost by queue priority and position")

const previewReason = buildEnrollmentPreviewQueueReason({
  queue,
  leadId: "lead-2",
  scheduledToday: true,
})
assert.ok(previewReason?.includes("#2"))
console.log("  ✓ Campaign enrollment preview explains queue position")

const learningEvent: AiOsEvent = {
  id: "evt-1",
  organizationId: "org-1",
  eventType: GROWTH_REVENUE_OUTCOME_EVENT,
  entityType: "lead",
  entityId: "lead-1",
  correlationId: "daily_queue:lead-1:send_email:completed",
  payload: {
    qa_marker: "revenue-outcome-integration-v1",
    lead_id: "lead-1",
    channel: "email",
    outcome: "completed",
    action: "send_email",
    runtime: "daily_revenue_work_queue",
    execution_id: "daily_queue:lead-1:send_email:completed",
    timestamp: "2026-06-28T12:00:00.000Z",
    confidence: 84,
  },
  occurredAt: "2026-06-28T12:00:00.000Z",
  createdAt: "2026-06-28T12:00:00.000Z",
}
const learningOutcome = normalizeLearningOutcomeFromEvent(learningEvent)
assert.equal(learningOutcome?.outcomeType, "completed")
assert.equal(learningOutcome?.dimensions.channel, "email")
console.log("  ✓ Completed queue items normalize into learning pipeline")

const consumerChecks: Array<{ file: string; mustInclude: string[]; mustExclude?: string[] }> = [
  {
    file: "lib/growth/operator-inbox/operator-inbox-aggregator.ts",
    mustInclude: ["rankItemsWithDailyWorkQueue", "dailyRevenueWorkQueue"],
  },
  {
    file: "lib/growth/call-queue-repository.ts",
    mustInclude: ["sortCallQueueRowsByDailyWorkQueue", "fetchDailyRevenueWorkQueue"],
  },
  {
    file: "lib/growth/notifications/notification-repository.ts",
    mustInclude: ["boostNotificationPriorityWithDailyWorkQueue"],
  },
  {
    file: "lib/growth/audiences/growth-audience-enrollment-readiness.ts",
    mustInclude: ["buildEnrollmentPreviewQueueReason"],
  },
  {
    file: "lib/growth/aios/ai-os-command-center-service.ts",
    mustInclude: ["fetchDailyRevenueWorkQueue"],
  },
  {
    file: "components/growth/growth-command-daily-action-queue.tsx",
    mustInclude: ["/api/platform/growth/daily-revenue-work-queue"],
    mustExclude: [".sort(", "sortScore"],
  },
  {
    file: "app/api/platform/growth/daily-revenue-work-queue/route.ts",
    mustInclude: ["fetchDailyRevenueWorkQueue", "leadId"],
  },
]

for (const check of consumerChecks) {
  const source = readSource(check.file)
  for (const token of check.mustInclude) {
    assert.ok(source.includes(token), `${check.file} must include ${token}`)
  }
  for (const token of check.mustExclude ?? []) {
    assert.equal(source.includes(token), false, `${check.file} must not include ${token}`)
  }
}
console.log("  ✓ Runtime consumers wired to canonical queue helpers/API")

console.log("\nGE-AIOS-SDR-2B integration certification passed.")
