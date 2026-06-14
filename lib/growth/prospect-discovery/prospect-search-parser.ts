/** Deterministic natural-language parser for prospect search intent (client-safe). */

import { parseProspectSearchQuery } from "@/lib/growth/prospect-search/prospect-search-query-parser"
import type { ProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"

const US_STATES: Record<string, string> = {
  alabama: "Alabama",
  alaska: "Alaska",
  arizona: "Arizona",
  arkansas: "Arkansas",
  california: "California",
  colorado: "Colorado",
  connecticut: "Connecticut",
  delaware: "Delaware",
  florida: "Florida",
  georgia: "Georgia",
  hawaii: "Hawaii",
  idaho: "Idaho",
  illinois: "Illinois",
  indiana: "Indiana",
  iowa: "Iowa",
  kansas: "Kansas",
  kentucky: "Kentucky",
  louisiana: "Louisiana",
  maine: "Maine",
  maryland: "Maryland",
  massachusetts: "Massachusetts",
  michigan: "Michigan",
  minnesota: "Minnesota",
  mississippi: "Mississippi",
  missouri: "Missouri",
  montana: "Montana",
  nebraska: "Nebraska",
  nevada: "Nevada",
  "new hampshire": "New Hampshire",
  "new jersey": "New Jersey",
  "new mexico": "New Mexico",
  "new york": "New York",
  "north carolina": "North Carolina",
  "north dakota": "North Dakota",
  ohio: "Ohio",
  oklahoma: "Oklahoma",
  oregon: "Oregon",
  pennsylvania: "Pennsylvania",
  "rhode island": "Rhode Island",
  "south carolina": "South Carolina",
  "south dakota": "South Dakota",
  tennessee: "Tennessee",
  texas: "Texas",
  utah: "Utah",
  vermont: "Vermont",
  virginia: "Virginia",
  washington: "Washington",
  "west virginia": "West Virginia",
  wisconsin: "Wisconsin",
  wyoming: "Wyoming",
}

const US_REGIONS: Record<string, string[]> = {
  southeast: ["Alabama", "Arkansas", "Florida", "Georgia", "Kentucky", "Louisiana", "Mississippi", "North Carolina", "South Carolina", "Tennessee", "Virginia", "West Virginia"],
  southwest: ["Arizona", "New Mexico", "Oklahoma", "Texas"],
  midwest: ["Illinois", "Indiana", "Iowa", "Kansas", "Michigan", "Minnesota", "Missouri", "Nebraska", "North Dakota", "Ohio", "South Dakota", "Wisconsin"],
  northeast: ["Connecticut", "Maine", "Massachusetts", "New Hampshire", "New Jersey", "New York", "Pennsylvania", "Rhode Island", "Vermont"],
  west: ["Alaska", "California", "Colorado", "Hawaii", "Idaho", "Montana", "Nevada", "Oregon", "Utah", "Washington", "Wyoming"],
}

const COUNTRIES: Record<string, string> = {
  usa: "United States",
  "united states": "United States",
  us: "United States",
  canada: "Canada",
  uk: "United Kingdom",
  "united kingdom": "United Kingdom",
}

const INDUSTRY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bbiomedical\b/i, label: "Biomedical" },
  { pattern: /\bhvac\b/i, label: "HVAC" },
  { pattern: /\bmanufacturing\b/i, label: "Manufacturing" },
  { pattern: /\bhealthcare\b/i, label: "Healthcare" },
  { pattern: /\bfield service\b/i, label: "Field Service" },
  { pattern: /\bmedical equipment\b/i, label: "Medical Equipment Service" },
  { pattern: /\bmedical device\b/i, label: "Medical Device Repair" },
  { pattern: /\bindustrial\b/i, label: "Industrial" },
  { pattern: /\bfacilities\b/i, label: "Facilities" },
]

const TECHNOLOGY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bsalesforce\b/i, label: "Salesforce" },
  { pattern: /\bhubspot\b/i, label: "HubSpot" },
  { pattern: /\bservicetitan\b/i, label: "ServiceTitan" },
  { pattern: /\bhousecall pro\b/i, label: "Housecall Pro" },
  { pattern: /\bquickbooks\b/i, label: "QuickBooks" },
  { pattern: /\bzoho\b/i, label: "Zoho CRM" },
  { pattern: /\bmicrosoft dynamics\b/i, label: "Microsoft Dynamics" },
  { pattern: /\bfieldpulse\b/i, label: "FieldPulse" },
]

const SIGNAL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bhiring(?:\s+surge|\s+signal|\s+signals|\s+activity|\s+spike)?\b/i, label: "hiring" },
  { pattern: /\brecent(?:ly)?\s+hiring\b/i, label: "hiring" },
  { pattern: /\braised funding\b/i, label: "funding" },
  { pattern: /\bfunding(?:\s+event|\s+round|\s+raise)?\b/i, label: "funding" },
  { pattern: /\bexpansion(?:\s+event|\s+signal|\s+signals)?\b/i, label: "expansion" },
  { pattern: /\btechnology change\b/i, label: "technology_change" },
  { pattern: /\btech(?:nology)?\s+change\b/i, label: "technology_change" },
  { pattern: /\bwebsite intent\b/i, label: "website_intent" },
  { pattern: /\bpricing page\b/i, label: "website_intent" },
  { pattern: /\bintent signal\b/i, label: "website_intent" },
]

const KEYWORD_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bhospitals?\b/i, label: "hospitals" },
  { pattern: /\bmedical devices?\b/i, label: "medical devices" },
  { pattern: /\bcommercial hvac\b/i, label: "commercial HVAC" },
  { pattern: /\bservicing hospitals\b/i, label: "servicing hospitals" },
  { pattern: /\btechnicians?\b/i, label: "technicians" },
  { pattern: /\bindependent\b/i, label: "independent" },
]

const TITLE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bceo\b/i, label: "CEO" },
  { pattern: /\bowner\b/i, label: "Owner" },
  { pattern: /\bdirector\b/i, label: "Director" },
  { pattern: /\bvp\b/i, label: "VP" },
  { pattern: /\bvice president\b/i, label: "Vice President" },
  { pattern: /\boperations manager\b/i, label: "Operations Manager" },
  { pattern: /\bservice manager\b/i, label: "Service Manager" },
  { pattern: /\bdecision makers?\b/i, label: "Decision Maker" },
]

const COMPANY_CHARACTERISTIC_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bindependent\b/i, label: "independent" },
  { pattern: /\bcommercial\b/i, label: "commercial" },
  { pattern: /\bservicing hospitals\b/i, label: "servicing hospitals" },
  { pattern: /\benterprise\b/i, label: "enterprise" },
  { pattern: /\bfamily owned\b/i, label: "family owned" },
  { pattern: /\blocally owned\b/i, label: "locally owned" },
]

const STOP_WORDS = new Set([
  "find",
  "search",
  "companies",
  "company",
  "with",
  "that",
  "and",
  "the",
  "for",
  "in",
  "using",
  "use",
  "recent",
  "recently",
  "have",
  "has",
  "their",
  "who",
  "are",
  "is",
  "a",
  "an",
])

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function extractMatches(text: string, patterns: Array<{ pattern: RegExp; label: string }>): string[] {
  const found: string[] = []
  for (const { pattern, label } of patterns) {
    if (pattern.test(text)) found.push(label)
  }
  return unique(found)
}

function extractLocations(text: string): string[] {
  const lower = text.toLowerCase()
  const locations: string[] = []

  for (const [region, states] of Object.entries(US_REGIONS)) {
    if (lower.includes(region)) locations.push(...states)
  }

  for (const [key, label] of Object.entries(US_STATES)) {
    if (lower.includes(key)) locations.push(label)
  }

  for (const [key, label] of Object.entries(COUNTRIES)) {
    if (lower.includes(key)) locations.push(label)
  }

  return unique(locations)
}

function extractEmployeeRanges(text: string): string[] {
  const lower = text.toLowerCase()
  const ranges: string[] = []

  const rangeMatch = lower.match(/(\d+)\s*-\s*(\d+)\s*employees?/)
  if (rangeMatch) ranges.push(`${rangeMatch[1]}-${rangeMatch[2]} employees`)

  const plusMatch = lower.match(/(\d+)\+\s*(?:employees?|technicians?|people|staff)?/)
  if (plusMatch) ranges.push(`${plusMatch[1]}+ employees`)

  if (/\benterprise\b/i.test(text)) ranges.push("enterprise (1000+ employees)")

  const techCount = lower.match(/(\d+)\+\s*technicians?/)
  if (techCount) ranges.push(`${techCount[1]}+ technicians`)

  return unique(ranges)
}

function extractRevenueRanges(text: string): string[] {
  const lower = text.toLowerCase()
  const ranges: string[] = []
  if (/\bunder \$1m\b/i.test(lower) || /\bunder 1m\b/i.test(lower)) ranges.push("under_1m")
  if (/\$1m[-–]\$5m\b/i.test(lower) || /\b1m to 5m\b/i.test(lower)) ranges.push("1m_5m")
  if (/\$5m[-–]\$10m\b/i.test(lower)) ranges.push("5m_10m")
  if (/\$10m[-–]\$50m\b/i.test(lower)) ranges.push("10m_50m")
  if (/\$50m\+|\b50m\+\b/i.test(lower)) ranges.push("50m_100m")
  if (/\b100m\+\b/i.test(lower)) ranges.push("100m+")
  return unique(ranges)
}

function extractExclusions(text: string): string[] {
  const exclusions: string[] = []
  const patterns = [
    /\b(?:exclude|excluding|without|not)\s+([a-z][\w\s-]{2,40})/gi,
    /\bno\s+([a-z][\w\s-]{2,30})/gi,
  ]
  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const phrase = match[1]?.trim()
      if (phrase && !["include", "only"].includes(phrase.split(/\s+/)[0]?.toLowerCase() ?? "")) {
        exclusions.push(phrase)
      }
    }
  }
  return unique(exclusions)
}

function extractResidualKeywords(text: string, consumed: string[]): string[] {
  const lower = text.toLowerCase()
  const consumedSet = new Set(consumed.flatMap((c) => c.toLowerCase().split(/\s+/)))
  return unique(
    lower
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token) && !consumedSet.has(token)),
  ).slice(0, 12)
}

function computeConfidence(intent: Omit<ProspectSearchIntent, "confidence" | "assumptions" | "ambiguities">): number {
  let score = 0.25
  if (intent.industries.length) score += 0.2
  if (intent.locations.length) score += 0.15
  if (intent.employee_ranges.length) score += 0.1
  if (intent.technologies.length) score += 0.1
  if (intent.signals.length) score += 0.1
  if (intent.titles.length) score += 0.05
  if (intent.keywords.length) score += 0.05
  return Math.min(0.98, Math.round(score * 100) / 100)
}

function buildAssumptions(intent: Omit<ProspectSearchIntent, "confidence" | "assumptions" | "ambiguities">): string[] {
  const assumptions: string[] = []
  if (intent.industries.length === 0) {
    assumptions.push("No explicit industry detected — plan will default to field service companies.")
  }
  if (intent.locations.length === 0) {
    assumptions.push("No geography specified — discovery may require a location filter before execution.")
  }
  if (intent.employee_ranges.length === 0 && !intent.company_characteristics.includes("enterprise")) {
    assumptions.push("No employee size constraint — results may include very small and very large companies.")
  }
  if (intent.signals.length > 0) {
    assumptions.push("Signal filters will require post-discovery enrichment; not applied at search time in GS-2A.")
  }
  assumptions.push("Human review required before any search execution (GS-2A planning only).")
  return assumptions
}

function buildAmbiguities(intent: Omit<ProspectSearchIntent, "confidence" | "assumptions" | "ambiguities">): string[] {
  const ambiguities: string[] = []
  if (intent.industries.length > 2) {
    ambiguities.push("Multiple industries detected — consider narrowing to one primary vertical.")
  }
  if (intent.locations.length > 5) {
    ambiguities.push("Broad regional query — consider specifying states or a radius.")
  }
  if (intent.technologies.length && intent.industries.length === 0) {
    ambiguities.push("Technology specified without industry — results may span unrelated verticals.")
  }
  if (intent.industries.length > 0 && intent.locations.length === 0 && intent.employee_ranges.length === 0) {
    ambiguities.push("Industry specified without geography or company size — results may be too broad.")
  }
  if (/\bcompanies\b/i.test(intent.raw_query) && intent.industries.length === 0 && intent.keywords.length === 0) {
    ambiguities.push("Generic company search — add industry, service type, or geography for better targeting.")
  }
  return ambiguities
}

/**
 * Parse operator natural-language query into structured ProspectSearchIntent.
 * Deterministic keyword/regex extraction — no LLM, no search execution.
 */
export function parseProspectSearchIntent(query: string): ProspectSearchIntent {
  const raw_query = query.trim().slice(0, 500)
  const base = parseProspectSearchQuery(raw_query)

  const industries = unique([
    ...extractMatches(raw_query, INDUSTRY_PATTERNS),
    ...base.industry_hints
      .filter((hint) => hint !== "service companies")
      .map((hint) =>
        hint.replace(/\b\w/g, (c) => c.toUpperCase()).replace("Hvac", "HVAC"),
      ),
  ])

  const locations = unique([...extractLocations(raw_query), ...base.location_hints.map((l) => US_STATES[l] ?? l)])
  const employee_ranges = extractEmployeeRanges(raw_query)
  if (base.employee_min != null && base.employee_max != null) {
    employee_ranges.push(`${base.employee_min}-${base.employee_max} employees`)
  }

  const revenue_ranges = extractRevenueRanges(raw_query)
  const technologies = extractMatches(raw_query, TECHNOLOGY_PATTERNS)
  const signals = extractMatches(raw_query, SIGNAL_PATTERNS)
  const keywords = unique([
    ...extractMatches(raw_query, KEYWORD_PATTERNS),
    ...base.keywords.filter((k) => !STOP_WORDS.has(k)),
  ])
  const titles = unique([...extractMatches(raw_query, TITLE_PATTERNS), ...base.title_hints])
  const exclusions = extractExclusions(raw_query)
  const company_characteristics = extractMatches(raw_query, COMPANY_CHARACTERISTIC_PATTERNS)

  const consumed = [
    ...industries,
    ...locations,
    ...technologies,
    ...signals,
    ...titles,
    ...employee_ranges,
    ...company_characteristics,
  ]
  const residualKeywords = extractResidualKeywords(raw_query, consumed)
  const allKeywords = unique([...keywords, ...residualKeywords])

  const partial = {
    raw_query,
    industries,
    locations,
    employee_ranges: unique(employee_ranges),
    revenue_ranges,
    titles,
    technologies,
    keywords: allKeywords,
    signals,
    exclusions,
    company_characteristics,
  }

  return {
    ...partial,
    confidence: computeConfidence(partial),
    assumptions: buildAssumptions(partial),
    ambiguities: buildAmbiguities(partial),
  }
}
