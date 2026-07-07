/** GE-AVA-DATAMOON-SOURCING-WORKBENCH-1A — Convert workbench draft → Datamoon import request (client-safe). */

import type { DatamoonAudienceFilter } from "@/lib/growth/providers/datamoon"
import type { DatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
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

function resolvedTopics(draft: AvaDatamoonAudienceDraft): string[] {
  const topics = [...draft.topics]
  const custom = draft.customTopic?.trim()
  if (custom && !topics.includes(custom)) topics.push(custom)
  return topics
}

function resolvedJobTitles(draft: AvaDatamoonAudienceDraft): string[] {
  const titles = [...draft.jobTitles]
  const custom = draft.customJobTitle?.trim()
  if (custom && !titles.includes(custom)) titles.push(custom)
  return titles
}

export function buildDatamoonFiltersFromAudienceDraft(draft: AvaDatamoonAudienceDraft): DatamoonAudienceFilter[] {
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

export function buildDatamoonImportRequestFromAudienceDraft(
  draft: AvaDatamoonAudienceDraft,
): DatamoonAudienceImportRequest {
  const topics = resolvedTopics(draft)
  const draftAudienceType = draft.audienceType
  const requiresTopicIds = draftAudienceType === "b2b" || draftAudienceType === "b2c"
  const audienceType =
    requiresTopicIds && topics.length === 0 ? "advanced_search" : draftAudienceType
  return {
    run_name: draft.audienceName.trim() || "Datamoon audience run",
    audience_type: audienceType,
    provider_mode: draft.providerMode,
    filters: buildDatamoonFiltersFromAudienceDraft(draft),
    topic_ids: audienceType === "b2b" ? topics.slice(0, 5) : undefined,
    limit: draft.recordLimit,
    name: draft.audienceName.trim() || undefined,
  }
}
