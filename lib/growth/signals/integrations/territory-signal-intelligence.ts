/** Territory-level Intent Signals metrics (Milestone E). Client-safe. */

import {
  buildCompanySignalRollup,
  deriveMomentumLabel,
  type GrowthCompanySignalRollup,
  type GrowthSignalWatchlistMatchRef,
} from "@/lib/growth/signals/company-signal-rollup"
import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"

export type TerritorySignalCompanyRef = {
  company_id: string
  company_name: string
  domain?: string | null
  state?: string | null
  city?: string | null
  geography?: string | null
}

export type TerritorySignalIntelligenceInput = {
  territory_states?: string[]
  territory_cities?: string[]
  companies: TerritorySignalCompanyRef[]
  signals: GrowthSignalRow[]
  watchlist_matches?: GrowthSignalWatchlistMatchRef[]
  now?: Date
}

export type TerritoryTopSignalCompany = {
  company_id: string
  company_name: string
  domain: string | null
  momentum_score: number
  momentum_label: GrowthCompanySignalRollup["momentum_label"]
  signal_count_30d: number
}

export type TerritorySignalIntelligenceSummary = {
  total_signals_30d: number
  high_urgency_signals: number
  companies_with_signals: number
  hiring_spikes: number
  news_events: number
  average_momentum_score: number
  momentum_label: GrowthCompanySignalRollup["momentum_label"]
  top_signal_companies: TerritoryTopSignalCompany[]
}

function normalizeGeo(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ""
}

function signalMatchesTerritoryGeography(
  signal: GrowthSignalRow,
  input: TerritorySignalIntelligenceInput,
): boolean {
  const states = (input.territory_states ?? []).map(normalizeGeo).filter(Boolean)
  const cities = (input.territory_cities ?? []).map(normalizeGeo).filter(Boolean)
  if (states.length === 0 && cities.length === 0) return false

  const signalGeo = normalizeGeo(signal.geography)
  if (!signalGeo) return false

  if (states.some((state) => signalGeo.includes(state))) return true
  if (cities.some((city) => signalGeo.includes(city))) return true
  return false
}

function companyMatchesTerritoryGeography(
  company: TerritorySignalCompanyRef,
  input: TerritorySignalIntelligenceInput,
): boolean {
  const states = (input.territory_states ?? []).map(normalizeGeo).filter(Boolean)
  const cities = (input.territory_cities ?? []).map(normalizeGeo).filter(Boolean)
  if (states.length === 0 && cities.length === 0) return false

  const geo = normalizeGeo(company.geography)
  const state = normalizeGeo(company.state)
  const city = normalizeGeo(company.city)
  if (!geo && !state && !city) return false

  if (state && states.some((entry) => state.includes(entry) || entry.includes(state))) return true
  if (city && cities.some((entry) => city.includes(entry) || entry.includes(city))) return true
  if (geo) {
    if (states.some((entry) => geo.includes(entry))) return true
    if (cities.some((entry) => geo.includes(entry))) return true
  }
  return false
}

function signalInLast30Days(signal: GrowthSignalRow, nowMs: number): boolean {
  const ms = Date.parse(signal.occurred_at)
  if (!Number.isFinite(ms)) return false
  return ms >= nowMs - 30 * 24 * 60 * 60 * 1000
}

export function buildTerritorySignalIntelligenceSummary(
  input: TerritorySignalIntelligenceInput,
): TerritorySignalIntelligenceSummary {
  const nowMs = (input.now ?? new Date()).getTime()
  const empty: TerritorySignalIntelligenceSummary = {
    total_signals_30d: 0,
    high_urgency_signals: 0,
    companies_with_signals: 0,
    hiring_spikes: 0,
    news_events: 0,
    average_momentum_score: 0,
    momentum_label: "Quiet",
    top_signal_companies: [],
  }

  const hasGeo = (input.territory_states?.length ?? 0) > 0 || (input.territory_cities?.length ?? 0) > 0
  if (!hasGeo) return empty

  const territorySignals = input.signals.filter(
    (signal) =>
      signal.suppression_state === "active" &&
      signalInLast30Days(signal, nowMs) &&
      signalMatchesTerritoryGeography(signal, input),
  )

  const rollups: TerritoryTopSignalCompany[] = []

  for (const company of input.companies) {
    if (!companyMatchesTerritoryGeography(company, input)) continue

    const rollup = buildCompanySignalRollup({
      domain: company.domain,
      company_id: company.company_id,
      company_name: company.company_name,
      signals: input.signals,
      watchlist_matches: input.watchlist_matches,
      now: input.now,
    })

    if (rollup.counts_30d <= 0) continue

    rollups.push({
      company_id: company.company_id,
      company_name: company.company_name,
      domain: company.domain ?? null,
      momentum_score: rollup.momentum_score,
      momentum_label: rollup.momentum_label,
      signal_count_30d: rollup.counts_30d,
    })
  }

  const hiringSpikes = territorySignals.filter((signal) => {
    if (signal.signal_type !== "hire") return false
    const velocity = signal.metadata?.hiring_velocity
    if (!velocity || typeof velocity !== "object") return false
    return (velocity as Record<string, unknown>).hiring_spike === true
  }).length

  const newsEvents = territorySignals.filter((signal) => signal.signal_type === "news_event").length
  const highUrgency = territorySignals.filter(
    (signal) => signal.urgency === "high" || signal.urgency === "urgent",
  ).length

  const avgMomentum =
    rollups.length > 0
      ? Math.round(rollups.reduce((sum, row) => sum + row.momentum_score, 0) / rollups.length)
      : 0

  return {
    total_signals_30d: territorySignals.length,
    high_urgency_signals: highUrgency,
    companies_with_signals: rollups.length,
    hiring_spikes: hiringSpikes,
    news_events: newsEvents,
    average_momentum_score: avgMomentum,
    momentum_label: deriveMomentumLabel(avgMomentum),
    top_signal_companies: rollups
      .sort((a, b) => b.momentum_score - a.momentum_score)
      .slice(0, 5),
  }
}
