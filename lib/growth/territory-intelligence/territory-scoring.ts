/** Deterministic territory scoring + clustering. Client-safe. */

import type {
  GrowthTerritoryCluster,
  GrowthTerritoryHeatmapPoint,
  GrowthTerritoryScoreBucket,
  GrowthTerritoryScoreRow,
  GrowthTerritoryTopCompany,
  GrowthTerritoryWhitespaceZone,
} from "@/lib/growth/territory-intelligence/territory-intelligence-types"

export type TerritoryScoringCompanyInput = {
  company_id: string
  source_type: string
  company_name: string
  lat?: number | null
  lng?: number | null
  state?: string | null
  city?: string | null
  lead_engine_score?: number | null
  growth_signal_score?: number | null
  contact_coverage_score?: number | null
  is_existing_customer?: boolean
  is_existing_prospect?: boolean
  is_suppressed?: boolean
}

const HIGH_FIT_LEAD_SCORE = 65
const HIGH_FIT_GROWTH_SCORE = 60

export function companyTerritoryScoreBucket(input: TerritoryScoringCompanyInput): GrowthTerritoryScoreBucket {
  const hasCoords =
    typeof input.lat === "number" &&
    Number.isFinite(input.lat) &&
    typeof input.lng === "number" &&
    Number.isFinite(input.lng)

  if (!hasCoords) return "unmapped"

  const composite =
    (input.lead_engine_score ?? 0) * 0.4 +
    (input.growth_signal_score ?? 0) * 0.35 +
    (input.contact_coverage_score ?? 0) * 0.25

  if (composite >= 80) return "urgent"
  if (composite >= 60) return "high"
  if (composite >= 35) return "moderate"
  return "low"
}

export function isHighFitProspect(input: TerritoryScoringCompanyInput): boolean {
  return (
    (input.lead_engine_score ?? 0) >= HIGH_FIT_LEAD_SCORE ||
    (input.growth_signal_score ?? 0) >= HIGH_FIT_GROWTH_SCORE
  )
}

function emptyBuckets(): Record<GrowthTerritoryScoreBucket, number> {
  return { urgent: 0, high: 0, moderate: 0, low: 0, unmapped: 0 }
}

export function buildTerritoryClusters(companies: TerritoryScoringCompanyInput[]): GrowthTerritoryCluster[] {
  const groups = new Map<string, TerritoryScoringCompanyInput[]>()

  for (const company of companies) {
    const hasCoords =
      typeof company.lat === "number" &&
      Number.isFinite(company.lat) &&
      typeof company.lng === "number" &&
      Number.isFinite(company.lng)

    const key = hasCoords
      ? `${company.lat!.toFixed(1)}:${company.lng!.toFixed(1)}`
      : `geo:${(company.state ?? "unknown").toUpperCase()}:${(company.city ?? "unknown").toLowerCase()}`

    const bucket = groups.get(key) ?? []
    bucket.push(company)
    groups.set(key, bucket)
  }

  return [...groups.entries()]
    .map(([id, rows]) => {
      const mapped = rows.filter(
        (row) =>
          typeof row.lat === "number" &&
          Number.isFinite(row.lat) &&
          typeof row.lng === "number" &&
          Number.isFinite(row.lng),
      )
      const highFit = rows.filter(isHighFitProspect)
      const avg =
        rows.length > 0
          ? Math.round(
              rows.reduce(
                (sum, row) =>
                  sum +
                  (row.lead_engine_score ?? 0) * 0.4 +
                  (row.growth_signal_score ?? 0) * 0.35 +
                  (row.contact_coverage_score ?? 0) * 0.25,
                0,
              ) / rows.length,
            )
          : 0

      const firstMapped = mapped[0]
      const label = firstMapped?.city
        ? `${firstMapped.city}${firstMapped.state ? `, ${firstMapped.state}` : ""}`
        : firstMapped?.state
          ? firstMapped.state
          : rows[0]?.company_name ?? "Cluster"

      return {
        id,
        label,
        lat: firstMapped?.lat ?? null,
        lng: firstMapped?.lng ?? null,
        company_count: rows.length,
        high_fit_count: highFit.length,
        avg_opportunity_score: avg,
      }
    })
    .sort((a, b) => b.high_fit_count - a.high_fit_count || b.company_count - a.company_count)
    .slice(0, 24)
}

export function buildTerritoryWhitespaceZones(
  companies: TerritoryScoringCompanyInput[],
): GrowthTerritoryWhitespaceZone[] {
  const groups = new Map<string, TerritoryScoringCompanyInput[]>()

  for (const company of companies) {
    const label = [company.city, company.state].filter(Boolean).join(", ") || company.state || "Unknown area"
    const key = label.toLowerCase()
    const bucket = groups.get(key) ?? []
    bucket.push(company)
    groups.set(key, bucket)
  }

  return [...groups.entries()]
    .map(([id, rows]) => {
      const highFit = rows.filter(isHighFitProspect)
      const existing = rows.filter((row) => row.is_existing_customer || row.is_existing_prospect).length
      const whitespace = Math.max(0, Math.min(100, highFit.length * 12 - existing * 8))
      return {
        id,
        label: rows[0]?.city
          ? [rows[0].city, rows[0].state].filter(Boolean).join(", ")
          : rows[0]?.state ?? "Unknown area",
        high_fit_count: highFit.length,
        existing_account_count: existing,
        whitespace_score: whitespace,
      }
    })
    .filter((zone) => zone.high_fit_count > 0)
    .sort((a, b) => b.whitespace_score - a.whitespace_score)
    .slice(0, 12)
}

export function buildTerritoryHeatmapPoints(
  companies: TerritoryScoringCompanyInput[],
): GrowthTerritoryHeatmapPoint[] {
  return companies
    .filter(
      (company) =>
        typeof company.lat === "number" &&
        Number.isFinite(company.lat) &&
        typeof company.lng === "number" &&
        Number.isFinite(company.lng),
    )
    .map((company) => {
      const bucket = companyTerritoryScoreBucket(company)
      const weight =
        bucket === "urgent"
          ? 1
          : bucket === "high"
            ? 0.75
            : bucket === "moderate"
              ? 0.5
              : 0.25
      return {
        lat: company.lat!,
        lng: company.lng!,
        weight,
        score_bucket: bucket,
        company_id: company.company_id,
        company_name: company.company_name,
      }
    })
}

export function buildTerritoryTopCompanies(
  companies: TerritoryScoringCompanyInput[],
): GrowthTerritoryTopCompany[] {
  return [...companies]
    .sort((a, b) => {
      const scoreA = (a.growth_signal_score ?? 0) * 0.5 + (a.lead_engine_score ?? 0) * 0.5
      const scoreB = (b.growth_signal_score ?? 0) * 0.5 + (b.lead_engine_score ?? 0) * 0.5
      return scoreB - scoreA
    })
    .slice(0, 8)
    .map((company) => ({
      company_id: company.company_id,
      company_name: company.company_name,
      source_type: company.source_type,
      growth_signal_score: company.growth_signal_score ?? null,
      lead_engine_score: company.lead_engine_score ?? null,
      contact_coverage_score: company.contact_coverage_score ?? null,
      score_bucket: companyTerritoryScoreBucket(company),
      is_mapped:
        typeof company.lat === "number" &&
        Number.isFinite(company.lat) &&
        typeof company.lng === "number" &&
        Number.isFinite(company.lng),
    }))
}

export function computeTerritoryScoreMetrics(
  companies: TerritoryScoringCompanyInput[],
): Omit<GrowthTerritoryScoreRow, "territory_id" | "last_computed_at"> {
  const buckets = emptyBuckets()
  let contactTotal = 0
  let contactCount = 0
  let growthTotal = 0
  let growthCount = 0
  let mapped = 0

  for (const company of companies) {
    const bucket = companyTerritoryScoreBucket(company)
    buckets[bucket] += 1
    if (bucket !== "unmapped") mapped += 1

    if (company.contact_coverage_score != null) {
      contactTotal += company.contact_coverage_score
      contactCount += 1
    }
    if (company.growth_signal_score != null) {
      growthTotal += company.growth_signal_score
      growthCount += 1
    }
  }

  const highFit = companies.filter(isHighFitProspect).length
  const existingCustomers = companies.filter((c) => c.is_existing_customer).length
  const existingProspects = companies.filter((c) => c.is_existing_prospect).length
  const suppressed = companies.filter((c) => c.is_suppressed).length
  const contactCoverageAvg = contactCount > 0 ? Math.round(contactTotal / contactCount) : 0
  const growthSignalAvg = growthCount > 0 ? Math.round(growthTotal / growthCount) : 0
  const growthSignalDensity =
    companies.length > 0 ? Math.round((growthCount / companies.length) * 100) : 0

  const densityScore = Math.min(25, Math.round(companies.length * 1.5))
  const fitScore = Math.min(25, highFit * 3)
  const contactScore = Math.round(contactCoverageAvg * 0.15)
  const signalScore = Math.min(20, Math.round(growthSignalAvg * 0.2))
  const whitespaceRaw = Math.max(0, highFit - existingCustomers - existingProspects)
  const whitespaceScore = Math.min(100, whitespaceRaw * 8 + Math.max(0, 20 - suppressed))
  const overlapPenalty = Math.min(20, (existingCustomers + existingProspects) * 2 + suppressed)
  const territoryOpportunityScore = Math.max(
    0,
    Math.min(100, densityScore + fitScore + contactScore + signalScore + Math.round(whitespaceScore * 0.15) - overlapPenalty),
  )

  const clusters = buildTerritoryClusters(companies)
  const whitespaceZones = buildTerritoryWhitespaceZones(companies)

  return {
    company_count: companies.length,
    mapped_company_count: mapped,
    unmapped_company_count: companies.length - mapped,
    high_fit_count: highFit,
    contact_coverage_avg: contactCoverageAvg,
    growth_signal_avg: growthSignalAvg,
    growth_signal_density: growthSignalDensity,
    existing_customer_count: existingCustomers,
    existing_prospect_count: existingProspects,
    suppressed_count: suppressed,
    whitespace_score: whitespaceScore,
    territory_opportunity_score: territoryOpportunityScore,
    score_buckets: buckets,
    clusters,
    whitespace_zones: whitespaceZones,
    top_signal_companies: buildTerritoryTopCompanies(companies),
  }
}
