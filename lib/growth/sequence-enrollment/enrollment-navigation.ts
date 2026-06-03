/** Client-safe enrollment navigation helpers (pattern execution plane). */

export const GROWTH_PATTERN_ENROLLMENT_DETAIL_QA_MARKER = "growth-pattern-enrollment-detail-v1" as const

export function growthPatternEnrollmentDetailHref(enrollmentId: string): string {
  return `/admin/growth/sequences/enrollments/${enrollmentId}`
}

export function growthSequenceExecutionHref(input?: {
  enrollmentId?: string | null
  leadId?: string | null
  sequencePatternId?: string | null
  highlightJobId?: string | null
}): string {
  const params = new URLSearchParams()
  if (input?.enrollmentId) params.set("enrollmentId", input.enrollmentId)
  if (input?.leadId) params.set("leadId", input.leadId)
  if (input?.sequencePatternId) params.set("sequencePatternId", input.sequencePatternId)
  if (input?.highlightJobId) params.set("highlightJobId", input.highlightJobId)
  const query = params.toString()
  return query ? `/admin/growth/sequences/execution?${query}` : "/admin/growth/sequences/execution"
}

export function growthLeadsCrmHref(): string {
  return "/admin/growth/leads/crm"
}
