/** External provider search intent gating — cost/rate-limit safety. Client-safe. */

import type { GrowthProspectSearchDiscoveryMode } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_SEARCH_PROVIDER_INTENT_QA_MARKER =
  "growth-prospect-search-provider-intent-v1" as const

export const PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES = {
  templateApplied: "Template applied. Review filters, then click Search.",
  templateAppliedDiscover: "Template applied. Review filters, then click Search market.",
  workflowRestored: "Workflow restored — click Search.",
  workflowRestoredDiscover: "Workflow restored — click Search market.",
  filtersUpdated: "Filters updated — click Search.",
  filtersUpdatedDiscover: "Filters updated — click Search market.",
  queryPrefilled: "Query updated — click Search.",
  queryPrefilledDiscover: "Query updated — click Search market.",
} as const

export type ProspectSearchExternalPendingMessageKey = keyof typeof PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES

export type ProspectSearchFetchTrigger =
  | "explicit_operator_search"
  | "filters_updated"
  | "icp_template_selection"
  | "saved_workflow_restore"
  | "suggested_query_click"
  | "search_recommendation_select"
  | "post_action_refresh"
  | "pagination"
  | "sort_change"

export function shouldFetchProspectSearchResults(input: {
  discoveryMode: GrowthProspectSearchDiscoveryMode
  trigger: ProspectSearchFetchTrigger
}): boolean {
  if (input.discoveryMode !== "discover_external") return true
  return input.trigger === "explicit_operator_search"
}

export function resolveProspectSearchExternalPendingMessage(
  trigger: Exclude<
    ProspectSearchFetchTrigger,
    "explicit_operator_search" | "pagination" | "sort_change" | "post_action_refresh"
  >,
  discoveryMode: GrowthProspectSearchDiscoveryMode = "internal",
): string {
  const discover = discoveryMode === "discover_external"
  switch (trigger) {
    case "icp_template_selection":
      return discover
        ? PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.templateAppliedDiscover
        : PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.templateApplied
    case "saved_workflow_restore":
      return discover
        ? PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.workflowRestoredDiscover
        : PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.workflowRestored
    case "filters_updated":
      return discover
        ? PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.filtersUpdatedDiscover
        : PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.filtersUpdated
    case "suggested_query_click":
    case "search_recommendation_select":
      return discover
        ? PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.queryPrefilledDiscover
        : PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.queryPrefilled
    default:
      return discover
        ? PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.filtersUpdatedDiscover
        : PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.filtersUpdated
  }
}
