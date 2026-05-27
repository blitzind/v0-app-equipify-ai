import type { GrowthRealWorldDiscoverySearchInputs } from "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"

function cleanPart(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Build a Google Places Text Search query from ICP facets.
 * Examples:
 * - "medical equipment service Boston MA"
 * - "biomedical calibration California"
 * - "commercial HVAC repair Nashville TN"
 */
export function buildGooglePlacesDiscoveryQuery(
  inputs: GrowthRealWorldDiscoverySearchInputs,
): string {
  const raw = cleanPart(inputs.raw_query)
  if (raw.length >= 8) return raw

  const industry = cleanPart(inputs.subindustry) || cleanPart(inputs.industry)
  const location = cleanPart(inputs.location)
  const service = cleanPart(inputs.service_category)
  const business = cleanPart(inputs.business_type)
  const intent = cleanPart(inputs.intent_category)
  const employees = cleanPart(inputs.employee_size_estimate)
  const keywords = (inputs.keywords ?? []).map((k) => cleanPart(k)).filter(Boolean)
  const tech = (inputs.technology_hints ?? []).map((t) => cleanPart(t)).filter(Boolean)

  const subjectParts: string[] = []
  if (industry) subjectParts.push(industry)
  else if (business) subjectParts.push(business)
  else if (service) subjectParts.push(service)
  else if (keywords.length) subjectParts.push(keywords.slice(0, 3).join(" "))

  let subject = subjectParts.join(" ").trim()
  if (!subject) subject = "field service"

  const subjectLower = subject.toLowerCase()
  if (business && !subjectLower.includes(business.toLowerCase())) {
    subject = `${subject} ${business}`
  }
  if (service && !subject.toLowerCase().includes(service.toLowerCase())) {
    subject = `${subject} ${service}`
  }
  if (keywords.length && !industry && !business && !service) {
    subject = `${subject} ${keywords.slice(0, 3).join(" ")}`
  } else if (keywords.length) {
    const extra = keywords.filter((k) => !subject.toLowerCase().includes(k.toLowerCase())).slice(0, 2)
    if (extra.length) subject = `${subject} ${extra.join(" ")}`
  }

  if (intent && !subject.toLowerCase().includes(intent.toLowerCase())) {
    subject = `${subject} ${intent}`
  }
  if (tech.length) subject = `${subject} ${tech.slice(0, 2).join(" ")}`
  if (employees) subject = `${subject} ${employees.replace(/_/g, "-")} employees`

  if (location) subject = `${subject} ${location}`

  return subject.trim() || raw || "field service companies"
}
