/** Phase 6.31C — deterministic health-aware routing score + capacity (client-safe). */

import { buildHealthTrendDirection } from "@/lib/growth/deliverability/mailbox-health-score"
import type { GrowthMailboxHealthTrendPoint } from "@/lib/growth/deliverability/mailbox-health-score-types"
import type {
  GrowthReputationTrendDirection,
  GrowthSenderCapacityMetrics,
} from "@/lib/growth/sender-pools/health-aware-routing-types"
import type { GrowthSenderPoolMemberContext } from "@/lib/growth/sender-pools/sender-pool-types"

export type HealthAwareRouteCandidate = {
  route_id: string
  provider_id: string
  priority: number
  health_weight: number
  provider_health_score: number
  daily_cap: number
  current_volume: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function computeSenderCapacityMetrics(input: {
  daily_capacity: number
  sends_today: number
  sends_per_hour_estimate?: number
}): GrowthSenderCapacityMetrics {
  const daily_capacity = Math.max(0, input.daily_capacity)
  const sends_today = Math.max(0, input.sends_today)
  const remaining_capacity = Math.max(0, daily_capacity - sends_today)
  const utilization_pct =
    daily_capacity > 0 ? Math.round((sends_today / daily_capacity) * 100) : sends_today > 0 ? 100 : 0

  let projected_exhaustion_hours: number | null = null
  const hourly = input.sends_per_hour_estimate ?? (sends_today > 0 ? sends_today / Math.max(1, new Date().getHours() || 1) : 0)
  if (remaining_capacity > 0 && hourly > 0.5) {
    projected_exhaustion_hours = Math.round((remaining_capacity / hourly) * 10) / 10
  } else if (remaining_capacity <= 0 && daily_capacity > 0) {
    projected_exhaustion_hours = 0
  }

  return {
    daily_capacity,
    sends_today,
    remaining_capacity,
    utilization_pct,
    projected_exhaustion_hours,
  }
}

export function scoreDeliveryRouteForRotation(route: HealthAwareRouteCandidate, requestedVolume = 1): number {
  const remainingCap = Math.max(0, route.daily_cap - route.current_volume)
  const capFit =
    route.daily_cap <= 0 ? 50 : Math.min(100, (remainingCap / Math.max(requestedVolume, 1)) * 100)
  return route.priority + route.provider_health_score * 0.4 + route.health_weight * 0.2 + capFit * 0.1
}

export function pickBestRouteForSender(
  routes: HealthAwareRouteCandidate[],
  requestedVolume = 1,
): HealthAwareRouteCandidate | null {
  const eligible = routes.filter((route) => {
    if (route.provider_health_score < 20) return false
    if (route.daily_cap > 0 && route.current_volume + requestedVolume > route.daily_cap) return false
    return true
  })
  if (eligible.length === 0) return null
  return [...eligible].sort(
    (a, b) => scoreDeliveryRouteForRotation(b, requestedVolume) - scoreDeliveryRouteForRotation(a, requestedVolume),
  )[0]!
}

export function reputationTrendFromPoints(
  points: GrowthMailboxHealthTrendPoint[],
): GrowthReputationTrendDirection {
  return buildHealthTrendDirection(points)
}

function healthStatePenalty(state: GrowthSenderPoolMemberContext["mailboxHealthState"]): number {
  switch (state) {
    case "healthy":
      return 0
    case "warning":
      return 12
    case "at_risk":
      return 28
    case "critical":
      return 55
    case "disabled":
      return 100
    default:
      return 15
  }
}

function throttlePenalty(status: GrowthSenderPoolMemberContext["throttleStatus"]): number {
  if (status === "paused") return 80
  if (status === "throttled") return 35
  return 0
}

export function computeHealthAwareRoutingScore(member: GrowthSenderPoolMemberContext): number {
  const health = member.mailboxHealthScore ?? member.healthScore
  const capacityBonus = Math.min(15, (member.remainingDailyCapacity ?? member.dailyCapRemaining) * 0.3)
  const utilizationPenalty =
    (member.utilizationPct ?? 0) >= 95 ? 20 : (member.utilizationPct ?? 0) >= 85 ? 10 : 0
  const trendBonus =
    member.reputationTrendDirection === "improving"
      ? 6
      : member.reputationTrendDirection === "declining"
        ? -10
        : 0
  const deliveryBonus =
    (member.deliverySuccessRate ?? 100) >= 95 ? 4 : (member.deliverySuccessRate ?? 100) < 85 ? -12 : 0
  const warmupBonus =
    member.warmupProgress > 0 && member.warmupProgress < 100 ? member.warmupProgress * 0.08 : 0

  const score =
    health * 0.4 +
    member.reputationScore * 0.15 +
    member.domainHealthScore * 0.1 +
    member.providerHealthScore * 0.1 +
    capacityBonus +
    warmupBonus +
    trendBonus +
    deliveryBonus -
    member.bounceRisk * 0.25 -
    member.complaintRisk * 0.35 -
    member.recentVolume * 0.04 -
    healthStatePenalty(member.mailboxHealthState ?? "warning") -
    throttlePenalty(member.throttleStatus ?? "ok") -
    utilizationPenalty +
    member.priorityWeight * 0.01

  return Math.round(clamp(score, 0, 100))
}

export function deriveRoutingRecommendedAction(member: GrowthSenderPoolMemberContext): string | null {
  if (member.routingRecommendedAction) return member.routingRecommendedAction
  if (member.mailboxHealthState === "critical") {
    return "Exclude from rotation until mailbox health recovers."
  }
  if (member.mailboxHealthState === "disabled") return "Mailbox disabled — reconnect or replace sender."
  if (member.throttleStatus === "paused") return "Deliverability pause active — do not route volume here."
  if (member.throttleStatus === "throttled") return "Throttle active — prefer healthier senders in pool."
  if ((member.utilizationPct ?? 0) >= 100) return "Daily capacity exhausted — defer sends or rotate to another sender."
  if ((member.projectedExhaustionHours ?? null) != null && member.projectedExhaustionHours! <= 2) {
    return `Projected cap exhaustion in ~${member.projectedExhaustionHours}h — balance remaining pool volume.`
  }
  if (member.mailboxHealthState === "at_risk") return "At-risk mailbox — limit volume and monitor bounce/complaint rates."
  if (member.reputationTrendDirection === "declining") return "Reputation trend declining — reduce share of pool sends."
  return null
}

export function isHealthAwareRoutingEligible(member: GrowthSenderPoolMemberContext): boolean {
  if (member.mailboxHealthState === "critical" || member.mailboxHealthState === "disabled") return false
  if (member.throttleStatus === "paused") return false
  if (member.throttleStatus === "throttled") return false
  if ((member.remainingDailyCapacity ?? member.dailyCapRemaining) <= 0) return false
  return true
}

export function buildRouteBalancingRecommendation(
  members: Array<Pick<GrowthSenderPoolMemberContext, "senderLabel" | "utilizationPct" | "routingEligible" | "mailboxHealthState">>,
): string | null {
  const eligible = members.filter((m) => m.routingEligible !== false)
  if (eligible.length < 2) return null
  const utils = eligible.map((m) => m.utilizationPct ?? 0)
  const max = Math.max(...utils)
  const min = Math.min(...utils)
  if (max - min >= 40) {
    const heavy = eligible.find((m) => (m.utilizationPct ?? 0) === max)
    const light = eligible.find((m) => (m.utilizationPct ?? 0) === min)
    if (heavy && light) {
      return `Balance pool volume: ${heavy.senderLabel} at ${max}% utilization vs ${light.senderLabel} at ${min}% — shift sends toward lower-utilization mailboxes.`
    }
  }
  const atRisk = eligible.filter((m) => m.mailboxHealthState === "at_risk" || m.mailboxHealthState === "warning")
  if (atRisk.length > 0 && atRisk.length < eligible.length) {
    return `${atRisk.length} mailbox(es) in warning/at-risk — route new sends to healthy members first.`
  }
  return null
}

export function memberContextToRoutingInsight(
  member: GrowthSenderPoolMemberContext,
  senderPoolId: string | null,
  poolBalancingNote: string | null,
): import("@/lib/growth/sender-pools/health-aware-routing-types").GrowthSenderRoutingInsight {
  return {
    sender_account_id: member.senderAccountId,
    sender_label: member.senderLabel,
    sender_pool_id: senderPoolId,
    routing_score: member.routingScore ?? computeHealthAwareRoutingScore(member),
    mailbox_health_score: member.mailboxHealthScore ?? member.healthScore,
    mailbox_health_state: member.mailboxHealthState ?? "warning",
    remaining_capacity: member.remainingDailyCapacity ?? member.dailyCapRemaining,
    utilization_pct: member.utilizationPct ?? 0,
    projected_exhaustion_hours: member.projectedExhaustionHours ?? null,
    routing_eligible: member.routingEligible ?? isHealthAwareRoutingEligible(member),
    recommended_action: deriveRoutingRecommendedAction(member),
    reputation_trend: member.reputationTrendDirection ?? "unknown",
    throttle_status: member.throttleStatus ?? "ok",
    warmup_status: member.warmupStatus ?? null,
    delivery_success_rate: member.deliverySuccessRate ?? 100,
    route_balancing_note: poolBalancingNote,
  }
}
