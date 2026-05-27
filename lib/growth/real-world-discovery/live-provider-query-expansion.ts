/** Growth Engine — shared live provider query expansion (Prospect Search external discovery). */

import type { GrowthRealWorldDiscoverySearchInputs } from "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"

export const GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER =
  "growth-live-provider-query-expansion-v1" as const

export const LIVE_PROVIDER_QUERY_MIN = 3
export const LIVE_PROVIDER_QUERY_MAX = 8
export const LIVE_PROVIDER_FALLBACK_QUERY_MAX = 6

const INDUSTRY_QUERY_EXPANSIONS: Record<string, readonly string[]> = {
  "medical equipment service": [
    "medical equipment service companies",
    "medical equipment repair",
    "biomedical equipment service",
    "biomedical equipment repair",
    "clinical engineering service",
    "healthcare equipment maintenance",
    "hospital equipment repair",
    "medical device repair company",
    "biomedical field service",
    "clinical equipment maintenance",
    "medical device repair",
    "healthcare equipment field service",
    "biomedical calibration",
    "medical equipment maintenance",
  ],
  "commercial hvac": [
    "commercial HVAC repair",
    "commercial HVAC service",
    "commercial HVAC maintenance",
    "industrial HVAC service",
    "commercial air conditioning repair",
  ],
  "commercial hvac repair": [
    "commercial HVAC repair",
    "commercial HVAC service",
    "commercial HVAC maintenance",
    "HVAC contractor commercial",
  ],
  "biomedical calibration": [
    "biomedical calibration",
    "medical equipment calibration",
    "clinical equipment calibration",
    "biomedical equipment service",
  ],
  "field service": [
    "field service company",
    "multi-trade field service",
    "commercial field service",
    "equipment field service",
  ],
}

export const MEDICAL_EQUIPMENT_SERVICE_QUERY_EXPANSIONS =
  INDUSTRY_QUERY_EXPANSIONS["medical equipment service"] ?? []

function cleanPart(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function uniqueQueries(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const q = value.trim()
    if (!q) continue
    const key = q.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(q)
  }
  return out
}

function appendLocation(phrase: string, location: string): string {
  const subject = phrase.trim()
  const loc = location.trim()
  if (!loc) return subject
  if (subject.toLowerCase().includes(loc.toLowerCase())) return subject
  return `${subject} ${loc}`.trim()
}

function stripCompaniesSuffix(value: string): string {
  return value.replace(/\bcompanies?\b/gi, " ").replace(/\s+/g, " ").trim()
}

/** ICP facets used for live provider queries — excludes intent, technology, and title targeting. */
export function liveProviderIcpInputs(
  inputs: GrowthRealWorldDiscoverySearchInputs,
): GrowthRealWorldDiscoverySearchInputs {
  return {
    industry: inputs.industry ?? null,
    subindustry: inputs.subindustry ?? null,
    location: inputs.location ?? null,
    employee_size_estimate: inputs.employee_size_estimate ?? null,
    keywords: inputs.keywords ?? [],
    raw_query: inputs.raw_query ?? null,
  }
}

export function expandIndustrySearchPhrases(industry: string): string[] {
  const key = normalizeKey(industry)
  const mapped = INDUSTRY_QUERY_EXPANSIONS[key]
  if (mapped?.length) return [...mapped]

  const base = stripCompaniesSuffix(industry)
  const phrases = [base]
  const lower = base.toLowerCase()

  if (/\bservice\b/.test(lower)) {
    phrases.push(base.replace(/\bservice\b/i, "repair"))
    phrases.push(base.replace(/\bservice\b/i, "maintenance"))
    phrases.push(`${base.replace(/\bservice\b/i, "").trim()} field service`.trim())
  } else if (/\brepair\b/.test(lower)) {
    phrases.push(base.replace(/\brepair\b/i, "service"))
    phrases.push(base.replace(/\brepair\b/i, "maintenance"))
  } else {
    phrases.push(`${base} service`, `${base} repair`, `${base} maintenance`)
  }

  if (/\bmedical\b/.test(lower) && !/\bbiomedical\b/.test(lower)) {
    phrases.push(base.replace(/\bmedical\b/i, "biomedical"))
    phrases.push(base.replace(/\bmedical\b/i, "healthcare"))
    phrases.push(base.replace(/\bmedical\b/i, "clinical"))
  }

  return uniqueQueries(phrases.filter(Boolean))
}

function fallbackPhrases(industry: string | null, keywords: string[]): string[] {
  if (industry) return expandIndustrySearchPhrases(industry)
  if (keywords.length) return keywords.slice(0, 4).map(stripCompaniesSuffix).filter(Boolean)
  return ["field service", "equipment service", "commercial service"]
}

function buildPhrasePool(icp: GrowthRealWorldDiscoverySearchInputs): string[] {
  const industry = cleanPart(icp.subindustry) || cleanPart(icp.industry)
  const raw = stripCompaniesSuffix(cleanPart(icp.raw_query))
  const keywords = (icp.keywords ?? []).map((k) => stripCompaniesSuffix(cleanPart(k))).filter(Boolean)

  const phrases: string[] = []
  if (raw.length >= 8) phrases.push(raw)
  if (industry) phrases.push(...expandIndustrySearchPhrases(industry))
  if (keywords.length) {
    for (const keyword of keywords.slice(0, 3)) {
      phrases.push(keyword)
      if (industry && !keyword.toLowerCase().includes(industry.toLowerCase())) {
        phrases.push(`${keyword} ${industry}`)
      }
    }
  }
  if (!phrases.length) phrases.push(...fallbackPhrases(industry || null, keywords))
  return uniqueQueries(phrases)
}

export type LiveProviderDiscoveryQueryPlan = {
  queries: string[]
  primary_query: string
  fallback_queries: string[]
}

export function buildLiveProviderDiscoveryQueries(
  inputs: GrowthRealWorldDiscoverySearchInputs,
  options?: { min?: number; max?: number },
): LiveProviderDiscoveryQueryPlan {
  const icp = liveProviderIcpInputs(inputs)
  const min = options?.min ?? LIVE_PROVIDER_QUERY_MIN
  const max = options?.max ?? LIVE_PROVIDER_QUERY_MAX
  const location = cleanPart(icp.location)

  const phrases = buildPhrasePool(icp)
  let withLocation = uniqueQueries(phrases.map((p) => appendLocation(stripCompaniesSuffix(p), location)))

  if (withLocation.length < min) {
    const extras = fallbackPhrases(cleanPart(icp.subindustry) || cleanPart(icp.industry) || null, icp.keywords ?? []).map(
      (p) => appendLocation(p, location),
    )
    withLocation = uniqueQueries([...withLocation, ...extras])
  }

  let queries = uniqueQueries(withLocation.map(stripCompaniesSuffix)).slice(0, max)
  if (queries.length < min) {
    const padPool = fallbackPhrases(cleanPart(icp.subindustry) || cleanPart(icp.industry) || null, icp.keywords ?? []).map(
      (p) => appendLocation(stripCompaniesSuffix(p), location),
    )
    queries = uniqueQueries([...queries, ...padPool.map(stripCompaniesSuffix)]).slice(0, max)
  }
  if (queries.length === 0) {
    queries = [appendLocation(stripCompaniesSuffix(cleanPart(icp.industry) || "field service"), location)]
  }

  const fallback_queries = buildLiveProviderFallbackQueries(icp, queries).map(stripCompaniesSuffix)

  return {
    queries,
    primary_query: queries[0]!,
    fallback_queries,
  }
}

/** Broader retry queries when the primary batch returns zero provider matches. */
export function buildLiveProviderFallbackQueries(
  inputs: GrowthRealWorldDiscoverySearchInputs,
  primaryQueries: string[] = [],
): string[] {
  const icp = liveProviderIcpInputs(inputs)
  const location = cleanPart(icp.location)
  const industry = cleanPart(icp.subindustry) || cleanPart(icp.industry)
  const raw = stripCompaniesSuffix(cleanPart(icp.raw_query))

  const phrases: string[] = []
  if (industry) phrases.push(...expandIndustrySearchPhrases(industry))
  if (raw) phrases.push(raw)
  phrases.push(
    "biomedical equipment repair",
    "medical equipment repair",
    "clinical engineering service",
    "healthcare equipment maintenance",
    "hospital equipment repair",
    "medical device repair",
    "biomedical field service",
    "equipment repair service",
    "field service company",
  )

  const primaryKeys = new Set(primaryQueries.map((q) => q.toLowerCase()))
  const withLocation = uniqueQueries(phrases.map((p) => appendLocation(stripCompaniesSuffix(p), location)))
  const fallback = withLocation.filter((q) => !primaryKeys.has(q.toLowerCase()))
  return fallback.slice(0, LIVE_PROVIDER_FALLBACK_QUERY_MAX)
}

export function planLiveProviderQueryBatches(
  inputs: GrowthRealWorldDiscoverySearchInputs,
): { primary: string[]; fallback: string[] } {
  const plan = buildLiveProviderDiscoveryQueries(inputs)
  return {
    primary: plan.queries,
    fallback: plan.fallback_queries,
  }
}
