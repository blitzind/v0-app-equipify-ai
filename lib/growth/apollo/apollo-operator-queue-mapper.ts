/** Map Apollo DB rows to normalized operator queue items — client-safe. */

import type {
  ApolloOperatorQueueItem,
  ApolloOperatorQueueOutcome,
  ApolloOperatorQueueStage,
} from "@/lib/growth/apollo/apollo-operator-scale-types"

const HIGH_CONFIDENCE_THRESHOLD = 70

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function outcomeFromEnrollmentStatus(status: string): ApolloOperatorQueueOutcome {
  if (status === "enrollment_approved") return "approved"
  if (status === "enrollment_rejected") return "rejected"
  if (status === "research_rerun_requested") return "regenerated"
  return "pending"
}

function outcomeFromPlaybookStatus(status: string): ApolloOperatorQueueOutcome {
  if (status === "playbook_approved") return "approved"
  if (status === "playbook_rejected") return "rejected"
  if (status === "playbook_rerun_requested") return "regenerated"
  return "pending"
}

function outcomeFromVoiceDropStatus(status: string): ApolloOperatorQueueOutcome {
  if (status === "voice_drop_approved") return "approved"
  if (status === "voice_drop_rejected") return "rejected"
  if (status === "intelligence_rerun_requested") return "regenerated"
  return "pending"
}

function outcomeFromMultichannelStatus(status: string): ApolloOperatorQueueOutcome {
  if (status === "sequence_approved") return "approved"
  if (status === "sequence_rejected") return "rejected"
  if (status === "recommendation_regenerated") return "regenerated"
  return "pending"
}

function outcomeFromSequenceExecutionStatus(status: string): ApolloOperatorQueueOutcome {
  if (status === "execution_ready") return "approved"
  if (status === "draft_rejected") return "rejected"
  if (status === "draft_regenerated") return "regenerated"
  return "pending"
}

function outcomeFromJobStatus(status: string): ApolloOperatorQueueOutcome {
  if (status === "approved" || status === "sent" || status === "scheduled" || status === "running") {
    return "approved"
  }
  if (status === "blocked" || status === "failed") return "rejected"
  return "pending"
}

export function mapEnrollmentRowToQueueItem(row: Record<string, unknown>): ApolloOperatorQueueItem {
  const status = asString(row.status)
  const metadata = (row.metadata as Record<string, unknown>) ?? {}
  return {
    id: asString(row.id),
    stage: "enrollment",
    status,
    outcome: outcomeFromEnrollmentStatus(status),
    created_at: asString(row.created_at),
    resolved_at: asString(row.enrollment_approved_at) || null,
    confidence_score: asNumber(row.qualification_score),
    regeneration_note: asString(metadata.research_rerun_note) || asString(row.enrollment_rejection_note) || null,
    metadata,
  }
}

export function mapPlaybookRowToQueueItem(row: Record<string, unknown>): ApolloOperatorQueueItem {
  const status = asString(row.status)
  const metadata = (row.metadata as Record<string, unknown>) ?? {}
  return {
    id: asString(row.id),
    stage: "account_playbook",
    status,
    outcome: outcomeFromPlaybookStatus(status),
    created_at: asString(row.created_at),
    resolved_at: asString(row.playbook_approved_at) || null,
    confidence_score: asNumber(row.confidence_score),
    regeneration_note: asString(row.playbook_rejection_note) || null,
    metadata,
  }
}

export function mapVoiceDropRowToQueueItem(row: Record<string, unknown>): ApolloOperatorQueueItem {
  const status = asString(row.status)
  const metadata = (row.metadata as Record<string, unknown>) ?? {}
  return {
    id: asString(row.id),
    stage: "voice_drop",
    status,
    outcome: outcomeFromVoiceDropStatus(status),
    created_at: asString(row.created_at),
    resolved_at: asString(row.voice_drop_approved_at) || null,
    confidence_score: asNumber(row.recommendation_confidence) ?? asNumber(row.voice_drop_score),
    regeneration_note: asString(row.voice_drop_rejection_note) || null,
    metadata,
  }
}

export function mapMultichannelRowToQueueItem(row: Record<string, unknown>): ApolloOperatorQueueItem {
  const status = asString(row.status)
  const metadata = (row.metadata as Record<string, unknown>) ?? {}
  return {
    id: asString(row.id),
    stage: "multichannel",
    status,
    outcome: outcomeFromMultichannelStatus(status),
    created_at: asString(row.created_at),
    resolved_at: asString(row.sequence_approved_at) || null,
    confidence_score: asNumber(row.orchestration_confidence) ?? asNumber(row.qualification_score),
    regeneration_note: asString(row.sequence_rejection_note) || null,
    metadata,
  }
}

export function mapSequenceExecutionRowToQueueItem(row: Record<string, unknown>): ApolloOperatorQueueItem {
  const status = asString(row.status)
  const metadata = (row.metadata as Record<string, unknown>) ?? {}
  const operatorSummary = (row.operator_summary as Record<string, unknown>) ?? {}
  return {
    id: asString(row.id),
    stage: "sequence_execution",
    status,
    outcome: outcomeFromSequenceExecutionStatus(status),
    created_at: asString(row.created_at),
    resolved_at: asString(row.drafts_approved_at) || null,
    confidence_score: asNumber(operatorSummary.confidence_score) ?? asNumber(metadata.confidence_score),
    regeneration_note: asString(row.draft_rejection_note) || asString(metadata.regeneration_reason) || null,
    metadata,
  }
}

export function mapSafeExecutionJobToQueueItem(row: Record<string, unknown>): ApolloOperatorQueueItem {
  const status = asString(row.status)
  const metadata = (row.metadata as Record<string, unknown>) ?? {}
  return {
    id: asString(row.id),
    stage: "safe_execution",
    status,
    outcome: outcomeFromJobStatus(status),
    created_at: asString(row.created_at),
    resolved_at: asString(row.human_approved_at) || null,
    confidence_score: asNumber(metadata.confidence_score),
    regeneration_note: asString(row.last_error) || null,
    metadata,
  }
}

export const APOLLO_OPERATOR_HIGH_CONFIDENCE_THRESHOLD = HIGH_CONFIDENCE_THRESHOLD

export const APOLLO_OPERATOR_QUEUE_STAGE_LABELS: Record<ApolloOperatorQueueStage, string> = {
  enrollment: "Enrollment",
  account_playbook: "Account Playbook",
  voice_drop: "Voice Drop",
  multichannel: "Multi-Channel",
  sequence_execution: "Sequence Execution",
  safe_execution: "Safe Execution",
}
