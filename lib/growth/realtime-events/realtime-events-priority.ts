/** Phase GS-4C — Realtime event prioritization (client-safe). */

import type {
  GrowthRealtimeEvent,
  GrowthRealtimeEventDeliveryStatus,
  RealtimeEventFilter,
} from "@/lib/growth/realtime-events/realtime-events-types"

const DELIVERY_RANK: Record<GrowthRealtimeEventDeliveryStatus, number> = {
  failed: 5,
  pending: 4,
  routed: 3,
  delivered: 2,
  reviewed: 1,
  dismissed: 0,
}

const REVIEW_PENALTY: Record<GrowthRealtimeEvent["review_status"], number> = {
  pending: 0,
  reviewed: -15,
  dismissed: -100,
}

export function scoreGrowthRealtimeEvent(event: GrowthRealtimeEvent): number {
  const deliveryScore = DELIVERY_RANK[event.delivery_status] * 10
  const routeScore = Math.min(15, event.routes.length * 3)
  const recencyMs = Date.now() - Date.parse(event.occurred_at)
  const recencyBoost =
    Number.isFinite(recencyMs) && recencyMs <= 24 * 60 * 60 * 1000
      ? Math.round(12 * (1 - recencyMs / (24 * 60 * 60 * 1000)))
      : 0
  const reviewPenalty = REVIEW_PENALTY[event.review_status] ?? 0
  const highRouteBoost = event.routes.some((r) => r.priority === "high") ? 8 : 0
  return deliveryScore + routeScore + recencyBoost + reviewPenalty + highRouteBoost
}

export function rankGrowthRealtimeEvents(events: GrowthRealtimeEvent[]): GrowthRealtimeEvent[] {
  return [...events].sort((left, right) => {
    const scoreDiff = scoreGrowthRealtimeEvent(right) - scoreGrowthRealtimeEvent(left)
    if (scoreDiff !== 0) return scoreDiff
    return right.occurred_at.localeCompare(left.occurred_at)
  })
}

export function filterGrowthRealtimeEvents(
  events: GrowthRealtimeEvent[],
  filter: RealtimeEventFilter,
): GrowthRealtimeEvent[] {
  switch (filter) {
    case "routed":
      return events.filter((e) => e.delivery_status === "routed" || e.delivery_status === "delivered")
    case "pending":
      return events.filter((e) => e.delivery_status === "pending")
    case "failed":
      return events.filter((e) => e.delivery_status === "failed")
    default:
      return events.filter((e) => e.review_status !== "dismissed")
  }
}
