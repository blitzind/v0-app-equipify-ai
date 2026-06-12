/** Apollo Operations Dashboard — read-only aggregation (Phase 14.3B). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildApollo25CompanyPilotEligibilityDiagnostic } from "@/lib/growth/apollo/apollo-25-company-pilot-eligibility-diagnostic"
import {
  buildApollo25CompanyPilotSelectionInputs,
  loadApollo25CompanyPilotCohortReview,
} from "@/lib/growth/apollo/apollo-25-company-pilot-route"
import type { Apollo25CompanyPilotSelectionMode } from "@/lib/growth/apollo/apollo-25-company-pilot-skip-reasons"
import { APOLLO_25_COMPANY_PILOT_SKIP_REASONS } from "@/lib/growth/apollo/apollo-25-company-pilot-skip-reasons"
import { APOLLO_25_COMPANY_PILOT_TARGET_COUNT } from "@/lib/growth/apollo/apollo-25-company-pilot-types"
import { buildApolloEnrollmentFunnelMetrics } from "@/lib/growth/apollo/apollo-enrollment-funnel-metrics"
import {
  APOLLO_OPERATIONS_SKIP_REASON_LABELS,
  apolloOperationsPct,
  type ApolloOperationsCohortFunnelRow,
  type ApolloOperationsDashboardPayload,
  type ApolloOperationsRejectionRow,
  APOLLO_OPERATIONS_DASHBOARD_QA_MARKER,
} from "@/lib/growth/apollo/apollo-operations-dashboard-types"
import { listApolloPilotCohorts } from "@/lib/growth/apollo/apollo-pilot-route"
import { resolveApolloEnrollmentQualificationThreshold } from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"

const CONTACT_CANDIDATES_TABLE = "contact_candidates"
const ENROLLMENT_TABLE = "apollo_enrollment_candidates"
const COHORT_COMPANIES_TABLE = "apollo_pilot_cohort_companies"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function extractCreditsFromEvidence(evidence: unknown): number | null {
  if (!evidence || typeof evidence !== "object") return null
  const record = evidence as Record<string, unknown>
  const direct = record.credits_consumed
  if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) return direct
  const runtime = record.runtime
  if (runtime && typeof runtime === "object") {
    const runtimeCredits = (runtime as Record<string, unknown>).credits_consumed
    if (typeof runtimeCredits === "number" && Number.isFinite(runtimeCredits) && runtimeCredits > 0) {
      return runtimeCredits
    }
  }
  return null
}

async function loadContactCandidateRawCounts(admin: SupabaseClient): Promise<{
  total: number
  with_email: number
  with_phone: number
  with_linkedin: number
}> {
  const { data, error } = await admin
    .schema("growth")
    .from(CONTACT_CANDIDATES_TABLE)
    .select("email, phone, linkedin_url")
    .eq("provider_type", "future_apollo")

  if (error) throw new Error(error.message)

  const rows = data ?? []
  return {
    total: rows.length,
    with_email: rows.filter((row) => asString(row.email)).length,
    with_phone: rows.filter((row) => asString(row.phone)).length,
    with_linkedin: rows.filter((row) => asString(row.linkedin_url)).length,
  }
}

async function loadEnrollmentCreditsSum(admin: SupabaseClient): Promise<number | null> {
  const { data, error } = await admin
    .schema("growth")
    .from(ENROLLMENT_TABLE)
    .select("acquisition_evidence")

  if (error) throw new Error(error.message)

  let sum = 0
  let found = 0
  for (const row of data ?? []) {
    const credits = extractCreditsFromEvidence(row.acquisition_evidence)
    if (credits != null) {
      sum += credits
      found += 1
    }
  }
  return found > 0 ? sum : null
}

async function loadCohortEnrollmentCounts(
  admin: SupabaseClient,
  cohortIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (cohortIds.length === 0) return counts

  const { data, error } = await admin
    .schema("growth")
    .from(COHORT_COMPANIES_TABLE)
    .select("cohort_id, enrollment_candidate_count, sequence_enrollment_count")
    .in("cohort_id", cohortIds)

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const cohortId = asString(row.cohort_id)
    if (!cohortId) continue
    const enrolled = Math.max(
      Number(row.enrollment_candidate_count ?? 0),
      Number(row.sequence_enrollment_count ?? 0),
    )
    counts.set(cohortId, (counts.get(cohortId) ?? 0) + (enrolled > 0 ? 1 : 0))
  }

  return counts
}

function aggregateContactYieldFromSelectionInputs(
  inputs: Awaited<ReturnType<typeof buildApollo25CompanyPilotSelectionInputs>>,
): {
  verified_emails: number
  linkedin_profiles: number
  phone_numbers: number
} {
  let verified_emails = 0
  let linkedin_profiles = 0
  let phone_numbers = 0

  for (const input of inputs) {
    verified_emails += input.snapshot_summary.verified_email_contacts
    for (const contact of input.contacts) {
      if (contact.channel_availability?.linkedin) linkedin_profiles += 1
      if (contact.channel_availability?.phone) phone_numbers += 1
    }
  }

  return { verified_emails, linkedin_profiles, phone_numbers }
}

function buildRejectionAnalysis(
  skipped: Record<string, number>,
  totalDiscovered: number,
): ApolloOperationsRejectionRow[] {
  const rows: ApolloOperationsRejectionRow[] = []

  for (const reason of APOLLO_25_COMPANY_PILOT_SKIP_REASONS) {
    const count = skipped[reason] ?? 0
    if (count <= 0) continue
    rows.push({
      reason,
      label: APOLLO_OPERATIONS_SKIP_REASON_LABELS[reason],
      count,
      pct: apolloOperationsPct(count, totalDiscovered) ?? 0,
    })
  }

  return rows.sort((a, b) => b.count - a.count)
}

export async function loadApolloOperationsDashboard(
  admin: SupabaseClient,
  input?: {
    cohort_id?: string | null
    pilot_selection_mode?: Apollo25CompanyPilotSelectionMode
  },
): Promise<ApolloOperationsDashboardPayload> {
  const pilot_selection_mode = input?.pilot_selection_mode ?? "greenfield"
  const production_threshold = resolveApolloEnrollmentQualificationThreshold()

  const [selectionInputs, contactCandidateRaw, cohorts, enrollmentFunnel, creditsConsumed] =
    await Promise.all([
      buildApollo25CompanyPilotSelectionInputs(admin),
      loadContactCandidateRawCounts(admin),
      listApolloPilotCohorts(admin),
      buildApolloEnrollmentFunnelMetrics(admin, { view: "historical" }),
      loadEnrollmentCreditsSum(admin),
    ])

  const diagnostic = buildApollo25CompanyPilotEligibilityDiagnostic(selectionInputs, {
    production_threshold,
    pilot_selection_mode,
    target_count: APOLLO_25_COMPANY_PILOT_TARGET_COUNT,
  })

  const fc = diagnostic.funnel_counts
  const contactYield = aggregateContactYieldFromSelectionInputs(selectionInputs)

  const activePilotCompanyCount = fc.companies_blocked_by_active_pilot
  const certifiedCompanies = activePilotCompanyCount

  const discoveryStages = [
    {
      key: "discovered",
      label: "Discovered",
      count: fc.total_apollo_discovered_companies,
      conversion_pct: null as number | null,
    },
    {
      key: "verified_email",
      label: "Verified email",
      count: fc.companies_with_verified_email,
      conversion_pct: apolloOperationsPct(
        fc.companies_with_verified_email,
        fc.total_apollo_discovered_companies,
      ),
    },
    {
      key: "sequence_ready",
      label: "Sequence-ready",
      count: fc.companies_with_sequence_ready_contacts,
      conversion_pct: apolloOperationsPct(
        fc.companies_with_sequence_ready_contacts,
        fc.companies_with_verified_email,
      ),
    },
    {
      key: "qualified",
      label: "Qualified",
      count: fc.companies_with_qualification_score_gte_threshold,
      conversion_pct: apolloOperationsPct(
        fc.companies_with_qualification_score_gte_threshold,
        fc.companies_with_sequence_ready_contacts,
      ),
    },
    {
      key: "greenfield",
      label: "Greenfield available",
      count: fc.companies_eligible_greenfield,
      conversion_pct: apolloOperationsPct(
        fc.companies_eligible_greenfield,
        fc.companies_with_qualification_score_gte_threshold,
      ),
    },
    {
      key: "certified",
      label: "Certified (active pilot)",
      count: certifiedCompanies,
      conversion_pct: null,
    },
  ].map((stage) => ({ ...stage, trend_placeholder: null as null }))

  const requestedCohortId = input?.cohort_id?.trim() || null
  const primaryCohort =
    (requestedCohortId ? cohorts.find((row) => row.id === requestedCohortId) : null) ??
    cohorts.find((row) => row.status === "active" || row.status === "draft") ??
    cohorts[0] ??
    null

  let cohortReview: Awaited<ReturnType<typeof loadApollo25CompanyPilotCohortReview>> | null = null
  if (primaryCohort?.id) {
    try {
      cohortReview = await loadApollo25CompanyPilotCohortReview(admin, {
        cohort_id: primaryCohort.id,
      })
    } catch {
      cohortReview = null
    }
  }

  const cohortEnrollmentCounts = await loadCohortEnrollmentCounts(
    admin,
    cohorts.map((row) => row.id),
  )

  const cohortRows: ApolloOperationsCohortFunnelRow[] = cohorts.map((cohort) => {
    const isPrimary = cohort.id === primaryCohort?.id
    const reviewMatch = isPrimary ? cohortReview : null
    return {
      cohort_id: cohort.id,
      cohort_name: cohort.cohort_name,
      status: cohort.status,
      company_count: cohort.company_count,
      target_company_count: cohort.target_company_count,
      enrolled_count: cohortEnrollmentCounts.get(cohort.id) ?? cohort.company_count,
      personalized_ready_count: isPrimary
        ? (reviewMatch?.personalization.companies_ready ?? 0)
        : 0,
      certified: isPrimary ? (reviewMatch?.launch_certification.certified ?? null) : null,
      is_primary_certified: isPrimary && reviewMatch?.launch_certification.certified === true,
    }
  })

  const draftCohorts = cohorts.filter((row) => row.status === "draft").length
  const enrolledCompanies =
    cohortReview?.enrollment_readiness.companies_ready ??
    cohortRows.reduce((sum, row) => sum + row.enrolled_count, 0)
  const personalizedReady =
    cohortReview?.personalization.companies_ready ??
    cohortRows.reduce((sum, row) => sum + row.personalized_ready_count, 0)
  const certifiedCount =
    cohortReview?.launch_certification.certified === true
      ? (cohortReview.cohort_size ?? certifiedCompanies)
      : certifiedCompanies

  const targetCohortSize = APOLLO_25_COMPANY_PILOT_TARGET_COUNT
  const greenfieldAvailable = fc.companies_eligible_greenfield

  const creditTrackingStatus =
    creditsConsumed != null ? ("partial_evidence" as const) : ("not_yet_tracked" as const)

  return {
    qa_marker: APOLLO_OPERATIONS_DASHBOARD_QA_MARKER,
    computed_at: new Date().toISOString(),
    data_sources: [
      "buildApollo25CompanyPilotSelectionInputs",
      "buildApollo25CompanyPilotEligibilityDiagnostic",
      "loadApollo25CompanyPilotCohortReview",
      "buildApolloEnrollmentFunnelMetrics",
      "contact_candidates (future_apollo)",
      "apollo_enrollment_candidates.acquisition_evidence",
    ],
    discovery_funnel: {
      companies_discovered: fc.total_apollo_discovered_companies,
      verified_email_companies: fc.companies_with_verified_email,
      sequence_ready_companies: fc.companies_with_sequence_ready_contacts,
      qualified_companies: fc.companies_with_qualification_score_gte_threshold,
      greenfield_available: greenfieldAvailable,
      certified_companies: certifiedCount,
      stages: discoveryStages,
    },
    rejection_analysis: buildRejectionAnalysis(
      diagnostic.skipped_reason_counts,
      fc.total_apollo_discovered_companies,
    ),
    contact_funnel: {
      contact_candidates: contactCandidateRaw.total,
      verified_emails: contactYield.verified_emails,
      linkedin_profiles: Math.max(contactYield.linkedin_profiles, contactCandidateRaw.with_linkedin),
      phone_numbers: contactCandidateRaw.with_phone,
      conversion: {
        candidates_to_verified_email_pct: apolloOperationsPct(
          contactYield.verified_emails,
          contactCandidateRaw.total,
        ),
        candidates_to_linkedin_pct: apolloOperationsPct(
          Math.max(contactYield.linkedin_profiles, contactCandidateRaw.with_linkedin),
          contactCandidateRaw.total,
        ),
        candidates_to_phone_pct: apolloOperationsPct(
          contactCandidateRaw.with_phone,
          contactCandidateRaw.total,
        ),
      },
      apollo_phone_note:
        contactCandidateRaw.with_phone === 0
          ? "0 Apollo phone numbers — informational only; email-only pilot template does not require phones."
          : `${contactCandidateRaw.with_phone} Apollo phone numbers in contact candidates.`,
    },
    cohort_funnel: {
      portfolio: {
        draft_cohorts: draftCohorts,
        enrolled_companies: enrolledCompanies,
        personalized_ready_companies: personalizedReady,
        certified_companies: certifiedCount,
      },
      cohorts: cohortRows,
    },
    certification_status: {
      cohort_id: cohortReview?.cohort_id ?? primaryCohort?.id ?? null,
      cohort_name: cohortReview?.cohort_name ?? primaryCohort?.cohort_name ?? null,
      enrollment_ready_pct: cohortReview?.launch_certification.enrollment_ready_pct ?? null,
      personalization_ready_pct: cohortReview?.launch_certification.personalization_ready_pct ?? null,
      ready_for_launch: cohortReview?.launch_recommendation.ready_for_launch ?? null,
      certified: cohortReview?.launch_certification.certified ?? null,
      fatal_blockers: cohortReview?.launch_certification.fatal_blockers ?? [],
      warnings: cohortReview?.launch_certification.warnings ?? [],
      launch_recommendation: cohortReview?.launch_recommendation ?? null,
      launch_certification: cohortReview?.launch_certification ?? null,
    },
    expansion_readiness: {
      greenfield_available: greenfieldAvailable,
      current_certified_cohort: certifiedCount,
      target_cohort_size: targetCohortSize,
      additional_companies_needed_for_next_25_cohort: Math.max(
        0,
        targetCohortSize - greenfieldAvailable,
      ),
      greenfield_gap_to_target: Math.max(0, targetCohortSize - greenfieldAvailable),
    },
    credit_utilization: {
      credits_available: null,
      credits_consumed: creditsConsumed,
      tracking_status: creditTrackingStatus,
      note:
        creditsConsumed != null
          ? "Credits summed from enrollment acquisition_evidence where present."
          : "Apollo credits are not yet aggregated in production — ROI dashboard returns null.",
    },
    enrollment_automation_funnel: enrollmentFunnel,
  }
}
