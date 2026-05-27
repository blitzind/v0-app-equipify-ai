import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import type { GrowthSignalWatchlistMatchRef } from "@/lib/growth/signals/company-signal-rollup"
import {
  attachProspectSearchSignalIntelligence,
  buildProspectSearchSignalIntelligenceOverlay,
  sortProspectSearchCompaniesBySignalMomentum,
} from "@/lib/growth/signals/integrations/prospect-search-signal-overlay"
import { loadGrowthSignals } from "@/lib/growth/signals/signal-repository"
import {
  GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
  type GrowthSignalMomentumLabel,
} from "@/lib/growth/signals/company-signal-rollup"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"
import { isGrowthSignalWatchlistSchemaReady } from "@/lib/growth/signals/signal-watchlist-schema-health"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export type GrowthProspectSearchSortBy = "rank" | "signal_momentum"

async function loadWatchlistMatchRefs(
  admin: SupabaseClient,
  signalIds: string[],
): Promise<GrowthSignalWatchlistMatchRef[]> {
  if (signalIds.length === 0) return []
  if (!(await isGrowthSignalWatchlistSchemaReady(admin))) return []

  const { data: matchRows, error } = await admin
    .schema("growth")
    .from("signal_watchlist_matches")
    .select("signal_id, watchlist_id")
    .in("signal_id", signalIds.slice(0, 500))

  if (error || !matchRows?.length) return []

  const watchlistIds = [
    ...new Set(
      matchRows
        .map((row) => (typeof row.watchlist_id === "string" ? row.watchlist_id : ""))
        .filter(Boolean),
    ),
  ]

  const nameById = new Map<string, string>()
  if (watchlistIds.length > 0) {
    const { data: watchlists } = await admin
      .schema("growth")
      .from("signal_watchlists")
      .select("id, name")
      .in("id", watchlistIds)
    for (const row of watchlists ?? []) {
      const id = typeof row.id === "string" ? row.id : ""
      const name = typeof row.name === "string" ? row.name.trim() : ""
      if (id && name) nameById.set(id, name)
    }
  }

  const refs: GrowthSignalWatchlistMatchRef[] = []
  for (const row of matchRows) {
    const record = row as Record<string, unknown>
    const signal_id = typeof record.signal_id === "string" ? record.signal_id : ""
    const watchlist_id = typeof record.watchlist_id === "string" ? record.watchlist_id : ""
    if (!signal_id || !watchlist_id) continue
    refs.push({
      signal_id,
      watchlist_id,
      watchlist_name: nameById.get(watchlist_id) ?? "Watchlist",
    })
  }
  return refs
}

export async function applyProspectSearchSignalIntelligenceOverlay(
  admin: SupabaseClient,
  companies: GrowthProspectSearchCompanyResult[],
  options?: { sort_by?: GrowthProspectSearchSortBy; now?: Date },
): Promise<GrowthProspectSearchCompanyResult[]> {
  if (companies.length === 0) return companies
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return companies.map((company) =>
      attachProspectSearchSignalIntelligence(company, null),
    )
  }

  const occurredFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const loaded = await loadGrowthSignals(admin, {
    occurred_from: occurredFrom,
    suppression_state: "active",
    limit: 500,
    offset: 0,
  })

  const watchlistMatches = await loadWatchlistMatchRefs(
    admin,
    loaded.items.map((signal) => signal.id),
  )

  const enriched = companies.map((company) => {
    const overlay = buildProspectSearchSignalIntelligenceOverlay({
      company,
      signals: loaded.items,
      watchlist_matches: watchlistMatches,
      now: options?.now,
    })
    return attachProspectSearchSignalIntelligence(company, overlay)
  })

  if (options?.sort_by === "signal_momentum") {
    return sortProspectSearchCompaniesBySignalMomentum(enriched)
  }

  return enriched
}

export function extractDomainFromProspectCompany(
  company: Pick<GrowthProspectSearchCompanyResult, "website">,
): string | null {
  if (!company.website?.trim()) return null
  try {
    const url = company.website.startsWith("http") ? company.website : `https://${company.website}`
    return normalizeDomain(new URL(url).hostname)
  } catch {
    return normalizeDomain(company.website)
  }
}

export { GROWTH_SIGNAL_MOMENTUM_QA_MARKER, type GrowthSignalMomentumLabel }
