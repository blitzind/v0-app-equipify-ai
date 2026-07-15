/** GE-AIOS-DATAMOON-FIRMOGRAPHIC-FILTER-INTEGRATION-1A — Canonical BP/SSV → DataMoon firmographic filters (client-safe). */

import type { AvaDatamoonCompanySize } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import type { BusinessProfileLeadDiscoveryProjection } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import type { DatamoonAudienceFilter } from "@/lib/growth/providers/datamoon"
import type { DatamoonOperationalTargetingTranslation } from "@/lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"

export const GROWTH_DATAMOON_FIRMOGRAPHIC_FILTER_MAPPING_1A_QA_MARKER =
  "ge-aios-datamoon-firmographic-filter-integration-1a-v1" as const

export const DATAMOON_FIRMOGRAPHIC_FILTER_STRATEGY_VERSION = "1a-v1" as const

/** Documented DataMoon `company_employee_count` multiselect values (docs.datamoon.com/api). */
export const DATAMOON_DOCUMENTED_COMPANY_EMPLOYEE_COUNT_BANDS = [
  "1 to 10",
  "11 to 50",
  "51 to 200",
  "201 to 500",
  "501 to 1000",
  "1001 to 5000",
  "5001 to 10000",
  "10000+",
] as const

export type DatamoonDocumentedCompanyEmployeeCountBand =
  (typeof DATAMOON_DOCUMENTED_COMPANY_EMPLOYEE_COUNT_BANDS)[number]

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
  companyEmployeeCountBands: string[]
  companyRevenueBands: string[]
  companyDomainValues: string[]
  sourceCompanySizeRanges: string[]
}

const MAX_PRIMARY_INDUSTRY_FILTER_VALUES = 5 as const

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

/** Equipify workbench intent → documented DataMoon employee bands. */
export function translateEquipifyCompanySizeIntentToDatamoonEmployeeBands(
  companySize: AvaDatamoonCompanySize,
): DatamoonDocumentedCompanyEmployeeCountBand[] {
  switch (companySize) {
    case "1-10":
      return ["1 to 10"]
    case "11-50":
      return ["11 to 50"]
    case "51-200":
      return ["51 to 200"]
    case "201-500":
      return ["201 to 500"]
    case "500+":
      return ["501 to 1000", "1001 to 5000", "5001 to 10000", "10000+"]
    case "smb":
    default:
      return ["1 to 10", "11 to 50"]
  }
}

function extractNumericRange(value: string): { min: number; max: number } | null {
  const normalized = value.toLowerCase().replace(/,/g, "")
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

function datamoonEmployeeBandRange(band: DatamoonDocumentedCompanyEmployeeCountBand): {
  min: number
  max: number
} {
  switch (band) {
    case "1 to 10":
      return { min: 1, max: 10 }
    case "11 to 50":
      return { min: 11, max: 50 }
    case "51 to 200":
      return { min: 51, max: 200 }
    case "201 to 500":
      return { min: 201, max: 500 }
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

function bandIncludedInEmployeeRange(
  parsed: { min: number; max: number },
  band: DatamoonDocumentedCompanyEmployeeCountBand,
): boolean {
  const bandRange = datamoonEmployeeBandRange(band)
  const overlapMin = Math.max(parsed.min, bandRange.min)
  const overlapMax = Math.min(parsed.max, bandRange.max)
  if (overlapMax < overlapMin) return false
  if (parsed.min >= 10 && bandRange.max <= 10) return false
  return true
}

/** Map canonical Business Profile company-size range strings → documented DataMoon bands. */
export function translateCompanySizeRangeStringsToDatamoonEmployeeBands(
  ranges: readonly string[],
): DatamoonDocumentedCompanyEmployeeCountBand[] {
  const selected = new Set<DatamoonDocumentedCompanyEmployeeCountBand>()

  for (const entry of ranges) {
    const normalized = entry.trim().toLowerCase()
    if (!normalized || /million|billion|revenue|\$/.test(normalized)) continue

    if (/enterprise|500\+|500 plus/.test(normalized)) {
      for (const band of ["501 to 1000", "1001 to 5000", "5001 to 10000", "10000+"] as const) {
        selected.add(band)
      }
      continue
    }

    const numericRange = extractNumericRange(entry)
    if (numericRange) {
      for (const band of DATAMOON_DOCUMENTED_COMPANY_EMPLOYEE_COUNT_BANDS) {
        if (bandIncludedInEmployeeRange(numericRange, band)) {
          selected.add(band)
        }
      }
      continue
    }

    if (/smb|small|mid/.test(normalized)) {
      selected.add("1 to 10")
      selected.add("11 to 50")
    }
  }

  return DATAMOON_DOCUMENTED_COMPANY_EMPLOYEE_COUNT_BANDS.filter((band) => selected.has(band))
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

function industryAliasesForVerticalIds(
  projection: BusinessProfileLeadDiscoveryProjection,
  verticalIds: readonly string[],
): string[] {
  const idSet = new Set(verticalIds)
  return uniqueStrings(
    projection.supportedServiceVerticals
      .filter((vertical) => idSet.has(vertical.id))
      .flatMap((vertical) => vertical.industryAliases),
  )
}

/** Deterministic subset of SSV aliases aligned with OMT cluster rotation (max 5). */
export function buildPrimaryIndustryFilterValuesFromCanonicalProjection(input: {
  projection: BusinessProfileLeadDiscoveryProjection
  operationalTargeting: DatamoonOperationalTargetingTranslation
}): string[] {
  const selected: string[] = []
  const seen = new Set<string>()

  const add = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    const key = normalizeKey(trimmed)
    if (seen.has(key)) return
    if (selected.length >= MAX_PRIMARY_INDUSTRY_FILTER_VALUES) return
    seen.add(key)
    selected.push(trimmed)
  }

  for (const alias of input.operationalTargeting.industryAliasesUsed) add(alias)

  const clusterAliases = industryAliasesForVerticalIds(
    input.projection,
    input.operationalTargeting.selectedVerticalIds,
  )
  for (const alias of clusterAliases) add(alias)

  for (const alias of input.projection.industryAliases) add(alias)

  return selected
}

export function buildDatamoonFirmographicFilterStrategyMetadata(input: {
  projection: BusinessProfileLeadDiscoveryProjection
  operationalTargeting: DatamoonOperationalTargetingTranslation
  companySizeRanges: readonly string[]
  targetCompanyDomains?: readonly string[]
}): DatamoonFirmographicFilterStrategyMetadata {
  const employeeFromRanges = translateCompanySizeRangeStringsToDatamoonEmployeeBands(input.companySizeRanges)
  const employeeBands =
    employeeFromRanges.length > 0
      ? employeeFromRanges
      : translateEquipifyCompanySizeIntentToDatamoonEmployeeBands(input.projection.companySize)

  return {
    version: DATAMOON_FIRMOGRAPHIC_FILTER_STRATEGY_VERSION,
    primaryIndustryValues: buildPrimaryIndustryFilterValuesFromCanonicalProjection({
      projection: input.projection,
      operationalTargeting: input.operationalTargeting,
    }),
    companyEmployeeCountBands: employeeBands,
    companyRevenueBands: translateRevenueIntentStringsToDatamoonCompanyRevenue(input.companySizeRanges),
    companyDomainValues: uniqueStrings(input.targetCompanyDomains ?? []).slice(0, 5),
    sourceCompanySizeRanges: uniqueStrings(input.companySizeRanges),
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

  if (strategy.primaryIndustryValues.length > 0) {
    filters.push({
      field: "primary_industry",
      operator: "in",
      value: strategy.primaryIndustryValues,
    })
  }

  if (strategy.companyEmployeeCountBands.length > 0) {
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
