/** Client-safe enrollment navigation helpers (pattern execution plane). */

import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import { GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"

export const GROWTH_PATTERN_ENROLLMENT_DETAIL_QA_MARKER = "growth-pattern-enrollment-detail-v1" as const

export function growthPatternEnrollmentDetailHref(enrollmentId: string): string {
  return `/admin/growth/sequences/enrollments/${enrollmentId}`
}

export function isGrowthSequenceExecutionPathname(pathname: string): boolean {
  return (
    pathname === "/admin/growth/sequences/execution" || pathname === GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF
  )
}

export function growthSequenceExecutionHref(
  input?: {
    enrollmentId?: string | null
    leadId?: string | null
    sequencePatternId?: string | null
    highlightJobId?: string | null
  },
  pathname?: string | null,
): string {
  const params = new URLSearchParams()
  if (input?.enrollmentId) params.set("enrollmentId", input.enrollmentId)
  if (input?.leadId) params.set("leadId", input.leadId)
  if (input?.sequencePatternId) params.set("sequencePatternId", input.sequencePatternId)
  if (input?.highlightJobId) params.set("highlightJobId", input.highlightJobId)
  const query = params.toString()
  const base = growthFeaturePath(pathname, "sequences/execution")
  return query ? `${base}?${query}` : base
}

export function growthLeadsCrmHref(): string {
  return "/admin/growth/leads/crm"
}

/** Deep-link into the CRM growth.leads drawer (`growth.leads` table). */
export function growthCrmLeadDetailHref(leadId: string, focus?: string | null): string {
  const params = new URLSearchParams({ open: leadId })
  if (focus) params.set("focus", focus)
  return `/admin/growth/leads/crm?${params.toString()}`
}

export type GrowthLeadNavigationSource = "growth.leads" | "lead_inbox"

/** Route to the correct lead workspace based on lead source/table. */
export function growthLeadDetailHref(
  leadId: string,
  source: GrowthLeadNavigationSource = "growth.leads",
): string {
  if (source === "lead_inbox") {
    return `/admin/growth/leads/${leadId}`
  }
  return growthCrmLeadDetailHref(leadId)
}
