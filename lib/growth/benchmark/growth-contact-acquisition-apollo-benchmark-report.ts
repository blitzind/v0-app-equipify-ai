/** Phase 7.PCA-3 — Apollo benchmark lift, title buckets, and enablement reporting. Client-safe. */

import type { ApolloReplacementBenchmarkMetrics } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import type { ApolloConfigDiagnostics } from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import type { ApolloContactTitleBucket } from "@/lib/growth/providers/apollo/apollo-title-buckets"
import { emptyApolloTitleBucketCounts } from "@/lib/growth/providers/apollo/apollo-title-buckets"

export const GROWTH_APOLLO_BENCHMARK_REPORT_QA_MARKER =
  "growth-apollo-benchmark-report-7-pca-3-v1" as const

/** Documented PDL benchmark lift on the same 54-company cohort (Phase 7.PS-IR). */
export const APOLLO_BENCHMARK_PDL_BASELINE_LIFT = {
  named_persons: 6,
  titled_persons: 6,
  verified_emails: 0,
  outreach_ready_companies: 0,
} as const

export type ApolloBenchmarkMetricLift = {
  named_persons: number
  titled_persons: number
  verified_emails: number
  outreach_ready_companies: number
  companies_with_contacts: number
}

export type ApolloBenchmarkDistributionStats = {
  average_contacts_per_company: number
  median_contacts_per_company: number
  companies_with_zero_contacts: number
}

export type ApolloBenchmarkEnablementRecommendation =
  | "do_not_enable_yet"
  | "benchmark_only"
  | "high_priority_companies_only"
  | "default_operator_chain"
  | "enrichment_after_manual_approval"

export type ApolloBenchmarkProviderOrderRecommendation =
  | "internal_website_pdl_apollo"
  | "internal_website_apollo_pdl"
  | "internal_website_apollo_high_score_only"
  | "apollo_not_ready"

export type ApolloBenchmarkReport = {
  qa_marker: typeof GROWTH_APOLLO_BENCHMARK_REPORT_QA_MARKER
  config_diagnostics: ApolloConfigDiagnostics | null
  distribution: ApolloBenchmarkDistributionStats
  title_buckets: Record<ApolloContactTitleBucket, number>
  raw_contacts_returned: number
  contacts_mapped: number
  contacts_skipped: number
  apollo_api_calls: number
  credits_consumed_estimate: number
  search_only_credits_confirmed_zero: boolean
  rate_limit_events: number
  errors: string[]
  lift_vs_baseline: ApolloBenchmarkMetricLift | null
  lift_vs_pdl: ApolloBenchmarkMetricLift | null
  pdl_baseline_lift: typeof APOLLO_BENCHMARK_PDL_BASELINE_LIFT
  enablement_recommendation: ApolloBenchmarkEnablementRecommendation
  provider_order_recommendation: ApolloBenchmarkProviderOrderRecommendation
  enrichment_recommendation: "defer" | "subset_only_after_approval" | "not_applicable_mock"
  remaining_risks: string[]
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function computeLift(
  before: ApolloReplacementBenchmarkMetrics | null,
  after: ApolloReplacementBenchmarkMetrics | null,
): ApolloBenchmarkMetricLift | null {
  if (!before || !after) return null
  return {
    named_persons: after.person.named_persons - before.person.named_persons,
    titled_persons: after.person.titled_persons - before.person.titled_persons,
    verified_emails: after.channel.verified_emails - before.channel.verified_emails,
    outreach_ready_companies:
      after.company.outreach_ready_companies - before.company.outreach_ready_companies,
    companies_with_contacts:
      after.company.companies_with_contacts - before.company.companies_with_contacts,
  }
}

function compareToPdl(apolloLift: ApolloBenchmarkMetricLift | null): ApolloBenchmarkMetricLift | null {
  if (!apolloLift) return null
  return {
    named_persons: apolloLift.named_persons - APOLLO_BENCHMARK_PDL_BASELINE_LIFT.named_persons,
    titled_persons: apolloLift.titled_persons - APOLLO_BENCHMARK_PDL_BASELINE_LIFT.titled_persons,
    verified_emails: apolloLift.verified_emails - APOLLO_BENCHMARK_PDL_BASELINE_LIFT.verified_emails,
    outreach_ready_companies:
      apolloLift.outreach_ready_companies -
      APOLLO_BENCHMARK_PDL_BASELINE_LIFT.outreach_ready_companies,
    companies_with_contacts: apolloLift.companies_with_contacts,
  }
}

function recommendEnablement(input: {
  mock: boolean
  live_db: boolean
  lift: ApolloBenchmarkMetricLift | null
  dry_run_contacts_mapped: number
  irrelevant_rate: number
  credits: number
  enrich_emails: boolean
}): ApolloBenchmarkEnablementRecommendation {
  if (input.mock) return "benchmark_only"
  if (!input.live_db) return "benchmark_only"
  if (!input.lift) return "do_not_enable_yet"

  const decisionMakerLift =
    input.lift.named_persons + input.lift.titled_persons + input.lift.outreach_ready_companies

  if (decisionMakerLift <= 0 && input.dry_run_contacts_mapped === 0) {
    return "do_not_enable_yet"
  }

  if (input.enrich_emails) {
    return "enrichment_after_manual_approval"
  }

  if (
    input.lift.outreach_ready_companies > 0 ||
    (input.lift.named_persons >= APOLLO_BENCHMARK_PDL_BASELINE_LIFT.named_persons &&
      input.irrelevant_rate < 0.35)
  ) {
    return "high_priority_companies_only"
  }

  if (
    input.lift.named_persons > APOLLO_BENCHMARK_PDL_BASELINE_LIFT.named_persons &&
    input.irrelevant_rate < 0.4
  ) {
    return "high_priority_companies_only"
  }

  if (input.lift.named_persons > 0) {
    return "benchmark_only"
  }

  return "do_not_enable_yet"
}

function recommendProviderOrder(input: {
  mock: boolean
  lift_vs_pdl: ApolloBenchmarkMetricLift | null
}): ApolloBenchmarkProviderOrderRecommendation {
  if (input.mock || !input.lift_vs_pdl) return "apollo_not_ready"

  const { named_persons, titled_persons, outreach_ready_companies } = input.lift_vs_pdl

  if (named_persons > 2 && titled_persons > 2) {
    return "internal_website_apollo_pdl"
  }
  if (named_persons >= 0 && titled_persons >= 0 && outreach_ready_companies >= 0) {
    return "internal_website_pdl_apollo"
  }
  if (named_persons < 0) {
    return "internal_website_pdl_apollo"
  }
  return "internal_website_apollo_high_score_only"
}

export function buildApolloBenchmarkReport(input: {
  mock: boolean
  mode: "dry_run" | "live_db"
  config_diagnostics: ApolloConfigDiagnostics | null
  contacts_per_company: number[]
  title_buckets: Record<ApolloContactTitleBucket, number>
  raw_contacts_returned: number
  contacts_mapped: number
  contacts_skipped: number
  apollo_api_calls: number
  credits_consumed_estimate: number
  enrich_emails: boolean
  rate_limit_events: number
  errors: string[]
  metrics_before: ApolloReplacementBenchmarkMetrics | null
  metrics_after: ApolloReplacementBenchmarkMetrics | null
}): ApolloBenchmarkReport {
  const distribution: ApolloBenchmarkDistributionStats = {
    average_contacts_per_company:
      input.contacts_per_company.length === 0
        ? 0
        : Math.round(
            (input.contacts_per_company.reduce((sum, n) => sum + n, 0) /
              input.contacts_per_company.length) *
              100,
          ) / 100,
    median_contacts_per_company: median(input.contacts_per_company),
    companies_with_zero_contacts: input.contacts_per_company.filter((n) => n === 0).length,
  }

  const titleTotal = Object.values(input.title_buckets).reduce((sum, n) => sum + n, 0)
  const irrelevant = input.title_buckets.sales_marketing_admin_irrelevant
  const irrelevant_rate = titleTotal > 0 ? irrelevant / titleTotal : 0

  const lift_vs_baseline = computeLift(input.metrics_before, input.metrics_after)
  const lift_vs_pdl = compareToPdl(lift_vs_baseline)

  const search_only_credits_confirmed_zero =
    !input.enrich_emails && input.credits_consumed_estimate === 0

  const remaining_risks: string[] = []
  if (input.mock) {
    remaining_risks.push("Benchmark ran in mock mode — live Apollo HTTP not exercised.")
  }
  if (input.mode === "dry_run") {
    remaining_risks.push("Dry-run did not persist candidates or run ZeroBounce verification.")
  }
  if (irrelevant_rate >= 0.35) {
    remaining_risks.push(
      `Irrelevant title bucket rate ${Math.round(irrelevant_rate * 100)}% — tune filters before broad enablement.`,
    )
  }
  if (input.rate_limit_events > 0) {
    remaining_risks.push(`${input.rate_limit_events} Apollo rate-limit event(s) observed.`)
  }
  if (input.errors.length > 0) {
    remaining_risks.push(`${input.errors.length} provider error(s) during benchmark.`)
  }

  return {
    qa_marker: GROWTH_APOLLO_BENCHMARK_REPORT_QA_MARKER,
    config_diagnostics: input.config_diagnostics,
    distribution,
    title_buckets: input.title_buckets,
    raw_contacts_returned: input.raw_contacts_returned,
    contacts_mapped: input.contacts_mapped,
    contacts_skipped: input.contacts_skipped,
    apollo_api_calls: input.apollo_api_calls,
    credits_consumed_estimate: input.credits_consumed_estimate,
    search_only_credits_confirmed_zero,
    rate_limit_events: input.rate_limit_events,
    errors: input.errors,
    lift_vs_baseline,
    lift_vs_pdl,
    pdl_baseline_lift: APOLLO_BENCHMARK_PDL_BASELINE_LIFT,
    enablement_recommendation: recommendEnablement({
      mock: input.mock,
      live_db: input.mode === "live_db",
      lift: lift_vs_baseline,
      dry_run_contacts_mapped: input.contacts_mapped,
      irrelevant_rate,
      credits: input.credits_consumed_estimate,
      enrich_emails: input.enrich_emails,
    }),
    provider_order_recommendation: recommendProviderOrder({
      mock: input.mock,
      lift_vs_pdl,
    }),
    enrichment_recommendation: input.mock
      ? "not_applicable_mock"
      : input.enrich_emails
        ? "subset_only_after_approval"
        : "defer",
    remaining_risks,
  }
}

export function mergeApolloTitleBucketCounts(
  left: Record<ApolloContactTitleBucket, number>,
  right: Record<ApolloContactTitleBucket, number>,
): Record<ApolloContactTitleBucket, number> {
  const merged = emptyApolloTitleBucketCounts()
  for (const key of Object.keys(merged) as ApolloContactTitleBucket[]) {
    merged[key] = (left[key] ?? 0) + (right[key] ?? 0)
  }
  return merged
}
