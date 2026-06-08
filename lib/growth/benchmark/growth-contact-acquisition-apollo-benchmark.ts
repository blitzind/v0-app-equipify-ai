/** Phase 7.PCA-2/3 — Apollo contact acquisition benchmark. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadApolloReplacementBenchmarkMetrics } from "@/lib/growth/benchmark/apollo-replacement-benchmark-metrics"
import { loadApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import type { ApolloReplacementBenchmarkMetrics } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import {
  buildApolloBenchmarkReport,
  mergeApolloTitleBucketCounts,
  type ApolloBenchmarkReport,
} from "@/lib/growth/benchmark/growth-contact-acquisition-apollo-benchmark-report"
import { createApolloContactDiscoveryProvider } from "@/lib/growth/contact-discovery/providers/apollo-contact-discovery-provider"
import {
  diagnoseApolloContactDiscoveryConfig,
  type ApolloConfigDiagnostics,
} from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import { searchApolloPeopleByCompany } from "@/lib/growth/providers/apollo/apollo-client"
import {
  isApolloEmailEnrichmentEnabled,
  isApolloMockEnabled,
  isApolloProviderConfigured,
  resolveApolloCreditLimits,
} from "@/lib/growth/providers/apollo/apollo-config"
import { mapApolloPeopleToContactDiscoveryRaw } from "@/lib/growth/providers/apollo/map-apollo-contact"
import { getApolloProviderRuntimeDiagnostics } from "@/lib/growth/providers/apollo/apollo-provider-diagnostics"
import {
  beginApolloRunGuardrails,
  getApolloRunGuardrailSnapshot,
  resetApolloRunGuardrails,
} from "@/lib/growth/providers/apollo/apollo-run-guardrails"
import {
  classifyApolloContactTitleBucket,
  emptyApolloTitleBucketCounts,
  type ApolloContactTitleBucket,
} from "@/lib/growth/providers/apollo/apollo-title-buckets"

export const GROWTH_CONTACT_ACQUISITION_APOLLO_BENCHMARK_QA_MARKER =
  "growth-contact-acquisition-apollo-benchmark-7-pca-3-v1" as const

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
    domain: string | null
    industry: string | null
  }>
> {
  if (company_ids.length === 0) return []

  const [{ data: candidates }, { data: companies }] = await Promise.all([
    admin
      .schema("growth")
      .from("discovery_candidates")
      .select("id, company_id, company_name, canonical_company_id, primary_domain, industry")
      .in("canonical_company_id", company_ids),
    admin
      .schema("growth")
      .from("companies")
      .select("id, display_name, primary_domain, website, industry")
      .in("id", company_ids),
  ])

  const companyMeta = new Map(
    (companies ?? []).map((row) => {
      const record = row as Record<string, unknown>
      return [
        asString(record.id),
        {
          display_name: asString(record.display_name),
          domain:
            asString(record.primary_domain) ||
            asString(record.website)?.replace(/^https?:\/\//, "").split("/")[0] ||
            null,
          industry: asString(record.industry) || null,
        },
      ] as const
    }),
  )

  const byCanonical = new Map<
    string,
    {
      canonical_company_id: string
      company_name: string
      company_candidate_id: string
      domain: string | null
      industry: string | null
    }
  >()

  for (const row of candidates ?? []) {
    const record = row as Record<string, unknown>
    const canonical_company_id = asString(record.canonical_company_id)
    if (!canonical_company_id) continue
    const meta = companyMeta.get(canonical_company_id)
    const company_name =
      asString(record.company_name) || meta?.display_name || canonical_company_id
    const company_candidate_id = asString(record.company_id) || asString(record.id)
    const domain = asString(record.primary_domain) || meta?.domain || null
    const industry = asString(record.industry) || meta?.industry || null
    if (!byCanonical.has(canonical_company_id)) {
      byCanonical.set(canonical_company_id, {
        canonical_company_id,
        company_name,
        company_candidate_id,
        domain,
        industry,
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
      domain: meta.domain,
      industry: meta.industry,
    })
  }

  return company_ids
    .map((id) => byCanonical.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
}

export type GrowthContactAcquisitionApolloBenchmarkCompanyResult = {
  canonical_company_id: string
  company_name: string
  company_candidate_id: string
  status: "success" | "skipped" | "failed" | "no_results"
  raw_contacts_returned: number
  contacts_mapped: number
  contacts_skipped: number
  candidates_stored: number
  company_contacts_synced: number
  api_calls: number
  credits_estimate: number | null
  title_buckets: Record<ApolloContactTitleBucket, number>
  diagnostics: Record<string, unknown> | null
  message: string
}

export type GrowthContactAcquisitionApolloBenchmarkResult = {
  qa_marker: typeof GROWTH_CONTACT_ACQUISITION_APOLLO_BENCHMARK_QA_MARKER
  mode: "dry_run" | "live_db"
  mock: boolean
  config_diagnostics: ApolloConfigDiagnostics
  guardrails: ReturnType<typeof getApolloRunGuardrailSnapshot>
  cohort_company_count: number
  companies_processed: number
  companies_with_apollo_results: number
  companies_with_contacts: number
  companies_skipped_unresolved: number
  raw_contacts_returned: number
  total_contacts_mapped: number
  total_contacts_skipped: number
  total_api_calls: number
  total_credits_estimate: number
  title_buckets: Record<ApolloContactTitleBucket, number>
  rate_limit_events: number
  errors: string[]
  metrics_before: ApolloReplacementBenchmarkMetrics | null
  metrics_after: ApolloReplacementBenchmarkMetrics | null
  provider_runtime: ReturnType<typeof getApolloProviderRuntimeDiagnostics>
  report: ApolloBenchmarkReport
  company_results: GrowthContactAcquisitionApolloBenchmarkCompanyResult[]
}

function tallyRawTitleBuckets(people: Array<{ title?: string | null; headline?: string | null }>) {
  const buckets = emptyApolloTitleBucketCounts()
  for (const person of people) {
    const title = asString(person.title) || asString(person.headline) || null
    buckets[classifyApolloContactTitleBucket(title)] += 1
  }
  return buckets
}

export async function runGrowthContactAcquisitionApolloBenchmark(
  admin: SupabaseClient | null,
  input?: {
    dry_run?: boolean
    mock?: boolean
    company_limit?: number
    benchmark_id?: string
    env?: NodeJS.ProcessEnv
  },
): Promise<GrowthContactAcquisitionApolloBenchmarkResult> {
  const env = input?.env ?? process.env
  const dry_run = input?.dry_run !== false && (input?.dry_run === true || !admin)
  const mock = input?.mock ?? isApolloMockEnabled(env)
  const benchmark_id = input?.benchmark_id ?? APOLLO_REPLACEMENT_BENCHMARK_ID
  const config_diagnostics = diagnoseApolloContactDiscoveryConfig(env)
  const credit_limits = resolveApolloCreditLimits(env)

  const requestedLimit = input?.company_limit ?? credit_limits.max_companies_per_run
  const company_limit = Math.min(requestedLimit, credit_limits.max_companies_per_run)

  beginApolloRunGuardrails()

  const cohort = admin ? await loadApolloReplacementBenchmarkCohort(admin, benchmark_id) : null
  const company_ids = (cohort?.company_ids ?? []).slice(0, company_limit)
  let companies = admin ? await loadBenchmarkCohortCompanies(admin, company_ids) : []

  if (dry_run && companies.length === 0) {
    companies = Array.from({ length: Math.min(company_ids.length || 3, company_limit || 3) }).map(
      (_, index) => ({
        canonical_company_id: `mock-canonical-${index + 1}`,
        company_name: `Benchmark Mock Co ${index + 1}`,
        company_candidate_id: `mock-candidate-${index + 1}`,
        domain: `mockco${index + 1}.com`,
        industry: "Healthcare",
      }),
    )
  }

  const metrics_before =
    admin && !dry_run ? await loadApolloReplacementBenchmarkMetrics(admin, company_ids) : null

  const company_results: GrowthContactAcquisitionApolloBenchmarkCompanyResult[] = []
  let raw_contacts_returned = 0
  let total_contacts_mapped = 0
  let total_contacts_skipped = 0
  let total_api_calls = 0
  let total_credits_estimate = 0
  let companies_skipped_unresolved = 0
  let title_buckets = emptyApolloTitleBucketCounts()
  let rate_limit_events = 0
  const errors: string[] = []

  const provider = createApolloContactDiscoveryProvider()

  for (const company of companies) {
    if (dry_run) {
      const search = await searchApolloPeopleByCompany(
        {
          company_name: company.company_name,
          domain: company.domain,
          industry: company.industry,
          limit: credit_limits.max_contacts_per_company,
        },
        { mock },
      )
      const mapped = mapApolloPeopleToContactDiscoveryRaw({
        people: search.people,
        company_name: company.company_name,
        domain: company.domain,
        mock: search.mock,
      })
      const api_calls = search.mock ? 0 : 1
      const credits = search.diagnostics.credits_consumed_estimate ?? 0
      const rawBuckets = tallyRawTitleBuckets(search.people)

      if (search.status === "failed") errors.push(`${company.company_name}: ${search.message}`)
      if (search.diagnostics.api_error_category === "rate_limit" || search.diagnostics.rate_limit_remaining === 0) {
        rate_limit_events += 1
      }

      raw_contacts_returned += search.people.length
      total_api_calls += api_calls
      total_credits_estimate += credits
      total_contacts_mapped += mapped.contacts.length
      total_contacts_skipped += mapped.diagnostics.contacts_skipped
      title_buckets = mergeApolloTitleBucketCounts(title_buckets, rawBuckets)

      company_results.push({
        ...company,
        status:
          search.status === "failed"
            ? "failed"
            : search.status === "success" && mapped.contacts.length === 0
              ? "no_results"
              : search.status,
        raw_contacts_returned: search.people.length,
        contacts_mapped: mapped.contacts.length,
        contacts_skipped: mapped.diagnostics.contacts_skipped,
        candidates_stored: 0,
        company_contacts_synced: 0,
        api_calls,
        credits_estimate: credits,
        title_buckets: rawBuckets,
        diagnostics: search.diagnostics as unknown as Record<string, unknown>,
        message: search.message,
      })
      continue
    }

    if (!admin) break

    const { runContactDiscoveryForCompany } = await import("@/lib/growth/contact-discovery/contact-repository")
    const { syncContactCandidatesToCompanyContactsWithResolution } = await import(
      "@/lib/growth/acquisition/sync-contact-candidates-to-company-contacts"
    )

    const discovery = await runContactDiscoveryForCompany(admin, {
      company_candidate_id: company.company_candidate_id,
      limit: credit_limits.max_contacts_per_company,
      provider_types: ["future_apollo"],
    })

    const apolloOutcome = discovery.provider_outcomes.find((o) => o.provider === "apollo")
    const contacts = discovery.contacts.filter((c) => c.provider_type === "future_apollo")
    const sync = await syncContactCandidatesToCompanyContactsWithResolution(admin, {
      company_candidate_id: company.company_candidate_id,
      canonical_company_id: company.canonical_company_id,
      candidates: contacts,
    })

    if (!sync.resolution?.ready) companies_skipped_unresolved += 1

    const diag =
      apolloOutcome && typeof apolloOutcome === "object"
        ? (apolloOutcome as Record<string, unknown>)
        : null

    const contactTitles = contacts.map((c) => c.job_title)
    const mappedBuckets = emptyApolloTitleBucketCounts()
    for (const title of contactTitles) {
      mappedBuckets[classifyApolloContactTitleBucket(title)] += 1
    }

    if (apolloOutcome?.status === "failed") {
      errors.push(`${company.company_name}: ${apolloOutcome.message ?? "apollo_failed"}`)
    }

    total_contacts_mapped += contacts.length
    total_api_calls += 1
    title_buckets = mergeApolloTitleBucketCounts(title_buckets, mappedBuckets)

    company_results.push({
      ...company,
      status:
        contacts.length === 0
          ? apolloOutcome?.status === "skipped"
            ? "skipped"
            : "no_results"
          : "success",
      raw_contacts_returned: contacts.length,
      contacts_mapped: contacts.length,
      contacts_skipped: 0,
      candidates_stored: contacts.length,
      company_contacts_synced: sync.synced,
      api_calls: 1,
      credits_estimate: isApolloEmailEnrichmentEnabled(env) ? null : 0,
      title_buckets: mappedBuckets,
      diagnostics: diag,
      message: apolloOutcome?.message ?? discovery.provider_messages.join("; "),
    })
  }

  const metrics_after =
    admin && !dry_run ? await loadApolloReplacementBenchmarkMetrics(admin, company_ids) : null

  const guardrails = getApolloRunGuardrailSnapshot()
  resetApolloRunGuardrails()

  const contacts_per_company = company_results.map((r) => r.contacts_mapped)

  const report = buildApolloBenchmarkReport({
    mock,
    mode: dry_run ? "dry_run" : "live_db",
    config_diagnostics,
    contacts_per_company,
    title_buckets,
    raw_contacts_returned,
    contacts_mapped: total_contacts_mapped,
    contacts_skipped: total_contacts_skipped,
    apollo_api_calls: total_api_calls,
    credits_consumed_estimate: total_credits_estimate,
    enrich_emails: isApolloEmailEnrichmentEnabled(env),
    rate_limit_events,
    errors,
    metrics_before,
    metrics_after,
  })

  return {
    qa_marker: GROWTH_CONTACT_ACQUISITION_APOLLO_BENCHMARK_QA_MARKER,
    mode: dry_run ? "dry_run" : "live_db",
    mock,
    config_diagnostics,
    guardrails,
    cohort_company_count: company_ids.length,
    companies_processed: company_results.length,
    companies_with_apollo_results: company_results.filter(
      (r) => r.raw_contacts_returned > 0 || r.status === "success",
    ).length,
    companies_with_contacts: company_results.filter((r) => r.contacts_mapped > 0).length,
    companies_skipped_unresolved,
    raw_contacts_returned,
    total_contacts_mapped,
    total_contacts_skipped,
    total_api_calls,
    total_credits_estimate,
    title_buckets,
    rate_limit_events,
    errors,
    metrics_before,
    metrics_after,
    provider_runtime: getApolloProviderRuntimeDiagnostics(),
    report,
    company_results,
  }
}

export function isApolloBenchmarkRunnable(env: NodeJS.ProcessEnv = process.env): boolean {
  return isApolloProviderConfigured(env)
}
