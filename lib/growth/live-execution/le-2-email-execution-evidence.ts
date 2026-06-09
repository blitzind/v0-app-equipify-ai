/** LE-2 email execution evidence — one approved send validation. Client-safe. */

export const LE_2_EMAIL_EXECUTION_EVIDENCE_QA_MARKER = "le-2-email-execution-v1" as const

export type Le2EmailExecutionEvidence = {
  qa_marker: typeof LE_2_EMAIL_EXECUTION_EVIDENCE_QA_MARKER
  validated_at: string
  lead_id: string
  enrollment_id: string
  execution_job_id: string
  approved_by: string
  approved_at: string
  send_executed: true
  transport_message_id?: string | null
  timeline_event_ids: string[]
  engagement_event_ids?: string[]
  channel_event_ids?: string[]
  delivery_status?: string | null
  notes?: string | null
}

export type Le2EvidenceValidation = { ok: boolean; errors: string[] }

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export function validateLe2EmailExecutionEvidence(input: unknown): Le2EvidenceValidation {
  const errors: string[] = []
  if (!input || typeof input !== "object") return { ok: false, errors: ["Must be a JSON object"] }
  const r = input as Record<string, unknown>

  if (r.qa_marker !== LE_2_EMAIL_EXECUTION_EVIDENCE_QA_MARKER) {
    errors.push(`qa_marker must be ${LE_2_EMAIL_EXECUTION_EVIDENCE_QA_MARKER}`)
  }
  if (!isNonEmptyString(r.validated_at)) errors.push("validated_at required")
  if (!isNonEmptyString(r.lead_id)) errors.push("lead_id required")
  if (!isNonEmptyString(r.enrollment_id)) errors.push("enrollment_id required")
  if (!isNonEmptyString(r.execution_job_id)) errors.push("execution_job_id required")
  if (!isNonEmptyString(r.approved_by)) errors.push("approved_by required")
  if (!isNonEmptyString(r.approved_at)) errors.push("approved_at required")
  if (r.send_executed !== true) errors.push("send_executed must be true for LE-2 approved email validation")
  if (!Array.isArray(r.timeline_event_ids) || r.timeline_event_ids.length === 0) {
    errors.push("timeline_event_ids must be a non-empty array")
  }

  return { ok: errors.length === 0, errors }
}
