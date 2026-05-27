/** Client-safe Growth Engine sequence safe execution types (Phase 2H). */

export const GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER = "growth-sequence-safe-execution-v1" as const

export const GROWTH_SEQUENCE_SAFE_EXECUTION_PRIVACY_NOTE =
  "Sequence safe execution owned by Growth Engine. Human approval required for every send — no autonomous AI decisions, no raw provider secrets in UI."

export const GROWTH_SEQUENCE_EXECUTION_JOB_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
  "running",
  "sent",
  "blocked",
  "failed",
  "skipped",
] as const

export type GrowthSequenceExecutionJobStatus = (typeof GROWTH_SEQUENCE_EXECUTION_JOB_STATUSES)[number]

export const GROWTH_SEQUENCE_EXECUTION_ACTIVE_JOB_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
  "running",
] as const

export const GROWTH_SEQUENCE_EXECUTION_TIMELINE_EVENT_TYPES = [
  "sequence_step_scheduled",
  "sequence_step_approved",
  "sequence_step_blocked",
  "sequence_step_sent",
  "sequence_step_failed",
  "sequence_step_skipped",
] as const

export type GrowthSequenceExecutionTimelineEventType =
  (typeof GROWTH_SEQUENCE_EXECUTION_TIMELINE_EVENT_TYPES)[number]

export type GrowthSequenceExecutionJob = {
  id: string
  sequenceEnrollmentId: string
  sequenceStepId: string | null
  leadId: string
  senderAccountId: string | null
  providerId: string | null
  status: GrowthSequenceExecutionJobStatus
  scheduledFor: string
  lockedAt: string | null
  lockedBy: string | null
  attemptCount: number
  lastError: string | null
  deliveryAttemptId: string | null
  requiresHumanApproval: boolean
  humanApprovedAt: string | null
  humanApprovedBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthSequenceExecutionJobEvent = {
  id: string
  jobId: string
  eventType: string
  severity: "info" | "low" | "medium" | "high" | "critical"
  title: string
  description: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type GrowthSequenceExecutionJobView = GrowthSequenceExecutionJob & {
  leadLabel: string
  sequenceLabel: string
  stepLabel: string
  providerLabel: string | null
}

export type GrowthSequenceSafeExecutionDashboard = {
  qa_marker: typeof GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER
  dueJobs: number
  pendingApproval: number
  blocked: number
  sent24h: number
  jobs: GrowthSequenceExecutionJobView[]
}

export type GrowthSequenceExecutionPlanResult = {
  scanned: number
  created: number
  skippedExisting: number
  skippedNonEmail: number
  failed: number
}

export type GrowthSequenceExecutionRunResult = {
  ok: boolean
  jobId: string
  status: GrowthSequenceExecutionJobStatus
  deliveryAttemptId?: string | null
  message?: string
  blocked?: boolean
}

export type GrowthSequenceApprovalGateInput = {
  humanApproved?: boolean
  humanApprovalConfirmed?: boolean
  approvedBy?: string | null
  job: Pick<GrowthSequenceExecutionJob, "requiresHumanApproval" | "humanApprovedAt" | "humanApprovedBy">
}

export type GrowthSequenceApprovalGateResult = {
  allowed: boolean
  code: "ok" | "human_approval_required" | "human_approval_confirmed_required" | "approved_by_required" | "not_yet_approved"
  message: string
}

export type GrowthSequenceSendPayload = {
  to: string
  subject: string
  html: string
  text: string
  senderAccountId: string
  providerId: string | null
}

export function maskSequenceExecutionLeadLabel(leadId: string, companyName?: string | null): string {
  if (companyName?.trim()) return companyName.trim().slice(0, 80)
  return `Lead ${leadId.slice(0, 8)}…`
}

export function sequenceExecutionStatusLabel(status: GrowthSequenceExecutionJobStatus): string {
  return status.replace(/_/g, " ")
}
