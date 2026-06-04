import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { tierFromSenderReputationScore } from "@/lib/growth/compliance/sender-reputation"
import { buildMailboxHealthIntelRow } from "@/lib/growth/deliverability/mailbox-health-intelligence"
import { buildSenderPerformanceMetrics, senderHealthScore } from "@/lib/growth/revenue-intelligence/sender-intelligence"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import type { GrowthDeliveryRoute } from "@/lib/growth/providers/provider-types"
import { getSenderAccount, listSenderAccounts } from "@/lib/growth/sender/sender-repository"
import {
  computeHealthAwareRoutingScore,
  computeSenderCapacityMetrics,
  isHealthAwareRoutingEligible,
  pickBestRouteForSender,
  reputationTrendFromPoints,
} from "@/lib/growth/sender-pools/health-aware-routing"
import type { HealthAwareRouteCandidate } from "@/lib/growth/sender-pools/health-aware-routing"
import {
  detectSenderFatigueSignals,
  memberContextFromFatigue,
} from "@/lib/growth/sender-pools/sender-fatigue"
import {
  createSenderRotationDecision,
  getSenderPool,
  listSenderPoolMembers,
  recordSenderFatigueEvent,
  touchSenderPoolMemberSelection,
} from "@/lib/growth/sender-pools/sender-pool-repository"
import { selectSenderFromPool } from "@/lib/growth/sender-pools/sender-rotation"
import type {
  GrowthSenderPoolMemberContext,
  GrowthSenderRotationOutput,
} from "@/lib/growth/sender-pools/sender-pool-types"
import { maskSenderLabel } from "@/lib/growth/sender-pools/sender-pool-types"

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

async function mailboxConnectedForSender(admin: SupabaseClient, senderAccountId: string): Promise<boolean> {
  const { count, error } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select("id", { count: "exact", head: true })
    .eq("sender_account_id", senderAccountId)
    .eq("status", "connected")
    .is("deleted_at", null)
  if (error) return false
  return (count ?? 0) > 0
}

export async function buildSenderPoolMemberContext(
  admin: SupabaseClient,
  member: Awaited<ReturnType<typeof listSenderPoolMembers>>[number],
  routes: Awaited<ReturnType<typeof listDeliveryRoutes>>,
): Promise<GrowthSenderPoolMemberContext | null> {
  const sender = await getSenderAccount(admin, member.senderAccountId)
  if (!sender || sender.deleted_at) return null

  const senderRoutes = routes.filter((route) => route.sender_account_id === sender.id && route.enabled)
  let warmupProgress = sender.warmup_enabled ? 0 : 100
  const { data: warmupRow } = await admin
    .schema("growth")
    .from("warmup_profiles")
    .select("warmup_progress, status")
    .eq("sender_account_id", sender.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (warmupRow && sender.warmup_enabled) {
    warmupProgress = Number((warmupRow as { warmup_progress?: number }).warmup_progress ?? 0)
    if ((warmupRow as { status?: string }).status === "throttled") warmupProgress = Math.min(warmupProgress, 40)
  }
  const metrics = buildSenderPerformanceMetrics({
    sent: sender.daily_send_used,
    warmupProgress,
  })
  const health = senderHealthScore(metrics)
  const reputationTier = tierFromSenderReputationScore(metrics.reputation_score)
  const domainPart = sender.email_address.split("@")[1] ?? ""

  let domainHealthScore = 80
  if (domainPart) {
    const { data: domainRow } = await admin
      .schema("growth")
      .from("sender_domains")
      .select("deliverability_score, reputation_score, status")
      .eq("domain", domainPart)
      .maybeSingle()
    if (domainRow) {
      domainHealthScore = Math.min(
        asNumber((domainRow as { deliverability_score?: number }).deliverability_score, 80),
        asNumber((domainRow as { reputation_score?: number }).reputation_score, 80),
      )
      if ((domainRow as { status?: string }).status === "invalid") domainHealthScore = 10
    }
  }

  const mailboxConnected = await mailboxConnectedForSender(admin, sender.id)
  const dailyCapRemaining = Math.max(0, sender.daily_send_limit - sender.daily_send_used)

  const routeCandidates: HealthAwareRouteCandidate[] = senderRoutes.map((route) => ({
    route_id: route.id,
    provider_id: route.provider_id,
    priority: route.priority,
    health_weight: route.health_weight,
    provider_health_score: route.health_weight,
    daily_cap: route.daily_cap,
    current_volume: route.current_volume,
  }))
  const bestRoute = pickBestRouteForSender(routeCandidates)
  const providerHealthScore = bestRoute
    ? Math.round(bestRoute.provider_health_score * 0.6 + bestRoute.health_weight * 0.4)
    : senderRoutes.length > 0
      ? 75
      : 20

  const base: GrowthSenderPoolMemberContext = {
    memberId: member.id,
    senderAccountId: sender.id,
    senderLabel: maskSenderLabel(sender.email_address, sender.display_name),
    senderEmail: sender.email_address,
    memberStatus: member.memberStatus,
    priorityWeight: member.priorityWeight,
    manualPriority: member.manualPriority,
    lastSelectedAt: member.lastSelectedAt,
    cooldownUntil: member.cooldownUntil,
    senderConnected: sender.status === "connected" || sender.status === "warming",
    mailboxConnected,
    suppressed: sender.status === "disabled" || sender.status === "error",
    disabled: sender.status === "disabled",
    warmupHealthCritical: sender.health_status === "critical",
    senderReputationCritical: reputationTier === "critical",
    domainDeliverabilityCritical: domainHealthScore < 30,
    dailyCapRemaining,
    providerRouteAvailable: senderRoutes.length > 0,
    complianceScore: Math.max(0, 100 - metrics.fatigue_score),
    healthScore: health,
    reputationScore: metrics.reputation_score,
    recentVolume: sender.daily_send_used,
    bounceRisk: metrics.bounce_trend,
    complaintRisk: metrics.complaint_trend,
    providerHealthScore,
    domainHealthScore,
    warmupProgress,
  }

  const intel = await buildMailboxHealthIntelRow(admin, sender.id).catch(() => null)
  if (!intel) {
    const capacity = computeSenderCapacityMetrics({
      daily_capacity: sender.daily_send_limit,
      sends_today: sender.daily_send_used,
    })
    return {
      ...base,
      remainingDailyCapacity: capacity.remaining_capacity,
      utilizationPct: capacity.utilization_pct,
      projectedExhaustionHours: capacity.projected_exhaustion_hours,
      routingScore: computeHealthAwareRoutingScore(base),
      routingEligible: isHealthAwareRoutingEligible(base),
    }
  }

  const capacity = computeSenderCapacityMetrics({
    daily_capacity: intel.daily_capacity,
    sends_today: intel.sends_today,
  })

  const enriched: GrowthSenderPoolMemberContext = {
    ...base,
    healthScore: intel.health_score,
    reputationScore: Math.max(base.reputationScore, intel.health_score),
    bounceRisk: intel.bounce_rate,
    complaintRisk: intel.complaint_rate,
    mailboxHealthScore: intel.health_score,
    mailboxHealthState: intel.health_state,
    reputationTrendDirection:
      intel.health_trend.length >= 2 ? reputationTrendFromPoints(intel.health_trend) : "unknown",
    warmupStatus: intel.warmup_status,
    remainingDailyCapacity: capacity.remaining_capacity,
    utilizationPct: capacity.utilization_pct,
    projectedExhaustionHours: capacity.projected_exhaustion_hours,
    deliverySuccessRate: intel.delivery_success_rate,
    throttleStatus: intel.throttle_status,
    dailyCapRemaining: capacity.remaining_capacity,
    routingRecommendedAction:
      intel.throttle_recommendation ?? intel.capacity_recommendation ?? intel.primary_risk_reason,
    warmupHealthCritical:
      base.warmupHealthCritical || intel.health_state === "critical" || intel.health_state === "disabled",
  }
  enriched.routingScore = computeHealthAwareRoutingScore(enriched)
  enriched.routingEligible = isHealthAwareRoutingEligible(enriched)
  return enriched
}

function routeCandidateFromGrowthRoute(route: GrowthDeliveryRoute): HealthAwareRouteCandidate {
  return {
    route_id: route.id,
    provider_id: route.provider_id,
    priority: route.priority,
    health_weight: route.health_weight,
    provider_health_score: route.health_weight,
    daily_cap: route.daily_cap,
    current_volume: route.current_volume,
  }
}

export function buildHealthAwareRouteBySender(
  routes: GrowthDeliveryRoute[],
): Record<string, { providerId: string | null; routeId: string | null }> {
  const routeBySender: Record<string, { providerId: string | null; routeId: string | null }> = {}
  const bySender = new Map<string, GrowthDeliveryRoute[]>()
  for (const route of routes.filter((r) => r.enabled)) {
    const list = bySender.get(route.sender_account_id) ?? []
    list.push(route)
    bySender.set(route.sender_account_id, list)
  }
  for (const [senderId, senderRoutes] of bySender) {
    const best = pickBestRouteForSender(senderRoutes.map(routeCandidateFromGrowthRoute))
    if (best) {
      routeBySender[senderId] = { providerId: best.provider_id, routeId: best.route_id }
    }
  }
  return routeBySender
}

export async function resolveSenderRotationForPool(
  admin: SupabaseClient,
  input: {
    senderPoolId: string
    allowAutoRotation?: boolean
    manualSenderAccountId?: string | null
    sequenceExecutionJobId?: string | null
    deliveryAttemptId?: string | null
    persistDecision?: boolean
  },
): Promise<GrowthSenderRotationOutput & { decisionId?: string | null }> {
  const pool = await getSenderPool(admin, input.senderPoolId)
  if (!pool || pool.status !== "active") {
    return {
      selectedSenderAccountId: null,
      selectedProviderId: null,
      selectedRouteId: null,
      reason: "health_score",
      riskLevel: "critical",
      fallbackSenderCandidates: [],
      decisionId: null,
    }
  }

  const [members, routes] = await Promise.all([
    listSenderPoolMembers(admin, input.senderPoolId),
    listDeliveryRoutes(admin),
  ])

  const contexts: GrowthSenderPoolMemberContext[] = []
  for (const member of members) {
    const ctx = await buildSenderPoolMemberContext(admin, member, routes)
    if (ctx) {
      const fatigueSignals = detectSenderFatigueSignals(memberContextFromFatigue(ctx))
      for (const signal of fatigueSignals) {
        if (signal.severity === "high" || signal.severity === "critical") {
          await recordSenderFatigueEvent(admin, {
            senderAccountId: ctx.senderAccountId,
            senderPoolId: pool.id,
            fatigueType: signal.fatigueType,
            severity: signal.severity,
            title: signal.title,
            description: signal.description,
            signals: { member_status: ctx.memberStatus },
          }).catch(() => undefined)
        }
        if (signal.severity === "critical") {
          const { applyOperationalPauseForFatigue } = await import(
            "@/lib/growth/sender-pools/sender-operational-pause"
          )
          await applyOperationalPauseForFatigue(admin, {
            memberId: member.id,
            senderAccountId: ctx.senderAccountId,
            senderPoolId: pool.id,
            signal,
          }).catch(() => undefined)
        }
      }
      contexts.push(ctx)
    }
  }

  const routeBySender = buildHealthAwareRouteBySender(routes)

  const output = selectSenderFromPool({
    strategy: pool.rotationStrategy,
    minComplianceScore: pool.minComplianceScore,
    requiresMailbox: pool.requiresMailbox,
    members: contexts,
    manualSenderAccountId: input.manualSenderAccountId,
    allowAutoRotation: input.allowAutoRotation ?? pool.allowAutoRotation,
    routeBySender,
  })

  if (output.selectedSenderAccountId && input.persistDecision !== false) {
    const decision = await createSenderRotationDecision(admin, {
      senderPoolId: pool.id,
      sequenceExecutionJobId: input.sequenceExecutionJobId ?? null,
      deliveryAttemptId: input.deliveryAttemptId ?? null,
      selectedSenderAccountId: output.selectedSenderAccountId,
      selectedProviderId: output.selectedProviderId,
      selectedRouteId: output.selectedRouteId,
      decisionReason: output.reason,
      riskLevel: output.riskLevel,
      allowAutoRotation: input.allowAutoRotation ?? pool.allowAutoRotation,
      fallbackCandidates: output.fallbackSenderCandidates,
    })
    const member = members.find((m) => m.senderAccountId === output.selectedSenderAccountId)
    if (member) {
      await touchSenderPoolMemberSelection(admin, member.id).catch(() => undefined)
    }
    return { ...output, decisionId: decision.id }
  }

  return { ...output, decisionId: null }
}

export async function resolveTransportSenderWithPool(
  admin: SupabaseClient,
  input: {
    senderAccountId?: string
    senderPoolId?: string | null
    allowAutoRotation?: boolean
    manualSenderAccountId?: string | null
    sequenceExecutionJobId?: string | null
  },
): Promise<{
  senderAccountId: string
  providerId: string | null
  rotationDecisionId?: string | null
  rotationReason?: GrowthSenderRotationOutput["reason"]
  rotationRiskLevel?: GrowthSenderRotationOutput["riskLevel"]
  poolFallbackSenders?: GrowthSenderRotationOutput["fallbackSenderCandidates"]
} | null> {
  if (input.senderPoolId && (input.allowAutoRotation ?? true)) {
    const rotation = await resolveSenderRotationForPool(admin, {
      senderPoolId: input.senderPoolId,
      allowAutoRotation: input.allowAutoRotation,
      manualSenderAccountId: input.manualSenderAccountId,
      sequenceExecutionJobId: input.sequenceExecutionJobId,
    })
    if (rotation.selectedSenderAccountId) {
      const routes = await listDeliveryRoutes(admin)
      const routeBySender = buildHealthAwareRouteBySender(routes)
      const route = routeBySender[rotation.selectedSenderAccountId]
      return {
        senderAccountId: rotation.selectedSenderAccountId,
        providerId: route?.providerId ?? rotation.selectedProviderId,
        rotationDecisionId: rotation.decisionId ?? null,
        rotationReason: rotation.reason,
        rotationRiskLevel: rotation.riskLevel,
        poolFallbackSenders: rotation.fallbackSenderCandidates,
      }
    }
  }

  if (input.manualSenderAccountId && input.allowAutoRotation === false) {
    const sender = await getSenderAccount(admin, input.manualSenderAccountId)
    if (sender) {
      return { senderAccountId: sender.id, providerId: null, rotationDecisionId: null }
    }
  }

  if (input.senderAccountId) {
    return { senderAccountId: input.senderAccountId, providerId: null, rotationDecisionId: null }
  }

  const senders = await listSenderAccounts(admin)
  const sender = senders.find((row) => row.status === "connected" || row.status === "warming")
  if (!sender) return null
  return { senderAccountId: sender.id, providerId: null, rotationDecisionId: null }
}
