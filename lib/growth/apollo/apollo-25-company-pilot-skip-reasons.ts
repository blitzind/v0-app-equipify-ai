/** Canonical skip reasons for 25-company pilot eligibility — client-safe. */

export const APOLLO_25_COMPANY_PILOT_SKIP_REASONS = [
  "no_verified_email",
  "not_sequence_ready",
  "qualification_below_threshold",
  "already_enrollment_approved",
  "active_enrollment_conflict",
  "suppression_conflict",
  "active_pilot_conflict",
  "missing_company_contact",
  "missing_growth_lead",
  "missing_required_identity",
  "materialization_not_ready",
  "preflight_failed",
  "duplicate_company_in_pool",
] as const

export type Apollo25CompanyPilotSkipReason = (typeof APOLLO_25_COMPANY_PILOT_SKIP_REASONS)[number]

export const APOLLO_25_COMPANY_PILOT_SELECTION_MODES = [
  "greenfield",
  "existing_pipeline_revalidation",
] as const

export type Apollo25CompanyPilotSelectionMode =
  (typeof APOLLO_25_COMPANY_PILOT_SELECTION_MODES)[number]

export function emptyApollo25CompanyPilotSkipReasonCounts(): Record<
  Apollo25CompanyPilotSkipReason,
  number
> {
  return Object.fromEntries(
    APOLLO_25_COMPANY_PILOT_SKIP_REASONS.map((key) => [key, 0]),
  ) as Record<Apollo25CompanyPilotSkipReason, number>
}

export function normalizeApollo25CompanyPilotSkipReason(raw: string): Apollo25CompanyPilotSkipReason {
  const reason = raw.trim().toLowerCase()

  if (reason === "duplicate_company_in_pool") return "duplicate_company_in_pool"
  if (reason === "verified_email_missing") return "no_verified_email"
  if (reason === "company_in_active_pilot_cohort") return "active_pilot_conflict"
  if (reason === "already_enrollment_approved") return "already_enrollment_approved"
  if (reason === "active_enrollment_exists") return "active_enrollment_conflict"
  if (reason === "lead_resolution_path_missing") return "missing_growth_lead"
  if (reason === "missing_apollo_contact_evidence") return "missing_required_identity"
  if (reason === "materialization_not_ready" || reason === "playbook_prerequisites_missing") {
    return "materialization_not_ready"
  }
  if (reason.startsWith("suppression_")) return "suppression_conflict"
  if (reason === "no_sequence_ready_contact_above_threshold") {
    return "qualification_below_threshold"
  }
  if (reason === "preflight_failed") return "preflight_failed"

  return "missing_required_identity"
}

export function incrementApollo25CompanyPilotSkipReason(
  counts: Record<Apollo25CompanyPilotSkipReason, number>,
  raw: string,
): void {
  const key = normalizeApollo25CompanyPilotSkipReason(raw)
  counts[key] += 1
}
