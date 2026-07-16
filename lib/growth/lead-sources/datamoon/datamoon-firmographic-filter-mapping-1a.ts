/** GE-AIOS-DATAMOON-FIRMOGRAPHIC-FILTER-INTEGRATION-1A — Canonical BP/SSV → DataMoon firmographic filters (client-safe). */

import type { AvaDatamoonCompanySize } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import type { BusinessProfileLeadDiscoveryProjection } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import type { DatamoonAudienceFilter } from "@/lib/growth/providers/datamoon"
import type { DatamoonOperationalTargetingTranslation } from "@/lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"
import {
  DATAMOON_PRIMARY_INDUSTRY_FILTER_OMISSION_REASON_NO_PROVEN_TAXONOMY,
  DATAMOON_PRIMARY_INDUSTRY_TAXONOMY_VERSION,
  resolveDatamoonPrimaryIndustryTaxonomyFromCanonicalProjection,
  type DatamoonPrimaryIndustryTaxonomyResolution,
} from "@/lib/growth/lead-sources/datamoon/datamoon-primary-industry-taxonomy-1a"

export const GROWTH_DATAMOON_FIRMOGRAPHIC_FILTER_MAPPING_1A_QA_MARKER =
  "ge-aios-datamoon-firmographic-filter-integration-1a-v1" as const

export const DATAMOON_FIRMOGRAPHIC_FILTER_STRATEGY_VERSION = "1a-v1" as const

/**
 * Proven live DataMoon **module** `company_employee_count` values (Production server probe 2026-07-15).
 * Provider docs also list `11 to 50`, `51 to 200`, and `201 to 500`, but the live module endpoint rejects them.
 */
export const DATAMOON_LIVE_MODULE_COMPANY_EMPLOYEE_COUNT_BANDS = [
  "1 to 10",
  "501 to 1000",
  "1001 to 5000",
  "5001 to 10000",
  "10000+",
] as const

export type DatamoonLiveModuleCompanyEmployeeCountBand =
  (typeof DATAMOON_LIVE_MODULE_COMPANY_EMPLOYEE_COUNT_BANDS)[number]

export const DATAMOON_LIVE_MODULE_EMPLOYEE_COUNT_CONTRACT_VERSION = "module-2026-07-15" as const

export const DATAMOON_EMPLOYEE_COUNT_FILTER_OMISSION_REASON_LIVE_MODULE_GAP =
  "live_module_enum_cannot_represent_canonical_ranges_without_material_precision_loss" as const

/** Certification guard — never emit these live-module-rejected documented bands. */
export const DATAMOON_LIVE_MODULE_REJECTED_DOC_EMPLOYEE_COUNT_BANDS = [
  "11 to 50",
  "51 to 200",
  "201 to 500",
] as const

/** Documented DataMoon `company_revenue` multiselect values (docs.datamoon.com/api). */
export const DATAMOON_DOCUMENTED_COMPANY_REVENUE_BANDS = [
  "under 1 million",
  "1 million to 10 million",
  "10 million to 50 million",
  "50 million to 100 million",
  "100 million to 500 million",
  "500 million to 1 billion",
  "1 billion and over",
] as const

export type DatamoonDocumentedCompanyRevenueBand = (typeof DATAMOON_DOCUMENTED_COMPANY_REVENUE_BANDS)[number]

export const DATAMOON_PROVIDER_FIRMOGRAPHIC_FILTER_FIELDS = [
  "primary_industry",
  "company_employee_count",
  "company_revenue",
  "company_domain",
] as const

export type DatamoonProviderFirmographicFilterField =
  (typeof DATAMOON_PROVIDER_FIRMOGRAPHIC_FILTER_FIELDS)[number]

export type DatamoonFirmographicFilterStrategyMetadata = {
  version: typeof DATAMOON_FIRMOGRAPHIC_FILTER_STRATEGY_VERSION
  primaryIndustryValues: string[]
  primaryIndustryFilterApplied: boolean
  primaryIndustryFilterOmissionReason: string | null
  primaryIndustryTaxonomyVersion: typeof DATAMOON_PRIMARY_INDUSTRY_TAXONOMY_VERSION
  primaryIndustrySourceCluster: string
  primaryIndustrySourceVerticalIds: string[]
  companyEmployeeCountBands: string[]
  companyRevenueBands: string[]
  companyDomainValues: string[]
  sourceCompanySizeRanges: string[]
  employeeCountFilterApplied: boolean
  employeeCountFilterOmissionReason: string | null
  liveProviderEmployeeCountContractVersion: typeof DATAMOON_LIVE_MODULE_EMPLOYEE_COUNT_CONTRACT_VERSION
}

export { DATAMOON_PRIMARY_INDUSTRY_FILTER_OMISSION_REASON_NO_PROVEN_TAXONOMY }
export type { DatamoonPrimaryIndustryTaxonomyResolution }

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = normalizeKey(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    output.push(trimmed)
  }
  return output
}

function extractNumericRange(value: string): { min: number; max: number } | null {
  const normalized = value.toLowerCase().replace(/,/g, "").replace(/\u2013/g, "-")
  const between = normalized.match(/(\d+)\s*(?:-|to)\s*(\d+)/)
  if (between) {
    const min = Number(between[1])
    const max = Number(between[2])
    if (Number.isFinite(min) && Number.isFinite(max) && min <= max) {
      return { min, max }
    }
  }
  const plus = normalized.match(/(\d+)\s*\+/)
  if (plus) {
    const min = Number(plus[1])
    if (Number.isFinite(min)) return { min, max: Number.MAX_SAFE_INTEGER }
  }
  return null
}

function datamoonLiveEmployeeBandRange(band: DatamoonLiveModuleCompanyEmployeeCountBand): {
  min: number
  max: number
} {
  switch (band) {
    case "1 to 10":
      return { min: 1, max: 10 }
    case "501 to 1000":
      return { min: 501, max: 1000 }
    case "1001 to 5000":
      return { min: 1001, max: 5000 }
    case "5001 to 10000":
      return { min: 5001, max: 10000 }
    case "10000+":
      return { min: 10001, max: Number.MAX_SAFE_INTEGER }
  }
}

function mergeAdjacentEmployeeIntervals(
  intervals: readonly { min: number; max: number }[],
): { min: number; max: number }[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.min - b.min)
  const merged: { min: number; max: number }[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i]!
    const last = merged[merged.length - 1]!
    if (current.min <= last.max + 1) {
      last.max = Math.max(last.max, current.max)
      continue
    }
    merged.push({ ...current })
  }
  return merged
}

/** Greedy cover using only live-module bands fully contained in the canonical interval. */
function resolveLiveModuleBandsForCanonicalInterval(
  canonical: { min: number; max: number },
): DatamoonLiveModuleCompanyEmployeeCountBand[] | null {
  const selected: DatamoonLiveModuleCompanyEmployeeCountBand[] = []
  let cursor = canonical.min

  while (cursor <= canonical.max) {
    const candidates = DATAMOON_LIVE_MODULE_COMPANY_EMPLOYEE_COUNT_BANDS.filter((band) => {
      const range = datamoonLiveEmployeeBandRange(band)
      return (
        range.min <= cursor &&
        range.max >= cursor &&
        range.min >= canonical.min &&
        range.max <= canonical.max
      )
    })

    if (candidates.length === 0) return null

    const pick = candidates.reduce((best, band) => {
      const bestMax = datamoonLiveEmployeeBandRange(best).max
      const bandMax = datamoonLiveEmployeeBandRange(band).max
      return bandMax < bestMax ? band : best
    })

    selected.push(pick)
    cursor = datamoonLiveEmployeeBandRange(pick).max + 1
  }

  return DATAMOON_LIVE_MODULE_COMPANY_EMPLOYEE_COUNT_BANDS.filter((band) => selected.includes(band))
}

function workbenchCompanySizeToCanonicalRange(
  companySize: AvaDatamoonCompanySize,
): { min: number; max: number } | null {
  switch (companySize) {
    case "1-10":
      return { min: 1, max: 10 }
    case "11-50":
      return { min: 11, max: 50 }
    case "51-200":
      return { min: 51, max: 200 }
    case "201-500":
      return { min: 201, max: 500 }
    case "500+":
      return { min: 501, max: Number.MAX_SAFE_INTEGER }
    case "smb":
      return { min: 1, max: 50 }
    default:
      return null
  }
}

function parseEmployeeSizeIntervalsFromRangeStrings(ranges: readonly string[]): { min: number; max: number }[] {
  const intervals: { min: number; max: number }[] = []

  for (const entry of ranges) {
    const normalized = entry.trim().toLowerCase()
    if (!normalized || /million|billion|revenue|\$/.test(normalized)) continue

    if (/enterprise|500\+|500 plus/.test(normalized)) {
      intervals.push({ min: 501, max: Number.MAX_SAFE_INTEGER })
      continue
    }

    const numericRange = extractNumericRange(entry)
    if (numericRange) {
      intervals.push(numericRange)
      continue
    }

    if (/smb|small|mid/.test(normalized)) {
      intervals.push({ min: 1, max: 50 })
    }
  }

  return intervals
}

export function resolveLiveModuleCompanyEmployeeCountBands(input: {
  companySizeRanges: readonly string[]
  workbenchCompanySize?: AvaDatamoonCompanySize
}): {
  bands: DatamoonLiveModuleCompanyEmployeeCountBand[]
  omissionReason: string | null
} {
  let intervals = parseEmployeeSizeIntervalsFromRangeStrings(input.companySizeRanges)

  if (intervals.length === 0 && input.workbenchCompanySize) {
    const fallback = workbenchCompanySizeToCanonicalRange(input.workbenchCompanySize)
    if (fallback) intervals = [fallback]
  }

  if (intervals.length === 0) {
    return { bands: [], omissionReason: null }
  }

  const merged = mergeAdjacentEmployeeIntervals(intervals)
  const selected = new Set<DatamoonLiveModuleCompanyEmployeeCountBand>()

  for (const interval of merged) {
    const covered = resolveLiveModuleBandsForCanonicalInterval(interval)
    if (!covered) {
      return {
        bands: [],
        omissionReason: DATAMOON_EMPLOYEE_COUNT_FILTER_OMISSION_REASON_LIVE_MODULE_GAP,
      }
    }
    for (const band of covered) selected.add(band)
  }

  return {
    bands: DATAMOON_LIVE_MODULE_COMPANY_EMPLOYEE_COUNT_BANDS.filter((band) => selected.has(band)),
    omissionReason: null,
  }
}

/** Equipify workbench intent → live module employee bands when fully representable. */
export function translateEquipifyCompanySizeIntentToDatamoonEmployeeBands(
  companySize: AvaDatamoonCompanySize,
): DatamoonLiveModuleCompanyEmployeeCountBand[] {
  const canonical = workbenchCompanySizeToCanonicalRange(companySize)
  if (!canonical) return []
  return resolveLiveModuleBandsForCanonicalInterval(canonical) ?? []
}

/** Map canonical Business Profile company-size range strings → live module employee bands. */
export function translateCompanySizeRangeStringsToDatamoonEmployeeBands(
  ranges: readonly string[],
): DatamoonLiveModuleCompanyEmployeeCountBand[] {
  return resolveLiveModuleCompanyEmployeeCountBands({ companySizeRanges: ranges }).bands
}

function normalizeRevenuePhrase(value: string): DatamoonDocumentedCompanyRevenueBand | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ")
  if (!normalized) return null

  for (const band of DATAMOON_DOCUMENTED_COMPANY_REVENUE_BANDS) {
    if (normalized === band) return band
  }

  if (/under\s*1\s*m|<\s*\$?\s*1\s*m|<\s*1\s*million/.test(normalized)) {
    return "under 1 million"
  }
  if (/\d+\s*(?:-|to)\s*\d+\s*m(illion)?/.test(normalized)) {
    const rangeMatch = normalized.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*m(illion)?/)
    if (rangeMatch) {
      const low = Number(rangeMatch[1])
      const high = Number(rangeMatch[2])
      if (low <= 1 && high <= 10) return "1 million to 10 million"
      if (low <= 10 && high <= 50) return "10 million to 50 million"
      if (low <= 50 && high <= 100) return "50 million to 100 million"
      if (low <= 100 && high <= 500) return "100 million to 500 million"
      if (low <= 500 && high <= 1000) return "500 million to 1 billion"
    }
  }
  if (/1\s*m(illion)?\s*(to|-)\s*10\s*m(illion)?/.test(normalized)) {
    return "1 million to 10 million"
  }
  if (/10\s*m(illion)?\s*(to|-)\s*50\s*m(illion)?/.test(normalized)) {
    return "10 million to 50 million"
  }
  if (/50\s*m(illion)?\s*(to|-)\s*100\s*m(illion)?/.test(normalized)) {
    return "50 million to 100 million"
  }
  if (/100\s*m(illion)?\s*(to|-)\s*500\s*m(illion)?/.test(normalized)) {
    return "100 million to 500 million"
  }
  if (/500\s*m(illion)?\s*(to|-)\s*1\s*b(illion)?/.test(normalized)) {
    return "500 million to 1 billion"
  }
  if (/1\s*b(illion)?\s*(and\s*)?(over|\+)/.test(normalized) || /over\s*1\s*b(illion)?/.test(normalized)) {
    return "1 billion and over"
  }

  return null
}

/** Map canonical revenue-intent strings when explicitly present in profile range fields. */
export function translateRevenueIntentStringsToDatamoonCompanyRevenue(
  ranges: readonly string[],
): DatamoonDocumentedCompanyRevenueBand[] {
  const selected = new Set<DatamoonDocumentedCompanyRevenueBand>()
  for (const entry of ranges) {
    const normalized = entry.trim().toLowerCase()
    if (!normalized) continue
    if (!/million|billion|revenue|\$/.test(normalized)) continue
    const mapped = normalizeRevenuePhrase(entry)
    if (mapped) selected.add(mapped)
  }
  return DATAMOON_DOCUMENTED_COMPANY_REVENUE_BANDS.filter((band) => selected.has(band))
}

function industryTaxonomyResolution(input: {
  projection: BusinessProfileLeadDiscoveryProjection
  operationalTargeting: DatamoonOperationalTargetingTranslation
}): DatamoonPrimaryIndustryTaxonomyResolution {
  return resolveDatamoonPrimaryIndustryTaxonomyFromCanonicalProjection(input)
}

/** Proven DataMoon primary_industry taxonomy for the selected primary OMT cluster (no SSV alias fallback). */
export function buildPrimaryIndustryFilterValuesFromCanonicalProjection(input: {
  projection: BusinessProfileLeadDiscoveryProjection
  operationalTargeting: DatamoonOperationalTargetingTranslation
}): string[] {
  return industryTaxonomyResolution(input).values
}

export function resolvePrimaryIndustryFilterFromCanonicalProjection(input: {
  projection: BusinessProfileLeadDiscoveryProjection
  operationalTargeting: DatamoonOperationalTargetingTranslation
}): DatamoonPrimaryIndustryTaxonomyResolution {
  return industryTaxonomyResolution(input)
}

export function buildDatamoonFirmographicFilterStrategyMetadata(input: {
  projection: BusinessProfileLeadDiscoveryProjection
  operationalTargeting: DatamoonOperationalTargetingTranslation
  companySizeRanges: readonly string[]
  targetCompanyDomains?: readonly string[]
}): DatamoonFirmographicFilterStrategyMetadata {
  const employeeResolution = resolveLiveModuleCompanyEmployeeCountBands({
    companySizeRanges: input.companySizeRanges,
    workbenchCompanySize: input.projection.companySize,
  })
  const primaryIndustry = industryTaxonomyResolution({
    projection: input.projection,
    operationalTargeting: input.operationalTargeting,
  })

  return {
    version: DATAMOON_FIRMOGRAPHIC_FILTER_STRATEGY_VERSION,
    primaryIndustryValues: [...primaryIndustry.values],
    primaryIndustryFilterApplied: primaryIndustry.applied,
    primaryIndustryFilterOmissionReason: primaryIndustry.omissionReason,
    primaryIndustryTaxonomyVersion: primaryIndustry.taxonomyVersion,
    primaryIndustrySourceCluster: primaryIndustry.sourceCluster,
    primaryIndustrySourceVerticalIds: [...primaryIndustry.sourceVerticalIds],
    companyEmployeeCountBands: employeeResolution.bands,
    companyRevenueBands: translateRevenueIntentStringsToDatamoonCompanyRevenue(input.companySizeRanges),
    companyDomainValues: uniqueStrings(input.targetCompanyDomains ?? []).slice(0, 5),
    sourceCompanySizeRanges: uniqueStrings(input.companySizeRanges),
    employeeCountFilterApplied: employeeResolution.bands.length > 0,
    employeeCountFilterOmissionReason: employeeResolution.omissionReason,
    liveProviderEmployeeCountContractVersion: DATAMOON_LIVE_MODULE_EMPLOYEE_COUNT_CONTRACT_VERSION,
  }
}

export function buildDatamoonFirmographicFiltersFromCanonicalProjection(input: {
  projection: BusinessProfileLeadDiscoveryProjection
  operationalTargeting: DatamoonOperationalTargetingTranslation
  companySizeRanges: readonly string[]
  targetCompanyDomains?: readonly string[]
}): DatamoonAudienceFilter[] {
  const strategy = buildDatamoonFirmographicFilterStrategyMetadata(input)
  const filters: DatamoonAudienceFilter[] = []

  if (strategy.primaryIndustryFilterApplied && strategy.primaryIndustryValues.length > 0) {
    filters.push({
      field: "primary_industry",
      operator: "in",
      value: strategy.primaryIndustryValues,
    })
  }

  if (strategy.employeeCountFilterApplied && strategy.companyEmployeeCountBands.length > 0) {
    filters.push({
      field: "company_employee_count",
      operator: "in",
      value: strategy.companyEmployeeCountBands,
    })
  }

  if (strategy.companyRevenueBands.length > 0) {
    filters.push({
      field: "company_revenue",
      operator: "in",
      value: strategy.companyRevenueBands,
    })
  }

  if (strategy.companyDomainValues.length > 0) {
    filters.push({
      field: "company_domain",
      operator: "in",
      value: strategy.companyDomainValues,
    })
  }

  return filters
}

export function mergeDatamoonAudienceFiltersPreservingProviderFields(
  baseFilters: readonly DatamoonAudienceFilter[],
  additionalFilters: readonly DatamoonAudienceFilter[],
): DatamoonAudienceFilter[] {
  const output = [...baseFilters]
  const existingFields = new Set(output.map((filter) => filter.field))
  for (const filter of additionalFilters) {
    if (existingFields.has(filter.field)) continue
    output.push(filter)
    existingFields.add(filter.field)
  }
  return output
}
