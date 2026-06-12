/** Apollo 25-company pilot — deterministic greenfield cohort snapshot (Phase 14.2F). */

import {
  analyzeApollo25CompanyPilotCompanyEligibility,
  type Apollo25CompanyPilotSelectionInput,
} from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import { applyApollo25CompanyPilotCanonicalCohortDedupe } from "@/lib/growth/apollo/apollo-25-company-pilot-canonical-cohort-dedupe"
import {
  APOLLO_25_COMPANY_PILOT_COHORT_SNAPSHOT_QA_MARKER,
  APOLLO_25_COMPANY_PILOT_TARGET_COUNT,
  type Apollo25CompanyPilotCohortSnapshot,
  type Apollo25CompanyPilotCohortSnapshotCompany,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"

function buildDeterministicSnapshotId(companies: Apollo25CompanyPilotCohortSnapshotCompany[]): string {
  const payload = companies
    .map((company) => `${company.cohort_rank}:${company.company_candidate_id}:${company.qualification_score}`)
    .join("|")
  let hash = 5381
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash << 5) + hash + payload.charCodeAt(i)
  }
  return `apollo-pilot-snapshot-${(hash >>> 0).toString(16)}`
}

function buildRankingExplanation(
  company: Apollo25CompanyPilotCohortSnapshotCompany,
  cohortSize: number,
): string {
  return `Rank ${company.cohort_rank} of ${cohortSize} greenfield-eligible companies by qualification score (${company.qualification_score} ≥ threshold). ${company.cohort_reason}.`
}

export function buildApollo25CompanyPilotGreenfieldCohortSnapshot(input: {
  selection_inputs: Apollo25CompanyPilotSelectionInput[]
  production_threshold?: number
  target_size?: number
  generated_at?: string
}): Apollo25CompanyPilotCohortSnapshot {
  const production_threshold = input.production_threshold ?? 70
  const target_size = input.target_size ?? APOLLO_25_COMPANY_PILOT_TARGET_COUNT
  const generated_at = input.generated_at ?? new Date().toISOString()

  const eligible: Apollo25CompanyPilotCohortSnapshotCompany[] = []
  const seenCompanyIds = new Set<string>()

  for (const row of input.selection_inputs) {
    const companyId = row.company_candidate_id.trim()
    if (!companyId || seenCompanyIds.has(companyId)) continue
    seenCompanyIds.add(companyId)

    const analysis = analyzeApollo25CompanyPilotCompanyEligibility(
      row,
      production_threshold,
      "greenfield",
    )
    if (!analysis.eligible || !analysis.contact) continue

    eligible.push({
      company_candidate_id: companyId,
      company_name: row.company_name,
      qualification_score: analysis.score,
      verified_email_count: row.snapshot_summary.verified_email_contacts,
      sequence_ready_count: row.snapshot_summary.sequence_ready_contacts,
      canonical_company_id: row.canonical_company_id?.trim() || null,
      enrollment_status: row.enrollment_status ?? null,
      cohort_rank: 0,
      cohort_reason: analysis.raw_reason ?? "production_rules_passed",
      ranking_explanation: "",
    })
  }

  eligible.sort((left, right) => {
    if (right.qualification_score !== left.qualification_score) {
      return right.qualification_score - left.qualification_score
    }
    return left.company_name.localeCompare(right.company_name)
  })

  const preDedupeSize = eligible.length
  for (let index = 0; index < eligible.length; index += 1) {
    const company = eligible[index]!
    company.cohort_rank = index + 1
    company.ranking_explanation = buildRankingExplanation(company, preDedupeSize)
  }

  const deduped = applyApollo25CompanyPilotCanonicalCohortDedupe(eligible)
  for (const company of deduped.kept) {
    company.ranking_explanation = buildRankingExplanation(company, deduped.kept.length)
  }

  return {
    qa_marker: APOLLO_25_COMPANY_PILOT_COHORT_SNAPSHOT_QA_MARKER,
    snapshot_id: buildDeterministicSnapshotId(deduped.kept),
    generated_at,
    pilot_selection_mode: "greenfield",
    target_size,
    cohort_size: deduped.kept.length,
    production_qualification_threshold: production_threshold,
    immutable: true,
    companies: deduped.kept,
    canonical_dedupe: deduped.summary,
  }
}

export function ensureApollo25CompanyPilotCanonicalUniqueSnapshot(
  snapshot: Apollo25CompanyPilotCohortSnapshot,
): Apollo25CompanyPilotCohortSnapshot {
  if (
    snapshot.canonical_dedupe &&
    snapshot.canonical_dedupe.duplicate_canonical_companies === 0
  ) {
    return snapshot
  }

  const deduped = applyApollo25CompanyPilotCanonicalCohortDedupe(snapshot.companies)
  for (const company of deduped.kept) {
    company.ranking_explanation = buildRankingExplanation(company, deduped.kept.length)
  }

  return {
    ...snapshot,
    snapshot_id: buildDeterministicSnapshotId(deduped.kept),
    cohort_size: deduped.kept.length,
    companies: deduped.kept,
    canonical_dedupe: deduped.summary,
  }
}

export function parseApollo25CompanyPilotCohortSnapshotFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Apollo25CompanyPilotCohortSnapshot | null {
  const raw = metadata?.draft_cohort_snapshot_v14_2f
  if (!raw || typeof raw !== "object") return null
  const snapshot = raw as Apollo25CompanyPilotCohortSnapshot
  if (snapshot.qa_marker !== APOLLO_25_COMPANY_PILOT_COHORT_SNAPSHOT_QA_MARKER) return null
  if (!Array.isArray(snapshot.companies)) return null
  return snapshot
}

export function snapshotCompaniesFromCohortCompanyRows(
  companies: Array<{
    company_candidate_id: string
    company_name: string
    metadata: Record<string, unknown>
  }>,
): Apollo25CompanyPilotCohortSnapshotCompany[] {
  return companies
    .map((row) => {
      const snapshot = row.metadata.snapshot_v14_2f as Apollo25CompanyPilotCohortSnapshotCompany | undefined
      if (snapshot?.company_candidate_id) return snapshot
      return null
    })
    .filter((row): row is Apollo25CompanyPilotCohortSnapshotCompany => row !== null)
    .sort((left, right) => left.cohort_rank - right.cohort_rank)
}
