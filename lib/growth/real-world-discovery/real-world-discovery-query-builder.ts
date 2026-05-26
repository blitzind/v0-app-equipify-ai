import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"

/** ICP + search inputs for real-world company discovery. */
export type GrowthRealWorldDiscoverySearchInputs = {
  industry?: string | null
  subindustry?: string | null
  location?: string | null
  radius_miles?: number | null
  employee_size_estimate?: string | null
  keywords?: string[]
  service_category?: string | null
  business_type?: string | null
  intent_category?: string | null
  technology_hints?: string[]
  decision_maker_role_hints?: string[]
  /** Raw operator query when present. */
  raw_query?: string | null
}

function cleanPart(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : ""
}

function joinNonEmpty(parts: string[], sep: string): string {
  return parts.filter(Boolean).join(sep)
}

/**
 * Build a natural-language provider query from ICP facets.
 * Examples:
 * - "medical equipment service companies in Tennessee"
 * - "commercial HVAC service companies 20-100 employees in Dallas"
 */
export function buildRealWorldDiscoveryQuery(
  inputs: GrowthRealWorldDiscoverySearchInputs,
): string {
  const raw = cleanPart(inputs.raw_query)
  if (raw.length >= 8) return raw

  const industry = cleanPart(inputs.subindustry) || cleanPart(inputs.industry)
  const location = cleanPart(inputs.location)
  const service = cleanPart(inputs.service_category)
  const business = cleanPart(inputs.business_type)
  const employees = cleanPart(inputs.employee_size_estimate)
  const intent = cleanPart(inputs.intent_category)
  const keywords = (inputs.keywords ?? []).map((k) => cleanPart(k)).filter(Boolean)
  const tech = (inputs.technology_hints ?? []).map((t) => cleanPart(t)).filter(Boolean)
  const roles = (inputs.decision_maker_role_hints ?? []).map((r) => cleanPart(r)).filter(Boolean)

  const subjectParts: string[] = []
  if (service) subjectParts.push(service)
  else if (business) subjectParts.push(business)
  else if (industry) subjectParts.push(industry)
  else if (keywords.length) subjectParts.push(keywords.slice(0, 3).join(" "))

  let subject = subjectParts.join(" ")
  if (!subject) subject = "field service companies"
  if (!subject.toLowerCase().includes("compan")) {
    subject = `${subject} companies`
  }

  const modifiers: string[] = []
  if (employees) modifiers.push(`${employees} employees`)
  if (tech.length) modifiers.push(`using ${tech.slice(0, 2).join(", ")}`)
  if (intent) modifiers.push(intent)
  if (roles.length) modifiers.push(`(${roles.slice(0, 2).join(", ")})`)

  const locationClause = location
    ? inputs.radius_miles
      ? `within ${inputs.radius_miles} miles of ${location}`
      : `in ${location}`
    : ""

  const pieces = [subject, ...modifiers, locationClause].filter(Boolean)
  const built = joinNonEmpty(pieces, " ")
  return built || raw || "field service companies"
}

export function prospectSearchFiltersToRealWorldInputs(
  filters: GrowthProspectSearchFilters,
  rawQuery: string,
): GrowthRealWorldDiscoverySearchInputs {
  const employeeBand = filters.employee_size_bands?.[0]
  const employee_size_estimate =
    employeeBand && employeeBand !== "unknown" ? employeeBand.replace(/_/g, "-") : null

  return {
    raw_query: rawQuery,
    industry: filters.industry ?? null,
    subindustry: filters.subindustry ?? null,
    location: filters.location ?? filters.service_area ?? null,
    employee_size_estimate,
    keywords: filters.keywords ?? [],
    service_category: filters.field_service_software ?? null,
    business_type: filters.crm_detected ?? null,
    intent_category: filters.search_intent_categories?.[0] ?? null,
    technology_hints: [
      ...(filters.technologies ?? []),
      ...(filters.website_platform ? [filters.website_platform] : []),
      ...(filters.crm_detected ? [filters.crm_detected] : []),
    ],
    decision_maker_role_hints: [
      ...(filters.decision_maker_role ? [filters.decision_maker_role] : []),
      ...(filters.title_contains ? [filters.title_contains] : []),
    ],
  }
}
