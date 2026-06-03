/** Client-safe Growth Engine sequence scheduler types (slice 6.16A). */

import type { GrowthOutboundMode } from "@/lib/growth/runtime/outbound-mode-types"

export type { GrowthOutboundMode } from "@/lib/growth/runtime/outbound-mode-types"

export const GROWTH_SEQUENCE_SCHEDULER_QA_MARKER = "growth-sequence-scheduler-v1" as const

/** Vercel cron route id — also plans standalone transport execution jobs (Phase 1.3). */
export const GROWTH_SEQUENCE_SCHEDULER_CRON_ROUTE = "growth-sequence-scheduler" as const

export const GROWTH_SEQUENCE_SCHEDULER_DEFAULT_BATCH_SIZE = 25 as const

export type GrowthSequenceSchedulerPlanningPlane = "sequence_execution_jobs" | "outreach_queue"

export type GrowthSequenceSchedulerRunPlanningMetadata = {
  outboundMode?: GrowthOutboundMode
  transportConfigured?: boolean
  standalonePlanningAutomated?: boolean
  planningPlane?: GrowthSequenceSchedulerPlanningPlane
  planningCronRoute?: typeof GROWTH_SEQUENCE_SCHEDULER_CRON_ROUTE
  executionJobsPlanned?: number
  outreachQueueItemsQueued?: number
  skippedTransportNotConfigured?: number
  skippedNoSender?: number
}

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
  planning?: GrowthSequenceSchedulerRunPlanningMetadata
}

export type GrowthSequenceSchedulerStatus = {
  dueStepsCount: number
  lastRun: GrowthSequenceSchedulerRunSummary | null
  qaMarker: typeof GROWTH_SEQUENCE_SCHEDULER_QA_MARKER
  providerConfigured: boolean
  outboundMode?: GrowthOutboundMode
  transportConfigured?: boolean
  /** Standalone mode: cron scheduler creates pending_approval execution jobs (no manual plan API). */
  standalonePlanningAutomated?: boolean
  planningCronRoute?: typeof GROWTH_SEQUENCE_SCHEDULER_CRON_ROUTE
  planningPlane?: GrowthSequenceSchedulerPlanningPlane
  manualPlanRequired?: boolean
}

export type GrowthSequenceSchedulerRunResult = {
  scanned: number
  due: number
  queued: number
  skippedSuppressed: number
  skippedAlreadyQueued: number
  skippedMissingDraft: number
  skippedTransportNotConfigured: number
  skippedNoSender: number
  failed: number
  dryRun: boolean
  providerWarning: boolean
  qaMarker: typeof GROWTH_SEQUENCE_SCHEDULER_QA_MARKER
  runId: string | null
  outboundMode?: GrowthOutboundMode
  transportConfigured?: boolean
  standalonePlanningAutomated?: boolean
  planningPlane?: GrowthSequenceSchedulerPlanningPlane
  planningCronRoute?: typeof GROWTH_SEQUENCE_SCHEDULER_CRON_ROUTE
  executionJobsPlanned?: number
  outreachQueueItemsQueued?: number
}

export function buildSequenceSchedulerIdempotencyKey(enrollmentId: string, stepId: string): string {
  return `sequence-scheduler:${enrollmentId}:${stepId}`
}
