/**
 * GE-AIOS-SDR-2A — Ava Daily Revenue Work Queue certification.
 * Run: pnpm test:growth-daily-revenue-work-queue
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { AcquisitionCandidate } from "../lib/growth/contact-verification/contact-acquisition-types"
import type { CommunicationStrategy } from "../lib/growth/contact-verification/communication-strategy-types"
import type { NextBestAction } from "../lib/growth/contact-verification/next-best-action-types"
import type { ProspectQualification } from "../lib/growth/contact-verification/prospect-qualification-types"
import type { RevenueExecutionPlan } from "../lib/growth/contact-verification/revenue-execution-plan-types"
import type { SequenceRecommendation } from "../lib/growth/contact-verification/sequence-recommendation-types"
import {
  buildDailyRevenueWorkQueue,
  summarizeDailyRevenueWorkQueue,
} from "../lib/growth/daily-work-queue/daily-revenue-work-queue-engine"
import {
  isDailyRevenueWorkQueueEnabled,
  isDailyRevenueWorkQueueEnabledClient,
} from "../lib/growth/daily-work-queue/daily-revenue-work-queue-feature"
import {
  DEFAULT_DAILY_REVENUE_WORK_QUEUE_CAPACITY,
  GROWTH_DAILY_REVENUE_WORK_QUEUE_QA_MARKER,
  type DailyRevenueWorkQueueCandidate,
} from "../lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import { adaptDailyRevenueWorkQueueToDisplaySummary } from "../lib/growth/daily-work-queue/daily-revenue-work-queue-view"

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

const FIXTURE_ACQUISITION: AcquisitionCandidate = {
  version: 1,
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  primaryContact: {
    personId: "person-001",
    fullName: "Chris Taylor",
    title: "VP Operations",
    email: "chris.taylor@example.com",
    confidence: 88,
  },
  verification: { emailVerified: true, deliverability: "verified", confidence: 92 },
  committee: { role: "economic_buyer", confidence: 72 },
  outreach: { readiness: "ready", preferredChannel: "email" },
  backupContacts: [],
  blockers: [],
  reasons: ["Verified executive"],
  overallConfidence: 88,
}

const BASE_QUALIFICATION: ProspectQualification = {
  version: 1,
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  qualification: "qualified",
  overallScore: 82,
  fitScore: 80,
  contactScore: 85,
  engagementScore: 70,
  buyingCommitteeCoverage: 67,
  confidence: 84,
  acquisitionCandidate: FIXTURE_ACQUISITION,
  strengths: [],
  risks: [],
  blockers: [],
  recommendations: [],
  nextAction: "enroll_sequence",
}

const BASE_SEQUENCE: SequenceRecommendation = {
  version: 1,
  companyId: "company-fixture-001",
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
}

const BASE_NBA: NextBestAction = {
  version: 1,
  companyId: "company-fixture-001",
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
}

const BASE_REP: RevenueExecutionPlan = {
  version: 1,
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  executionState: "ready",
  executionMode: "approval_required",
  recommendedWorkflow: "sequence_enrollment",
  executionSteps: [],
  prerequisites: [],
  approvalsRequired: ["human_approval"],
  estimatedDurationMinutes: 10,
  confidence: 84,
  risks: [],
  blockers: [],
}

function strategy(overrides: Partial<CommunicationStrategy>): CommunicationStrategy {
  return {
    version: 1,
    qa_marker: "communication-strategy-engine-v1",
    companyId: "company-fixture-001",
    generatedAt: "2026-06-28T00:00:00.000Z",
    primaryChannel: "email",
    fallbackChannels: ["phone"],
    recommendedAction: "send_email",
    reasoning: ["Qualified executive outreach"],
    escalationPlan: [],
    stopConditions: [],
    waitConditions: [],
    confidence: 84,
    requiresHumanApproval: true,
    communicationPlanId: "plan-001",
    source: "communication_strategy_engine",
    ...overrides,
  }
}

function candidate(
  leadId: string,
  overrides: Partial<DailyRevenueWorkQueueCandidate> = {},
): DailyRevenueWorkQueueCandidate {
  return {
    leadId,
    companyId: `company-${leadId}`,
    qualification: BASE_QUALIFICATION,
    sequenceRecommendation: BASE_SEQUENCE,
    nextBestAction: BASE_NBA,
    revenueExecutionPlan: BASE_REP,
    communicationStrategy: strategy({ companyId: `company-${leadId}` }),
    ...overrides,
  }
}

async function main(): Promise<void> {
  console.log("\n=== GE-AIOS-SDR-2A Daily Revenue Work Queue Certification ===\n")

  withEnv({ GROWTH_DAILY_REVENUE_WORK_QUEUE: undefined, GROWTH_COMMUNICATION_STRATEGY: undefined }, () => {
    assert.equal(isDailyRevenueWorkQueueEnabled(), false)
  })
  withEnv({ GROWTH_DAILY_REVENUE_WORK_QUEUE: "true" }, () => {
    assert.equal(isDailyRevenueWorkQueueEnabled(), true)
  })
  withEnv({ GROWTH_COMMUNICATION_STRATEGY: "true" }, () => {
    assert.equal(isDailyRevenueWorkQueueEnabled(), true)
  })
  console.log("  ✓ Feature flag defaults and enable paths")

  const morning = buildDailyRevenueWorkQueue({
    generatedAt: "2026-06-28T09:00:00.000Z",
    candidates: [candidate("lead-001"), candidate("lead-002")],
    workingHours: { startHour: 8, endHour: 18, timezone: "UTC" },
  })
  assert.equal(morning.qa_marker, GROWTH_DAILY_REVENUE_WORK_QUEUE_QA_MARKER)
  assert.equal(morning.totalAccounts, 2)
  assert.ok(morning.high.length + morning.medium.length + morning.critical.length >= 1)
  console.log("  ✓ Morning startup builds queue")

  const hundred = buildDailyRevenueWorkQueue({
    candidates: Array.from({ length: 100 }, (_, index) => candidate(`lead-${index + 1}`)),
    capacityLimits: DEFAULT_DAILY_REVENUE_WORK_QUEUE_CAPACITY,
  })
  assert.equal(hundred.totalAccounts, 100)
  const actionable =
    hundred.critical.length + hundred.high.length + hundred.medium.length + hundred.low.length
  assert.ok(actionable <= hundred.suggestedDailyCapacity + hundred.critical.length)
  assert.ok(hundred.waiting.length > 0, "capacity should defer overflow to waiting")
  console.log("  ✓ 100 leads balanced with capacity deferrals")

  const meetingFirst = buildDailyRevenueWorkQueue({
    candidates: [
      candidate("lead-email", {
        communicationStrategy: strategy({ recommendedAction: "send_email", primaryChannel: "email" }),
      }),
      candidate("lead-meeting", {
        meetingState: { meetingToday: true, meetingScheduledAt: "2026-06-28T14:00:00.000Z" },
        communicationStrategy: strategy({
          recommendedAction: "schedule_meeting",
          primaryChannel: "email",
        }),
      }),
    ],
  })
  assert.equal(meetingFirst.critical[0]?.leadId, "lead-meeting")
  console.log("  ✓ Meetings prioritized over outreach")

  const replyInterrupt = buildDailyRevenueWorkQueue({
    candidates: [
      candidate("lead-a"),
      candidate("lead-reply", {
        replyIntelligence: { positiveReply: true },
        communicationStrategy: strategy({ recommendedAction: "schedule_meeting" }),
      }),
    ],
  })
  assert.equal(replyInterrupt.critical[0]?.leadId, "lead-reply")
  console.log("  ✓ Positive replies interrupt queue")

  const voiceDrop = buildDailyRevenueWorkQueue({
    candidates: [
      candidate("lead-vd", {
        communicationStrategy: strategy({
          recommendedAction: "launch_voice_drop",
          primaryChannel: "voice_drop",
        }),
      }),
    ],
    capacityLimits: { channelLimits: { voice_drop: 3, email: 18, phone: 7, sms: 5 } },
  })
  assert.equal(voiceDrop.channelAllocation.voice_drop, 1)
  assert.equal(voiceDrop.high[0]?.action, "launch_voice_drop")
  console.log("  ✓ Voice drop inserted correctly")

  const smsItem = buildDailyRevenueWorkQueue({
    candidates: [
      candidate("lead-sms", {
        communicationStrategy: strategy({ recommendedAction: "send_sms", primaryChannel: "sms" }),
      }),
    ],
  })
  assert.equal(smsItem.channelAllocation.sms, 1)
  console.log("  ✓ SMS inserted correctly")

  const disqualified = buildDailyRevenueWorkQueue({
    candidates: [
      candidate("lead-bad", {
        qualification: { ...BASE_QUALIFICATION, qualification: "disqualified" },
        nextBestAction: { ...BASE_NBA, action: "disqualify" },
        communicationStrategy: strategy({ recommendedAction: "stop", primaryChannel: "stop" }),
      }),
    ],
  })
  assert.equal(disqualified.blocked.length, 1)
  assert.equal(disqualified.critical.length + disqualified.high.length, 0)
  console.log("  ✓ Disqualified leads excluded from actionable buckets")

  const suppressed = buildDailyRevenueWorkQueue({
    candidates: [candidate("lead-suppressed")],
    suppressionList: ["lead-suppressed"],
  })
  assert.equal(suppressed.totalAccounts, 1)
  assert.equal(
    suppressed.critical.length +
      suppressed.high.length +
      suppressed.medium.length +
      suppressed.low.length,
    0,
  )
  console.log("  ✓ Suppressed leads excluded")

  const deduped = buildDailyRevenueWorkQueue({
    candidates: [
      candidate("lead-dup", {
        existingTasks: [{ taskKey: "lead-dup:send_email", status: "pending" }],
      }),
    ],
  })
  assert.equal(deduped.high.length + deduped.medium.length, 0)
  console.log("  ✓ No duplicate work items when task already exists")

  const deterministicA = buildDailyRevenueWorkQueue({
    generatedAt: "2026-06-28T09:00:00.000Z",
    candidates: [
      candidate("lead-z"),
      candidate("lead-a"),
      candidate("lead-m"),
    ],
  })
  const deterministicB = buildDailyRevenueWorkQueue({
    generatedAt: "2026-06-28T09:00:00.000Z",
    candidates: [
      candidate("lead-z"),
      candidate("lead-a"),
      candidate("lead-m"),
    ],
  })
  assert.deepEqual(
    [...deterministicA.high, ...deterministicA.medium].map((item) => item.leadId),
    [...deterministicB.high, ...deterministicB.medium].map((item) => item.leadId),
  )
  console.log("  ✓ Deterministic ordering")

  const mailboxLimited = buildDailyRevenueWorkQueue({
    candidates: Array.from({ length: 25 }, (_, index) =>
      candidate(`email-lead-${index}`, {
        communicationStrategy: strategy({
          companyId: `company-email-${index}`,
          recommendedAction: "send_email",
          primaryChannel: "email",
        }),
      }),
    ),
    capacityLimits: {
      channelLimits: { email: 18 },
      mailboxDailyLimit: 18,
      warmupDailyLimit: 12,
    },
  })
  assert.equal(mailboxLimited.channelAllocation.email, 12)
  assert.ok(mailboxLimited.waiting.length >= 13)
  console.log("  ✓ Mailbox and warmup limits respected")

  const summary = summarizeDailyRevenueWorkQueue(hundred)
  assert.ok(summary.actionableCount >= 0)
  const display = adaptDailyRevenueWorkQueueToDisplaySummary(hundred)
  assert.equal(display.qa_marker, GROWTH_DAILY_REVENUE_WORK_QUEUE_QA_MARKER)
  console.log("  ✓ Display adapter and summary")

  assert.match(readSource("lib/growth/command/command-center-daily-action-queue.ts"), /buildDailyRevenueWorkQueue/)
  assert.match(readSource("components/growth/growth-command-daily-action-queue.tsx"), /daily-revenue-work-queue/)
  assert.match(readSource("lib/growth/daily-work-queue/daily-revenue-work-queue-resolver.ts"), /resolveLeadCommunicationStrategyBundle/)
  console.log("  ✓ Command Center and resolver wired")

  assert.match(readSource("package.json"), /test:growth-daily-revenue-work-queue/)
  assert.match(readSource("next.config.mjs"), /NEXT_PUBLIC_GROWTH_DAILY_REVENUE_WORK_QUEUE/)
  console.log("  ✓ Env exposure and test script registered")

  withEnv({ NEXT_PUBLIC_GROWTH_DAILY_REVENUE_WORK_QUEUE: "true" }, () => {
    assert.equal(isDailyRevenueWorkQueueEnabledClient(), true)
  })
  console.log("  ✓ Client feature flag")

  console.log("\n=== GE-AIOS-SDR-2A certification passed ===\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
