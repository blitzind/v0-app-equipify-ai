import type { GrowthProspectSearchParsedQuery } from "@/lib/growth/prospect-search/prospect-search-types"

const US_STATES = new Set([
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "tennessee",
  "texas",
  "virginia",
  "washington",
  "oregon",
  "nevada",
  "ohio",
  "michigan",
  "illinois",
  "pennsylvania",
  "new york",
  "north carolina",
  "south carolina",
])

const INDUSTRY_HINTS = [
  "medical equipment",
  "biomedical",
  "hvac",
  "field service",
  "healthcare",
  "manufacturing",
  "industrial",
  "facilities",
  "equipment service",
  "service companies",
]

function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1)
}

export function parseProspectSearchQuery(raw: string): GrowthProspectSearchParsedQuery {
  const query = raw.trim().slice(0, 300)
  const lower = query.toLowerCase()

  const keywords: string[] = []
  const industry_hints: string[] = []
  const location_hints: string[] = []
  const title_hints: string[] = []

  let employee_min: number | null = null
  let employee_max: number | null = null

  const employeeMatch = lower.match(/(\d+)\s*-\s*(\d+)\s*employees?/)
  if (employeeMatch) {
    employee_min = Number(employeeMatch[1])
    employee_max = Number(employeeMatch[2])
  }

  for (const hint of INDUSTRY_HINTS) {
    if (lower.includes(hint)) industry_hints.push(hint)
  }

  for (const state of US_STATES) {
    if (lower.includes(state)) location_hints.push(state)
  }

  const tokens = tokenize(query)
  for (const token of tokens) {
    if (US_STATES.has(token)) continue
    if (["companies", "company", "employees", "employee", "service"].includes(token)) continue
    keywords.push(token)
  }

  if (lower.includes("director") || lower.includes("manager") || lower.includes("owner")) {
    title_hints.push("decision maker")
  }

  return {
    raw_query: query,
    keywords,
    industry_hints,
    location_hints,
    employee_min,
    employee_max,
    title_hints,
  }
}

export function mergeParsedQueryIntoFilters(
  parsed: GrowthProspectSearchParsedQuery,
  filters: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...filters }
  if (parsed.industry_hints[0] && !out.industry) {
    out.industry = parsed.industry_hints[0]
  }
  if (parsed.location_hints[0] && !out.location) {
    out.location = parsed.location_hints[0]
  }
  if (parsed.keywords.length && !out.keywords) {
    out.keywords = parsed.keywords
  }
  if (parsed.employee_min != null && parsed.employee_max != null && !out.employee_size_bands) {
    out.employee_size_bands = inferBandsFromRange(parsed.employee_min, parsed.employee_max)
  }
  return out
}

function inferBandsFromRange(min: number, max: number): string[] {
  const bands: string[] = []
  if (min <= 10 && max >= 1) bands.push("1-10")
  if (min <= 20 && max >= 11) bands.push("11-20")
  if (min <= 50 && max >= 21) bands.push("21-50")
  if (min <= 100 && max >= 51) bands.push("51-100")
  if (min <= 250 && max >= 101) bands.push("101-250")
  if (bands.length === 0) bands.push("51-100")
  return bands
}
