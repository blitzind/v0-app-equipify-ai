/** Phase 7.PS-HS — Prospect Search graph expansion overlay. Client-safe builders. */

import {
  GROWTH_PROSPECT_GRAPH_EXPANSION_QA_MARKER,
  type GrowthProspectGraphExpansionMetrics,
} from "@/lib/growth/graph-expansion/prospect-graph-expansion-types"
import { listLiveProspectSources } from "@/lib/growth/graph-expansion/prospect-source-registry"
import type { ProspectSearchIntelligenceCoverage } from "@/lib/growth/prospect-search/prospect-search-coverage-types"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

export const GROWTH_PROSPECT_SEARCH_GRAPH_EXPANSION_QA_MARKER =
  "growth-prospect-search-graph-expansion-7-ps-hs-v1" as const

export type ProspectSearchGraphExpansionOverlay = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_GRAPH_EXPANSION_QA_MARKER
  graph_qa_marker: typeof GROWTH_PROSPECT_GRAPH_EXPANSION_QA_MARKER
  metrics: GrowthProspectGraphExpansionMetrics
  source_registry: Array<{
    source_type: string
    label: string
    refresh_cadence_days: number
    live: boolean
  }>
  source_attribution_summary: string[]
  evidence_freshness_label: string
  graph_growth_score: number
}

export function buildProspectSearchGraphExpansionOverlay(
  metrics: GrowthProspectGraphExpansionMetrics,
): ProspectSearchGraphExpansionOverlay {
  const registry = listLiveProspectSources().map((entry) => ({
    source_type: entry.source_type,
    label: entry.label,
    refresh_cadence_days: entry.refresh_cadence_days,
    live: entry.live,
  }))

  const source_attribution_summary = Object.entries(metrics.source_attribution ?? {})
    .filter(([, count]) => (count ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([source, count]) => `${source}: ${count}`)

  const freshness = metrics.evidence_freshness
  const evidence_freshness_label =
    freshness.stale_sources > freshness.fresh_sources
      ? "stale_heavy"
      : freshness.fresh_sources > 0
        ? "fresh_weighted"
        : "unknown"

  const graph_growth_score = Math.min(
    100,
    Math.round(
      metrics.named_person_density_pct * 0.35 +
        metrics.committee_density_pct * 0.2 +
        Math.min(metrics.verified_emails_total + metrics.verified_phones_total, 20) * 2 +
        Math.min(metrics.companies_total, 50) * 0.5,
    ),
  )

  return {
    qa_marker: GROWTH_PROSPECT_SEARCH_GRAPH_EXPANSION_QA_MARKER,
    graph_qa_marker: GROWTH_PROSPECT_GRAPH_EXPANSION_QA_MARKER,
    metrics,
    source_registry: registry,
    source_attribution_summary,
    evidence_freshness_label,
    graph_growth_score,
  }
}

export function mergeProspectSearchGraphExpansionIntoContactIntelligence(
  intelligence: GrowthProspectSearchContactIntelligence,
  overlay: ProspectSearchGraphExpansionOverlay,
): GrowthProspectSearchContactIntelligence {
  const source_labels = [
    ...new Set([...(intelligence.source_labels ?? []), "growth.graph_expansion"]),
  ]

  const engine_coverage: ProspectSearchIntelligenceCoverage | null = intelligence.engine_coverage
    ? {
        ...intelligence.engine_coverage,
        metrics: {
          ...intelligence.engine_coverage.metrics,
          graph_expansion: overlay.metrics,
        },
      }
    : intelligence.engine_coverage

  return {
    ...intelligence,
    source_labels,
    engine_coverage,
    graph_expansion: overlay,
  }
}
