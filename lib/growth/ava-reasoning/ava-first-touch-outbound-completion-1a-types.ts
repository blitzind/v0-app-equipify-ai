/** AVA-FIRST-TOUCH-OUTBOUND-COMPLETION-1A — First-touch lifecycle completion (client-safe). */

export const AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER =
  "ava-first-touch-outbound-completion-1a-v1" as const

export const AVA_FIRST_TOUCH_OUTBOUND_RECONCILIATION_1A_QA_MARKER =
  "ava-first-touch-outbound-reconciliation-1a-v1" as const

export type AvaFirstTouchOutboundCompletionEvidenceKind =
  | "supervised_generation_sent"
  | "delivery_attempt_sent"
  | "sequence_job_sent"
  | "outbound_message_sent"
  | "lead_metadata_reconciled"

export type AvaFirstTouchOutboundCompletionRecord = {
  qaMarker: typeof AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER
  complete: true
  completedAt: string
  evidenceKind: AvaFirstTouchOutboundCompletionEvidenceKind
  recipientEmail?: string | null
  subject?: string | null
  sentAt?: string | null
  deliveryAttemptId?: string | null
  sequenceExecutionJobId?: string | null
  outboundMessageId?: string | null
  supervisedGenerationId?: string | null
  senderAccountId?: string | null
  providerMessageId?: string | null
  reconciledAt?: string | null
  reconciledBy?: string | null
  reconciliationNote?: string | null
}

export type AvaFirstTouchOutboundCompletionResolution = {
  qaMarker: typeof AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER
  leadId: string
  complete: boolean
  evidenceKind: AvaFirstTouchOutboundCompletionEvidenceKind | null
  record: AvaFirstTouchOutboundCompletionRecord | null
  /** Persisted transport — not operator-only reconciliation. */
  transportProven: boolean
}

export type AvaFirstTouchOutboundReconciliationRecord = {
  qaMarker: typeof AVA_FIRST_TOUCH_OUTBOUND_RECONCILIATION_1A_QA_MARKER
  reconciledAt: string
  reconciledBy?: string | null
  evidenceKind: AvaFirstTouchOutboundCompletionEvidenceKind
  transportProven: boolean
  supersededGenerationIds: string[]
  historicalDeliveryAttemptId?: string | null
  historicalSequenceExecutionJobId?: string | null
  historicalSupervisedGenerationId?: string | null
  note?: string | null
}

export function readAvaFirstTouchOutboundReconciliationFromLeadMetadata(
  metadata: Record<string, unknown> | null | undefined,
): AvaFirstTouchOutboundReconciliationRecord | null {
  const raw = metadata?.avaFirstTouchOutboundReconciliation
  if (!raw || typeof raw !== "object") return null
  const record = raw as Partial<AvaFirstTouchOutboundReconciliationRecord>
  if (record.qaMarker !== AVA_FIRST_TOUCH_OUTBOUND_RECONCILIATION_1A_QA_MARKER) return null
  if (!record.reconciledAt?.trim()) return null
  if (!record.evidenceKind) return null
  if (!Array.isArray(record.supersededGenerationIds)) return null
  return record as AvaFirstTouchOutboundReconciliationRecord
}

export function readAvaFirstTouchOutboundCompletionFromLeadMetadata(
  metadata: Record<string, unknown> | null | undefined,
): AvaFirstTouchOutboundCompletionRecord | null {
  const raw = metadata?.avaFirstTouchOutboundCompletion
  if (!raw || typeof raw !== "object") return null
  const record = raw as Partial<AvaFirstTouchOutboundCompletionRecord>
  if (record.qaMarker !== AVA_FIRST_TOUCH_OUTBOUND_COMPLETION_1A_QA_MARKER) return null
  if (record.complete !== true) return null
  if (!record.completedAt?.trim()) return null
  if (!record.evidenceKind) return null
  return record as AvaFirstTouchOutboundCompletionRecord
}
