/** Apollo enrollment funnel acquisition overlay — server-only aggregation. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { summarizeApolloOperatorReviewForQualification } from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import { loadApolloPrimaryContactOperatorReviewSnapshot } from "@/lib/growth/apollo/apollo-primary-contact-operator-review"

export const APOLLO_ENROLLMENT_FUNNEL_ACQUISITION_QA_MARKER =
  "apollo-enrollment-funnel-acquisition-v1" as const

export type ApolloEnrollmentFunnelAcquisitionView = "historical" | "current_run"

export type ApolloEnrollmentFunnelAcquisitionOverlay = {
  qa_marker: typeof APOLLO_ENROLLMENT_FUNNEL_ACQUISITION_QA_MARKER
  view: ApolloEnrollmentFunnelAcquisitionView
  companies_searched: number
  contacts_found: number
  contacts_mapped: number
  verified_emails: number
  promoted_contacts: number
  contactable_contacts: number
  sequence_ready_contacts: number
  qualified_contacts: number
  company_ids_included: string[]
}

const ENROLLMENT_TABLE = "apollo_enrollment_candidates"
const RUNS_TABLE = "apollo_enrollment_automation_runs"

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return 0
}

function readFunnelMetric(metrics: Record<string, unknown>, key: string): number {
  return asNumber(metrics[key])
}

async function loadDistinctEnrollmentCompanyIds(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin
    .schema("growth")
    .from(ENROLLMENT_TABLE)
    .select("company_candidate_id")

  if (error) throw new Error(error.message)

  const ids = new Set<string>()
  for (const row of data ?? []) {
    const id = typeof row.company_candidate_id === "string" ? row.company_candidate_id.trim() : ""
    if (id) ids.add(id)
  }
  return [...ids]
}

async function aggregateHistoricalFromSnapshots(
  admin: SupabaseClient,
  companyIds: string[],
): Promise<Omit<ApolloEnrollmentFunnelAcquisitionOverlay, "qa_marker" | "view">> {
  let contacts_found = 0
  let contacts_mapped = 0
  let verified_emails = 0
  let promoted_contacts = 0
  let contactable_contacts = 0
  let sequence_ready_contacts = 0
  let qualified_contacts = 0
  const included: string[] = []

  for (const companyId of companyIds) {
    const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, companyId)
    if (!snapshot) continue

    included.push(companyId)
    const summary = summarizeApolloOperatorReviewForQualification(snapshot)

    contacts_found += summary.mapped_contacts
    contacts_mapped += summary.mapped_contacts
    verified_emails += summary.verified_email_contacts
    promoted_contacts += snapshot.evidence.promoted_company_contacts_loaded
    contactable_contacts += summary.contactable_contacts
    sequence_ready_contacts += summary.sequence_ready_contacts
    qualified_contacts += snapshot.contacts.filter((row) => row.sequence_ready && row.contactable).length
  }

  return {
    companies_searched: included.length,
    contacts_found,
    contacts_mapped,
    verified_emails,
    promoted_contacts,
    contactable_contacts,
    sequence_ready_contacts,
    qualified_contacts,
    company_ids_included: included,
  }
}

async function aggregateCurrentRunFromAutomationRuns(
  admin: SupabaseClient,
  companyIds: string[],
): Promise<Omit<ApolloEnrollmentFunnelAcquisitionOverlay, "qa_marker" | "view">> {
  let contacts_found = 0
  let contacts_mapped = 0
  let verified_emails = 0
  let promoted_contacts = 0
  let contactable_contacts = 0
  let sequence_ready_contacts = 0
  let qualified_contacts = 0
  const included: string[] = []

  for (const companyId of companyIds) {
    const { data, error } = await admin
      .schema("growth")
      .from(RUNS_TABLE)
      .select("funnel_metrics, created_at")
      .eq("company_candidate_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)

    const metrics =
      data?.funnel_metrics && typeof data.funnel_metrics === "object"
        ? (data.funnel_metrics as Record<string, unknown>)
        : null

    if (!metrics) continue

    included.push(companyId)
    contacts_found += readFunnelMetric(metrics, "contacts_found")
    contacts_mapped += readFunnelMetric(metrics, "contacts_mapped")
    verified_emails += readFunnelMetric(metrics, "verified_emails")
    promoted_contacts += readFunnelMetric(metrics, "promoted_contacts")
    contactable_contacts += readFunnelMetric(metrics, "contactable_contacts")
    sequence_ready_contacts += readFunnelMetric(metrics, "sequence_ready_contacts")
    qualified_contacts += readFunnelMetric(metrics, "qualified_contacts")
  }

  if (included.length === 0) {
    return aggregateHistoricalFromSnapshots(admin, companyIds)
  }

  return {
    companies_searched: included.length,
    contacts_found,
    contacts_mapped,
    verified_emails,
    promoted_contacts,
    contactable_contacts,
    sequence_ready_contacts,
    qualified_contacts,
    company_ids_included: included,
  }
}

export async function buildApolloEnrollmentFunnelAcquisitionOverlay(
  admin: SupabaseClient,
  input?: {
    view?: ApolloEnrollmentFunnelAcquisitionView
    company_candidate_id?: string | null
  },
): Promise<ApolloEnrollmentFunnelAcquisitionOverlay> {
  const view = input?.view ?? "historical"
  const scopedCompanyId = input?.company_candidate_id?.trim() || null
  const companyIds = scopedCompanyId
    ? [scopedCompanyId]
    : await loadDistinctEnrollmentCompanyIds(admin)

  const overlay =
    view === "current_run"
      ? await aggregateCurrentRunFromAutomationRuns(admin, companyIds)
      : await aggregateHistoricalFromSnapshots(admin, companyIds)

  return {
    qa_marker: APOLLO_ENROLLMENT_FUNNEL_ACQUISITION_QA_MARKER,
    view,
    ...overlay,
  }
}
