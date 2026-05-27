/**
 * Regression checks for Multi-Channel Sequence Orchestration (Phase 2P).
 * Run: pnpm test:growth-multichannel-sequences
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateChannelTaskApprovalGate,
  evaluateChannelTaskCompleteGate,
  evaluateChannelTaskSkipGate,
} from "../lib/growth/multichannel/channel-approval-gate"
import { channelAttributionWeight } from "../lib/growth/multichannel/multichannel-types"
import {
  channelIsBlockedPlaceholder,
  channelRequiresApproval,
  mapEnrollmentChannelToMultichannel,
  selectChannelRoutingRule,
} from "../lib/growth/multichannel/channel-routing"
import {
  detectBookingIntentFromInbox,
  hasMinimumBookingEvidence,
} from "../lib/growth/booking-intelligence/booking-intent-detector"
import {
  GROWTH_FUTURE_PLACEHOLDER_CHANNELS,
  GROWTH_MULTICHANNEL_SEQUENCES_PRIVACY_NOTE,
  GROWTH_MULTICHANNEL_SEQUENCES_QA_MARKER,
  GROWTH_SEQUENCE_CHANNEL_TASK_STATUSES,
  GROWTH_SEQUENCE_CHANNEL_TYPES,
  isFuturePlaceholderChannel,
  sanitizeChannelEvidenceSnippet,
} from "../lib/growth/multichannel/multichannel-types"
import { GROWTH_MULTICHANNEL_SEQUENCES_SCHEMA_MIGRATION } from "../lib/growth/multichannel/schema-health"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_MULTICHANNEL_SEQUENCES_QA_MARKER, "growth-multichannel-sequences-v1")
  assert.match(GROWTH_MULTICHANNEL_SEQUENCES_PRIVACY_NOTE, /human approval/i)
  assert.match(GROWTH_MULTICHANNEL_SEQUENCES_PRIVACY_NOTE, /No autonomous/i)
  assert.equal(GROWTH_SEQUENCE_CHANNEL_TYPES.length, 7)
  assert.equal(GROWTH_SEQUENCE_CHANNEL_TASK_STATUSES.length, 7)
  assert.equal(GROWTH_FUTURE_PLACEHOLDER_CHANNELS.length, 2)

  const migration = readSource(`supabase/migrations/${GROWTH_MULTICHANNEL_SEQUENCES_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.sequence_channel_tasks/)
  assert.match(migration, /growth\.sequence_channel_task_events/)
  assert.match(migration, /growth\.channel_performance_snapshots/)
  assert.match(migration, /growth\.channel_routing_rules/)
  assert.match(migration, /requires_human_approval/)
  assert.match(migration, /service role only/i)

  assert.equal(mapEnrollmentChannelToMultichannel("email"), "email")
  assert.equal(mapEnrollmentChannelToMultichannel("manual_call"), "manual_call")
  assert.equal(mapEnrollmentChannelToMultichannel("linkedin"), "linkedin_manual")
  assert.equal(mapEnrollmentChannelToMultichannel("sms_future"), "sms_future")
  assert.ok(isFuturePlaceholderChannel("sms_future"))
  assert.ok(isFuturePlaceholderChannel("voicemail_future"))

  const rules = [
    {
      id: "r1",
      channel: "manual_call" as const,
      label: "Manual call",
      priority: 10,
      isActive: true,
      requiresApproval: true,
      isFuturePlaceholder: false,
      matchCriteria: {},
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "r2",
      channel: "sms_future" as const,
      label: "SMS future",
      priority: 900,
      isActive: true,
      requiresApproval: true,
      isFuturePlaceholder: true,
      matchCriteria: { blocked: true },
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
  assert.equal(selectChannelRoutingRule(rules, "manual_call")?.label, "Manual call")
  assert.ok(channelRequiresApproval(rules, "manual_call"))
  assert.ok(channelIsBlockedPlaceholder(rules, "sms_future"))
  assert.equal(channelAttributionWeight("manual_call"), 1.5)
  assert.equal(channelAttributionWeight("sms_future"), 0)

  const pendingGate = evaluateChannelTaskApprovalGate({
    task: { status: "pending", channel: "manual_call", requiresHumanApproval: true },
  })
  assert.equal(pendingGate.allowed, false)
  assert.equal(pendingGate.code, "human_approval_confirmed_required")

  const blockedGate = evaluateChannelTaskApprovalGate({
    task: { status: "pending", channel: "sms_future", requiresHumanApproval: true },
    humanApprovalConfirmed: true,
  })
  assert.equal(blockedGate.allowed, false)
  assert.equal(blockedGate.code, "future_channel_blocked")

  const approveOk = evaluateChannelTaskApprovalGate({
    task: { status: "pending", channel: "manual_call", requiresHumanApproval: true },
    humanApprovalConfirmed: true,
  })
  assert.equal(approveOk.allowed, true)

  const completeGate = evaluateChannelTaskCompleteGate({
    task: { status: "pending", channel: "manual_call" },
    humanApprovalConfirmed: true,
  })
  assert.equal(completeGate.allowed, false)

  const skipGate = evaluateChannelTaskSkipGate({ task: { status: "pending" } })
  assert.equal(skipGate.allowed, true)

  assert.equal(sanitizeChannelEvidenceSnippet("  call\x00task  "), "call task")

  const plannerSource = readSource("lib/growth/multichannel/channel-task-planner.ts")
  assert.match(plannerSource, /planMultichannelSequenceTasks/)
  assert.match(plannerSource, /listDueSequenceSchedulerSteps/)
  assert.match(plannerSource, /nativeCallWorkspaceHref/)
  assert.match(plannerSource, /createSequenceExecutionJob/)
  assert.match(plannerSource, /no_autonomous_external_action/)
  assert.doesNotMatch(plannerSource, /executeTransportSend\(|autoDial\(|robocall\(/i)

  const runnerSource = readSource("lib/growth/multichannel/channel-task-runner.ts")
  assert.match(runnerSource, /approveChannelTask/)
  assert.match(runnerSource, /completeChannelTask/)
  assert.match(runnerSource, /skipChannelTask/)
  assert.match(runnerSource, /recordChannelPerformanceSnapshot/)
  assert.match(runnerSource, /manually_completed/)
  assert.doesNotMatch(runnerSource, /executeTransportSend\(|syncGrowthMeeting|submitPublicBooking|autoDial\(/i)

  const performanceSource = readSource("lib/growth/multichannel/channel-performance.ts")
  assert.match(performanceSource, /recordChannelPerformanceSnapshot/)

  for (const route of [
    "app/api/platform/growth/multichannel/dashboard/route.ts",
    "app/api/platform/growth/multichannel/tasks/route.ts",
    "app/api/platform/growth/multichannel/plan/route.ts",
    "app/api/platform/growth/multichannel/tasks/[id]/approve/route.ts",
    "app/api/platform/growth/multichannel/tasks/[id]/complete/route.ts",
    "app/api/platform/growth/multichannel/tasks/[id]/skip/route.ts",
  ]) {
    const source = readSource(route)
    assert.match(source, /requireGrowthEnginePlatformAccess/)
    assert.match(source, /isGrowthMultichannelSequencesSchemaReady/)
    assert.doesNotMatch(source, /api_key|secret|password|calendar_token/i)
  }

  const approveRoute = readSource("app/api/platform/growth/multichannel/tasks/[id]/approve/route.ts")
  assert.match(approveRoute, /humanApprovalConfirmed/)
  assert.match(approveRoute, /no autonomous external action/)

  const completeRoute = readSource("app/api/platform/growth/multichannel/tasks/[id]/complete/route.ts")
  assert.match(completeRoute, /humanApprovalConfirmed/)

  const uiSource = readSource("components/growth/growth-multichannel-dashboard.tsx")
  assert.match(uiSource, /GROWTH_MULTICHANNEL_SEQUENCES_QA_MARKER/)
  assert.match(uiSource, /Channel Tasks Due/)
  assert.match(uiSource, /Email Steps/)
  assert.match(uiSource, /Call Tasks/)
  assert.match(uiSource, /LinkedIn Manual Tasks/)
  assert.match(uiSource, /Booking Follow-ups/)
  assert.match(uiSource, /Blocked Future Channels/)

  const leadPanelSource = readSource("components/growth/growth-lead-multichannel-timeline-panel.tsx")
  assert.match(leadPanelSource, /Multi-Channel Timeline/)

  const sequenceUiSource = readSource("components/growth/growth-sequence-safe-execution-dashboard.tsx")
  assert.match(sequenceUiSource, /Multi-Channel Task Timeline/)
  assert.match(sequenceUiSource, /Call Workspace/)
  assert.match(sequenceUiSource, /Booking Intelligence/)

  const navSource = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
  assert.match(navSource, /\/admin\/growth\/multichannel/)

  const bookingIntents = detectBookingIntentFromInbox({
    body: "Can we schedule a demo call next week?",
    classification: "meeting_intent",
  })
  assert.ok(hasMinimumBookingEvidence(bookingIntents))

  console.log("growth-multichannel-sequences-v1: all checks passed")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
