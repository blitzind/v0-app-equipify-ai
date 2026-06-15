/** Growth Engine SR-2B-4 — Share page booking attribution (client-safe). */

export const GROWTH_SHARE_PAGE_BOOKING_REF = "share_page" as const

export const GROWTH_SHARE_PAGES_BOOKING_QA_MARKER = "share-pages-booking-sr2b4-v1" as const

export const GROWTH_SHARE_PAGES_BOOKING_MIGRATION =
  "20270826120200_growth_engine_share_pages_booking_attribution.sql" as const

export const GROWTH_SHARE_PAGES_BOOKING_CONFIRM = "RUN_GROWTH_SHARE_PAGES_BOOKING_CERTIFICATION" as const

export type GrowthSharePageBookingAttribution = {
  ref: typeof GROWTH_SHARE_PAGE_BOOKING_REF
  sharePageId: string
  leadId: string
  sourceChannel: string
  campaignId?: string | null
  enrollmentId?: string | null
  sequenceEnrollmentStepId?: string | null
  sequenceExecutionJobId?: string | null
}

export type GrowthSharePageBookingRenderModel = {
  bookingPageId: string
  slug: string
  name: string
  bookingUrl: string
  embedUrl: string
  disabled: boolean
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function buildSharePageBookingAttribution(input: {
  sharePageId: string
  leadId: string
  sourceChannel: string
  campaignId?: string | null
  enrollmentId?: string | null
  sequenceEnrollmentStepId?: string | null
  sequenceExecutionJobId?: string | null
}): GrowthSharePageBookingAttribution {
  return {
    ref: GROWTH_SHARE_PAGE_BOOKING_REF,
    sharePageId: input.sharePageId,
    leadId: input.leadId,
    sourceChannel: input.sourceChannel,
    campaignId: input.campaignId ?? null,
    enrollmentId: input.enrollmentId ?? null,
    sequenceEnrollmentStepId: input.sequenceEnrollmentStepId ?? null,
    sequenceExecutionJobId: input.sequenceExecutionJobId ?? null,
  }
}

export function buildSharePageBookingUrl(
  slug: string,
  attribution: GrowthSharePageBookingAttribution,
  options?: { preview?: boolean },
): string {
  const params = new URLSearchParams()
  params.set("ref", attribution.ref)
  params.set("share_page_id", attribution.sharePageId)
  params.set("lead_id", attribution.leadId)
  params.set("source_channel", attribution.sourceChannel)
  if (attribution.campaignId) params.set("campaign_id", attribution.campaignId)
  if (attribution.enrollmentId) params.set("enrollment_id", attribution.enrollmentId)
  if (attribution.sequenceEnrollmentStepId) {
    params.set("sequence_enrollment_step_id", attribution.sequenceEnrollmentStepId)
  }
  if (attribution.sequenceExecutionJobId) {
    params.set("sequence_execution_job_id", attribution.sequenceExecutionJobId)
  }
  if (options?.preview) params.set("preview", "1")
  return `/book/${encodeURIComponent(slug)}?${params.toString()}`
}

export function parseSharePageBookingAttributionFromSearchParams(
  params: URLSearchParams,
): GrowthSharePageBookingAttribution | null {
  if (params.get("ref") !== GROWTH_SHARE_PAGE_BOOKING_REF) return null

  const sharePageId = readString(params.get("share_page_id"))
  const leadId = readString(params.get("lead_id"))
  const sourceChannel = readString(params.get("source_channel"))
  if (!sharePageId || !leadId || !sourceChannel) return null

  return buildSharePageBookingAttribution({
    sharePageId,
    leadId,
    sourceChannel,
    campaignId: readString(params.get("campaign_id")),
    enrollmentId: readString(params.get("enrollment_id")),
    sequenceEnrollmentStepId: readString(params.get("sequence_enrollment_step_id")),
    sequenceExecutionJobId: readString(params.get("sequence_execution_job_id")),
  })
}

export function parseSharePageBookingAttributionFromRecord(
  value: unknown,
): GrowthSharePageBookingAttribution | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (record.ref !== GROWTH_SHARE_PAGE_BOOKING_REF) return null

  const sharePageId = readString(record.share_page_id ?? record.sharePageId)
  const leadId = readString(record.lead_id ?? record.leadId)
  const sourceChannel = readString(record.source_channel ?? record.sourceChannel)
  if (!sharePageId || !leadId || !sourceChannel) return null

  return buildSharePageBookingAttribution({
    sharePageId,
    leadId,
    sourceChannel,
    campaignId: readString(record.campaign_id ?? record.campaignId),
    enrollmentId: readString(record.enrollment_id ?? record.enrollmentId),
    sequenceEnrollmentStepId: readString(record.sequence_enrollment_step_id ?? record.sequenceEnrollmentStepId),
    sequenceExecutionJobId: readString(record.sequence_execution_job_id ?? record.sequenceExecutionJobId),
  })
}

export function sharePageBookingAttributionToMetadata(
  attribution: GrowthSharePageBookingAttribution,
): Record<string, unknown> {
  return {
    qa_marker: GROWTH_SHARE_PAGES_BOOKING_QA_MARKER,
    ref: attribution.ref,
    share_page_id: attribution.sharePageId,
    lead_id: attribution.leadId,
    source_channel: attribution.sourceChannel,
    campaign_id: attribution.campaignId ?? null,
    enrollment_id: attribution.enrollmentId ?? null,
    sequence_enrollment_step_id: attribution.sequenceEnrollmentStepId ?? null,
    sequence_execution_job_id: attribution.sequenceExecutionJobId ?? null,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  }
}

export function sharePageBookingAttributionToMeetingSourceAttribution(
  attribution: GrowthSharePageBookingAttribution,
  input?: { bookingId?: string | null; meetingId?: string | null },
): Record<string, unknown> {
  return {
    ...sharePageBookingAttributionToMetadata(attribution),
    booking_id: input?.bookingId ?? null,
    meeting_id: input?.meetingId ?? null,
    attribution_source: "share_page_booking",
  }
}
