/** Apollo Enrollment funnel metrics — server-only aggregation. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildApolloEnrollmentFunnelAcquisitionOverlay,
  type ApolloEnrollmentFunnelAcquisitionView,
} from "@/lib/growth/apollo/apollo-enrollment-funnel-acquisition-aggregator"
import {
  APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
  type ApolloEnrollmentFunnelMetrics,
} from "@/lib/growth/apollo/apollo-enrollment-automation-types"

const CANDIDATES_TABLE = "apollo_enrollment_candidates"

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return 0
}

export async function buildApolloEnrollmentFunnelMetrics(
  admin: SupabaseClient,
  input?: {
    companies_searched?: number
    contacts_found?: number
    contacts_mapped?: number
    verified_emails?: number
    promoted_contacts?: number
    contactable_contacts?: number
    sequence_ready_contacts?: number
    qualified_contacts?: number
    view?: ApolloEnrollmentFunnelAcquisitionView
    company_candidate_id?: string | null
  },
): Promise<ApolloEnrollmentFunnelMetrics> {
  const { data: candidates } = await admin
    .schema("growth")
    .from(CANDIDATES_TABLE)
    .select("status, qualified_for_enrollment")

  const rows = candidates ?? []
  const enrollment_candidates = rows.length
  const enrollment_approvals = rows.filter((row) => row.status === "enrollment_approved").length
  const enrollment_rejections = rows.filter((row) => row.status === "enrollment_rejected").length
  const qualifiedFromCandidates =
    rows.filter((row) => row.qualified_for_enrollment === true).length

  const hasExplicitOverlay =
    input?.companies_searched != null ||
    input?.contacts_found != null ||
    input?.contacts_mapped != null ||
    input?.verified_emails != null ||
    input?.promoted_contacts != null ||
    input?.contactable_contacts != null ||
    input?.sequence_ready_contacts != null ||
    input?.qualified_contacts != null

  const acquisitionOverlay = hasExplicitOverlay
    ? null
    : await buildApolloEnrollmentFunnelAcquisitionOverlay(admin, {
        view: input?.view ?? "historical",
        company_candidate_id: input?.company_candidate_id ?? null,
      })

  return {
    qa_marker: APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
    funnel_view: acquisitionOverlay?.view ?? input?.view ?? "historical",
    companies_searched: asNumber(input?.companies_searched ?? acquisitionOverlay?.companies_searched),
    contacts_found: asNumber(input?.contacts_found ?? acquisitionOverlay?.contacts_found),
    contacts_mapped: asNumber(input?.contacts_mapped ?? acquisitionOverlay?.contacts_mapped),
    verified_emails: asNumber(input?.verified_emails ?? acquisitionOverlay?.verified_emails),
    promoted_contacts: asNumber(input?.promoted_contacts ?? acquisitionOverlay?.promoted_contacts),
    contactable_contacts: asNumber(
      input?.contactable_contacts ?? acquisitionOverlay?.contactable_contacts,
    ),
    sequence_ready_contacts: asNumber(
      input?.sequence_ready_contacts ?? acquisitionOverlay?.sequence_ready_contacts,
    ),
    qualified_contacts:
      input?.qualified_contacts ??
      acquisitionOverlay?.qualified_contacts ??
      qualifiedFromCandidates,
    enrollment_candidates,
    enrollment_approvals,
    enrollment_rejections,
    computed_at: new Date().toISOString(),
  }
}
