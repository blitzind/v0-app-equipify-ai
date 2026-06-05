/** Phase 7.PS-HX — External evidence source expansion orchestrator. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runCanonicalPersonBackfillForCompanyCandidate } from "@/lib/growth/canonical-persons/canonical-person-backfill"
import { acquireExternalEvidenceFromRegistry } from "@/lib/growth/external-evidence/external-evidence-acquisition"
import {
  mineLatentTitleEvidenceFromContacts,
  reconcileExternalEvidenceRecords,
} from "@/lib/growth/external-evidence/external-evidence-reconciliation"
import {
  GROWTH_EXTERNAL_EVIDENCE_QA_MARKER,
  type ExternalEvidenceExpansionMetrics,
} from "@/lib/growth/external-evidence/external-evidence-types"
import {
  countOutreachReadyCompanies,
  loadPersonCommitteeDensityExpansionCohort,
} from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import type { PersonCommitteeDensityCohortCompany } from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"
import {
  diffProspectGraphExpansionMetrics,
  loadProspectGraphExpansionMetrics,
} from "@/lib/growth/graph-expansion/prospect-graph-expansion-metrics"
import { ensureBuyingCommitteeIntelligenceFoundation } from "@/lib/growth/prospect-search/prospect-search-buying-committee-foundation"

function emptyMetrics(): ExternalEvidenceExpansionMetrics {
  return {
    sources_queried: 0,
    sources_with_records: 0,
    external_evidence_records: 0,
    names_discovered: 0,
    titles_discovered: 0,
    companies_enriched: 0,
    persons_materialized: 0,
    committee_members_promoted: 0,
    latent_titles_recovered: 0,
  }
}

async function countCommitteeVerified(admin: SupabaseClient, company_ids: string[]): Promise<number> {
  if (company_ids.length === 0) return 0
  const { count } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_members")
    .select("id", { count: "exact", head: true })
    .in("company_id", company_ids)
    .eq("verification_status", "verified")
  return count ?? 0
}

export async function runExternalEvidenceExpansion(
  admin: SupabaseClient,
  input: {
    cohort?: PersonCommitteeDensityCohortCompany[]
    include_anchors?: boolean
    limit?: number
    max_sources?: number
  } = {},
): Promise<{
  qa_marker: typeof GROWTH_EXTERNAL_EVIDENCE_QA_MARKER
  ok: boolean
  cohort: PersonCommitteeDensityCohortCompany[]
  metrics: ExternalEvidenceExpansionMetrics
  before: {
    committee_members_verified: number
    outreach_ready_companies: number
    graph_metrics: Awaited<ReturnType<typeof loadProspectGraphExpansionMetrics>>["metrics"]
  }
  after: {
    committee_members_verified: number
    outreach_ready_companies: number
    graph_metrics: Awaited<ReturnType<typeof loadProspectGraphExpansionMetrics>>["metrics"]
  }
  graph_delta: ReturnType<typeof diffProspectGraphExpansionMetrics>
  acquisition_messages: string[]
  messages: string[]
}> {
  const metrics = emptyMetrics()
  const messages: string[] = []

  const cohort =
    input.cohort ??
    (await loadPersonCommitteeDensityExpansionCohort(admin, {
      include_anchors: input.include_anchors,
      limit: input.limit,
    }))

  const companyIds = cohort.map((c) => c.canonical_company_id)

  const graph_before = await loadProspectGraphExpansionMetrics(admin, { company_ids: companyIds })
  const committee_before = await countCommitteeVerified(admin, companyIds)
  const outreach_before = await countOutreachReadyCompanies(admin, companyIds)

  const acquisition = await acquireExternalEvidenceFromRegistry({
    max_sources: input.max_sources,
    cohort: cohort.map((c) => ({ company_name: c.company_name })),
  })
  metrics.sources_queried = acquisition.sources_queried
  metrics.sources_with_records = acquisition.sources_with_records
  metrics.external_evidence_records = acquisition.records.length
  messages.push(
    `acquisition: ${acquisition.sources_queried} sources, ${acquisition.records.length} records`,
  )

  const reconciliation = await reconcileExternalEvidenceRecords(admin, {
    records: acquisition.records,
    cohort,
  })
  metrics.companies_enriched = reconciliation.companies_enriched
  metrics.names_discovered = reconciliation.names_discovered
  metrics.titles_discovered = reconciliation.titles_discovered
  metrics.persons_materialized = reconciliation.persons_materialized
  messages.push(
    `reconciliation: matched=${reconciliation.matched_records} companies=${reconciliation.companies_enriched} names=${reconciliation.names_discovered} titles=${reconciliation.titles_discovered}`,
  )

  for (const target of cohort) {
    await runCanonicalPersonBackfillForCompanyCandidate(admin, {
      company_candidate_id: target.company_candidate_id,
      canonical_company_id: target.canonical_company_id,
      mode: "apply",
    })
  }

  const latent = await mineLatentTitleEvidenceFromContacts(admin, { company_ids: companyIds })
  metrics.latent_titles_recovered = latent.titles_recovered
  messages.push(
    `latent_titles: scanned=${latent.contacts_scanned} recovered=${latent.titles_recovered} enriched=${latent.persons_enriched}`,
  )

  const titleEvidenceAcquired =
    reconciliation.titles_discovered > 0 ||
    latent.titles_recovered > 0 ||
    reconciliation.persons_enriched > 0 ||
    latent.persons_enriched > 0

  if (titleEvidenceAcquired) {
    for (const target of cohort) {
      const committee = await ensureBuyingCommitteeIntelligenceFoundation(admin, {
        company_id: target.canonical_company_id,
        force: true,
      })
      metrics.committee_members_promoted += committee.promoted_count
    }
    messages.push(`committee: promoted=${metrics.committee_members_promoted} (title evidence acquired)`)
  } else {
    messages.push("committee: skipped — no new title evidence")
  }

  const graph_after = await loadProspectGraphExpansionMetrics(admin, { company_ids: companyIds })
  const committee_after = await countCommitteeVerified(admin, companyIds)
  const outreach_after = await countOutreachReadyCompanies(admin, companyIds)

  const named_density_increased =
    graph_after.metrics.named_person_density_pct > graph_before.metrics.named_person_density_pct ||
    graph_after.metrics.named_persons_total > graph_before.metrics.named_persons_total
  const title_density_increased =
    (graph_after.metrics.titles_total ?? 0) > (graph_before.metrics.titles_total ?? 0)

  const ok =
    metrics.sources_queried > 0 &&
    metrics.external_evidence_records > 0 &&
    (named_density_increased || title_density_increased || metrics.committee_members_promoted > 0)

  return {
    qa_marker: GROWTH_EXTERNAL_EVIDENCE_QA_MARKER,
    ok,
    cohort,
    metrics,
    before: {
      committee_members_verified: committee_before,
      outreach_ready_companies: outreach_before,
      graph_metrics: graph_before.metrics,
    },
    after: {
      committee_members_verified: committee_after,
      outreach_ready_companies: outreach_after,
      graph_metrics: graph_after.metrics,
    },
    graph_delta: diffProspectGraphExpansionMetrics(graph_before.metrics, graph_after.metrics),
    acquisition_messages: acquisition.messages,
    messages,
  }
}
