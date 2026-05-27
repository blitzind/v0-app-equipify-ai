/** Growth Engine — Google Places multi-query ICP expansion (v2). */

import type { GrowthRealWorldDiscoverySearchInputs } from "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"

export const GROWTH_GOOGLE_PLACES_QUERY_EXPANSION_QA_MARKER =
  "growth-google-places-query-expansion-v2" as const

export const GOOGLE_PLACES_QUERY_MIN = 3
export const GOOGLE_PLACES_QUERY_MAX = 8

export type GooglePlacesQueryExpansionResult = {
  queries: string[]
  primary_query: string
}

const INDUSTRY_QUERY_EXPANSIONS: Record<string, string[]> = {
  "medical equipment service": [
    "medical equipment repair",
    "biomedical equipment service",
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

/** ICP facets used for Google Places — excludes intent, technology, and title targeting. */
export function googlePlacesIcpInputs(
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

function expandIndustryPhrases(industry: string): string[] {
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
  if (industry) return expandIndustryPhrases(industry)
  if (keywords.length) return keywords.slice(0, 4).map(stripCompaniesSuffix).filter(Boolean)
  return ["field service", "equipment service", "commercial service"]
}

/**
 * Generate 3–8 Google Places queries from ICP facets with industry synonym expansion.
 * Location is appended to every query. Intent, technology, and title filters are ignored.
 */
export function buildGooglePlacesDiscoveryQueries(
  inputs: GrowthRealWorldDiscoverySearchInputs,
  options?: { min?: number; max?: number },
): GooglePlacesQueryExpansionResult {
  const icp = googlePlacesIcpInputs(inputs)
  const min = options?.min ?? GOOGLE_PLACES_QUERY_MIN
  const max = options?.max ?? GOOGLE_PLACES_QUERY_MAX
  const industry = cleanPart(icp.subindustry) || cleanPart(icp.industry)
  const location = cleanPart(icp.location)
  const raw = stripCompaniesSuffix(cleanPart(icp.raw_query))
  const keywords = (icp.keywords ?? []).map((k) => stripCompaniesSuffix(cleanPart(k))).filter(Boolean)

  const phrases: string[] = []

  if (raw.length >= 8) phrases.push(raw)
  if (industry) phrases.push(...expandIndustryPhrases(industry))
  if (keywords.length) {
    for (const keyword of keywords.slice(0, 3)) {
      phrases.push(keyword)
      if (industry && !keyword.toLowerCase().includes(industry.toLowerCase())) {
        phrases.push(`${keyword} ${industry}`)
      }
    }
  }
  if (!phrases.length) phrases.push(...fallbackPhrases(industry || null, keywords))

  let withLocation = uniqueQueries(phrases.map((p) => appendLocation(p, location)))

  if (withLocation.length < min) {
    const extras = fallbackPhrases(industry || null, keywords).map((p) => appendLocation(p, location))
    withLocation = uniqueQueries([...withLocation, ...extras])
  }

  let finalQueries = uniqueQueries(withLocation).slice(0, max)

  if (finalQueries.length < min) {
    const padPool = fallbackPhrases(industry || null, keywords).map((p) => appendLocation(p, location))
    finalQueries = uniqueQueries([...finalQueries, ...padPool]).slice(0, max)
  }

  if (finalQueries.length === 0) {
    finalQueries = [appendLocation(industry || "field service", location)]
  }

  return {
    queries: finalQueries.slice(0, max),
    primary_query: finalQueries[0]!,
  }
}

/** Back-compat single query helper — returns primary expanded query. */
export function buildGooglePlacesDiscoveryQuery(
  inputs: GrowthRealWorldDiscoverySearchInputs,
): string {
  return buildGooglePlacesDiscoveryQueries(inputs).primary_query
}

export function computeGooglePlacesIcpFitScore(
  candidate: {
    company_name: string
    category?: string | null
    description?: string | null
    industry?: string | null
    city?: string | null
    state?: string | null
    location?: string | null
    address?: string | null
  },
  inputs: GrowthRealWorldDiscoverySearchInputs,
  matchedQueries: string[],
): number {
  const icp = googlePlacesIcpInputs(inputs)
  const industryHint = cleanPart(icp.subindustry) || cleanPart(icp.industry)
  const locationHint = cleanPart(icp.location)
  const blob = [
    candidate.company_name,
    candidate.category,
    candidate.description,
    candidate.industry,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  const locBlob = [candidate.city, candidate.state, candidate.location, candidate.address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  let score = 0.3

  if (industryHint) {
    const tokens = industryHint
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
    const hits = tokens.filter((t) => blob.includes(t)).length
    score += (hits / Math.max(tokens.length, 1)) * 0.35
  }

  if (locationHint) {
    const locLower = locationHint.toLowerCase()
    if (locBlob.includes(locLower)) {
      score += 0.25
    } else {
      const locTokens = locLower.split(/\s+/).filter(Boolean)
      const locHits = locTokens.filter((t) => locBlob.includes(t)).length
      score += (locHits / Math.max(locTokens.length, 1)) * 0.2
    }
  }

  for (const kw of (icp.keywords ?? []).slice(0, 3)) {
    if (blob.includes(kw.toLowerCase())) score += 0.04
  }

  for (const q of matchedQueries.slice(0, 3)) {
    score += textOverlapScore(q, blob) * 0.05
  }

  score += Math.min(0.08, matchedQueries.length * 0.015)

  return Math.min(0.99, Number(score.toFixed(4)))
}

function textOverlapScore(a: string, b: string): number {
  const tokens = a
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)
  if (!tokens.length) return 0
  const hits = tokens.filter((t) => b.includes(t)).length
  return hits / tokens.length
}
