/** Queue throughput metrics — client-safe (Phase 13 audit). */

import { APOLLO_OPERATOR_QUEUE_STAGE_LABELS } from "@/lib/growth/apollo/apollo-operator-queue-mapper"
import type {
  ApolloOperatorQueueItem,
  ApolloOperatorQueueStage,
  ApolloOperatorQueueThroughput,
} from "@/lib/growth/apollo/apollo-operator-scale-types"

const MS_PER_HOUR = 3600000
const MS_PER_DAY = 86400000

function pct(count: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((count / total) * 1000) / 10
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "unknown"
  return d.toISOString().slice(0, 10)
}

function queueAgeHours(item: ApolloOperatorQueueItem, nowMs: number): number | null {
  const created = Date.parse(item.created_at)
  if (!Number.isFinite(created)) return null
  const end = item.resolved_at ? Date.parse(item.resolved_at) : nowMs
  if (!Number.isFinite(end)) return null
  return Math.max(0, (end - created) / MS_PER_HOUR)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

export function buildApolloOperatorQueueThroughput(
  items: ApolloOperatorQueueItem[],
  stage: ApolloOperatorQueueStage,
  now?: string,
): ApolloOperatorQueueThroughput {
  const stageItems = items.filter((item) => item.stage === stage)
  const nowMs = Date.parse(now ?? new Date().toISOString())
  const createdByDay = new Map<string, number>()
  const approvedByDay = new Map<string, number>()
  const rejectedByDay = new Map<string, number>()
  const regeneratedByDay = new Map<string, number>()

  const ages: number[] = []
  let maxAge: number | null = null

  for (const item of stageItems) {
    const key = dayKey(item.created_at)
    createdByDay.set(key, (createdByDay.get(key) ?? 0) + 1)

    const age = queueAgeHours(item, nowMs)
    if (age != null) {
      ages.push(age)
      if (maxAge == null || age > maxAge) maxAge = age
    }

    const resolvedKey = item.resolved_at ? dayKey(item.resolved_at) : key
    if (item.outcome === "approved") approvedByDay.set(resolvedKey, (approvedByDay.get(resolvedKey) ?? 0) + 1)
    if (item.outcome === "rejected") rejectedByDay.set(resolvedKey, (rejectedByDay.get(resolvedKey) ?? 0) + 1)
    if (item.outcome === "regenerated") regeneratedByDay.set(resolvedKey, (regeneratedByDay.get(resolvedKey) ?? 0) + 1)
  }

  const dayCount = Math.max(1, createdByDay.size)
  const avg = (map: Map<string, number>) =>
    [...map.values()].reduce((sum, v) => sum + v, 0) / dayCount

  const avgAge = ages.length > 0 ? ages.reduce((s, v) => s + v, 0) / ages.length : null

  return {
    stage,
    label: APOLLO_OPERATOR_QUEUE_STAGE_LABELS[stage],
    items_created_per_day: Math.round(avg(createdByDay) * 10) / 10,
    items_approved_per_day: Math.round(avg(approvedByDay) * 10) / 10,
    items_rejected_per_day: Math.round(avg(rejectedByDay) * 10) / 10,
    items_regenerated_per_day: Math.round(avg(regeneratedByDay) * 10) / 10,
    average_time_in_queue_hours: avgAge != null ? Math.round(avgAge * 10) / 10 : null,
    median_time_in_queue_hours:
      median(ages) != null ? Math.round(median(ages)! * 10) / 10 : null,
    max_queue_age_hours: maxAge != null ? Math.round(maxAge * 10) / 10 : null,
    pending_count: stageItems.filter((i) => i.outcome === "pending").length,
  }
}

export function buildApolloOperatorThroughputReport(
  items: ApolloOperatorQueueItem[],
  now?: string,
): ApolloOperatorQueueThroughput[] {
  const stages: ApolloOperatorQueueStage[] = [
    "enrollment",
    "account_playbook",
    "voice_drop",
    "multichannel",
    "sequence_execution",
    "safe_execution",
  ]
  return stages.map((stage) => buildApolloOperatorQueueThroughput(items, stage, now))
}

export { pct as operatorThroughputPct }
