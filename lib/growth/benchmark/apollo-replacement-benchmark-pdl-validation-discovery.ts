/** Phase 7.PS-IR — Benchmark PDL validation orchestrator. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { acquireBenchmarkPdlContacts } from "@/lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-acquisition"
import { reconcileBenchmarkPdlContacts } from "@/lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-reconciliation"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER,
  type BenchmarkPdlValidationMetrics,
  type BenchmarkPdlValidationRejectedRecord,
  type BenchmarkPdlValidationCompanyResult,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-types"
import { runApolloReplacementBenchmarkVerifiedEmailCompletion } from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-completion"
import { loadApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import { buildGrowthProviderRuntimeDiagnosticsSnapshot } from "@/lib/growth/qa/growth-provider-runtime-diagnostics"
import { isPdlSandboxEnabled } from "@/lib/growth/providers/pdl/pdl-config"

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
    const domain =
      asString(record.primary_domain) ||
      meta?.domain ||
      null
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

function emptyMetrics(): BenchmarkPdlValidationMetrics {
  return {
    companies_processed: 0,
    companies_with_results: 0,
    companies_enriched: 0,
    persons_discovered: 0,
    persons_accepted: 0,
    persons_persisted: 0,
    persons_rejected: 0,
    persons_promoted: 0,
    titles_added: 0,
    committee_members_created: 0,
    verified_emails_added: 0,
    emails_returned: 0,
    outreach_ready_companies_added: 0,
  }
}

export async function runApolloReplacementBenchmarkPdlValidation(
  admin: SupabaseClient,
): Promise<{
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER
  ok: boolean
  preflight: {
    pdl_configured: boolean
    pdl_sandbox_env: boolean
    pdl_effective_live: boolean
    pdl_production_ready: boolean
    zerobounce_configured: boolean
    production_safe: boolean
  }
  runtime_diagnostics: ReturnType<typeof buildGrowthProviderRuntimeDiagnosticsSnapshot>
  metrics: BenchmarkPdlValidationMetrics
  company_results: BenchmarkPdlValidationCompanyResult[]
  rejected: BenchmarkPdlValidationRejectedRecord[]
  verified_email_completion: Awaited<
    ReturnType<typeof runApolloReplacementBenchmarkVerifiedEmailCompletion>
  > | null
  messages: string[]
}> {
  const messages: string[] = []
  const metrics = emptyMetrics()

  const runtime_diagnostics = buildGrowthProviderRuntimeDiagnosticsSnapshot()
  const pdl_configured =
    runtime_diagnostics.loaders.isPdlApiConfigured &&
    !runtime_diagnostics.loaders.pdl_discovery_disabled
  const pdl_sandbox_env = isPdlSandboxEnabled()
  const pdl_effective_live = true
  const pdl_production_ready = pdl_configured && pdl_effective_live
  const zerobounce_configured = runtime_diagnostics.loaders.isZeroBounceConfigured

  const preflight = {
    pdl_configured,
    pdl_sandbox_env,
    pdl_effective_live,
    pdl_production_ready,
    zerobounce_configured,
    production_safe: runtime_diagnostics.production_safe,
  }

  if (!pdl_configured) {
    messages.push("preflight_failed: pdl_not_configured")
    return {
      qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER,
      ok: false,
      preflight,
      runtime_diagnostics,
      metrics,
      company_results: [],
      rejected: [],
      verified_email_completion: null,
      messages,
    }
  }

  if (pdl_sandbox_env) {
    messages.push(
      "preflight_note: pdl_sandbox_env_enabled — benchmark validation forces live PDL (sandbox:false per company)",
    )
  }

  const cohort =
    (await loadApolloReplacementBenchmarkCohort(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)) ?? null
  if (!cohort || cohort.company_ids.length === 0) {
    messages.push("benchmark_cohort_missing")
    return {
      qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER,
      ok: false,
      preflight,
      runtime_diagnostics,
      metrics,
      company_results: [],
      rejected: [],
      verified_email_completion: null,
      messages,
    }
  }

  const cohortCompanies = await loadBenchmarkCohortCompanies(admin, cohort.company_ids)
  metrics.companies_processed = cohortCompanies.length
  messages.push(`benchmark_cohort=${cohortCompanies.length} companies`)

  const outreach_before = cohortCompanies.length > 0
    ? (
        await import("@/lib/growth/graph-expansion/person-committee-density-expansion")
      ).countOutreachReadyCompanies(admin, cohort.company_ids)
    : 0

  const acquisition = await acquireBenchmarkPdlContacts(admin, {
    companies: cohortCompanies,
    force_live: true,
  })

  metrics.persons_discovered = acquisition.company_results.reduce(
    (sum, r) => sum + r.persons_discovered,
    0,
  )
  metrics.persons_accepted = acquisition.company_results.reduce(
    (sum, r) => sum + r.persons_accepted,
    0,
  )
  metrics.persons_persisted = acquisition.company_results.reduce(
    (sum, r) => sum + r.persons_persisted,
    0,
  )
  metrics.persons_rejected = acquisition.rejected.length
  metrics.companies_with_results = acquisition.company_results.filter(
    (r) => r.persons_discovered > 0,
  ).length
  metrics.emails_returned = acquisition.company_results.reduce(
    (sum, r) => sum + r.emails_returned,
    0,
  )

  messages.push(...acquisition.messages)

  const reconciliation = await reconcileBenchmarkPdlContacts(admin, {
    companies: acquisition.company_results,
  })

  metrics.persons_promoted = reconciliation.persons_promoted
  metrics.titles_added = reconciliation.titles_added
  metrics.committee_members_created = reconciliation.committee_members_created
  metrics.companies_enriched = reconciliation.companies_enriched
  messages.push(...reconciliation.messages)

  let verified_email_completion: Awaited<
    ReturnType<typeof runApolloReplacementBenchmarkVerifiedEmailCompletion>
  > | null = null

  if (metrics.persons_persisted > 0) {
    verified_email_completion = await runApolloReplacementBenchmarkVerifiedEmailCompletion(admin)
    metrics.verified_emails_added = Math.max(
      0,
      verified_email_completion.after.verified_emails -
        verified_email_completion.before.verified_emails,
    )
    messages.push(...verified_email_completion.messages)
  } else {
    messages.push("verified_email_completion_skipped: no persisted contacts")
  }

  const outreach_after = await (
    await import("@/lib/growth/graph-expansion/person-committee-density-expansion")
  ).countOutreachReadyCompanies(admin, cohort.company_ids)
  metrics.outreach_ready_companies_added = Math.max(0, outreach_after - outreach_before)

  const ok =
    metrics.companies_processed > 0 &&
    (metrics.persons_discovered > 0 || metrics.persons_persisted > 0)

  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER,
    ok,
    preflight,
    runtime_diagnostics,
    metrics,
    company_results: reconciliation.company_results,
    rejected: acquisition.rejected,
    verified_email_completion,
    messages,
  }
}
