/** Map existing enrichment/research fields onto Prospect Search index rows (Sprint 2). */

import type { GrowthProspectSearchIndexCompany } from "@/lib/growth/prospect-search/prospect-search-index"
import type { GrowthProspectSearchSourceType } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_SEARCH_INDEX_ENRICHMENT_QA_MARKER =
  "growth-prospect-search-index-enrichment-v1" as const

const WEBSITE_PLATFORM_TECHNOLOGIES = ["WordPress", "Shopify", "HubSpot", "Wix", "Squarespace"] as const

const FIELD_SERVICE_TECHNOLOGIES = [
  "ServiceTitan",
  "Housecall Pro",
  "Jobber",
  "FieldPulse",
  "FieldEdge",
] as const

export type ProspectSearchResearchOverlay = {
  industry_guess: string | null
  employee_size_guess: string | null
  revenue_size_guess: string | null
  detected_technologies: string[]
}

export type ProspectSearchCustomerLocationOverlay = {
  city: string | null
  state: string | null
  postal_code: string | null
  address_line1: string | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function metaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function metaString(meta: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const direct = asString(meta[key])
    if (direct) return direct
  }
  return null
}

function nestedMetaString(
  meta: Record<string, unknown>,
  path: string[],
  ...keys: string[]
): string | null {
  let current: unknown = meta
  for (const segment of path) {
    if (!current || typeof current !== "object") return null
    current = (current as Record<string, unknown>)[segment]
  }
  return metaString(metaRecord(current), ...keys)
}

export function mergeFirstPopulatedString(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const text = asString(value)
    if (text) return text
  }
  return null
}

export function buildLocationLabel(input: {
  location?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  address_line1?: string | null
  postal_code?: string | null
}): string | null {
  const direct = asString(input.location)
  if (direct) return direct

  const parts = [
    asString(input.city),
    asString(input.state),
    asString(input.country),
  ].filter(Boolean)

  if (parts.length > 0) return parts.join(", ")

  const addressParts = [asString(input.address_line1), asString(input.postal_code)].filter(Boolean)
  return addressParts.length > 0 ? addressParts.join(" ") : null
}

export function pickWebsitePlatformFromTechnologies(technologies: string[]): string | null {
  for (const tech of technologies) {
    const normalized = tech.trim()
    if (!normalized) continue
    if (WEBSITE_PLATFORM_TECHNOLOGIES.some((platform) => normalized.toLowerCase().includes(platform.toLowerCase()))) {
      return normalized.replace(/ \(signal\)$/i, "")
    }
  }
  return null
}

export function pickFieldServiceSoftwareFromTechnologies(technologies: string[]): string | null {
  for (const tech of technologies) {
    const normalized = tech.trim()
    if (!normalized) continue
    if (
      FIELD_SERVICE_TECHNOLOGIES.some((platform) =>
        normalized.toLowerCase().includes(platform.toLowerCase()),
      )
    ) {
      return normalized.replace(/ \(signal\)$/i, "")
    }
  }
  return null
}

export function formatEstimatedValueCents(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null
  if (value >= 100_000_000) return "$1m+"
  if (value >= 10_000_000) return "$100k+"
  return `$${Math.round(value / 100).toLocaleString("en-US")}`
}

export function mapGrowthLeadIndexEnrichment(input: {
  raw: Record<string, unknown>
  research?: ProspectSearchResearchOverlay | null
}): Pick<
  GrowthProspectSearchIndexCompany,
  | "website"
  | "industry"
  | "subindustry"
  | "employees"
  | "revenue_range"
  | "location"
  | "city"
  | "state"
  | "service_area"
  | "notes"
  | "crm_detected"
  | "website_platform"
  | "field_service_software"
  | "keywords"
> {
  const meta = metaRecord(input.raw.metadata)
  const research = input.research
  const technologies = research?.detected_technologies ?? []

  const industry = mergeFirstPopulatedString(
    metaString(meta, "industry", "industry_detected", "vertical"),
    research?.industry_guess,
  )

  return {
    website: mergeFirstPopulatedString(asString(input.raw.website)),
    industry,
    subindustry: metaString(meta, "subindustry", "category"),
    employees: mergeFirstPopulatedString(
      asString(input.raw.estimated_employee_count),
      research?.employee_size_guess,
    ),
    revenue_range: mergeFirstPopulatedString(
      asString(input.raw.estimated_annual_revenue),
      research?.revenue_size_guess,
    ),
    location: buildLocationLabel({
      location: metaString(meta, "location", "service_area"),
      city: asString(input.raw.city),
      state: asString(input.raw.state),
      country: asString(input.raw.country),
      address_line1: asString(input.raw.address_line1),
      postal_code: asString(input.raw.postal_code),
    }),
    city: mergeFirstPopulatedString(asString(input.raw.city)),
    state: mergeFirstPopulatedString(asString(input.raw.state)),
    service_area: metaString(meta, "service_area", "service_area_clues"),
    notes: mergeFirstPopulatedString(asString(input.raw.notes)),
    crm_detected: mergeFirstPopulatedString(asString(input.raw.crm_detected), metaString(meta, "crm_detected")),
    website_platform: mergeFirstPopulatedString(
      metaString(meta, "website_platform"),
      pickWebsitePlatformFromTechnologies(technologies),
    ),
    field_service_software: mergeFirstPopulatedString(
      asString(input.raw.field_service_stack_detected),
      metaString(meta, "field_service_software", "field_service_stack_detected"),
      pickFieldServiceSoftwareFromTechnologies(technologies),
    ),
    keywords: [],
  }
}

export function mapLeadInboxIndexEnrichment(input: {
  raw: Record<string, unknown>
}): Pick<
  GrowthProspectSearchIndexCompany,
  | "website"
  | "industry"
  | "subindustry"
  | "employees"
  | "revenue_range"
  | "location"
  | "city"
  | "state"
  | "service_area"
  | "notes"
  | "crm_detected"
  | "website_platform"
  | "field_service_software"
  | "keywords"
> {
  const meta = metaRecord(input.raw.metadata)

  return {
    website: mergeFirstPopulatedString(
      asString(input.raw.domain),
      nestedMetaString(meta, ["company_identification_summary"], "company_domain"),
    ),
    industry: mergeFirstPopulatedString(
      metaString(meta, "industry", "vertical"),
      nestedMetaString(meta, ["prospect_search"], "industry"),
    ),
    subindustry: metaString(meta, "subindustry", "category"),
    employees: metaString(meta, "employee_count", "employees", "employee_estimate"),
    revenue_range: metaString(meta, "revenue_range", "revenue_estimate", "estimated_annual_revenue"),
    location: buildLocationLabel({
      location: metaString(meta, "location"),
      city: metaString(meta, "city"),
      state: metaString(meta, "state"),
    }),
    city: metaString(meta, "city"),
    state: metaString(meta, "state"),
    service_area: metaString(meta, "service_area"),
    notes: null,
    crm_detected: metaString(meta, "crm_detected"),
    website_platform: metaString(meta, "website_platform"),
    field_service_software: metaString(meta, "field_service_software", "field_service_stack_detected"),
    keywords: [],
  }
}

export function mapCrmProspectIndexEnrichment(input: {
  raw: Record<string, unknown>
}): Pick<
  GrowthProspectSearchIndexCompany,
  | "website"
  | "industry"
  | "subindustry"
  | "employees"
  | "revenue_range"
  | "location"
  | "city"
  | "state"
  | "service_area"
  | "notes"
  | "crm_detected"
  | "website_platform"
  | "field_service_software"
  | "keywords"
> {
  const notes = asString(input.raw.notes)

  return {
    website: mergeFirstPopulatedString(asString(input.raw.website)),
    industry: null,
    subindustry: null,
    employees: null,
    revenue_range: formatEstimatedValueCents(input.raw.estimated_value_cents),
    location: buildLocationLabel({
      city: asString(input.raw.city),
      state: asString(input.raw.state),
      address_line1: asString(input.raw.address_line1),
      postal_code: asString(input.raw.postal_code),
    }),
    city: mergeFirstPopulatedString(asString(input.raw.city)),
    state: mergeFirstPopulatedString(asString(input.raw.state)),
    service_area: null,
    notes: notes || null,
    crm_detected: null,
    website_platform: null,
    field_service_software: null,
    keywords: [],
  }
}

export function mapCrmCustomerIndexEnrichment(input: {
  raw: Record<string, unknown>
  location?: ProspectSearchCustomerLocationOverlay | null
}): Pick<
  GrowthProspectSearchIndexCompany,
  | "website"
  | "industry"
  | "subindustry"
  | "employees"
  | "revenue_range"
  | "location"
  | "city"
  | "state"
  | "service_area"
  | "notes"
  | "crm_detected"
  | "website_platform"
  | "field_service_software"
  | "keywords"
> {
  const notes = asString(input.raw.notes)
  const locationOverlay = input.location

  return {
    website: null,
    industry: null,
    subindustry: null,
    employees: null,
    revenue_range: null,
    location: buildLocationLabel({
      city: locationOverlay?.city,
      state: locationOverlay?.state,
      address_line1: locationOverlay?.address_line1,
      postal_code: locationOverlay?.postal_code,
    }),
    city: mergeFirstPopulatedString(locationOverlay?.city),
    state: mergeFirstPopulatedString(locationOverlay?.state),
    service_area: null,
    notes: notes || null,
    crm_detected: null,
    website_platform: null,
    field_service_software: null,
    keywords: [],
  }
}

export function buildProspectSearchIndexSignals(input: {
  source_type: GrowthProspectSearchSourceType
  notes?: string | null
  crm_detected?: string | null
  field_service_software?: string | null
  website_platform?: string | null
  service_area?: string | null
  existing_account?: boolean
}): string[] {
  const signals: string[] = []

  if (input.source_type === "crm_prospect") {
    signals.push("CRM prospect record.")
  } else if (input.source_type === "crm_customer" || input.existing_account) {
    signals.push("Existing CRM customer.")
  }

  if (input.crm_detected) signals.push(`CRM: ${input.crm_detected}`)
  if (input.field_service_software) signals.push(`Field service: ${input.field_service_software}`)
  if (input.website_platform) signals.push(`Platform: ${input.website_platform}`)
  if (input.service_area) signals.push(`Service area: ${input.service_area}`)
  if (input.notes) signals.push(`Notes: ${input.notes.slice(0, 80)}`)

  return [...new Set(signals)].slice(0, 6)
}
