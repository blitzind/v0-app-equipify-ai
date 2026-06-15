import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { recordSequenceEnrollmentChannelEvent } from "@/lib/growth/sequence-orchestration/sequence-multi-channel-state-repository"
import type { GrowthSequenceChannelEventKind } from "@/lib/growth/sequence-orchestration/sequence-multi-channel-state-types"
import type { SequenceBranchEdge } from "@/lib/growth/sequences/conditions/sequence-branch-types"
import type { SequenceBranchResolverResult } from "@/lib/growth/sequences/conditions/sequence-branch-resolver-types"
import { GROWTH_SEQUENCE_BRANCH_RESOLVER_QA_MARKER } from "@/lib/growth/sequences/conditions/sequence-branch-resolver-types"
import { GROWTH_SEQUENCE_WAIT_REGISTRY_QA_MARKER } from "@/lib/growth/sequences/conditions/sequence-wait-registry-types"
import type { SequenceConditionMaskedEvidence } from "@/lib/growth/sequences/conditions/sequence-condition-evaluator-types"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"

export async function recordSequenceBranchEvaluatedAudit(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    enrollmentStepId: string
    leadId: string
    fromPatternStepId: string
    resolver: SequenceBranchResolverResult
    evidence: SequenceConditionMaskedEvidence[]
    skippedPatternStepIds: string[]
    occurredAt?: string
  },
): Promise<void> {
  const metadata = {
    qa_marker: GROWTH_SEQUENCE_BRANCH_RESOLVER_QA_MARKER,
    from_pattern_step_id: input.fromPatternStepId,
    selected_edge_id: input.resolver.selectedEdge?.id ?? null,
    target_pattern_step_id: input.resolver.targetPatternStepId,
    resolution: input.resolver.resolution,
    reason: input.resolver.reason,
    skipped_pattern_step_ids: input.skippedPatternStepIds,
    skipped_edge_ids: input.resolver.skippedEdges.map((edge) => edge.id),
    evidence_refs: input.evidence.map((entry) => entry.ref),
  }

  await recordSequenceEnrollmentChannelEvent(admin, {
    enrollmentId: input.enrollmentId,
    enrollmentStepId: input.enrollmentStepId,
    leadId: input.leadId,
    channel: "sequence",
    eventKind: "branch_evaluated" as GrowthSequenceChannelEventKind,
    title: "Sequence branch evaluated",
    summary: input.resolver.reason.slice(0, 500),
    metadata,
    occurredAt: input.occurredAt,
  })

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "sequence_branch_evaluated",
    title: "Sequence branch evaluated",
    summary: input.resolver.reason,
    payload: metadata,
    occurredAt: input.occurredAt,
  })
}

export async function recordSequenceWaitStartedAudit(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    enrollmentStepId: string
    leadId: string
    waitId: string
    conditionId: string
    waitedForEvent: string
    occurredAt?: string
  },
): Promise<void> {
  const metadata = {
    qa_marker: GROWTH_SEQUENCE_WAIT_REGISTRY_QA_MARKER,
    wait_id: input.waitId,
    condition_id: input.conditionId,
    waited_for_event: input.waitedForEvent,
  }

  await recordSequenceEnrollmentChannelEvent(admin, {
    enrollmentId: input.enrollmentId,
    enrollmentStepId: input.enrollmentStepId,
    leadId: input.leadId,
    channel: "sequence",
    eventKind: "wait_started" as GrowthSequenceChannelEventKind,
    title: "Sequence wait started",
    summary: `Waiting for ${input.waitedForEvent}.`,
    metadata,
    occurredAt: input.occurredAt,
  })
}

export async function recordSequenceWaitResolvedAudit(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    enrollmentStepId: string
    leadId: string
    waitId: string
    resolutionReason: string
    selectedEdge?: SequenceBranchEdge | null
    occurredAt?: string
  },
): Promise<void> {
  const metadata = {
    qa_marker: GROWTH_SEQUENCE_WAIT_REGISTRY_QA_MARKER,
    wait_id: input.waitId,
    resolution_reason: input.resolutionReason,
    selected_edge_id: input.selectedEdge?.id ?? null,
    target_pattern_step_id: input.selectedEdge?.toPatternStepId ?? null,
  }

  await recordSequenceEnrollmentChannelEvent(admin, {
    enrollmentId: input.enrollmentId,
    enrollmentStepId: input.enrollmentStepId,
    leadId: input.leadId,
    channel: "sequence",
    eventKind: "wait_resolved" as GrowthSequenceChannelEventKind,
    title: "Sequence wait resolved",
    summary: `Wait resolved (${input.resolutionReason}).`,
    metadata,
    occurredAt: input.occurredAt,
  })
}

export async function recordSequenceConditionTimeoutAudit(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    enrollmentStepId: string
    leadId: string
    waitId: string
    conditionId: string
    occurredAt?: string
  },
): Promise<void> {
  await recordSequenceEnrollmentChannelEvent(admin, {
    enrollmentId: input.enrollmentId,
    enrollmentStepId: input.enrollmentStepId,
    leadId: input.leadId,
    channel: "sequence",
    eventKind: "condition_timeout" as GrowthSequenceChannelEventKind,
    title: "Sequence condition timed out",
    summary: "Branch condition wait timed out.",
    metadata: {
      qa_marker: GROWTH_SEQUENCE_WAIT_REGISTRY_QA_MARKER,
      wait_id: input.waitId,
      condition_id: input.conditionId,
    },
    occurredAt: input.occurredAt,
  })
}
