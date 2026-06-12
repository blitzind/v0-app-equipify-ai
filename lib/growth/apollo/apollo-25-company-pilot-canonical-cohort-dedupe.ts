/** Apollo 25-company pilot — canonical-company cohort deduplication (Phase 14.2G.1). */

import type {
  Apollo25CompanyPilotCohortSnapshotCompany,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"

export const APOLLO_25_COMPANY_PILOT_CANONICAL_COHORT_DEDUPE_QA_MARKER =
  "apollo-25-company-pilot-canonical-cohort-dedupe-v14-2g-1" as const

export type Apollo25CompanyPilotCohortCanonicalDedupeAuditEntry = {
  canonical_company_id: string
  kept_company_candidate_id: string
  removed_company_candidate_ids: string[]
}

export type Apollo25CompanyPilotCohortCanonicalDedupeSummary = {
  qa_marker: typeof APOLLO_25_COMPANY_PILOT_CANONICAL_COHORT_DEDUPE_QA_MARKER
  canonical_company_count: number
  duplicate_canonical_companies: number
  canonical_duplicates_removed: number
  dedupe_audit: Apollo25CompanyPilotCohortCanonicalDedupeAuditEntry[]
  excluded_companies: Apollo25CompanyPilotCohortSnapshotCompany[]
}

function compareCohortCompanyPriority(
  left: Apollo25CompanyPilotCohortSnapshotCompany,
  right: Apollo25CompanyPilotCohortSnapshotCompany,
): number {
  if (right.qualification_score !== left.qualification_score) {
    return right.qualification_score - left.qualification_score
  }
  if (left.cohort_rank > 0 && right.cohort_rank > 0 && left.cohort_rank !== right.cohort_rank) {
    return left.cohort_rank - right.cohort_rank
  }
  return left.company_name.localeCompare(right.company_name)
}

export function countApollo25CompanyPilotCanonicalCompanies(
  companies: Apollo25CompanyPilotCohortSnapshotCompany[],
): number {
  const canonicalIds = new Set<string>()
  let withoutCanonical = 0
  for (const company of companies) {
    const canonicalId = company.canonical_company_id?.trim()
    if (canonicalId) canonicalIds.add(canonicalId)
    else withoutCanonical += 1
  }
  return canonicalIds.size + withoutCanonical
}

export function countApollo25CompanyPilotRemainingCanonicalDuplicates(
  companies: Apollo25CompanyPilotCohortSnapshotCompany[],
): number {
  const counts = new Map<string, number>()
  for (const company of companies) {
    const canonicalId = company.canonical_company_id?.trim()
    if (!canonicalId) continue
    counts.set(canonicalId, (counts.get(canonicalId) ?? 0) + 1)
  }
  let duplicates = 0
  for (const count of counts.values()) {
    if (count > 1) duplicates += count - 1
  }
  return duplicates
}

export function applyApollo25CompanyPilotCanonicalCohortDedupe(
  companies: Apollo25CompanyPilotCohortSnapshotCompany[],
): {
  kept: Apollo25CompanyPilotCohortSnapshotCompany[]
  summary: Apollo25CompanyPilotCohortCanonicalDedupeSummary
} {
  const sorted = [...companies].sort(compareCohortCompanyPriority)
  const kept: Apollo25CompanyPilotCohortSnapshotCompany[] = []
  const excluded: Apollo25CompanyPilotCohortSnapshotCompany[] = []
  const dedupe_audit: Apollo25CompanyPilotCohortCanonicalDedupeAuditEntry[] = []
  const seenCanonical = new Map<string, Apollo25CompanyPilotCohortSnapshotCompany>()

  for (const company of sorted) {
    const canonicalId = company.canonical_company_id?.trim()
    if (!canonicalId) {
      kept.push(company)
      continue
    }

    const existing = seenCanonical.get(canonicalId)
    if (!existing) {
      seenCanonical.set(canonicalId, company)
      kept.push(company)
      continue
    }

    excluded.push(company)
    const audit = dedupe_audit.find((row) => row.canonical_company_id === canonicalId)
    if (audit) {
      audit.removed_company_candidate_ids.push(company.company_candidate_id)
    } else {
      dedupe_audit.push({
        canonical_company_id: canonicalId,
        kept_company_candidate_id: existing.company_candidate_id,
        removed_company_candidate_ids: [company.company_candidate_id],
      })
    }
  }

  const cohortSize = kept.length
  for (let index = 0; index < kept.length; index += 1) {
    const company = kept[index]!
    company.cohort_rank = index + 1
    if (company.ranking_explanation.includes("Rank ")) {
      company.ranking_explanation = company.ranking_explanation.replace(
        /Rank \d+ of \d+/,
        `Rank ${company.cohort_rank} of ${cohortSize}`,
      )
    }
  }

  const summary: Apollo25CompanyPilotCohortCanonicalDedupeSummary = {
    qa_marker: APOLLO_25_COMPANY_PILOT_CANONICAL_COHORT_DEDUPE_QA_MARKER,
    canonical_company_count: countApollo25CompanyPilotCanonicalCompanies(kept),
    duplicate_canonical_companies: countApollo25CompanyPilotRemainingCanonicalDuplicates(kept),
    canonical_duplicates_removed: excluded.length,
    dedupe_audit,
    excluded_companies: excluded,
  }

  return { kept, summary }
}

export function parseApollo25CompanyPilotCanonicalDedupeFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Apollo25CompanyPilotCohortCanonicalDedupeSummary | null {
  const raw = metadata?.canonical_cohort_dedupe_v14_2g_1
  if (!raw || typeof raw !== "object") return null
  const summary = raw as Apollo25CompanyPilotCohortCanonicalDedupeSummary
  if (summary.qa_marker !== APOLLO_25_COMPANY_PILOT_CANONICAL_COHORT_DEDUPE_QA_MARKER) return null
  if (!Array.isArray(summary.dedupe_audit)) return null
  return summary
}

export function isApollo25CompanyPilotCanonicalDuplicateExcluded(
  company_candidate_id: string,
  dedupe: Apollo25CompanyPilotCohortCanonicalDedupeSummary | null | undefined,
): boolean {
  if (!dedupe) return false
  const id = company_candidate_id.trim()
  return dedupe.excluded_companies.some((row) => row.company_candidate_id === id)
}
