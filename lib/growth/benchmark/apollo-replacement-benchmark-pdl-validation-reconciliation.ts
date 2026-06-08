/** Phase 7.PS-IR — Promote PDL contacts through canonical person backfill. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runCanonicalPersonBackfillForCompanyCandidate } from "@/lib/growth/canonical-persons/canonical-person-backfill"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER,
  type BenchmarkPdlValidationCompanyResult,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-types"
import { loadPersonCommitteeDensityCompanySnapshot } from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import {
  collectTitleEvidenceForContact,
  selectBestTitleEvidence,
} from "@/lib/growth/human-identity-evidence/title-role-evidence-extract"
import { enrichPersonCompanyRoleFromTitleEvidence } from "@/lib/growth/human-identity-evidence/title-role-evidence-repository"
import { ensureBuyingCommitteeIntelligenceFoundation } from "@/lib/growth/prospect-search/prospect-search-buying-committee-foundation"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function reconcileBenchmarkPdlContacts(
  admin: SupabaseClient,
  input: {
    companies: Array<{
      canonical_company_id: string
      company_name: string
      company_candidate_id: string
      persons_persisted: number
      status: BenchmarkPdlValidationCompanyResult["status"]
      persons_discovered: number
      persons_accepted: number
      persons_rejected: number
      messages: string[]
    }>
  },
): Promise<{
  company_results: BenchmarkPdlValidationCompanyResult[]
  persons_promoted: number
  titles_added: number
  committee_members_created: number
  companies_enriched: number
  messages: string[]
}> {
  const messages: string[] = []
  const company_results: BenchmarkPdlValidationCompanyResult[] = []
  let persons_promoted = 0
  let titles_added = 0
  let committee_members_created = 0
  let companies_enriched = 0

  for (const company of input.companies) {
    const before = await loadPersonCommitteeDensityCompanySnapshot(admin, {
      canonical_company_id: company.canonical_company_id,
      company_name: company.company_name,
      cohort_kind: "ps_ht_new",
    })

    if (company.persons_persisted === 0) {
      company_results.push({
        canonical_company_id: company.canonical_company_id,
        company_name: company.company_name,
        company_candidate_id: company.company_candidate_id,
        status: company.status,
        persons_discovered: company.persons_discovered,
        persons_accepted: company.persons_accepted,
        persons_persisted: company.persons_persisted,
        persons_rejected: company.persons_rejected,
        named_persons_before: before.named_persons,
        named_persons_after: before.named_persons,
        titled_persons_before: before.titled_persons,
        titled_persons_after: before.titled_persons,
        messages: [...company.messages, "reconcile_skipped: no persisted contacts"],
      })
      continue
    }

    await runCanonicalPersonBackfillForCompanyCandidate(admin, {
      company_candidate_id: company.company_candidate_id,
      canonical_company_id: company.canonical_company_id,
      mode: "apply",
    })

    const { data: contacts } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("id, full_name, title, canonical_person_id, source_evidence, metadata, updated_at")
      .eq("company_id", company.company_candidate_id)
      .neq("contact_status", "archived")

    let company_titles_added = 0
    for (const row of contacts ?? []) {
      const record = row as Record<string, unknown>
      const metadata = (record.metadata as Record<string, unknown> | null) ?? {}
      if (metadata.qa_marker !== GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER) {
        continue
      }

      const title = asString(record.title)
      const person_id = asString(record.canonical_person_id)
      if (!title || !person_id) continue

      const evidence = collectTitleEvidenceForContact({
        full_name: asString(record.full_name),
        title,
        source_evidence: Array.isArray(record.source_evidence)
          ? (record.source_evidence as Array<{
              claim?: string
              evidence?: string
              source?: string
              page_url?: string | null
            }>)
          : [],
        metadata,
        company_contact_id: asString(record.id),
        person_id,
        company_id: company.canonical_company_id,
        observed_at: asString(record.updated_at),
      })
      const best = selectBestTitleEvidence(evidence)
      if (!best) continue

      const enriched = await enrichPersonCompanyRoleFromTitleEvidence(admin, {
        person_id,
        company_id: company.canonical_company_id,
        company_contact_id: asString(record.id),
        evidence: best,
      })
      if (enriched.enriched || enriched.created) {
        company_titles_added += 1
      }
    }

    const committee = await ensureBuyingCommitteeIntelligenceFoundation(admin, {
      company_id: company.canonical_company_id,
      force: true,
    })
    committee_members_created += committee.promoted_count

    const after = await loadPersonCommitteeDensityCompanySnapshot(admin, {
      canonical_company_id: company.canonical_company_id,
      company_name: company.company_name,
      cohort_kind: "ps_ht_new",
    })

    const named_added = Math.max(0, after.named_persons - before.named_persons)
    const titled_added = Math.max(0, after.titled_persons - before.titled_persons)
    persons_promoted += named_added
    titles_added += titled_added

    if (named_added > 0 || titled_added > 0 || company.persons_persisted > 0) {
      companies_enriched += 1
    }

    company_results.push({
      canonical_company_id: company.canonical_company_id,
      company_name: company.company_name,
      company_candidate_id: company.company_candidate_id,
      status: company.status,
      persons_discovered: company.persons_discovered,
      persons_accepted: company.persons_accepted,
      persons_persisted: company.persons_persisted,
      persons_rejected: company.persons_rejected,
      named_persons_before: before.named_persons,
      named_persons_after: after.named_persons,
      titled_persons_before: before.titled_persons,
      titled_persons_after: after.titled_persons,
      messages: [
        ...company.messages,
        `reconcile: named=${before.named_persons}→${after.named_persons} titled=${before.titled_persons}→${after.titled_persons}`,
      ],
    })
  }

  messages.push(
    `reconcile: promoted=${persons_promoted} titles=${titles_added} committee=${committee_members_created} enriched=${companies_enriched}`,
  )

  return {
    company_results,
    persons_promoted,
    titles_added,
    committee_members_created,
    companies_enriched,
    messages,
  }
}
