/** GE-AVA-DATAMOON-SOURCING-WORKBENCH-1A — Convert workbench draft → Datamoon import request (client-safe). */

import type { DatamoonAudienceFilter } from "@/lib/growth/providers/datamoon"
import type { DatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import { isDatamoonNumericTopicId } from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-topic-resolution-types"
import { DATAMOON_MAX_TOPIC_IDS } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import {
  buildDatamoonAudienceImportWorkbenchContextFromDraft,
  mapDatamoonFiltersToProviderFilters,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-filter-mapping"
import type { AvaDatamoonAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"

function companySizeFilter(size: AvaDatamoonAudienceDraft["companySize"]): DatamoonAudienceFilter | null {
  switch (size) {
    case "smb":
      return { field: "company_size", operator: "in", value: ["1-10", "11-50"] }
    case "1-10":
    case "11-50":
    case "51-200":
    case "201-500":
    case "500+":
      return { field: "company_size", operator: "=", value: size }
    default:
      return null
  }
}

export function normalizeDatamoonTopicIds(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    normalized.push(trimmed)
  }
  return normalized.slice(0, DATAMOON_MAX_TOPIC_IDS)
}

function isTopicIdAudienceType(audienceType: string): audienceType is "b2b" | "b2c" {
  return audienceType === "b2b" || audienceType === "b2c"
}

export function datamoonImportRequestIntendsB2bAudience(input: {
  audience_type?: string
  workbench_context?: DatamoonAudienceImportRequest["workbench_context"]
}): boolean {
  const topicQueries = normalizeDatamoonTopicIds(input.workbench_context?.topics ?? [])
  const intentLevels = input.workbench_context?.intentLevels ?? []
  return topicQueries.length > 0 || intentLevels.length > 0
}

export function resolveDatamoonAudienceTypeForImport(
  draftAudienceType: string,
  topicQueries: readonly string[],
  intentLevels: readonly string[] = [],
): DatamoonAudienceImportRequest["audience_type"] {
  if (topicQueries.length > 0 || intentLevels.length > 0) {
    return "b2b"
  }
  if (draftAudienceType === "b2c") return "b2c"
  return "advanced_search"
}

function resolveExistingNumericTopicIds(topicIds: readonly string[]): string[] {
  return normalizeDatamoonTopicIds(topicIds).filter(isDatamoonNumericTopicId)
}

export function normalizeDatamoonImportRequestAudience(
  request: DatamoonAudienceImportRequest,
): DatamoonAudienceImportRequest {
  const topicQueries = normalizeDatamoonTopicIds(request.workbench_context?.topics ?? [])
  const intentLevels = request.workbench_context?.intentLevels ?? []
  const audienceType = resolveDatamoonAudienceTypeForImport(
    request.audience_type,
    topicQueries,
    intentLevels,
  )
  const existingNumericTopicIds = resolveExistingNumericTopicIds(request.topic_ids ?? [])
  const mappedFilters = mapDatamoonFiltersToProviderFilters(request.filters)

  return {
    ...request,
    audience_type: audienceType,
    topic_ids:
      isTopicIdAudienceType(audienceType) && existingNumericTopicIds.length > 0
        ? existingNumericTopicIds
        : undefined,
    filters: mappedFilters.providerFilters,
    workbench_context: request.workbench_context
      ? {
          ...request.workbench_context,
          topics: topicQueries,
          omittedWorkbenchFilterFields: [
            ...new Set([
              ...(request.workbench_context.omittedWorkbenchFilterFields ?? []),
              ...mappedFilters.omittedWorkbenchFilterFields,
            ]),
          ],
        }
      : mappedFilters.omittedWorkbenchFilterFields.length > 0
        ? { omittedWorkbenchFilterFields: mappedFilters.omittedWorkbenchFilterFields }
        : undefined,
  }
}

export function datamoonImportRequestRequiresTopicIds(request: DatamoonAudienceImportRequest): boolean {
  if (!isTopicIdAudienceType(request.audience_type)) return false
  const numericTopicIds = resolveExistingNumericTopicIds(request.topic_ids ?? [])
  if (numericTopicIds.length > 0) return false
  const pendingQueries = normalizeDatamoonTopicIds(request.workbench_context?.topics ?? [])
  return pendingQueries.length === 0
}

function resolvedTopics(draft: AvaDatamoonAudienceDraft): string[] {
  const topics = normalizeDatamoonTopicIds(draft.topics)
  const custom = draft.customTopic?.trim()
  if (custom && !topics.includes(custom)) topics.push(custom)
  return normalizeDatamoonTopicIds(topics)
}

function resolvedJobTitles(draft: AvaDatamoonAudienceDraft): string[] {
  const titles = [...draft.jobTitles]
  const custom = draft.customJobTitle?.trim()
  if (custom && !titles.includes(custom)) titles.push(custom)
  return titles
}

/** Internal workbench filter vocabulary — not sent to Datamoon directly. */
export function buildDatamoonWorkbenchFiltersFromAudienceDraft(
  draft: AvaDatamoonAudienceDraft,
): DatamoonAudienceFilter[] {
  const filters: DatamoonAudienceFilter[] = []

  if (draft.geography.country.trim()) {
    filters.push({ field: "country", operator: "=", value: draft.geography.country.trim() })
  }
  if (draft.geography.state?.trim()) {
    filters.push({ field: "state", operator: "=", value: draft.geography.state.trim() })
  }
  if (draft.geography.city?.trim()) {
    filters.push({ field: "city", operator: "contains", value: draft.geography.city.trim() })
  }

  filters.push({ field: "lookback_days", operator: "=", value: String(draft.lookbackDays) })

  if (draft.intentLevels.length > 0) {
    filters.push({
      field: "intent_level",
      operator: "in",
      value: draft.intentLevels,
    })
  }

  for (const topic of resolvedTopics(draft)) {
    filters.push({ field: "topic", operator: "contains", value: topic })
  }

  for (const title of resolvedJobTitles(draft)) {
    filters.push({ field: "job_title", operator: "contains", value: title })
  }

  const sizeFilter = companySizeFilter(draft.companySize)
  if (sizeFilter) filters.push(sizeFilter)

  if (draft.revenueRange?.trim()) {
    filters.push({ field: "revenue_range", operator: "contains", value: draft.revenueRange.trim() })
  }

  if (draft.includeBusinessEmail) {
    filters.push({ field: "require_business_email", operator: "=", value: "true" })
  }
  if (draft.includePhone) {
    filters.push({ field: "require_phone", operator: "=", value: "true" })
  }
  if (draft.includeLinkedIn) {
    filters.push({ field: "require_linkedin", operator: "=", value: "true" })
  }
  if (draft.excludeDuplicates) {
    filters.push({ field: "exclude_duplicates", operator: "=", value: "true" })
  }
  if (draft.onlyNewSinceLastRefresh) {
    filters.push({ field: "only_new_since_last_refresh", operator: "=", value: "true" })
  }

  return filters
}

/** Provider-safe filters for Datamoon audience build. */
export function buildDatamoonFiltersFromAudienceDraft(draft: AvaDatamoonAudienceDraft): DatamoonAudienceFilter[] {
  return mapDatamoonFiltersToProviderFilters(buildDatamoonWorkbenchFiltersFromAudienceDraft(draft)).providerFilters
}

export function buildDatamoonImportRequestFromAudienceDraft(
  draft: AvaDatamoonAudienceDraft,
): DatamoonAudienceImportRequest {
  const topicQueries = resolvedTopics(draft)
  const audienceType = resolveDatamoonAudienceTypeForImport(
    draft.audienceType,
    topicQueries,
    draft.intentLevels,
  )
  const workbenchFilters = buildDatamoonWorkbenchFiltersFromAudienceDraft(draft)
  const mappedFilters = mapDatamoonFiltersToProviderFilters(workbenchFilters)
  const request: DatamoonAudienceImportRequest = {
    run_name: draft.audienceName.trim() || "Datamoon audience run",
    audience_type: audienceType,
    provider_mode: draft.providerMode,
    filters: mappedFilters.providerFilters,
    limit: draft.recordLimit,
    name: draft.audienceName.trim() || undefined,
    workbench_context: buildDatamoonAudienceImportWorkbenchContextFromDraft(draft, {
      topics: topicQueries,
      omittedWorkbenchFilterFields: mappedFilters.omittedWorkbenchFilterFields,
    }),
  }
  return normalizeDatamoonImportRequestAudience(request)
}
