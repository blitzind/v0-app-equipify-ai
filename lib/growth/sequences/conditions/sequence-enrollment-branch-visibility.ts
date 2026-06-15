import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listBranchDecisionsForEnrollment,
  listEdgesForPattern,
  listWaitsForEnrollment,
} from "@/lib/growth/sequences/conditions/sequence-condition-repository"
import {
  GROWTH_SEQUENCE_BRANCH_VISIBILITY_QA_MARKER,
  type SequenceEnrollmentBranchDecisionView,
  type SequenceEnrollmentBranchSkippedStepView,
  type SequenceEnrollmentBranchTimelineEntry,
  type SequenceEnrollmentBranchVisibilityView,
  type SequenceEnrollmentBranchWaitView,
} from "@/lib/growth/sequences/conditions/sequence-enrollment-branch-visibility-types"
import { listSequenceEnrollmentChannelEvents } from "@/lib/growth/sequence-orchestration/sequence-multi-channel-state-repository"
import type { GrowthSequenceChannelEventKind } from "@/lib/growth/sequence-orchestration/sequence-multi-channel-state-types"
import type { GrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment-types"
import { isTerminalEnrollmentWaitStatus } from "@/lib/growth/sequences/conditions/sequence-wait-types"

export { GROWTH_SEQUENCE_BRANCH_VISIBILITY_QA_MARKER }

const BRANCH_CHANNEL_EVENT_KINDS = new Set<string>([
  "branch_evaluated",
  "wait_started",
  "wait_resolved",
  "condition_timeout",
  "advancement_blocked",
])

function mapWait(wait: Awaited<ReturnType<typeof listWaitsForEnrollment>>[number]): SequenceEnrollmentBranchWaitView {
  return {
    id: wait.id,
    enrollmentStepId: wait.enrollmentStepId,
    patternStepId: wait.patternStepId,
    status: wait.status,
    waitKind: wait.waitKind,
    waitedForEvent: wait.waitedForEvent,
    waitedForSource: wait.waitedForSource,
    timeoutAt: wait.timeoutAt,
    startedAt: wait.startedAt,
    resolvedAt: wait.resolvedAt,
    resolutionReason: wait.resolutionReason,
    isActive: !isTerminalEnrollmentWaitStatus(wait.status),
  }
}

function extractEvidenceRefs(metadata: Record<string, unknown>): string[] {
  const refs = metadata.evidence_refs
  if (!Array.isArray(refs)) return []
  return refs.filter((entry): entry is string => typeof entry === "string")
}

export async function fetchSequenceEnrollmentBranchVisibility(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    sequencePatternId: string | null
    enrollmentSteps: GrowthSequenceEnrollmentStep[]
  },
): Promise<SequenceEnrollmentBranchVisibilityView> {
  const [waits, branchDecisions, channelEvents] = await Promise.all([
    listWaitsForEnrollment(admin, input.enrollmentId),
    listBranchDecisionsForEnrollment(admin, input.enrollmentId),
    listSequenceEnrollmentChannelEvents(admin, { enrollmentId: input.enrollmentId, limit: 200 }),
  ])

  const branchChannelEvents = channelEvents.filter((event) =>
    BRANCH_CHANNEL_EVENT_KINDS.has(event.eventKind),
  )

  const timeline: SequenceEnrollmentBranchTimelineEntry[] = branchChannelEvents.map((event) => ({
    id: event.id,
    occurredAt: event.occurredAt,
    eventKind: event.eventKind as GrowthSequenceChannelEventKind,
    title: event.title,
    summary: event.summary,
    enrollmentStepId: event.enrollmentStepId,
    evidenceRefs: extractEvidenceRefs(event.metadata),
  }))

  const skippedSteps: SequenceEnrollmentBranchSkippedStepView[] = input.enrollmentSteps
    .filter((step) => step.status === "branch_skipped")
    .map((step) => ({
      enrollmentStepId: step.id,
      stepOrder: step.stepOrder,
      channel: step.channel,
      skipReason: step.skipReason ?? null,
    }))

  const evidenceRefs = [
    ...new Set([
      ...timeline.flatMap((entry) => entry.evidenceRefs),
      ...branchDecisions.flatMap((decision) =>
        decision.outcomeDetail ? [] : [],
      ),
    ]),
  ]

  const decisionViews: SequenceEnrollmentBranchDecisionView[] = branchDecisions.map((decision) => ({
    id: decision.id,
    enrollmentStepId: decision.enrollmentStepId,
    patternStepId: decision.patternStepId,
    decision: decision.decision,
    source: decision.source,
    event: decision.event,
    outcomeDetail: decision.outcomeDetail,
    evaluatedAt: decision.evaluatedAt,
    edgeId: decision.edgeId,
    conditionId: decision.conditionId,
  }))

  let hasConditionalGraph = branchDecisions.length > 0 || waits.length > 0 || timeline.length > 0
  if (input.sequencePatternId) {
    const edges = await listEdgesForPattern(admin, input.sequencePatternId).catch(() => [])
    hasConditionalGraph = hasConditionalGraph || edges.length > 0
  }

  return {
    qaMarker: GROWTH_SEQUENCE_BRANCH_VISIBILITY_QA_MARKER,
    readOnly: true,
    activeWaits: waits.filter((wait) => !isTerminalEnrollmentWaitStatus(wait.status)).map(mapWait),
    branchDecisions: decisionViews,
    timeline: timeline.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
    skippedSteps,
    evidenceRefs,
    blockedAdvancementCount: timeline.filter((entry) => entry.eventKind === "advancement_blocked").length,
    hasConditionalGraph,
  }
}
