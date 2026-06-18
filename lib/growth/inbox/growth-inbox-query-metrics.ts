/**
 * Phase 8M — lightweight in-process Growth Inbox query diagnostics (no dashboards).
 */

export const GROWTH_INBOX_QUERY_METRICS_VERSION = "8m.1" as const

export type GrowthInboxQueryMetricsSnapshot = {
  version: typeof GROWTH_INBOX_QUERY_METRICS_VERSION
  compactOperatorInboxRequests: number
  fullOperatorInboxRequests: number
  threadLabelBatchQueries: number
  pollCycles: number
  duplicateThreadRequestsPrevented: number
}

const metrics = {
  compactOperatorInboxRequests: 0,
  fullOperatorInboxRequests: 0,
  threadLabelBatchQueries: 0,
  pollCycles: 0,
  duplicateThreadRequestsPrevented: 0,
}

export function recordGrowthInboxCompactOperatorInboxRequest(): void {
  metrics.compactOperatorInboxRequests += 1
}

export function recordGrowthInboxFullOperatorInboxRequest(): void {
  metrics.fullOperatorInboxRequests += 1
}

export function recordGrowthInboxThreadLabelBatchQuery(): void {
  metrics.threadLabelBatchQueries += 1
}

export function recordGrowthInboxPollCycle(): void {
  metrics.pollCycles += 1
}

export function recordGrowthInboxDuplicateThreadRequestPrevented(): void {
  metrics.duplicateThreadRequestsPrevented += 1
}

export function resetGrowthInboxQueryMetrics(): void {
  metrics.compactOperatorInboxRequests = 0
  metrics.fullOperatorInboxRequests = 0
  metrics.threadLabelBatchQueries = 0
  metrics.pollCycles = 0
  metrics.duplicateThreadRequestsPrevented = 0
}

export function getGrowthInboxQueryMetrics(): GrowthInboxQueryMetricsSnapshot {
  return {
    version: GROWTH_INBOX_QUERY_METRICS_VERSION,
    ...metrics,
  }
}
