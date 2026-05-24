/** Client-safe Growth Engine sequence scheduler types (slice 6.16A). */

export const GROWTH_SEQUENCE_SCHEDULER_QA_MARKER = "growth-sequence-scheduler-v1" as const

export const GROWTH_SEQUENCE_SCHEDULER_DEFAULT_BATCH_SIZE = 25 as const

export type GrowthSequenceSchedulerRunMode = "live" | "dry_run"

export type GrowthSequenceSchedulerRunSummary = {
  id: string
  runMode: GrowthSequenceSchedulerRunMode
  scanned: number
  due: number
  queued: number
  skippedSuppressed: number
  skippedAlreadyQueued: number
  skippedMissingDraft: number
  failed: number
  providerWarning: boolean
  qaMarker: typeof GROWTH_SEQUENCE_SCHEDULER_QA_MARKER
  startedAt: string
  finishedAt: string | null
  createdBy: string | null
}

export type GrowthSequenceSchedulerStatus = {
  dueStepsCount: number
  lastRun: GrowthSequenceSchedulerRunSummary | null
  qaMarker: typeof GROWTH_SEQUENCE_SCHEDULER_QA_MARKER
  providerConfigured: boolean
}

export type GrowthSequenceSchedulerRunResult = {
  scanned: number
  due: number
  queued: number
  skippedSuppressed: number
  skippedAlreadyQueued: number
  skippedMissingDraft: number
  failed: number
  dryRun: boolean
  providerWarning: boolean
  qaMarker: typeof GROWTH_SEQUENCE_SCHEDULER_QA_MARKER
  runId: string | null
}

export function buildSequenceSchedulerIdempotencyKey(enrollmentId: string, stepId: string): string {
  return `sequence-scheduler:${enrollmentId}:${stepId}`
}
