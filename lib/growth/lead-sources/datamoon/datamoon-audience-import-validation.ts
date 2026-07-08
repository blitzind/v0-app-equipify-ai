/** GE-DATAMOON-1B — Audience import request validation. Client-safe. */

import {
  DATAMOON_MAX_TOPIC_IDS,
  type DatamoonAudienceImportRequest,
  type DatamoonAudienceImportValidationIssue,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import {
  formatDatamoonProviderFilterFieldAllowlistMessage,
  isDatamoonProviderSupportedFilterField,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-filter-mapping"

export function validateDatamoonAudienceImportRequest(
  input: DatamoonAudienceImportRequest,
): { ok: true } | { ok: false; issues: DatamoonAudienceImportValidationIssue[] } {
  const issues: DatamoonAudienceImportValidationIssue[] = []

  if (!input.run_name?.trim()) {
    issues.push({ code: "run_name_required", field: "run_name", message: "Run name is required." })
  }

  if (!["advanced_search", "b2b", "b2c"].includes(input.audience_type)) {
    issues.push({
      code: "invalid_audience_type",
      field: "audience_type",
      message: "Audience type must be advanced_search, b2b, or b2c.",
    })
  }

  if (!Array.isArray(input.filters)) {
    issues.push({ code: "filters_required", field: "filters", message: "Filters must be an array." })
  } else {
    input.filters.forEach((filter, index) => {
      if (!isDatamoonProviderSupportedFilterField(filter.field)) {
        issues.push({
          code: "unsupported_provider_filter_field",
          field: `filters.${index}.field`,
          message: `Datamoon filter field '${filter.field}' is not supported. Supported provider filter fields: ${formatDatamoonProviderFilterFieldAllowlistMessage()}.`,
        })
      }
    })
  }

  const topicIds = input.topic_ids ?? []
  if (topicIds.length > DATAMOON_MAX_TOPIC_IDS) {
    issues.push({
      code: "topic_ids_max_exceeded",
      field: "topic_ids",
      message: `At most ${DATAMOON_MAX_TOPIC_IDS} topic_ids are allowed.`,
    })
  }

  if ((input.audience_type === "b2b" || input.audience_type === "b2c") && topicIds.length === 0) {
    issues.push({
      code: "topic_ids_required",
      field: "topic_ids",
      message: "b2b and b2c audiences require at least one topic_id.",
    })
  }

  if (input.limit != null && (!Number.isFinite(input.limit) || input.limit < 1 || input.limit > 1_000_000)) {
    issues.push({
      code: "invalid_limit",
      field: "limit",
      message: "Limit must be between 1 and 1,000,000.",
    })
  }

  if (input.provider_mode && input.provider_mode !== "ext" && input.provider_mode !== "module") {
    issues.push({
      code: "invalid_provider_mode",
      field: "provider_mode",
      message: "Provider mode must be ext or module.",
    })
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true }
}
