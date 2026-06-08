/** Phase 7.PS-IU — Verified contact source benchmark (read-only). Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import {
  buildContactSourceBenchmarkRegistry,
  OBSERVED_PS_IR_PDL_INCREMENTAL,
} from "@/lib/growth/benchmark/apollo-replacement-contact-source-benchmark-registry"
import {
  CONTACT_SOURCE_BENCHMARK_ID,
  CONTACT_SOURCE_BENCHMARK_POST_PS_IR_BASELINE,
  CONTACT_SOURCE_BENCHMARK_TARGETS,
  GROWTH_APOLLO_REPLACEMENT_CONTACT_SOURCE_BENCHMARK_QA_MARKER,
  type ContactSourceBenchmarkResult,
  type ContactSourceComparisonRow,
  type ContactSourceGapAnalysis,
  type ContactSourceStrategyRecommendation,
} from "@/lib/growth/benchmark/apollo-replacement-contact-source-benchmark-types"
import { loadApolloReplacementBenchmarkSnapshot } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { getPdlApiKey, isPdlDiscoveryDisabled } from "@/lib/growth/providers/pdl/pdl-config"
import { getZeroBounceApiKey } from "@/lib/growth/contact-verification/providers/zerobounce-config"

function normalizePer100(value: number, companies: number): number {
  if (companies <= 0) return 0
  return Math.round((value / companies) * 1000) / 10
}

function projectFromMarginal(input: {
  baseline_named: number
  baseline_verified_emails: number
  baseline_outreach: number
  companies: number
  marginal_per_100: {
    named_persons_per_100: number
    verified_emails_per_100: number
    outreach_ready_companies_per_100: number
  }
  dedup_overlap: number
}): {
  named_persons: number
  verified_emails: number
  outreach_ready_companies: number
} {
  const overlap = Math.min(Math.max(input.dedup_overlap, 0), 0.9)
  const named_add = Math.round(
    (input.marginal_per_100.named_persons_per_100 / 100) * input.companies * (1 - overlap),
  )
  const email_add = Math.round(
    (input.marginal_per_100.verified_emails_per_100 / 100) * input.companies * (1 - overlap),
  )
  const outreach_add = Math.round(
    (input.marginal_per_100.outreach_ready_companies_per_100 / 100) *
      input.companies *
      (1 - overlap),
  )
  return {
    named_persons: input.baseline_named + named_add,
    verified_emails: input.baseline_verified_emails + email_add,
    outreach_ready_companies: input.baseline_outreach + outreach_add,
  }
}

function buildGapAnalysis(baseline: typeof CONTACT_SOURCE_BENCHMARK_POST_PS_IR_BASELINE): ContactSourceGapAnalysis {
  const named_person_gap = Math.max(0, CONTACT_SOURCE_BENCHMARK_TARGETS.named_persons - baseline.named_persons)
  const outreach_ready_gap = Math.max(
    0,
    CONTACT_SOURCE_BENCHMARK_TARGETS.outreach_ready_companies - baseline.outreach_ready_companies,
  )
  const verified_email_gap = Math.max(0, outreach_ready_gap)

  return {
    current_named_persons: baseline.named_persons,
    current_verified_emails: baseline.verified_emails,
    current_outreach_ready_companies: baseline.outreach_ready_companies,
    target_named_persons: CONTACT_SOURCE_BENCHMARK_TARGETS.named_persons,
    target_outreach_ready_companies: CONTACT_SOURCE_BENCHMARK_TARGETS.outreach_ready_companies,
    named_person_gap,
    verified_email_gap,
    outreach_ready_gap,
    named_person_gap_per_100: normalizePer100(named_person_gap, baseline.companies),
    verified_email_gap_per_100: normalizePer100(verified_email_gap, baseline.companies),
    outreach_ready_gap_per_100: normalizePer100(outreach_ready_gap, baseline.companies),
  }
}

function buildComparisonMatrix(
  sources: ReturnType<typeof buildContactSourceBenchmarkRegistry>,
): ContactSourceComparisonRow[] {
  return sources.map((source) => ({
    source: source.label,
    named_person_lift: source.marginal_density.named_persons_per_100,
    verified_email_lift: source.marginal_density.verified_emails_per_100,
    outreach_ready_lift: source.marginal_density.outreach_ready_companies_per_100,
    cost_per_verified_email_usd: source.cost.cost_per_verified_email_usd,
    complexity: source.operational.integration_complexity,
    confidence: source.confidence,
  }))
}

function estimateScenarioCost(input: {
  companies: number
  marginal_per_100: {
    named_persons_per_100: number
    verified_emails_per_100: number
    outreach_ready_companies_per_100: number
  }
  cost: {
    cost_per_discovered_person_usd: number | null
    cost_per_verified_email_usd: number | null
    cost_per_outreach_ready_company_usd: number | null
  }
}): number | null {
  const persons = (input.marginal_per_100.named_persons_per_100 / 100) * input.companies
  const emails = (input.marginal_per_100.verified_emails_per_100 / 100) * input.companies
  const outreach =
    (input.marginal_per_100.outreach_ready_companies_per_100 / 100) * input.companies

  if (
    input.cost.cost_per_verified_email_usd == null &&
    input.cost.cost_per_discovered_person_usd == null
  ) {
    return null
  }

  return Math.round(
    (persons * (input.cost.cost_per_discovered_person_usd ?? 0) +
      emails * (input.cost.cost_per_verified_email_usd ?? 0) +
      outreach * (input.cost.cost_per_outreach_ready_company_usd ?? 0)) *
      100,
  ) / 100
}

function resolveRecommendation(input: {
  scenarios: ContactSourceBenchmarkResult["combination_scenarios"]
  gap: ContactSourceGapAnalysis
}): {
  recommendation: ContactSourceStrategyRecommendation
  rationale: string
  estimated_weeks: number | null
} {
  const meetsBoth = input.scenarios.filter(
    (s) => s.meets_named_target && s.meets_outreach_target,
  )
  if (meetsBoth.length > 0) {
    const best = [...meetsBoth].sort(
      (a, b) => (a.estimated_cost_usd ?? 9999) - (b.estimated_cost_usd ?? 9999),
    )[0]
    const key = best.strategy_key as ContactSourceStrategyRecommendation
    return {
      recommendation: key.includes("pdl") ? "hybrid_strategy" : key as ContactSourceStrategyRecommendation,
      rationale: `${best.label} is the lowest-cost scenario that closes both named-person and outreach-ready gaps on the frozen benchmark cohort.`,
      estimated_weeks: best.estimated_weeks_to_pilot,
    }
  }

  const meetsOutreach = input.scenarios
    .filter((s) => s.meets_outreach_target)
    .sort((a, b) => (a.estimated_cost_usd ?? 9999) - (b.estimated_cost_usd ?? 9999))

  if (meetsOutreach.length > 0) {
    const best = meetsOutreach[0]
    return {
      recommendation:
        best.strategy_key === "apollo_api"
          ? "apollo_only"
          : best.strategy_key === "seamless_api"
            ? "seamless_only"
            : "hybrid_strategy",
      rationale: `${best.label} is the fastest credible path to 15+ outreach-ready companies; PDL alone cannot move verified-contact density.`,
      estimated_weeks: best.estimated_weeks_to_pilot,
    }
  }

  if (input.gap.outreach_ready_gap > 0) {
    return {
      recommendation: "hybrid_strategy",
      rationale:
        "No single estimated source closes the outreach-ready gap on this ICP; pilot Apollo benchmark first while keeping wired PDL for incremental named-person lift.",
      estimated_weeks: 5,
    }
  }

  return {
    recommendation: "pdl_only",
    rationale: "Outreach gap closed; maintain wired PDL for low-cost named-person supplementation.",
    estimated_weeks: 0,
  }
}

export async function runApolloReplacementContactSourceBenchmark(
  admin: SupabaseClient,
): Promise<ContactSourceBenchmarkResult> {
  const messages: string[] = []

  const ps_ir_snapshot = await loadApolloReplacementBenchmarkSnapshot(admin, {
    benchmark_id: APOLLO_REPLACEMENT_BENCHMARK_ID,
    phase_version: "7.ps-ir",
  })

  const baseline = ps_ir_snapshot
    ? {
        benchmark_id: APOLLO_REPLACEMENT_BENCHMARK_ID,
        phase_version: "7.ps-ir" as const,
        companies: ps_ir_snapshot.metrics.company.total_companies,
        named_persons: ps_ir_snapshot.metrics.person.named_persons,
        titled_persons: ps_ir_snapshot.metrics.person.titled_persons,
        verified_emails: ps_ir_snapshot.metrics.channel.verified_emails,
        verified_phones: ps_ir_snapshot.metrics.channel.verified_phones,
        outreach_ready_companies: ps_ir_snapshot.metrics.company.outreach_ready_companies,
      }
    : CONTACT_SOURCE_BENCHMARK_POST_PS_IR_BASELINE

  if (!ps_ir_snapshot) {
    messages.push("ps_ir_snapshot_missing: using documented post-PS-IR baseline constants")
  }

  const pdl_configured = Boolean(getPdlApiKey()) && !isPdlDiscoveryDisabled()
  const zerobounce_configured = Boolean(getZeroBounceApiKey())
  const sources = buildContactSourceBenchmarkRegistry({ pdl_configured, zerobounce_configured })
  const gap_analysis = buildGapAnalysis(baseline)
  const comparison_matrix = buildComparisonMatrix(sources)

  const strategyDefs: Array<{
    strategy_key: string
    label: string
    source_keys: string[]
    dedup_overlap: number
    weeks: number
  }> = [
    { strategy_key: "pdl_only", label: "PDL only (observed)", source_keys: ["people_data_labs"], dedup_overlap: 0, weeks: 0 },
    { strategy_key: "apollo_api", label: "Apollo only", source_keys: ["apollo_api"], dedup_overlap: 0.15, weeks: 4 },
    { strategy_key: "seamless_api", label: "Seamless only", source_keys: ["seamless_api"], dedup_overlap: 0.15, weeks: 4 },
    { strategy_key: "prospeo", label: "Prospeo only", source_keys: ["prospeo"], dedup_overlap: 0.1, weeks: 3 },
    { strategy_key: "pdl_plus_apollo", label: "PDL + Apollo", source_keys: ["people_data_labs", "apollo_api"], dedup_overlap: 0.35, weeks: 4 },
    { strategy_key: "pdl_plus_seamless", label: "PDL + Seamless", source_keys: ["people_data_labs", "seamless_api"], dedup_overlap: 0.35, weeks: 4 },
    { strategy_key: "pdl_plus_prospeo", label: "PDL + Prospeo", source_keys: ["people_data_labs", "prospeo"], dedup_overlap: 0.25, weeks: 3 },
    { strategy_key: "hybrid_strategy", label: "PDL + Apollo + Prospeo", source_keys: ["people_data_labs", "apollo_api", "prospeo"], dedup_overlap: 0.45, weeks: 5 },
  ]

  const combination_scenarios = strategyDefs.map((def) => {
    const selected = sources.filter((s) => def.source_keys.includes(s.key))
    const marginal = selected.reduce(
      (acc, source) => ({
        named_persons_per_100:
          acc.named_persons_per_100 + source.marginal_density.named_persons_per_100,
        verified_emails_per_100:
          acc.verified_emails_per_100 + source.marginal_density.verified_emails_per_100,
        outreach_ready_companies_per_100:
          acc.outreach_ready_companies_per_100 +
          source.marginal_density.outreach_ready_companies_per_100,
      }),
      {
        named_persons_per_100: 0,
        verified_emails_per_100: 0,
        outreach_ready_companies_per_100: 0,
      },
    )

    const projected = projectFromMarginal({
      baseline_named: baseline.named_persons,
      baseline_verified_emails: baseline.verified_emails,
      baseline_outreach: baseline.outreach_ready_companies,
      companies: baseline.companies,
      marginal_per_100: marginal,
      dedup_overlap: def.dedup_overlap,
    })

    const costParts = selected.map((s) =>
      estimateScenarioCost({
        companies: baseline.companies,
        marginal_per_100: s.marginal_density,
        cost: s.cost,
      }),
    )
    const estimated_cost_usd =
      costParts.every((c) => c == null) ? null : costParts.reduce((sum, c) => sum + (c ?? 0), 0)

    return {
      strategy_key: def.strategy_key,
      label: def.label,
      projected_named_persons: projected.named_persons,
      projected_verified_emails: projected.verified_emails,
      projected_outreach_ready_companies: projected.outreach_ready_companies,
      meets_named_target: projected.named_persons >= CONTACT_SOURCE_BENCHMARK_TARGETS.named_persons,
      meets_outreach_target:
        projected.outreach_ready_companies >= CONTACT_SOURCE_BENCHMARK_TARGETS.outreach_ready_companies,
      estimated_cost_usd,
      estimated_weeks_to_pilot: def.weeks,
    }
  })

  const { recommendation, rationale, estimated_weeks } = resolveRecommendation({
    scenarios: combination_scenarios,
    gap: gap_analysis,
  })

  messages.push(
    `baseline=${baseline.named_persons} named / ${baseline.verified_emails} verified emails / ${baseline.outreach_ready_companies} outreach-ready across ${baseline.companies} companies`,
  )
  messages.push(
    `pdl_observed_incremental=${OBSERVED_PS_IR_PDL_INCREMENTAL.named_persons_per_100} named/100, ${OBSERVED_PS_IR_PDL_INCREMENTAL.verified_emails_per_100} verified emails/100`,
  )
  messages.push(`gap: ${gap_analysis.named_person_gap} named persons, ${gap_analysis.outreach_ready_gap} outreach-ready companies`)
  messages.push(`recommendation=${recommendation}`)

  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_CONTACT_SOURCE_BENCHMARK_QA_MARKER,
    benchmark_id: CONTACT_SOURCE_BENCHMARK_ID,
    baseline,
    targets: CONTACT_SOURCE_BENCHMARK_TARGETS,
    gap_analysis,
    sources,
    comparison_matrix,
    source_ranking: sources.map((source, index) => ({
      rank: index + 1,
      key: source.key,
      label: source.label,
      rank_score: Math.round(source.rank_score * 10) / 10,
      evidence_tier: source.evidence_tier,
    })),
    combination_scenarios,
    recommendation,
    recommendation_rationale: rationale,
    estimated_weeks_to_targets: estimated_weeks,
    messages,
  }
}
