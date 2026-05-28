/** Lightweight massive market index — fast discovery at scale without deep enrichment. Client-safe. */

import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchIndexCompany,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_MASSIVE_MARKET_INDEX_QA_MARKER = "growth-massive-market-index-v1" as const

export type ProspectSearchLightweightMarketIndexRecord = {
  qa_marker: typeof GROWTH_MASSIVE_MARKET_INDEX_QA_MARKER
  company_id: string
  source_type: string
  company_name: string
  normalized_domain: string | null
  location: string | null
  industry: string | null
  employee_estimate: string | null
  revenue_estimate: string | null
  discovery_source: string
  contactability_indicator: "indexed_contacts" | "decision_makers" | "website_only" | "unknown"
  indexed_contact_count: number
  indexed_decision_maker_count: number
  freshness_at: string | null
  indexed_keywords: string[]
  territory_id: string | null
  company_identity_hash: string
}

function normalizeDomain(website: string | null | undefined): string | null {
  if (!website?.trim()) return null
  try {
    const url = website.includes("://") ? new URL(website) : new URL(`https://${website}`)
    return url.hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return website
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      ?.toLowerCase() ?? null
  }
}

function buildCompanyIdentityHash(input: {
  company_name: string
  normalized_domain: string | null
  location: string | null
}): string {
  const blob = [input.company_name, input.normalized_domain, input.location]
    .filter(Boolean)
    .join("|")
    .toLowerCase()
  let hash = 0
  for (let i = 0; i < blob.length; i += 1) {
    hash = (hash << 5) - hash + blob.charCodeAt(i)
    hash |= 0
  }
  return `mkt_${Math.abs(hash).toString(36)}`
}

export function buildProspectSearchLightweightMarketIndexRecord(
  row: GrowthProspectSearchIndexCompany,
): ProspectSearchLightweightMarketIndexRecord {
  const normalized_domain = normalizeDomain(row.website)
  const dmCount = row.decision_maker_count ?? 0
  const contactability_indicator =
    dmCount >= 2
      ? "indexed_contacts"
      : dmCount === 1
        ? "decision_makers"
        : row.website
          ? "website_only"
          : "unknown"

  return {
    qa_marker: GROWTH_MASSIVE_MARKET_INDEX_QA_MARKER,
    company_id: row.id,
    source_type: row.source_type,
    company_name: row.company_name,
    normalized_domain,
    location: row.location ?? ([row.city, row.state].filter(Boolean).join(", ") || null),
    industry: row.industry,
    employee_estimate: row.employees,
    revenue_estimate: row.revenue_range,
    discovery_source: row.source_type,
    contactability_indicator,
    indexed_contact_count: dmCount,
    indexed_decision_maker_count: dmCount,
    freshness_at: row.lead_engine_last_run_at ?? row.buying_stage_last_assessed_at ?? null,
    indexed_keywords: row.keywords ?? [],
    territory_id: null,
    company_identity_hash: buildCompanyIdentityHash({
      company_name: row.company_name,
      normalized_domain,
      location: row.location,
    }),
  }
}

export function buildProspectSearchLightweightMarketIndexRecords(
  rows: GrowthProspectSearchIndexCompany[],
): ProspectSearchLightweightMarketIndexRecord[] {
  return rows.map(buildProspectSearchLightweightMarketIndexRecord)
}

export function attachLightweightMarketIndexToCompany(
  company: GrowthProspectSearchCompanyResult,
  indexRecord?: ProspectSearchLightweightMarketIndexRecord | null,
): GrowthProspectSearchCompanyResult {
  if (!indexRecord) return company
  return {
    ...company,
    lightweight_market_index: indexRecord,
  }
}
