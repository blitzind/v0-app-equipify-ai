/** GS-GROWTH-OPS-7A.1 — Workspace URL state helpers (client-safe). */

import type { GrowthActivityFilterId } from "@/lib/growth/activity/growth-activity-workspace-types"
import type { GrowthActivityRailQueueId } from "@/lib/growth/activity/growth-activity-workspace-types"
import { GROWTH_ACTIVITY_FILTER_OPTIONS } from "@/lib/growth/activity/growth-activity-workspace-constants"
import { GROWTH_WORKSPACE_CANONICAL_ALIASES } from "@/lib/growth/navigation/growth-workspace-cleanup-audit"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { resolveGrowthLeadIdFromSearchParams } from "@/lib/growth/navigation/growth-workspace-operator-links"
import type { GrowthSendrAnalyticsDateRangePreset } from "@/lib/growth/sendr/growth-sendr-types"

export const GROWTH_OPS_URL_STATE_7A1_QA_MARKER = "growth-ops-url-state-7a1-v1" as const

export const GROWTH_INBOX_THREAD_URL_PARAM = "threadId" as const
export const GROWTH_MEETINGS_MEETING_URL_PARAM = "meetingId" as const
export const GROWTH_OPPORTUNITY_ID_URL_PARAM = "opportunityId" as const
export const GROWTH_ACTIVITY_FILTER_URL_PARAM = "filter" as const
export const GROWTH_ACTIVITY_SEARCH_URL_PARAM = "search" as const
export const GROWTH_ACTIVITY_RANGE_URL_PARAM = "range" as const
export const GROWTH_ACTIVITY_RAIL_URL_PARAM = "rail" as const

const ACTIVITY_FILTER_IDS = new Set(GROWTH_ACTIVITY_FILTER_OPTIONS.map((option) => option.id))
const ACTIVITY_RAIL_IDS = new Set([
  "needs-attention",
  "hot-prospects",
  "meetings-ready",
  "stalled-opportunities",
] as const)

const ACTIVITY_RANGE_PRESETS = new Set<GrowthSendrAnalyticsDateRangePreset>([
  "today",
  "last_7_days",
  "last_30_days",
])

export function buildGrowthInboxThreadHref(input: {
  threadId: string
  leadId?: string | null
  view?: string | null
  preserve?: URLSearchParams | { toString(): string } | null
}): string {
  const params = new URLSearchParams(input.preserve?.toString() ?? "")
  params.set(GROWTH_INBOX_THREAD_URL_PARAM, input.threadId)
  if (input.leadId) params.set("leadId", input.leadId)
  if (input.view) params.set("view", input.view)
  return `${GROWTH_WORKSPACE_CANONICAL_ALIASES.inbox}?${params.toString()}`
}

export function resolveGrowthInboxThreadIdFromSearchParams(input: {
  get(name: string): string | null
}): string | null {
  return input.get(GROWTH_INBOX_THREAD_URL_PARAM)
}

export function buildGrowthMeetingsWorkspaceHref(input?: {
  meetingId?: string | null
  leadId?: string | null
  preserve?: URLSearchParams | { toString(): string } | null
}): string {
  const params = new URLSearchParams(input?.preserve?.toString() ?? "")
  if (input?.meetingId) params.set(GROWTH_MEETINGS_MEETING_URL_PARAM, input.meetingId)
  if (input?.leadId) params.set("leadId", input.leadId)
  const query = params.toString()
  return query
    ? `${GROWTH_WORKSPACE_BASE_PATH}/meetings?${query}`
    : `${GROWTH_WORKSPACE_BASE_PATH}/meetings`
}

export function resolveGrowthMeetingIdFromSearchParams(input: {
  get(name: string): string | null
}): string | null {
  return input.get(GROWTH_MEETINGS_MEETING_URL_PARAM) ?? input.get("highlight")
}

export function buildGrowthOpportunityPipelineHref(input?: {
  opportunityId?: string | null
  leadId?: string | null
  preserve?: URLSearchParams | { toString(): string } | null
}): string {
  const params = new URLSearchParams(input?.preserve?.toString() ?? "")
  if (input?.opportunityId) params.set(GROWTH_OPPORTUNITY_ID_URL_PARAM, input.opportunityId)
  if (input?.leadId) params.set("leadId", input.leadId)
  const query = params.toString()
  return query
    ? `${GROWTH_WORKSPACE_CANONICAL_ALIASES.pipeline}?${query}`
    : GROWTH_WORKSPACE_CANONICAL_ALIASES.pipeline
}

export function resolveGrowthOpportunityIdFromSearchParams(input: {
  get(name: string): string | null
}): string | null {
  return input.get(GROWTH_OPPORTUNITY_ID_URL_PARAM)
}

export function parseGrowthActivityFilterFromUrl(value: string | null): GrowthActivityFilterId {
  if (value && ACTIVITY_FILTER_IDS.has(value as GrowthActivityFilterId)) {
    return value as GrowthActivityFilterId
  }
  return "all"
}

export function parseGrowthActivityRangeFromUrl(
  value: string | null,
  fallback: GrowthSendrAnalyticsDateRangePreset = "last_7_days",
): GrowthSendrAnalyticsDateRangePreset {
  if (value && ACTIVITY_RANGE_PRESETS.has(value as GrowthSendrAnalyticsDateRangePreset)) {
    return value as GrowthSendrAnalyticsDateRangePreset
  }
  return fallback
}

export function parseGrowthActivityRailFromUrl(value: string | null): GrowthActivityRailQueueId | null {
  if (value && ACTIVITY_RAIL_IDS.has(value as GrowthActivityRailQueueId)) {
    return value as GrowthActivityRailQueueId
  }
  return null
}

export function buildGrowthActivityWorkspaceHref(input?: {
  filter?: GrowthActivityFilterId | null
  search?: string | null
  range?: GrowthSendrAnalyticsDateRangePreset | null
  rail?: GrowthActivityRailQueueId | null
  preserve?: URLSearchParams | { toString(): string } | null
}): string {
  const params = new URLSearchParams(input?.preserve?.toString() ?? "")
  if (input?.filter && input.filter !== "all") {
    params.set(GROWTH_ACTIVITY_FILTER_URL_PARAM, input.filter)
  } else {
    params.delete(GROWTH_ACTIVITY_FILTER_URL_PARAM)
  }
  if (input?.search?.trim()) {
    params.set(GROWTH_ACTIVITY_SEARCH_URL_PARAM, input.search.trim())
  } else {
    params.delete(GROWTH_ACTIVITY_SEARCH_URL_PARAM)
  }
  if (input?.range && input.range !== "last_7_days") {
    params.set(GROWTH_ACTIVITY_RANGE_URL_PARAM, input.range)
  } else {
    params.delete(GROWTH_ACTIVITY_RANGE_URL_PARAM)
  }
  if (input?.rail) {
    params.set(GROWTH_ACTIVITY_RAIL_URL_PARAM, input.rail)
  } else {
    params.delete(GROWTH_ACTIVITY_RAIL_URL_PARAM)
  }
  const query = params.toString()
  return query ? `${GROWTH_WORKSPACE_BASE_PATH}/activity?${query}` : `${GROWTH_WORKSPACE_BASE_PATH}/activity`
}

export function readGrowthActivityUrlState(input: { get(name: string): string | null }): {
  filterId: GrowthActivityFilterId
  search: string
  range: GrowthSendrAnalyticsDateRangePreset
  railQueue: GrowthActivityRailQueueId | null
} {
  return {
    filterId: parseGrowthActivityFilterFromUrl(input.get(GROWTH_ACTIVITY_FILTER_URL_PARAM)),
    search: input.get(GROWTH_ACTIVITY_SEARCH_URL_PARAM) ?? "",
    range: parseGrowthActivityRangeFromUrl(input.get(GROWTH_ACTIVITY_RANGE_URL_PARAM)),
    railQueue: parseGrowthActivityRailFromUrl(input.get(GROWTH_ACTIVITY_RAIL_URL_PARAM)),
  }
}

export function resolveGrowthMeetingsLeadIdFromSearchParams(input: {
  get(name: string): string | null
}): string | null {
  return resolveGrowthLeadIdFromSearchParams(input)
}

export function selectNewestGrowthMeetingForLead<T extends { id: string; leadId: string; startAt: string | null }>(
  items: T[],
  leadId: string,
): T | null {
  const matches = items.filter((item) => item.leadId === leadId)
  if (matches.length === 0) return null
  return [...matches].sort((left, right) => {
    const leftTime = Date.parse(left.startAt ?? "") || 0
    const rightTime = Date.parse(right.startAt ?? "") || 0
    return rightTime - leftTime
  })[0] ?? null
}

export function selectNewestGrowthOpportunityForLead<T extends { id: string; leadId: string; updatedAt: string }>(
  items: T[],
  leadId: string,
): T | null {
  const matches = items.filter((item) => item.leadId === leadId)
  if (matches.length === 0) return null
  return [...matches].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null
}
