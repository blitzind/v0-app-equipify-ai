/** GE-DATAMOON-FILTER-MAPPING-FIX-1 — Workbench → Datamoon provider filter mapping (client-safe). */

import type { DatamoonAudienceFilter } from "@/lib/growth/providers/datamoon"
import { DATAMOON_EXT_OUTPUT_FIELDS } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import { DATAMOON_PROVIDER_FIRMOGRAPHIC_FILTER_FIELDS } from "@/lib/growth/lead-sources/datamoon/datamoon-firmographic-filter-mapping-1a"
import type { DatamoonResolvedB2bTopic } from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-topic-resolution-types"
import type { AvaDatamoonAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"

export {
  DATAMOON_PROVIDER_FIRMOGRAPHIC_FILTER_FIELDS,
  type DatamoonProviderFirmographicFilterField,
} from "@/lib/growth/lead-sources/datamoon/datamoon-firmographic-filter-mapping-1a"

export const GROWTH_DATAMOON_FILTER_MAPPING_FIX_1_QA_MARKER =
  "ge-datamoon-filter-mapping-fix-1-v1" as const

/** 422 fixture in GE-DATAMOON-1A — partial provider allowlist sample. */
export const DATAMOON_PROVIDER_FILTER_FIELDS_FROM_422_FIXTURE = [
  "first_name",
  "last_name",
  "personal_emails",
] as const

/** Filter fields used in GE-DATAMOON-1A/1B certification buildAudience examples. */
export const DATAMOON_PROVIDER_FILTER_FIELDS_FROM_CERT_EXAMPLES = ["job_title", "company_name"] as const

/** Geography/contact fields from DATAMOON_EXT_OUTPUT_FIELDS referenced by the record normalizer. */
export const DATAMOON_PROVIDER_GEOGRAPHY_FILTER_FIELDS = [
  "contact_country",
  "personal_state",
  "personal_city",
] as const

export const DATAMOON_PROVIDER_B2B_INTENT_FILTER_FIELDS = ["score_category", "event_date"] as const

export const DATAMOON_PROVIDER_SUPPORTED_FILTER_FIELDS = [
  ...DATAMOON_PROVIDER_GEOGRAPHY_FILTER_FIELDS,
  ...DATAMOON_PROVIDER_FILTER_FIELDS_FROM_CERT_EXAMPLES,
  ...DATAMOON_PROVIDER_FILTER_FIELDS_FROM_422_FIXTURE,
  ...DATAMOON_PROVIDER_B2B_INTENT_FILTER_FIELDS,
  ...DATAMOON_PROVIDER_FIRMOGRAPHIC_FILTER_FIELDS,
] as const

export type DatamoonProviderSupportedFilterField = (typeof DATAMOON_PROVIDER_SUPPORTED_FILTER_FIELDS)[number]

/** Confirmed workbench/internal filter.field → provider filter.field mappings only. */
export const DATAMOON_WORKBENCH_TO_PROVIDER_FILTER_FIELD_MAP = {
  country: "contact_country",
  state: "personal_state",
  city: "personal_city",
  job_title: "job_title",
} as const satisfies Record<string, DatamoonProviderSupportedFilterField>

export type DatamoonWorkbenchFilterField = keyof typeof DATAMOON_WORKBENCH_TO_PROVIDER_FILTER_FIELD_MAP

export type DatamoonAudienceImportWorkbenchContext = {
  lookbackDays?: number
  intentLevels?: string[]
  topics?: string[]
  supplementalTopicSearchQueries?: string[]
  clusterBroadeningAnchors?: string[]
  broadenedTopicSearchQueries?: string[]
  resolvedB2bTopics?: DatamoonResolvedB2bTopic[]
  companySize?: string
  revenueRange?: string | null
  includeBusinessEmail?: boolean
  includePhone?: boolean
  includeLinkedIn?: boolean
  excludeDuplicates?: boolean
  onlyNewSinceLastRefresh?: boolean
  omittedWorkbenchFilterFields?: string[]
}

export const DATAMOON_B2B_EVENT_DATE_MAX_LOOKBACK_DAYS = 14 as const

export function resolveDatamoonB2bEventDateFromLookbackDays(lookbackDays: number): string {
  const capped = Math.min(Math.max(Math.trunc(lookbackDays), 1), DATAMOON_B2B_EVENT_DATE_MAX_LOOKBACK_DAYS)
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - capped)
  return date.toISOString().slice(0, 10)
}

export function appendDatamoonB2bIntentFiltersFromWorkbenchContext(
  filters: readonly DatamoonAudienceFilter[],
  context?: DatamoonAudienceImportWorkbenchContext,
): DatamoonAudienceFilter[] {
  const output = [...filters]
  const intentLevels = context?.intentLevels?.filter((level) => level.trim().length > 0) ?? []
  if (intentLevels.length > 0) {
    output.push({ field: "score_category", operator: "in", value: intentLevels })
  }
  if (context?.lookbackDays != null && context.lookbackDays > 0) {
    output.push({
      field: "event_date",
      operator: ">=",
      value: resolveDatamoonB2bEventDateFromLookbackDays(context.lookbackDays),
    })
  }
  return output
}

export type MapDatamoonFiltersToProviderFiltersResult = {
  providerFilters: DatamoonAudienceFilter[]
  omittedWorkbenchFilterFields: string[]
}

const SUPPORTED_FILTER_FIELD_SET = new Set<string>(DATAMOON_PROVIDER_SUPPORTED_FILTER_FIELDS)

export function isDatamoonProviderSupportedFilterField(field: string): field is DatamoonProviderSupportedFilterField {
  return SUPPORTED_FILTER_FIELD_SET.has(field)
}

export function listDatamoonProviderSupportedFilterFields(): readonly DatamoonProviderSupportedFilterField[] {
  return DATAMOON_PROVIDER_SUPPORTED_FILTER_FIELDS
}

export function mapDatamoonWorkbenchFilterToProviderFilter(
  filter: DatamoonAudienceFilter,
): DatamoonAudienceFilter | null {
  const mappedField =
    DATAMOON_WORKBENCH_TO_PROVIDER_FILTER_FIELD_MAP[
      filter.field as DatamoonWorkbenchFilterField
    ] ?? (isDatamoonProviderSupportedFilterField(filter.field) ? filter.field : null)

  if (!mappedField) return null
  return { ...filter, field: mappedField }
}

function readFilterStringValues(value: DatamoonAudienceFilter["value"]): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? [trimmed] : []
  }
  return []
}

/** Repeated same-field filters are ANDed by Datamoon — merge job_title to one OR-compatible `in` filter. */
export function consolidateDatamoonProviderFiltersForOrSemantics(
  filters: readonly DatamoonAudienceFilter[],
): DatamoonAudienceFilter[] {
  const output: DatamoonAudienceFilter[] = []
  const jobTitleValues: string[] = []

  for (const filter of filters) {
    if (
      filter.field === "job_title" &&
      (filter.operator === "contains" || filter.operator === "in" || filter.operator === "=")
    ) {
      for (const value of readFilterStringValues(filter.value)) {
        if (!jobTitleValues.includes(value)) jobTitleValues.push(value)
      }
      continue
    }
    output.push(filter)
  }

  if (jobTitleValues.length > 0) {
    output.push({
      field: "job_title",
      operator: "in",
      value: jobTitleValues,
    })
  }

  return output
}

export function mapDatamoonFiltersToProviderFilters(
  filters: readonly DatamoonAudienceFilter[],
): MapDatamoonFiltersToProviderFiltersResult {
  const providerFilters: DatamoonAudienceFilter[] = []
  const omittedWorkbenchFilterFields: string[] = []

  for (const filter of filters) {
    const mapped = mapDatamoonWorkbenchFilterToProviderFilter(filter)
    if (mapped) {
      providerFilters.push(mapped)
      continue
    }
    if (!omittedWorkbenchFilterFields.includes(filter.field)) {
      omittedWorkbenchFilterFields.push(filter.field)
    }
  }

  return {
    providerFilters: consolidateDatamoonProviderFiltersForOrSemantics(providerFilters),
    omittedWorkbenchFilterFields,
  }
}

export function resolveDatamoonProviderFiltersForImport(
  request: { filters: DatamoonAudienceFilter[] },
): DatamoonAudienceFilter[] {
  return mapDatamoonFiltersToProviderFilters(request.filters).providerFilters
}

export function buildDatamoonAudienceImportWorkbenchContextFromDraft(
  draft: AvaDatamoonAudienceDraft,
  input?: { omittedWorkbenchFilterFields?: string[]; topics?: string[] },
): DatamoonAudienceImportWorkbenchContext {
  return {
    lookbackDays: draft.lookbackDays,
    intentLevels: [...draft.intentLevels],
    topics: input?.topics ?? [],
    companySize: draft.companySize,
    revenueRange: draft.revenueRange,
    includeBusinessEmail: draft.includeBusinessEmail,
    includePhone: draft.includePhone,
    includeLinkedIn: draft.includeLinkedIn,
    excludeDuplicates: draft.excludeDuplicates,
    onlyNewSinceLastRefresh: draft.onlyNewSinceLastRefresh,
    omittedWorkbenchFilterFields: input?.omittedWorkbenchFilterFields,
  }
}

export function formatDatamoonProviderFilterFieldAllowlistMessage(): string {
  return DATAMOON_PROVIDER_SUPPORTED_FILTER_FIELDS.join(", ")
}

export function formatDatamoonAllowedFieldsMismatchMessage(input: {
  validationErrors?: Record<string, string[]> | null
  allowedFields?: string[] | null
}): string {
  const fieldErrors = Object.entries(input.validationErrors ?? {}).filter(([key]) =>
    key.includes(".field"),
  )
  const invalidFields = fieldErrors
    .map(([key]) => key.match(/filters\.(\d+)\.field/)?.[1])
    .filter((index): index is string => Boolean(index))

  const allowed =
    input.allowedFields && input.allowedFields.length > 0
      ? input.allowedFields.join(", ")
      : formatDatamoonProviderFilterFieldAllowlistMessage()

  if (invalidFields.length > 0) {
    return `Datamoon rejected filter field(s) at index ${invalidFields.join(", ")}. Supported provider filter fields: ${allowed}.`
  }

  const firstError = fieldErrors[0]?.[1]?.[0]
  if (firstError) {
    return `${firstError} Supported provider filter fields: ${allowed}.`
  }

  return `Datamoon filter validation failed. Supported provider filter fields: ${allowed}.`
}

/** Repo cross-reference: output fields that are not promoted to filter allowlist without cert evidence. */
export function listDatamoonExtOutputFieldsExcludedFromFilterAllowlist(): string[] {
  const allowed = new Set<string>(DATAMOON_PROVIDER_SUPPORTED_FILTER_FIELDS)
  return DATAMOON_EXT_OUTPUT_FIELDS.filter((field) => !allowed.has(field))
}
