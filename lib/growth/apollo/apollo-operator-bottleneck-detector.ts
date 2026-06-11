/** Bottleneck detection — client-safe (Phase 13C). */

import { APOLLO_OPERATOR_QUEUE_STAGE_LABELS } from "@/lib/growth/apollo/apollo-operator-queue-mapper"
import type {
  ApolloOperatorBottleneckItem,
  ApolloOperatorBottleneckReport,
  ApolloOperatorQueueItem,
  ApolloOperatorQueueStage,
} from "@/lib/growth/apollo/apollo-operator-scale-types"

const MS_PER_HOUR = 3600000
const STALLED_HOURS = 48

function ageHours(createdAt: string, nowMs: number): number {
  const created = Date.parse(createdAt)
  if (!Number.isFinite(created)) return 0
  return Math.max(0, (nowMs - created) / MS_PER_HOUR)
}

export function detectApolloOperatorBottlenecks(
  items: ApolloOperatorQueueItem[],
  input?: {
    now?: string
    company_names?: Record<string, string>
    limit?: number
  },
): ApolloOperatorBottleneckReport {
  const nowMs = Date.parse(input?.now ?? new Date().toISOString())
  const limit = input?.limit ?? 20
  const pending = items.filter((item) => item.outcome === "pending")

  const hotspots: ApolloOperatorBottleneckReport["hotspots"] = []
  const stages: ApolloOperatorQueueStage[] = [
    "enrollment",
    "account_playbook",
    "voice_drop",
    "multichannel",
    "sequence_execution",
    "safe_execution",
  ]

  for (const stage of stages) {
    const stagePending = pending.filter((item) => item.stage === stage)
    if (stagePending.length === 0) continue
    const ages = stagePending.map((item) => ageHours(item.created_at, nowMs))
    hotspots.push({
      stage,
      pending_count: stagePending.length,
      max_age_hours: Math.round(Math.max(...ages) * 10) / 10,
    })
  }

  hotspots.sort((a, b) => b.max_age_hours - a.max_age_hours)

  const toBottleneckItem = (item: ApolloOperatorQueueItem): ApolloOperatorBottleneckItem => ({
    stage: item.stage,
    item_id: item.id,
    status: item.status,
    age_hours: Math.round(ageHours(item.created_at, nowMs) * 10) / 10,
    confidence_score: item.confidence_score,
    company_name: input?.company_names?.[item.id] ?? null,
  })

  const oldest_items = [...pending]
    .sort((a, b) => ageHours(b.created_at, nowMs) - ageHours(a.created_at, nowMs))
    .slice(0, limit)
    .map(toBottleneckItem)

  const stalled_candidates = pending
    .filter((item) => ageHours(item.created_at, nowMs) >= STALLED_HOURS)
    .sort((a, b) => ageHours(b.created_at, nowMs) - ageHours(a.created_at, nowMs))
    .slice(0, limit)
    .map(toBottleneckItem)

  return { hotspots, oldest_items, stalled_candidates }
}

export function resolveApolloOperatorPrimaryBottleneck(
  report: ApolloOperatorBottleneckReport,
): ApolloOperatorQueueStage | null {
  if (report.hotspots.length === 0) return null
  return report.hotspots[0]!.stage
}
