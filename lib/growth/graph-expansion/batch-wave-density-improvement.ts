/** Phase 7.PS-IE — Re-enrich wave-1 companies with improved person-page discovery. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runBatchGraphExpansionForCompany } from "@/lib/growth/graph-expansion/batch-graph-expansion-company"
import { loadBatchGraphExpansionDensityFunnel } from "@/lib/growth/graph-expansion/batch-graph-expansion-density"
import type { BatchGraphExpansionProviderCounters } from "@/lib/growth/graph-expansion/batch-graph-expansion-types"
import { auditBatchWaveDensityCompany } from "@/lib/growth/graph-expansion/batch-wave-density-audit"
import { loadBatchWaveDensityImprovementCohort } from "@/lib/growth/graph-expansion/batch-wave-density-improvement-cohort"
import {
  GROWTH_BATCH_WAVE_DENSITY_IMPROVEMENT_QA_MARKER,
  type BatchWaveDensityImprovementResult,
} from "@/lib/growth/graph-expansion/batch-wave-density-improvement-types"
import { loadPersonCommitteeDensityCompanySnapshot } from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import { countOutreachReadyCompanies } from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import { parseWebsiteExtractionDiagnosticsFromMetadata } from "@/lib/growth/contact-discovery/website-acquisition-metadata-bridge"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function emptyProviderCounters(): BatchGraphExpansionProviderCounters {
  return {
    website_fetches: 0,
    zerobounce_calls: 0,
    external_evidence_sources: 0,
    channel_completion_persons: 0,
  }
}

async function loadLatestCrawlPages(
  admin: SupabaseClient,
  company_id: string,
): Promise<string[]> {
  const { data } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("metadata")
    .eq("company_id", company_id)
    .neq("contact_status", "archived")
    .order("updated_at", { ascending: false })
    .limit(3)

  for (const row of data ?? []) {
    const metadata =
      (row as Record<string, unknown>).metadata &&
      typeof (row as Record<string, unknown>).metadata === "object"
        ? ((row as Record<string, unknown>).metadata as Record<string, unknown>)
        : {}
    const diagnostics = parseWebsiteExtractionDiagnosticsFromMetadata(metadata)
    if (diagnostics?.pages_crawled.length) return diagnostics.pages_crawled
  }
  return []
}

export async function runBatchWaveDensityImprovement(
  admin: SupabaseClient,
  input: {
    batch_id?: string
    company_timeout_ms?: number
    limit?: number
  } = {},
): Promise<BatchWaveDensityImprovementResult> {
  const started = Date.now()
  const messages: string[] = []
  const provider_counters = emptyProviderCounters()

  const { batch_id, companies } = await loadBatchWaveDensityImprovementCohort(admin, {
    batch_id: input.batch_id,
    only_enriched: true,
    limit: input.limit ?? 12,
  })

  if (!batch_id || companies.length === 0) {
    return {
      qa_marker: GROWTH_BATCH_WAVE_DENSITY_IMPROVEMENT_QA_MARKER,
      ok: false,
      batch_id: batch_id || "",
      companies_inspected: 0,
      company_audits: [],
      metrics: {
        companies_processed: 0,
        companies_succeeded: 0,
        companies_failed: 0,
        pages_newly_crawled: 0,
        named_persons_delta: 0,
        titles_delta: 0,
        verified_emails_delta: 0,
        verified_phones_delta: 0,
        generic_contacts_preserved: 0,
        outreach_ready_delta: 0,
        runtime_ms: Date.now() - started,
        fetch_errors: 0,
      },
      names_recovered: [],
      titles_recovered: [],
      verified_channels_promoted: 0,
      density_funnel: {
        before: await loadBatchGraphExpansionDensityFunnel(admin, []),
        after: await loadBatchGraphExpansionDensityFunnel(admin, []),
      },
      company_results: [],
      messages: ["no_wave_enriched_cohort"],
    }
  }

  const company_audits = []
  for (const company of companies) {
    company_audits.push(await auditBatchWaveDensityCompany(admin, company))
  }

  const companyIds = companies.map((c) => c.canonical_company_id)
  const density_before = await loadBatchGraphExpansionDensityFunnel(admin, companyIds)
  const outreach_before = await countOutreachReadyCompanies(admin, companyIds)

  const company_results: BatchWaveDensityImprovementResult["company_results"] = []
  let companies_succeeded = 0
  let companies_failed = 0
  let pages_newly_crawled = 0
  let named_persons_delta = 0
  let titles_delta = 0
  let verified_emails_delta = 0
  let verified_phones_delta = 0
  let fetch_errors = 0
  const names_recovered: string[] = []
  const titles_recovered: string[] = []

  for (const company of companies) {
    const audit = company_audits.find((a) => a.canonical_company_id === company.canonical_company_id)
    const beforeSnapshot = await loadPersonCommitteeDensityCompanySnapshot(admin, {
      canonical_company_id: company.canonical_company_id,
      company_name: company.company_name,
      cohort_kind: "ps_ht_new",
    })
    const crawledBefore = new Set(audit?.pages_crawled_before ?? [])

    const result = await runBatchGraphExpansionForCompany(admin, {
      company: {
        company_candidate_id: company.company_candidate_id,
        canonical_company_id: company.canonical_company_id,
        company_name: company.company_name,
        search_query: company.search_query,
        contact_count: company.contact_count,
        enrichment_stale: true,
        cohort_kind: "stale",
      },
      provider_counters,
      company_timeout_ms: input.company_timeout_ms,
      run_external_evidence: true,
      run_channel_completion: true,
    })

    const afterSnapshot = await loadPersonCommitteeDensityCompanySnapshot(admin, {
      canonical_company_id: company.canonical_company_id,
      company_name: company.company_name,
      cohort_kind: "ps_ht_new",
    })

    const crawledAfter = await loadLatestCrawlPages(admin, company.canonical_company_id)
    const newlyCrawled = crawledAfter.filter((url) => !crawledBefore.has(url))
    pages_newly_crawled += newlyCrawled.length

    const namedDelta = Math.max(0, afterSnapshot.named_persons - beforeSnapshot.named_persons)
    const titleDelta = Math.max(0, afterSnapshot.titled_persons - beforeSnapshot.titled_persons)
    named_persons_delta += namedDelta
    titles_delta += titleDelta
    verified_emails_delta += Math.max(0, afterSnapshot.verified_emails - beforeSnapshot.verified_emails)
    verified_phones_delta += Math.max(0, afterSnapshot.verified_phones - beforeSnapshot.verified_phones)

    if (namedDelta > 0) {
      const { data: namedRows } = await admin
        .schema("growth")
        .from("company_contacts")
        .select("full_name, title")
        .eq("company_id", company.canonical_company_id)
        .neq("contact_status", "archived")
      for (const row of namedRows ?? []) {
        const name = asString((row as Record<string, unknown>).full_name)
        const title = asString((row as Record<string, unknown>).title)
        if (name && !names_recovered.includes(name)) names_recovered.push(name)
        if (title && !titles_recovered.includes(title)) titles_recovered.push(title)
      }
    }

    if (result.ok) companies_succeeded += 1
    else {
      companies_failed += 1
      fetch_errors += result.metrics.fetch_errors
    }

    company_results.push({
      company_name: company.company_name,
      canonical_company_id: company.canonical_company_id,
      ok: result.ok,
      pages_newly_crawled: newlyCrawled,
      named_persons_delta: namedDelta,
      messages: result.messages,
    })
    messages.push(
      `${company.company_name}: ok=${result.ok} pages+${newlyCrawled.length} named+${namedDelta}`,
    )
  }

  const density_after = await loadBatchGraphExpansionDensityFunnel(admin, companyIds)
  const outreach_after = await countOutreachReadyCompanies(admin, companyIds)

  return {
    qa_marker: GROWTH_BATCH_WAVE_DENSITY_IMPROVEMENT_QA_MARKER,
    ok: companies_succeeded > 0,
    batch_id,
    companies_inspected: companies.length,
    company_audits,
    metrics: {
      companies_processed: companies.length,
      companies_succeeded,
      companies_failed,
      pages_newly_crawled,
      named_persons_delta,
      titles_delta,
      verified_emails_delta,
      verified_phones_delta,
      generic_contacts_preserved: density_after.generic_identities,
      outreach_ready_delta: outreach_after - outreach_before,
      runtime_ms: Date.now() - started,
      fetch_errors,
    },
    names_recovered,
    titles_recovered,
    verified_channels_promoted: verified_emails_delta + verified_phones_delta,
    density_funnel: { before: density_before, after: density_after },
    company_results,
    messages,
  }
}
