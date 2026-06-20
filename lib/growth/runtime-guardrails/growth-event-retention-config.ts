/** GS-RG-1 — event retention policy helpers (client-safe). */

export type GrowthEventRetentionFamily =
  | "share_page_events"
  | "video_page_events"
  | "media_asset_events"
  | "intent_events"
  | "notification_events"

export type GrowthEventRetentionPolicy = {
  eventFamily: GrowthEventRetentionFamily
  retentionDays: number
  rollupRetentionDays: number
  enabled: boolean
}

export const GROWTH_DEFAULT_EVENT_RETENTION_POLICIES: GrowthEventRetentionPolicy[] = [
  { eventFamily: "share_page_events", retentionDays: 90, rollupRetentionDays: -1, enabled: true },
  { eventFamily: "video_page_events", retentionDays: 90, rollupRetentionDays: -1, enabled: true },
  { eventFamily: "media_asset_events", retentionDays: 90, rollupRetentionDays: -1, enabled: true },
  { eventFamily: "intent_events", retentionDays: 90, rollupRetentionDays: -1, enabled: true },
  { eventFamily: "notification_events", retentionDays: 90, rollupRetentionDays: -1, enabled: true },
]

export function computeRetentionCutoff(retentionDays: number, now = Date.now()): string {
  const cutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000)
  return cutoff.toISOString()
}

export function isRollupIndefinite(rollupRetentionDays: number): boolean {
  return rollupRetentionDays < 0
}

/** Local certification helper — estimate batches/duration without DB. */
export function estimateRetentionWorkerLoad(
  pendingRows: number,
  batchSize = 1000,
): {
  batchesPerFamilyRun: number
  writesPerBatch: number
  estimatedDurationMsPerBatch: number
  estimatedTotalDurationMs: number
} {
  const batchesPerFamilyRun = Math.ceil(pendingRows / batchSize)
  const writesPerBatch = batchSize + 2
  const estimatedDurationMsPerBatch = 250
  return {
    batchesPerFamilyRun,
    writesPerBatch,
    estimatedDurationMsPerBatch,
    estimatedTotalDurationMs: batchesPerFamilyRun * estimatedDurationMsPerBatch,
  }
}

export const GROWTH_EVENT_RETENTION_TABLE_MAP: Record<
  GrowthEventRetentionFamily,
  { table: string; timestampColumn: string }
> = {
  share_page_events: { table: "share_page_events", timestampColumn: "created_at" },
  video_page_events: { table: "video_page_events", timestampColumn: "created_at" },
  media_asset_events: { table: "media_asset_events", timestampColumn: "created_at" },
  intent_events: { table: "intent_pageview_events", timestampColumn: "created_at" },
  notification_events: { table: "operator_notifications", timestampColumn: "created_at" },
}

/** Tables that must never be deleted by retention worker. */
export const GROWTH_RETENTION_PROTECTED_TABLES = [
  "media_asset_event_rollups",
  "video_page_rollups",
  "share_page_analytics_snapshots",
] as const
