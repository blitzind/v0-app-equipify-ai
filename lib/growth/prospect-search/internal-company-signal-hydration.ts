/** In-memory company signal hydration for internal Prospect Search rows (Sprint 1). */

import {
  buildCompanySignalUiSummary,
  normalizeDetectedCompanySignals,
} from "@/lib/growth/company-signals/company-signal-engine"
import type { GrowthCompanySignalContext } from "@/lib/growth/company-signals/company-signal-context"
import { mergeSignalSummaryIntoProspectSignals } from "@/lib/growth/company-signals/integrations/real-world-discovery-bridge"
import type { GrowthCompanySignalUiSummary } from "@/lib/growth/company-signals/company-signal-types"
import type { GrowthProspectSearchSourceType } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_SEARCH_INTERNAL_SIGNAL_HYDRATION_QA_MARKER =
  "growth-prospect-search-internal-signals-v1" as const

const INTERNAL_SOURCE_TYPES: GrowthProspectSearchSourceType[] = [
  "growth_lead",
  "lead_inbox",
  "crm_prospect",
  "crm_customer",
]

const LIMITED_MATURITY_LABELS = new Set([
  "Limited ops evidence",
  "Limited digital evidence",
  "No field service evidence",
])

export type InternalCompanySignalHydrationInput = {
  id: string
  source_type: GrowthProspectSearchSourceType
  company_name: string
  website: string | null
  industry: string | null
  subindustry: string | null
  employees: string | null
  revenue_range: string | null
  location: string | null
  city: string | null
  state: string | null
  service_area: string | null
  notes: string | null
  crm_detected: string | null
  website_platform: string | null
  field_service_software: string | null
  keywords: string[]
  signals: string[]
}

export type InternalCompanySignalHydrationResult = {
  company_signal_summary: GrowthCompanySignalUiSummary
  merged_signals: string[]
  signal_confidence: number
  signal_count: number
}

function extractDomain(website: string | null): string | null {
  if (!website) return null
  const trimmed = website.trim()
  if (!trimmed) return null
  try {
    const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`)
    return url.hostname.replace(/^www\./, "") || null
  } catch {
    return trimmed.replace(/^https?:\/\//, "").split("/")[0]?.replace(/^www\./, "") || null
  }
}

function buildObservedSignalLists(input: InternalCompanySignalHydrationInput): {
  observed_technology_signals: string[]
  observed_crm_signals: string[]
  observed_service_signals: string[]
} {
  const observed_technology_signals: string[] = []
  const observed_crm_signals: string[] = []
  const observed_service_signals: string[] = []

  if (input.website_platform?.trim()) {
    observed_technology_signals.push(input.website_platform.trim())
  }
  if (input.field_service_software?.trim()) {
    observed_service_signals.push(input.field_service_software.trim())
  }
  if (input.crm_detected?.trim()) {
    observed_crm_signals.push(input.crm_detected.trim())
  }

  return {
    observed_technology_signals: [...new Set(observed_technology_signals)],
    observed_crm_signals: [...new Set(observed_crm_signals)],
    observed_service_signals: [...new Set(observed_service_signals)],
  }
}

function buildDescription(input: InternalCompanySignalHydrationInput): string | null {
  const parts = [
    input.notes?.trim() || null,
    input.employees?.trim() ? `${input.employees.trim()} employees` : null,
    input.revenue_range?.trim() ? `Revenue: ${input.revenue_range.trim()}` : null,
    input.service_area?.trim() ? `Service area: ${input.service_area.trim()}` : null,
    ...input.keywords.map((k) => k.trim()).filter(Boolean),
    ...input.signals.map((s) => s.trim()).filter(Boolean),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(". ") : null
}

export function internalRecordToCompanySignalContext(
  input: InternalCompanySignalHydrationInput,
): GrowthCompanySignalContext {
  const observed = buildObservedSignalLists(input)

  return {
    company_candidate_id: `${input.source_type}:${input.id}`,
    company_name: input.company_name,
    domain: extractDomain(input.website),
    website: input.website,
    industry: input.industry,
    category: input.subindustry,
    description: buildDescription(input),
    location: input.location,
    city: input.city,
    state: input.state,
    country: null,
    review_count: null,
    rating: null,
    observed_technology_signals: observed.observed_technology_signals,
    observed_crm_signals: observed.observed_crm_signals,
    observed_service_signals: observed.observed_service_signals,
    metadata: {
      source_type: input.source_type,
      source_id: input.id,
      hydration: GROWTH_PROSPECT_SEARCH_INTERNAL_SIGNAL_HYDRATION_QA_MARKER,
    },
  }
}

export function hasDisplayableCompanySignalSummary(
  summary: GrowthCompanySignalUiSummary,
  signalCount: number,
): boolean {
  if (signalCount <= 0) return false

  return (
    summary.technology_signals.length > 0 ||
    summary.growth_indicators.length > 0 ||
    summary.fit_indicators.length > 0 ||
    !LIMITED_MATURITY_LABELS.has(summary.operational_maturity) ||
    !LIMITED_MATURITY_LABELS.has(summary.digital_maturity) ||
    summary.field_service_maturity !== "No field service evidence"
  )
}

export function hydrateInternalCompanySignals(
  input: InternalCompanySignalHydrationInput,
): InternalCompanySignalHydrationResult | null {
  if (!INTERNAL_SOURCE_TYPES.includes(input.source_type)) return null

  const ctx = internalRecordToCompanySignalContext(input)
  const normalized = normalizeDetectedCompanySignals(ctx)
  if (normalized.length === 0) return null

  const company_signal_summary = buildCompanySignalUiSummary(normalized)
  if (!hasDisplayableCompanySignalSummary(company_signal_summary, normalized.length)) {
    return null
  }

  const signal_confidence = Number(
    (
      normalized.reduce((sum, signal) => sum + signal.confidence, 0) / normalized.length
    ).toFixed(3),
  )

  return {
    company_signal_summary,
    merged_signals: mergeSignalSummaryIntoProspectSignals(input.signals, company_signal_summary),
    signal_confidence,
    signal_count: normalized.length,
  }
}
