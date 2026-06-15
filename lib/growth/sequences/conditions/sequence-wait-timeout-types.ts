/** SR-3 Phase 5 — wait timeout processor types (client-safe). */

export const GROWTH_SEQUENCE_WAIT_TIMEOUT_QA_MARKER =
  "growth-sequence-wait-timeout-sr3-phase5-v1" as const

export type SequenceWaitTimeoutProcessorResult = {
  scanned: number
  resolved: number
  blocked: number
  failed: number
  processedWaitIds: string[]
}

export type SequenceWaitRecoveryIssue = {
  waitId: string
  enrollmentId: string
  issue: "stuck_active" | "missing_timeout" | "invalid_timeout_target" | "missing_pattern_step"
  detail: string
}

export type SequenceWaitRecoveryDiagnostics = {
  qa_marker: typeof GROWTH_SEQUENCE_WAIT_TIMEOUT_QA_MARKER
  stuckWaits: SequenceWaitRecoveryIssue[]
  missingTimeout: SequenceWaitRecoveryIssue[]
  invalidTimeoutTarget: SequenceWaitRecoveryIssue[]
  totalIssues: number
}
