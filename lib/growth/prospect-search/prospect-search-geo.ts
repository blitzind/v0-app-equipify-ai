/** Deterministic territory / geo helpers for Prospect Search (Sprint 4B). Client-safe. */

import type {
  GrowthProspectSearchTerritoryFilter,
  GrowthProspectSearchTerritoryRadiusFilter,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_SEARCH_GEO_QA_MARKER = "growth-prospect-search-geo-v1" as const

const US_STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
}

const US_STATE_ABBRS = new Set(Object.values(US_STATE_NAME_TO_ABBR))

export type ProspectSearchGeoMatchableRow = {
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  location?: string | null
  service_area?: string | null
  metro?: string | null
  lat?: number | null
  lng?: number | null
}

export type ProspectSearchTerritoryMatchResult = {
  matches: boolean
  reasons: string[]
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function cleanToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export function normalizeState(value: string | null | undefined): string | null {
  const raw = asString(value)
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (US_STATE_NAME_TO_ABBR[lower]) return US_STATE_NAME_TO_ABBR[lower]
  const upper = raw.toUpperCase()
  if (US_STATE_ABBRS.has(upper)) return upper
  return upper.length <= 3 ? upper : raw
}

export function normalizeCity(value: string | null | undefined): string | null {
  const raw = asString(value)
  if (!raw) return null
  return cleanToken(raw.replace(/\s+metro$/i, ""))
}

export function normalizeMetro(value: string | null | undefined): string | null {
  const raw = asString(value)
  if (!raw) return null
  return cleanToken(raw.replace(/\s+metro$/i, ""))
}

export function normalizePostalCode(value: string | null | undefined): string | null {
  const raw = asString(value)
  if (!raw) return null
  const match = raw.match(/\b(\d{5})(?:-\d{4})?\b/)
  return match ? match[1]! : null
}

export function normalizeCountry(value: string | null | undefined): string | null {
  const raw = asString(value)
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower === "us" || lower === "usa" || lower === "united states") return "US"
  return raw.toUpperCase()
}

export function buildNormalizedGeoKey(input: {
  city?: string | null
  state?: string | null
  postal_code?: string | null
}): string | null {
  const state = normalizeState(input.state)
  const city = normalizeCity(input.city)
  const postal = normalizePostalCode(input.postal_code)
  if (!state && !city && !postal) return null
  return [state ?? "", city ?? "", postal ?? ""].join("|").toLowerCase()
}

export function inferMetroFromText(value: string | null | undefined): string | null {
  const raw = asString(value)
  if (!raw) return null
  const metroMatch = raw.match(/^(.+?)\s+metro$/i)
  if (metroMatch) return normalizeMetro(metroMatch[1])
  return null
}

const COUNTRY_ONLY_TERRITORY_INPUTS: Record<string, string> = {
  us: "US",
  usa: "US",
  "u.s.": "US",
  "u.s": "US",
  "united states": "US",
  canada: "CA",
  mexico: "MX",
  mx: "MX",
  uk: "GB",
  gb: "GB",
  "united kingdom": "GB",
}

export function parseTerritoryInput(raw: string): Partial<GrowthProspectSearchTerritoryFilter> {
  const text = asString(raw)
  if (!text) return {}

  const state = normalizeState(text)
  if (state && (US_STATE_ABBRS.has(state) || US_STATE_NAME_TO_ABBR[text.toLowerCase()])) {
    return { states: [state] }
  }

  const countryOnly = COUNTRY_ONLY_TERRITORY_INPUTS[text.toLowerCase()]
  if (countryOnly) {
    return { country: countryOnly }
  }

  const postal = normalizePostalCode(text)
  if (postal && text.replace(/\D/g, "").length >= 5 && !text.includes(",")) {
    return { postal_codes: [postal] }
  }

  const metro = inferMetroFromText(text)
  if (metro) return { metros: [metro] }

  if (text.includes(",")) {
    const [cityPart, statePart] = text.split(",").map((part) => part.trim())
    const parsedState = normalizeState(statePart)
    const city = normalizeCity(cityPart)
    const patch: Partial<GrowthProspectSearchTerritoryFilter> = {}
    if (parsedState) patch.states = [parsedState]
    if (city) patch.cities = [city]
    return patch
  }

  const city = normalizeCity(text)
  if (city) return { cities: [city] }

  return {}
}

export function normalizeTerritoryRadiusFilter(
  raw: GrowthProspectSearchTerritoryRadiusFilter | null | undefined,
): GrowthProspectSearchTerritoryRadiusFilter | undefined {
  if (!raw) return undefined
  const center_lat = typeof raw.center_lat === "number" ? raw.center_lat : null
  const center_lng = typeof raw.center_lng === "number" ? raw.center_lng : null
  const miles = typeof raw.miles === "number" ? raw.miles : null
  if (center_lat == null || center_lng == null || miles == null || miles <= 0) return undefined
  return {
    center_lat,
    center_lng,
    miles: Math.min(500, Math.max(1, miles)),
    label: asString(raw.label) || undefined,
  }
}

export function normalizeTerritoryFilter(
  raw: GrowthProspectSearchTerritoryFilter | null | undefined,
): GrowthProspectSearchTerritoryFilter | undefined {
  if (!raw) return undefined

  const states = Array.isArray(raw.states)
    ? [...new Set(raw.states.map((value) => normalizeState(value)).filter(Boolean) as string[])]
    : []
  const cities = Array.isArray(raw.cities)
    ? [...new Set(raw.cities.map((value) => normalizeCity(value)).filter(Boolean) as string[])]
    : []
  const metros = Array.isArray(raw.metros)
    ? [...new Set(raw.metros.map((value) => normalizeMetro(value)).filter(Boolean) as string[])]
    : []
  const postal_codes = Array.isArray(raw.postal_codes)
    ? [...new Set(raw.postal_codes.map((value) => normalizePostalCode(value)).filter(Boolean) as string[])]
    : []
  const country = normalizeCountry(raw.country) ?? undefined
  const radius = normalizeTerritoryRadiusFilter(raw.radius)

  if (
    !country &&
    states.length === 0 &&
    cities.length === 0 &&
    metros.length === 0 &&
    postal_codes.length === 0 &&
    !radius
  ) {
    return undefined
  }

  return {
    country,
    states: states.length ? states : undefined,
    cities: cities.length ? cities : undefined,
    metros: metros.length ? metros : undefined,
    postal_codes: postal_codes.length ? postal_codes : undefined,
    radius,
  }
}

export function mergeLocationTextIntoTerritoryFilter(
  filters: { location?: string | null; territory_filter?: GrowthProspectSearchTerritoryFilter },
): GrowthProspectSearchTerritoryFilter | undefined {
  const base = normalizeTerritoryFilter(filters.territory_filter)
  const parsed = parseTerritoryInput(filters.location ?? "")
  if (!parsed || Object.keys(parsed).length === 0) return base

  return normalizeTerritoryFilter({
    ...parsed,
    ...base,
    states: [...new Set([...(parsed.states ?? []), ...(base?.states ?? [])])],
    cities: [...new Set([...(parsed.cities ?? []), ...(base?.cities ?? [])])],
    metros: [...new Set([...(parsed.metros ?? []), ...(base?.metros ?? [])])],
    postal_codes: [...new Set([...(parsed.postal_codes ?? []), ...(base?.postal_codes ?? [])])],
    country: base?.country ?? parsed.country,
    radius: base?.radius ?? parsed.radius,
  })
}

export function hasActiveTerritoryFilter(
  filter: GrowthProspectSearchTerritoryFilter | null | undefined,
): boolean {
  return Boolean(normalizeTerritoryFilter(filter))
}

export function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function includesFold(hay: string | null | undefined, needle: string): boolean {
  if (!hay || !needle) return false
  return hay.toLowerCase().includes(needle.toLowerCase())
}

function rowStateTokens(row: ProspectSearchGeoMatchableRow): string[] {
  const tokens = new Set<string>()
  const state = normalizeState(row.state)
  if (state) tokens.add(state)
  const location = asString(row.location)
  if (location.includes(",")) {
    const maybeState = normalizeState(location.split(",").pop())
    if (maybeState) tokens.add(maybeState)
  }
  return [...tokens]
}

function rowCityTokens(row: ProspectSearchGeoMatchableRow): string[] {
  const tokens = new Set<string>()
  const city = normalizeCity(row.city)
  if (city) tokens.add(city)
  const locationCity = normalizeCity(asString(row.location).split(",")[0])
  if (locationCity) tokens.add(locationCity)
  return [...tokens]
}

function rowMetroTokens(row: ProspectSearchGeoMatchableRow): string[] {
  const tokens = new Set<string>()
  const metro = normalizeMetro(row.metro)
  if (metro) tokens.add(metro)
  const serviceMetro = inferMetroFromText(row.service_area)
  if (serviceMetro) tokens.add(serviceMetro)
  for (const city of rowCityTokens(row)) tokens.add(city)
  return [...tokens]
}

export function evaluateTerritoryMatch(
  row: ProspectSearchGeoMatchableRow,
  filter: GrowthProspectSearchTerritoryFilter,
): ProspectSearchTerritoryMatchResult {
  const reasons: string[] = []
  const normalized = normalizeTerritoryFilter(filter)
  if (!normalized) return { matches: true, reasons: [] }

  if (normalized.country) {
    const country = normalizeCountry(row.country) ?? "US"
    if (country !== normalized.country) return { matches: false, reasons: [] }
    reasons.push(`Matches selected country (${normalized.country}).`)
  }

  if (normalized.states?.length) {
    const rowStates = rowStateTokens(row)
    const hit = normalized.states.find((state) => rowStates.includes(state))
    if (!hit) return { matches: false, reasons: [] }
    reasons.push(`Matches selected state (${hit}).`)
  }

  if (normalized.cities?.length) {
    const rowCities = rowCityTokens(row)
    const hit = normalized.cities.find((city) => rowCities.includes(city))
    if (!hit) return { matches: false, reasons: [] }
    reasons.push(`Matches selected city (${hit}).`)
  }

  if (normalized.metros?.length) {
    const rowMetros = rowMetroTokens(row)
    const hit = normalized.metros.find(
      (metro) => rowMetros.includes(metro) || rowMetros.some((token) => token.includes(metro)),
    )
    if (!hit) return { matches: false, reasons: [] }
    reasons.push(`Matches selected metro (${hit}).`)
  }

  if (normalized.postal_codes?.length) {
    const postal = normalizePostalCode(row.postal_code)
    if (!postal || !normalized.postal_codes.includes(postal)) return { matches: false, reasons: [] }
    reasons.push(`Matches selected ZIP (${postal}).`)
  }

  if (normalized.radius) {
    if (row.lat == null || row.lng == null) return { matches: false, reasons: [] }
    const distance = haversineDistanceMiles(
      normalized.radius.center_lat,
      normalized.radius.center_lng,
      row.lat,
      row.lng,
    )
    if (distance > normalized.radius.miles) return { matches: false, reasons: [] }
    const label = normalized.radius.label ? ` of ${normalized.radius.label}` : ""
    reasons.push(`Within ${normalized.radius.miles} miles${label} (${Math.round(distance)} mi).`)
  }

  if (
    normalized.cities?.length &&
    row.service_area &&
    normalized.cities.some((city) => includesFold(row.service_area, city))
  ) {
    reasons.push("Service area includes selected location.")
  }

  return { matches: true, reasons }
}

export function rowMatchesTerritoryFilter(
  row: ProspectSearchGeoMatchableRow,
  filter: GrowthProspectSearchTerritoryFilter | null | undefined,
): boolean {
  const normalized = normalizeTerritoryFilter(filter)
  if (!normalized) return true
  return evaluateTerritoryMatch(row, normalized).matches
}

export function extractCoordinatesFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): { lat: number | null; lng: number | null } {
  const meta = metadata ?? {}
  const directLat = meta.lat ?? meta.latitude
  const directLng = meta.lng ?? meta.longitude
  if (typeof directLat === "number" && typeof directLng === "number") {
    return { lat: directLat, lng: directLng }
  }
  const geo = meta.geo
  if (geo && typeof geo === "object") {
    const record = geo as Record<string, unknown>
    if (typeof record.lat === "number" && typeof record.lng === "number") {
      return { lat: record.lat, lng: record.lng }
    }
  }
  return { lat: null, lng: null }
}

export function formatTerritoryLocationLabel(row: ProspectSearchGeoMatchableRow): string | null {
  const city = asString(row.city)
  const state = normalizeState(row.state)
  const postal = normalizePostalCode(row.postal_code)
  const parts = [city, state, postal].filter(Boolean)
  if (parts.length > 0) return parts.join(", ")
  return asString(row.location) || null
}

export function buildProspectSearchRowGeoFields(input: {
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  service_area?: string | null
  metro?: string | null
  metadata?: Record<string, unknown> | null
}): {
  postal_code: string | null
  country: string | null
  metro: string | null
  lat: number | null
  lng: number | null
} {
  const coords = extractCoordinatesFromMetadata(input.metadata)
  const metro =
    normalizeMetro(input.metro) ??
    inferMetroFromText(input.service_area) ??
    inferMetroFromText(input.city)
  return {
    postal_code: normalizePostalCode(input.postal_code),
    country: normalizeCountry(input.country) ?? (input.state || input.postal_code ? "US" : null),
    metro,
    lat: coords.lat,
    lng: coords.lng,
  }
}

export function buildTerritoryFilterSummary(
  filter: GrowthProspectSearchTerritoryFilter | null | undefined,
): string | null {
  const normalized = normalizeTerritoryFilter(filter)
  if (!normalized) return null
  const parts: string[] = []
  if (normalized.states?.length) parts.push(normalized.states.join(", "))
  if (normalized.cities?.length) parts.push(normalized.cities.join(", "))
  if (normalized.metros?.length) parts.push(`${normalized.metros.join(", ")} metro`)
  if (normalized.postal_codes?.length) parts.push(normalized.postal_codes.join(", "))
  if (normalized.radius) {
    parts.push(
      `${normalized.radius.miles} mi radius${normalized.radius.label ? ` (${normalized.radius.label})` : ""}`,
    )
  }
  return parts.length ? parts.join(" · ") : null
}
