/** Deterministic market coverage + saturation scoring. Client-safe. */

import type { GrowthMarketCoverageScore } from "@/lib/growth/market-intelligence/market-intelligence-types"

export type MarketCoverageInput = {
  market_key: string
  market_label: string
  territory_id?: string | null
  industry?: string | null
  market_total_discovered: number
  market_researched: number
  market_contacted: number
  market_active_pipeline: number
  market_customers: number
  market_signal_density?: number | null
  market_contact_coverage?: number | null
  territory_strength?: number | null
}

export function computeMarketCoverageScore(input: MarketCoverageInput): GrowthMarketCoverageScore {
  const total = Math.max(0, input.market_total_discovered)
  const researched = Math.max(0, input.market_researched)
  const contacted = Math.max(0, input.market_contacted)
  const pipeline = Math.max(0, input.market_active_pipeline)
  const customers = Math.max(0, input.market_customers)

  const penetration =
    total > 0 ? Number((((customers + pipeline) / total) * 100).toFixed(1)) : 0
  const coverageScore = total > 0 ? Math.round(((researched + contacted) / (total * 2)) * 100) : 0
  const whitespaceScore = Math.max(
    0,
    Math.min(100, Math.round(total * 0.05 + Math.max(0, total - customers - pipeline) * 0.8)),
  )
  const penetrationScore = Math.max(0, Math.min(100, Math.round(penetration * 10)))

  return {
    market_key: input.market_key,
    market_label: input.market_label,
    territory_id: input.territory_id ?? null,
    industry: input.industry ?? null,
    market_total_discovered: total,
    market_researched: researched,
    market_contacted: contacted,
    market_active_pipeline: pipeline,
    market_customers: customers,
    market_penetration_percent: penetration,
    market_signal_density: Math.max(0, Math.min(100, input.market_signal_density ?? 0)),
    market_contact_coverage: Math.max(0, Math.min(100, input.market_contact_coverage ?? 0)),
    whitespace_score: whitespaceScore,
    coverage_score: Math.max(0, Math.min(100, coverageScore)),
    penetration_score: penetrationScore,
    territory_strength: Math.max(0, Math.min(100, input.territory_strength ?? 0)),
    last_computed_at: new Date().toISOString(),
  }
}

export function buildMarketKey(input: { territory_id?: string | null; industry?: string | null; label?: string | null }): string {
  if (input.territory_id) return `territory:${input.territory_id}`
  const parts = [input.label, input.industry].filter(Boolean).join("|")
  return parts ? `market:${parts.toLowerCase().replace(/\s+/g, "_")}` : "market:unknown"
}
