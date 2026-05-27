/** Client-safe Saved Search Workflow types (Sprint 4.1). */

import type {
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchSavedSearchRow,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_SAVED_SEARCH_WORKFLOWS_QA_MARKER = "growth-saved-search-workflows-v1" as const

export type GrowthSavedSearchWorkflowMetadata = {
  qa_marker?: typeof GROWTH_SAVED_SEARCH_WORKFLOWS_QA_MARKER
  result_count?: number | null
  previous_result_count?: number | null
  last_refreshed_at?: string | null
  page?: number | null
  page_size?: number | null
  save_pagination?: boolean
  owner_label?: string | null
  discovery_mode?: GrowthProspectSearchDiscoveryMode
}

export type GrowthSavedSearchWorkflowView = {
  resultCount: number | null
  previousResultCount: number | null
  countDelta: number | null
  lastRefreshedAt: string | null
  page: number | null
  pageSize: number | null
  savePagination: boolean
  ownerLabel: string | null
  discoveryMode: GrowthProspectSearchDiscoveryMode
}

export type GrowthProspectSearchSavedSearchWithWorkflow = GrowthProspectSearchSavedSearchRow & {
  workflow: GrowthSavedSearchWorkflowView
}

export function parseSavedSearchWorkflowMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GrowthSavedSearchWorkflowView {
  const raw = (metadata ?? {}) as GrowthSavedSearchWorkflowMetadata
  const resultCount =
    typeof raw.result_count === "number" && Number.isFinite(raw.result_count) ? raw.result_count : null
  const previousResultCount =
    typeof raw.previous_result_count === "number" && Number.isFinite(raw.previous_result_count)
      ? raw.previous_result_count
      : null
  const countDelta =
    resultCount != null && previousResultCount != null ? resultCount - previousResultCount : null

  return {
    resultCount,
    previousResultCount,
    countDelta,
    lastRefreshedAt: typeof raw.last_refreshed_at === "string" ? raw.last_refreshed_at : null,
    page: typeof raw.page === "number" && Number.isFinite(raw.page) ? raw.page : null,
    pageSize: typeof raw.page_size === "number" && Number.isFinite(raw.page_size) ? raw.page_size : null,
    savePagination: raw.save_pagination === true,
    ownerLabel: typeof raw.owner_label === "string" ? raw.owner_label : null,
    discoveryMode: raw.discovery_mode === "discover_external" ? "discover_external" : "internal",
  }
}

export function buildSavedSearchWorkflowMetadata(input: {
  resultCount?: number | null
  previousResultCount?: number | null
  lastRefreshedAt?: string | null
  page?: number | null
  pageSize?: number | null
  savePagination?: boolean
  ownerLabel?: string | null
  discoveryMode?: GrowthProspectSearchDiscoveryMode
}): GrowthSavedSearchWorkflowMetadata {
  return {
    qa_marker: GROWTH_SAVED_SEARCH_WORKFLOWS_QA_MARKER,
    result_count: input.resultCount ?? null,
    previous_result_count: input.previousResultCount ?? null,
    last_refreshed_at: input.lastRefreshedAt ?? null,
    page: input.page ?? null,
    page_size: input.pageSize ?? null,
    save_pagination: input.savePagination === true,
    owner_label: input.ownerLabel ?? null,
    discovery_mode: input.discoveryMode ?? "internal",
  }
}

export function formatSavedSearchCountDelta(delta: number | null): string | null {
  if (delta == null || delta === 0) return null
  return delta > 0 ? `+${delta}` : `${delta}`
}

export function formatSavedSearchRefreshedAt(value: string | null): string {
  if (!value) return "Never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function attachSavedSearchWorkflow(
  row: GrowthProspectSearchSavedSearchRow,
): GrowthProspectSearchSavedSearchWithWorkflow {
  return {
    ...row,
    workflow: parseSavedSearchWorkflowMetadata(row.metadata),
  }
}

export const GROWTH_SAVED_SEARCH_WORKFLOW_LINKS = {
  prospectSearch: "/admin/growth/search",
  leadInbox: "/admin/growth/leads",
  unifiedInbox: "/admin/growth/inbox",
  leadEngine: "/admin/growth/leads/lead-engine",
} as const

export { buildSavedSearchWorkflowLaunchLinks } from "@/lib/growth/prospect-search/prospect-pipeline-automation"
