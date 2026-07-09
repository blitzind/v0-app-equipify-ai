/**
 * GE-AIOS-15F — Client-safe keyset cursor helpers for Home lead pool pagination.
 */

import {
  GROWTH_HOME_LEAD_POOL_BATCH_LIMIT,
  GROWTH_HOME_WORKLOAD_SCALE_15F_QA_MARKER,
} from "@/lib/growth/relationship/relationship-scale-limits"

export type GrowthHomeLeadPoolCursorPayload = {
  ca: string
  id: string
}

export type GrowthHomeLeadPoolSummary = {
  qaMarker: typeof GROWTH_HOME_WORKLOAD_SCALE_15F_QA_MARKER
  visible_count: number
  total_estimated_count: number | null
  has_more: boolean
  next_cursor: string | null
  relationship_snapshot_count: number
  degraded: boolean
  page_limit: number
}

export function encodeGrowthHomeLeadPoolCursor(input: GrowthHomeLeadPoolCursorPayload): string {
  return Buffer.from(JSON.stringify({ ca: input.ca, id: input.id }), "utf8").toString("base64url")
}

export function parseGrowthHomeLeadPoolCursor(
  cursor: string | null | undefined,
): GrowthHomeLeadPoolCursorPayload | null {
  if (!cursor?.trim()) return null
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      ca?: string
      id?: string
    }
    const ca = typeof parsed.ca === "string" ? parsed.ca.trim() : ""
    const id = typeof parsed.id === "string" ? parsed.id.trim() : ""
    if (!ca || !id) return null
    return { ca, id }
  } catch {
    return null
  }
}

export function buildGrowthHomeLeadPoolSummary(input: {
  visibleLeads: Array<{ id: string; createdAt: string }>
  totalEstimatedCount: number | null
  pageLimit?: number
  relationshipSnapshotCount: number
  degraded?: boolean
  fetchedHasMore?: boolean
}): GrowthHomeLeadPoolSummary {
  const page_limit = input.pageLimit ?? GROWTH_HOME_LEAD_POOL_BATCH_LIMIT
  const visible_count = input.visibleLeads.length
  const last = input.visibleLeads.at(-1) ?? null
  const fetchedHasMore = input.fetchedHasMore === true
  const totalHasMore =
    input.totalEstimatedCount != null ? input.totalEstimatedCount > visible_count : fetchedHasMore
  const has_more = fetchedHasMore || totalHasMore
  const next_cursor =
    has_more && last
      ? encodeGrowthHomeLeadPoolCursor({ ca: last.createdAt, id: last.id })
      : null

  return {
    qaMarker: GROWTH_HOME_WORKLOAD_SCALE_15F_QA_MARKER,
    visible_count,
    total_estimated_count: input.totalEstimatedCount,
    has_more,
    next_cursor,
    relationship_snapshot_count: input.relationshipSnapshotCount,
    degraded: input.degraded === true,
    page_limit,
  }
}

export function buildSalesWorkloadScaleAcknowledgment(input: {
  has_more: boolean
  visible_count: number
  total_estimated_count: number | null
}): string | null {
  if (!input.has_more) return null
  if (input.total_estimated_count != null && input.total_estimated_count > input.visible_count) {
    return `Planning from the first ${input.visible_count} relationships; ~${input.total_estimated_count} total in pipeline.`
  }
  return `Planning from the first ${input.visible_count} relationships; more exist beyond this page.`
}
