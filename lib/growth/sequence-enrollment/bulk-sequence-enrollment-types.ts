/** Client-safe bulk sequence enrollment types (Phase 1.4). */

export const GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS = 100 as const

export const GROWTH_SEQUENCE_BULK_ENROLL_QA_MARKER = "growth-sequence-bulk-enroll-v1" as const

export type BulkSequenceEnrollmentSuggestedAction =
  | "view_enrollment"
  | "resume_enrollment"
  | "cancel_draft"

export type BulkSequenceEnrollmentLeadOutcome = {
  leadId: string
  leadLabel?: string
  enrollmentId?: string
  conflictingEnrollmentId?: string
  enrollmentStatus?: string
  sequencePatternId?: string
  currentStepSummary?: string
  schedulerEligible?: boolean
  suggestedAction?: BulkSequenceEnrollmentSuggestedAction
  code?: string
  reason?: string
}

export type BulkSequenceEnrollmentResult = {
  qaMarker: typeof GROWTH_SEQUENCE_BULK_ENROLL_QA_MARKER
  sequencePatternId: string
  dryRun: boolean
  startImmediately: boolean
  scheduledStartAt: string | null
  requested: number
  enrolled: BulkSequenceEnrollmentLeadOutcome[]
  skippedAlreadyEnrolled: BulkSequenceEnrollmentLeadOutcome[]
  skippedBlocked: BulkSequenceEnrollmentLeadOutcome[]
  failed: BulkSequenceEnrollmentLeadOutcome[]
}
