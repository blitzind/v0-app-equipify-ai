/** LE-1 live execution evidence schemas — client-safe validation. */

export const LE_1_MANUAL_ENROLLMENT_EVIDENCE_QA_MARKER = "le-1-manual-enrollment-v1" as const
export const LE_1_NON_VOICE_CHANNEL_EVIDENCE_QA_MARKER = "le-1-non-voice-channel-v1" as const
export const LE_1_VOICE_DROP_LIVE_EVIDENCE_QA_MARKER = "le-1-voice-drop-live-v1" as const

export type Le1ManualEnrollmentEvidence = {
  qa_marker: typeof LE_1_MANUAL_ENROLLMENT_EVIDENCE_QA_MARKER
  enrolled_at: string
  lead_id: string
  enrollment_id: string
  pattern_id: string
  company_candidate_id?: string | null
  canonical_person_id?: string | null
  operator_approved: true
  bulk_enrollment: false
  contacts_enrolled: 1
  notes?: string | null
}

export type Le1NonVoiceChannelEvidence = {
  qa_marker: typeof LE_1_NON_VOICE_CHANNEL_EVIDENCE_QA_MARKER
  validated_at: string
  lead_id: string
  enrollment_id: string
  email_job_created: boolean
  email_execution_job_id?: string | null
  sms_eligibility_evaluated: boolean
  sms_eligible: boolean
  approval_workflow_verified: boolean
  timeline_event_emitted: boolean
  timeline_event_ids?: string[]
  channel_event_ids?: string[]
  send_executed: boolean
  notes?: string | null
}

export type Le1VoiceDropLiveEvidence = {
  qa_marker: typeof LE_1_VOICE_DROP_LIVE_EVIDENCE_QA_MARKER
  validated_at: string
  callSid: string
  recipientId: string
  deliveryAttemptId: string
  enrollmentId?: string | null
  campaignId?: string | null
  leadId?: string | null
  timelineEventIds?: string[]
  channelEventIds?: string[]
  amd_detected?: boolean | null
  twiml_playback_confirmed?: boolean | null
  status_callback_received?: boolean | null
  delivery_status?: string | null
}

export type Le1EvidenceValidation = { ok: boolean; errors: string[] }

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export function validateLe1ManualEnrollmentEvidence(input: unknown): Le1EvidenceValidation {
  const errors: string[] = []
  if (!input || typeof input !== "object") return { ok: false, errors: ["Must be a JSON object"] }
  const r = input as Record<string, unknown>

  if (r.qa_marker !== LE_1_MANUAL_ENROLLMENT_EVIDENCE_QA_MARKER) {
    errors.push(`qa_marker must be ${LE_1_MANUAL_ENROLLMENT_EVIDENCE_QA_MARKER}`)
  }
  if (!isNonEmptyString(r.enrolled_at)) errors.push("enrolled_at required")
  if (!isNonEmptyString(r.lead_id)) errors.push("lead_id required")
  if (!isNonEmptyString(r.enrollment_id)) errors.push("enrollment_id required")
  if (!isNonEmptyString(r.pattern_id)) errors.push("pattern_id required")
  if (r.operator_approved !== true) errors.push("operator_approved must be true")
  if (r.bulk_enrollment !== false) errors.push("bulk_enrollment must be false")
  if (r.contacts_enrolled !== 1) errors.push("contacts_enrolled must be 1")

  return { ok: errors.length === 0, errors }
}

export function validateLe1NonVoiceChannelEvidence(input: unknown): Le1EvidenceValidation {
  const errors: string[] = []
  if (!input || typeof input !== "object") return { ok: false, errors: ["Must be a JSON object"] }
  const r = input as Record<string, unknown>

  if (r.qa_marker !== LE_1_NON_VOICE_CHANNEL_EVIDENCE_QA_MARKER) {
    errors.push(`qa_marker must be ${LE_1_NON_VOICE_CHANNEL_EVIDENCE_QA_MARKER}`)
  }
  if (!isNonEmptyString(r.validated_at)) errors.push("validated_at required")
  if (!isNonEmptyString(r.lead_id)) errors.push("lead_id required")
  if (!isNonEmptyString(r.enrollment_id)) errors.push("enrollment_id required")
  if (typeof r.email_job_created !== "boolean") errors.push("email_job_created boolean required")
  if (typeof r.sms_eligibility_evaluated !== "boolean") errors.push("sms_eligibility_evaluated boolean required")
  if (typeof r.sms_eligible !== "boolean") errors.push("sms_eligible boolean required")
  if (typeof r.approval_workflow_verified !== "boolean") errors.push("approval_workflow_verified boolean required")
  if (typeof r.timeline_event_emitted !== "boolean") errors.push("timeline_event_emitted boolean required")
  if (typeof r.send_executed !== "boolean") errors.push("send_executed boolean required")
  if (r.send_executed === true) {
    errors.push("send_executed must be false unless operator explicitly approved live send")
  }

  return { ok: errors.length === 0, errors }
}

export function validateLe1VoiceDropLiveEvidence(input: unknown): Le1EvidenceValidation {
  const errors: string[] = []
  if (!input || typeof input !== "object") return { ok: false, errors: ["Must be a JSON object"] }
  const r = input as Record<string, unknown>

  const markerOk =
    r.qa_marker === LE_1_VOICE_DROP_LIVE_EVIDENCE_QA_MARKER ||
    (isNonEmptyString(r.callSid) && isNonEmptyString(r.recipientId) && isNonEmptyString(r.deliveryAttemptId))

  if (!markerOk && r.qa_marker !== LE_1_VOICE_DROP_LIVE_EVIDENCE_QA_MARKER) {
    errors.push(`qa_marker must be ${LE_1_VOICE_DROP_LIVE_EVIDENCE_QA_MARKER} or provide VD-4 fields`)
  }
  if (!isNonEmptyString(r.callSid)) errors.push("callSid required")
  if (!isNonEmptyString(r.recipientId)) errors.push("recipientId required")
  if (!isNonEmptyString(r.deliveryAttemptId)) errors.push("deliveryAttemptId required")

  return { ok: errors.length === 0, errors }
}

export function assertLe1ManualEnrollmentEvidence(input: unknown): asserts input is Le1ManualEnrollmentEvidence {
  const v = validateLe1ManualEnrollmentEvidence(input)
  if (!v.ok) throw new Error(v.errors.join("; "))
}

export function assertLe1NonVoiceChannelEvidence(input: unknown): asserts input is Le1NonVoiceChannelEvidence {
  const v = validateLe1NonVoiceChannelEvidence(input)
  if (!v.ok) throw new Error(v.errors.join("; "))
}

export function assertLe1VoiceDropLiveEvidence(input: unknown): asserts input is Le1VoiceDropLiveEvidence {
  const v = validateLe1VoiceDropLiveEvidence(input)
  if (!v.ok) throw new Error(v.errors.join("; "))
}
