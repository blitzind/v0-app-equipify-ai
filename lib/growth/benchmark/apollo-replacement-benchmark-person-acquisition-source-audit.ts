/** Phase 7.PS-IQ — Person acquisition source benchmark audit (read-only). Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { auditApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-audit"
import { loadApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import {
  APOLLO_REPLACEMENT_BENCHMARK_ID,
  type ApolloReplacementBenchmarkMetrics,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import {
  buildPersonAcquisitionSourceRegistry,
  formatPersonAcquisitionSourceRankingTable,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-person-acquisition-source-registry"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PERSON_ACQUISITION_SOURCE_QA_MARKER,
  PERSON_ACQUISITION_BENCHMARK_TARGETS,
  type PersonAcquisitionSourceAuditMetrics,
  type PersonAcquisitionSourceRegistryEntry,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-person-acquisition-source-types"
import { getPdlApiKey, isPdlDiscoveryDisabled } from "@/lib/growth/providers/pdl/pdl-config"
import { getZeroBounceApiKey } from "@/lib/growth/contact-verification/providers/zerobounce-config"

export { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PERSON_ACQUISITION_SOURCE_QA_MARKER }

function resolveRecommendedNextPhase(
  sources: PersonAcquisitionSourceRegistryEntry[],
): {
  phase: string
  source_key: string
  rationale: string
} | null {
  const implementNext = sources.find((s) => s.recommendation === "implement_next")
  if (implementNext) {
    return {
      phase: "7.PS-IR",
      source_key: implementNext.key,
      rationale: implementNext.recommendation_rationale,
    }
  }

  const pilot = sources.find((s) => s.recommendation === "pilot_benchmark")
  if (pilot) {
    return {
      phase: "7.PS-IR",
      source_key: pilot.key,
      rationale: pilot.recommendation_rationale,
    }
  }

  return null
}

function summarizeAuditMetrics(
  sources: PersonAcquisitionSourceRegistryEntry[],
): PersonAcquisitionSourceAuditMetrics {
  const actionable = sources.filter(
    (s) => s.recommendation !== "exhausted" && s.recommendation !== "defer",
  )

  return {
    sources_evaluated: sources.length,
    sources_wired: sources.filter((s) => s.wired_in_codebase).length,
    sources_configured: sources.filter((s) => s.configured_at_runtime).length,
    sources_observed_on_benchmark: sources.filter((s) => s.benchmark_observed).length,
    sources_meeting_named_target: actionable.filter(
      (s) => s.yield.named_persons_per_100 >= PERSON_ACQUISITION_BENCHMARK_TARGETS.named_persons_per_100,
    ).length,
    sources_meeting_outreach_target: actionable.filter(
      (s) =>
        s.yield.outreach_ready_companies_per_100 >=
        PERSON_ACQUISITION_BENCHMARK_TARGETS.outreach_ready_companies_per_100,
    ).length,
    sources_meeting_both_targets: actionable.filter(
      (s) =>
        s.yield.named_persons_per_100 >= PERSON_ACQUISITION_BENCHMARK_TARGETS.named_persons_per_100 &&
        s.yield.outreach_ready_companies_per_100 >=
          PERSON_ACQUISITION_BENCHMARK_TARGETS.outreach_ready_companies_per_100,
    ).length,
  }
}

export async function runApolloReplacementBenchmarkPersonAcquisitionSourceAudit(
  admin: SupabaseClient,
  input: {
    benchmark_metrics: ApolloReplacementBenchmarkMetrics
  },
): Promise<{
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PERSON_ACQUISITION_SOURCE_QA_MARKER
  benchmark_metrics: ApolloReplacementBenchmarkMetrics
  cohort_company_count: number
  cohort_segmentation: Awaited<ReturnType<typeof auditApolloReplacementBenchmarkCohort>>["segmentation"]
  primary_blocker: string
  blocker_rationale: string
  provider_runtime: {
    pdl_configured: boolean
    pdl_discovery_disabled: boolean
    zerobounce_configured: boolean
  }
  ranked_sources: PersonAcquisitionSourceRegistryEntry[]
  source_ranking_table: ReturnType<typeof formatPersonAcquisitionSourceRankingTable>
  audit_metrics: PersonAcquisitionSourceAuditMetrics
  recommended_next_phase: string | null
  recommended_source_key: string | null
  recommended_rationale: string | null
  expected_benchmark_lift: {
    best_source_key: string | null
    named_persons_per_100: number | null
    verified_emails_per_100: number | null
    outreach_ready_companies_per_100: number | null
  }
  messages: string[]
}> {
  const messages: string[] = []

  const cohort = await loadApolloReplacementBenchmarkCohort(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)
  if (!cohort || cohort.company_ids.length === 0) {
    messages.push("benchmark_cohort_missing")
  }

  const company_ids = cohort?.company_ids ?? []
  const cohort_audit = await auditApolloReplacementBenchmarkCohort(admin, company_ids)

  const pdl_configured = Boolean(getPdlApiKey()) && !isPdlDiscoveryDisabled()
  const zerobounce_configured = Boolean(getZeroBounceApiKey())

  const ranked_sources = buildPersonAcquisitionSourceRegistry({
    pdl_configured,
    zerobounce_configured,
  })

  const audit_metrics = summarizeAuditMetrics(ranked_sources)
  const recommendation = resolveRecommendedNextPhase(ranked_sources)

  const bestLift = ranked_sources.find(
    (s) =>
      s.recommendation === "implement_next" ||
      (s.recommendation === "pilot_benchmark" &&
        s.yield.outreach_ready_companies_per_100 >=
          PERSON_ACQUISITION_BENCHMARK_TARGETS.outreach_ready_companies_per_100),
  )

  messages.push(
    `Benchmark at ${input.benchmark_metrics.person.named_persons} named persons and ${input.benchmark_metrics.company.outreach_ready_companies} outreach-ready companies across ${input.benchmark_metrics.company.total_companies} companies.`,
  )
  messages.push(cohort_audit.blocker_rationale)
  messages.push(
    `${audit_metrics.sources_meeting_both_targets} actionable source(s) meet both 50+ named and 15+ outreach-ready per 100 targets.`,
  )

  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PERSON_ACQUISITION_SOURCE_QA_MARKER,
    benchmark_metrics: input.benchmark_metrics,
    cohort_company_count: company_ids.length,
    cohort_segmentation: cohort_audit.segmentation,
    primary_blocker: cohort_audit.selected_blocker,
    blocker_rationale: cohort_audit.blocker_rationale,
    provider_runtime: {
      pdl_configured,
      pdl_discovery_disabled: isPdlDiscoveryDisabled(),
      zerobounce_configured,
    },
    ranked_sources,
    source_ranking_table: formatPersonAcquisitionSourceRankingTable(ranked_sources),
    audit_metrics,
    recommended_next_phase: recommendation?.phase ?? null,
    recommended_source_key: recommendation?.source_key ?? null,
    recommended_rationale: recommendation?.rationale ?? null,
    expected_benchmark_lift: {
      best_source_key: bestLift?.key ?? null,
      named_persons_per_100: bestLift?.yield.named_persons_per_100 ?? null,
      verified_emails_per_100: bestLift?.yield.verified_emails_per_100 ?? null,
      outreach_ready_companies_per_100: bestLift?.yield.outreach_ready_companies_per_100 ?? null,
    },
    messages,
  }
}
