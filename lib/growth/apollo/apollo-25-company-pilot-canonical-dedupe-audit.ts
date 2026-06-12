/** Apollo 25-company pilot — canonical company duplicate outreach audit (Phase 14.2G). */

import type { Apollo25CompanyPilotCohortSnapshotCompany } from "@/lib/growth/apollo/apollo-25-company-pilot-types"

export const APOLLO_25_COMPANY_PILOT_CANONICAL_DEDUPE_QA_MARKER =
  "apollo-25-company-pilot-canonical-dedupe-v14-2g" as const

export type Apollo25CompanyPilotCanonicalDedupeGroup = {
  canonical_company_id: string
  company_candidate_ids: string[]
  company_names: string[]
  duplicate_candidate_records_expected: boolean
  duplicate_outreach_risk: "low" | "elevated" | "high"
  dedupe_protections: string[]
  notes: string[]
}

export type Apollo25CompanyPilotCanonicalDedupeAudit = {
  qa_marker: typeof APOLLO_25_COMPANY_PILOT_CANONICAL_DEDUPE_QA_MARKER
  duplicate_canonical_groups: Apollo25CompanyPilotCanonicalDedupeGroup[]
  medical_equipment_solutions_audit: {
    company_name: string
    canonical_company_id: string | null
    matching_company_candidate_ids: string[]
    duplicate_candidate_records_expected: boolean
    duplicate_outreach_risk: "low" | "elevated" | "high"
    dedupe_protections: string[]
    summary: string
  } | null
}

const STANDARD_DEDUPE_PROTECTIONS = [
  "enrollment_candidate_contact_unique_per_company_contact",
  "account_playbook_duplicate_block_pending_or_approved",
  "voice_drop_duplicate_block_per_playbook",
  "multichannel_duplicate_block_per_voice_drop",
  "sequence_execution_duplicate_block_pending_or_ready",
  "suppression_and_re_enrollment_gates_at_selection",
  "pilot_cohort_single_membership_per_company_candidate",
] as const

function assessOutreachRisk(candidateCount: number): "low" | "elevated" | "high" {
  if (candidateCount <= 1) return "low"
  if (candidateCount === 2) return "elevated"
  return "high"
}

export function buildApollo25CompanyPilotCanonicalDedupeAudit(input: {
  snapshot_companies: Apollo25CompanyPilotCohortSnapshotCompany[]
}): Apollo25CompanyPilotCanonicalDedupeAudit {
  const byCanonical = new Map<string, Apollo25CompanyPilotCohortSnapshotCompany[]>()

  for (const company of input.snapshot_companies) {
    const canonicalId = company.canonical_company_id?.trim()
    if (!canonicalId) continue
    const bucket = byCanonical.get(canonicalId) ?? []
    bucket.push(company)
    byCanonical.set(canonicalId, bucket)
  }

  const duplicate_canonical_groups: Apollo25CompanyPilotCanonicalDedupeGroup[] = []

  for (const [canonical_company_id, companies] of byCanonical.entries()) {
    if (companies.length <= 1) continue
    const duplicate_outreach_risk = assessOutreachRisk(companies.length)
    duplicate_canonical_groups.push({
      canonical_company_id,
      company_candidate_ids: companies.map((row) => row.company_candidate_id),
      company_names: companies.map((row) => row.company_name),
      duplicate_candidate_records_expected: true,
      duplicate_outreach_risk,
      dedupe_protections: [...STANDARD_DEDUPE_PROTECTIONS],
      notes: [
        "Multiple Apollo company_candidate records may resolve to the same canonical company — expected when discovery sources diverge.",
        duplicate_outreach_risk === "high"
          ? "Review cohort membership — only one company_candidate per canonical company should remain active in pilot outreach."
          : "Pilot cohort membership is keyed by company_candidate_id; parallel outreach requires separate approved enrollments per candidate.",
      ],
    })
  }

  const medicalMatches = input.snapshot_companies.filter((row) =>
    row.company_name.toLowerCase().includes("medical equipment solutions"),
  )
  const medicalCanonicalId =
    medicalMatches.find((row) => row.canonical_company_id)?.canonical_company_id ?? null

  const medical_equipment_solutions_audit =
    medicalMatches.length > 0
      ? {
          company_name: medicalMatches[0]!.company_name,
          canonical_company_id: medicalCanonicalId,
          matching_company_candidate_ids: medicalMatches.map((row) => row.company_candidate_id),
          duplicate_candidate_records_expected: medicalMatches.length > 1,
          duplicate_outreach_risk: assessOutreachRisk(medicalMatches.length),
          dedupe_protections: [...STANDARD_DEDUPE_PROTECTIONS],
          summary:
            medicalMatches.length > 1
              ? "Multiple company_candidate rows share the Medical Equipment Solutions label — canonical linkage and pipeline duplicate blocks prevent duplicate sends unless both candidates are independently approved and materialized."
              : "Single Medical Equipment Solutions cohort member — canonical dedupe risk is low within this pilot snapshot.",
        }
      : null

  return {
    qa_marker: APOLLO_25_COMPANY_PILOT_CANONICAL_DEDUPE_QA_MARKER,
    duplicate_canonical_groups,
    medical_equipment_solutions_audit,
  }
}
