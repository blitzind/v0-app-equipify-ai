/** External provider search intent gating — cost/rate-limit safety. Client-safe. */

import type { GrowthProspectSearchDiscoveryMode } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_SEARCH_PROVIDER_INTENT_QA_MARKER =
  "growth-prospect-search-provider-intent-v1" as const

export const PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES = {
  templateApplied: "Template applied. Review filters, then click Search.",
  workflowRestored: "Workflow restored — click Search.",
  filtersUpdated: "Filters updated — click Search.",
  queryPrefilled: "Query updated — click Search.",
} as const

export type ProspectSearchExternalPendingMessageKey = keyof typeof PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES

export type ProspectSearchFetchTrigger =
  | "explicit_operator_search"
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
): string {
  switch (trigger) {
    case "icp_template_selection":
      return PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.templateApplied
    case "saved_workflow_restore":
      return PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.workflowRestored
    case "suggested_query_click":
    case "search_recommendation_select":
      return PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.queryPrefilled
    default:
      return PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.filtersUpdated
  }
}
