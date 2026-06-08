/** Phase 7.PS-IO — Benchmark multi-source professional identity expansion orchestrator. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { acquireBenchmarkProfessionalIdentityEvidence } from "@/lib/growth/benchmark/apollo-replacement-benchmark-professional-identity-acquisition"
import { reconcileBenchmarkProfessionalIdentityEvidence } from "@/lib/growth/benchmark/apollo-replacement-benchmark-professional-identity-reconciliation"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER,
  type BenchmarkProfessionalIdentityExpansionMetrics,
  type BenchmarkProfessionalIdentityRejectedRecord,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-professional-identity-expansion-types"
import { loadApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import { ensureBuyingCommitteeIntelligenceFoundation } from "@/lib/growth/prospect-search/prospect-search-buying-committee-foundation"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function loadBenchmarkCohortCompanies(
  admin: SupabaseClient,
  company_ids: string[],
): Promise<
  Array<{
    canonical_company_id: string
    company_name: string
    company_candidate_id: string
    state: string | null
  }>
> {
  if (company_ids.length === 0) return []

  const [{ data: candidates }, { data: companies }] = await Promise.all([
    admin
      .schema("growth")
      .from("discovery_candidates")
      .select("id, company_id, company_name, canonical_company_id, state")
      .in("canonical_company_id", company_ids),
    admin
      .schema("growth")
      .from("companies")
      .select("id, display_name, state")
      .in("id", company_ids),
  ])

  const companyMeta = new Map(
    (companies ?? []).map((row) => [
      asString((row as Record<string, unknown>).id),
      {
        display_name: asString((row as Record<string, unknown>).display_name),
        state: asString((row as Record<string, unknown>).state) || null,
      },
    ]),
  )

  const byCanonical = new Map<
    string,
    { canonical_company_id: string; company_name: string; company_candidate_id: string; state: string | null }
  >()

  for (const row of candidates ?? []) {
    const record = row as Record<string, unknown>
    const canonical_company_id = asString(record.canonical_company_id)
    if (!canonical_company_id) continue
    const meta = companyMeta.get(canonical_company_id)
    const company_name =
      asString(record.company_name) || meta?.display_name || canonical_company_id
    const company_candidate_id = asString(record.company_id) || asString(record.id)
    if (!byCanonical.has(canonical_company_id)) {
      byCanonical.set(canonical_company_id, {
        canonical_company_id,
        company_name,
        company_candidate_id,
        state: asString(record.state) || meta?.state || null,
      })
    }
  }

  for (const company_id of company_ids) {
    if (byCanonical.has(company_id)) continue
    const meta = companyMeta.get(company_id)
    if (!meta) continue
    byCanonical.set(company_id, {
      canonical_company_id: company_id,
      company_name: meta.display_name || company_id,
      company_candidate_id: company_id,
      state: meta.state,
    })
  }

  return company_ids
    .map((id) => byCanonical.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
}

function emptyMetrics(): BenchmarkProfessionalIdentityExpansionMetrics {
  return {
    sources_queried: 0,
    sources_with_records: 0,
    evidence_records_collected: 0,
    evidence_records_accepted: 0,
    evidence_records_rejected: 0,
    persons_created: 0,
    titles_created: 0,
    committee_members_created: 0,
    companies_enriched: 0,
  }
}

export async function runApolloReplacementBenchmarkProfessionalIdentityExpansion(
  admin: SupabaseClient,
  input: {
    max_registry_sources?: number
    include_company_targeted_sources?: boolean
  } = {},
): Promise<{
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER
  ok: boolean
  cohort_company_count: number
  sources_queried: Array<{ key: string; label: string; source_type: string }>
  evidence_records_collected: number
  rejected: BenchmarkProfessionalIdentityRejectedRecord[]
  committee_classifications: Awaited<
    ReturnType<typeof reconcileBenchmarkProfessionalIdentityEvidence>
  >["committee_classifications"]
  metrics: BenchmarkProfessionalIdentityExpansionMetrics
  messages: string[]
}> {
  const messages: string[] = []
  const metrics = emptyMetrics()

  const cohort =
    (await loadApolloReplacementBenchmarkCohort(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)) ?? null
  if (!cohort || cohort.company_ids.length === 0) {
    return {
      qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER,
      ok: false,
      cohort_company_count: 0,
      sources_queried: [],
      evidence_records_collected: 0,
      rejected: [],
      committee_classifications: [],
      metrics,
      messages: ["benchmark_cohort_missing"],
    }
  }

  const cohortCompanies = await loadBenchmarkCohortCompanies(admin, cohort.company_ids)
  messages.push(`benchmark_cohort=${cohortCompanies.length} companies`)

  const acquisition = await acquireBenchmarkProfessionalIdentityEvidence({
    cohort: cohortCompanies.map((c) => ({ company_name: c.company_name, state: c.state })),
    max_registry_sources: input.max_registry_sources,
    include_company_targeted_sources: input.include_company_targeted_sources ?? true,
  })

  metrics.sources_queried = acquisition.sources_queried.length
  metrics.sources_with_records = acquisition.sources_with_records
  metrics.evidence_records_collected = acquisition.records.length
  messages.push(...acquisition.messages)

  const reconciliation = await reconcileBenchmarkProfessionalIdentityEvidence(admin, {
    records: acquisition.records,
    cohort: cohortCompanies,
  })

  metrics.evidence_records_accepted = reconciliation.evidence_records_accepted
  metrics.evidence_records_rejected = reconciliation.evidence_records_rejected
  metrics.persons_created = reconciliation.persons_created
  metrics.titles_created = reconciliation.titles_created
  metrics.companies_enriched = reconciliation.companies_enriched
  messages.push(...reconciliation.messages)

  if (
    reconciliation.enriched_company_ids.length > 0 &&
    (reconciliation.titles_created > 0 || reconciliation.persons_created > 0)
  ) {
    for (const company_id of reconciliation.enriched_company_ids) {
      const committee = await ensureBuyingCommitteeIntelligenceFoundation(admin, {
        company_id,
        force: true,
      })
      metrics.committee_members_created += committee.promoted_count
    }
    messages.push(`committee_members_created=${metrics.committee_members_created}`)
  } else {
    messages.push("committee: skipped — no new person/title evidence")
  }

  const ok =
    metrics.sources_queried > 0 &&
    (metrics.evidence_records_collected > 0 ||
      metrics.evidence_records_accepted > 0 ||
      metrics.persons_created > 0)

  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER,
    ok,
    cohort_company_count: cohortCompanies.length,
    sources_queried: acquisition.sources_queried.map((s) => ({
      key: s.key,
      label: s.label,
      source_type: s.source_type,
    })),
    evidence_records_collected: acquisition.records.length,
    rejected: reconciliation.rejected,
    committee_classifications: reconciliation.committee_classifications,
    metrics,
    messages,
  }
}
