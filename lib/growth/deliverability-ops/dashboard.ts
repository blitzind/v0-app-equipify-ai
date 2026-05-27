import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { tierFromSenderReputationScore } from "@/lib/growth/compliance/sender-reputation"
import { aggregateDeliverabilityScores, highestSeverity } from "@/lib/growth/deliverability-ops/deliverability-aggregator"
import {
  aggregateDomainAuthenticationScore,
  buildDomainReputationSnapshot,
} from "@/lib/growth/deliverability-ops/domain-reputation"
import {
  acknowledgeDeliverabilityRecommendationWithTimeline,
  appendDeliverabilityOpsTimelineEvent,
  completeDeliverabilityRecommendationWithTimeline,
  dismissDeliverabilityRecommendationWithTimeline,
} from "@/lib/growth/deliverability-ops/deliverability-ops-events"
import {
  createDeliverabilityRecommendation,
  createDeliverabilityRemediationTask,
  createDeliverabilityRiskEvent,
  findOpenRecommendationByFingerprint,
  findOpenRiskByFingerprint,
  getLatestDeliverabilityOpsSnapshot,
  listDeliverabilityRecommendations,
  listDeliverabilityRemediationTasks,
  listDeliverabilityRiskEvents,
  listDomainReputationHistory,
  recordDeliverabilityOpsSnapshot,
  recordDomainReputationHistory,
  updateDeliverabilityRecommendationStatus,
} from "@/lib/growth/deliverability-ops/deliverability-ops-repository"
import {
  GROWTH_DELIVERABILITY_OPS_QA_MARKER,
  maskDomainLabel,
  maskSenderEntityLabel,
  type GrowthDeliverabilityOpsDashboard,
  type GrowthDeliverabilityProviderRouteRiskSummary,
  type GrowthDeliverabilityRecommendation,
  type GrowthDeliverabilitySenderRiskSummary,
} from "@/lib/growth/deliverability-ops/deliverability-ops-types"
import {
  generateDeliverabilityRecommendations,
  hasMinimumRecommendationEvidence,
} from "@/lib/growth/deliverability-ops/recommendation-engine"
import {
  buildRemediationTasksFromRecommendation,
  buildRemediationTasksFromRisk,
} from "@/lib/growth/deliverability-ops/remediation-tasks"
import { detectDeliverabilityRisks } from "@/lib/growth/deliverability-ops/risk-detector"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import { buildSenderPerformanceMetrics } from "@/lib/growth/revenue-intelligence/sender-intelligence"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"
import { detectSenderFatigueSignals } from "@/lib/growth/sender-pools/sender-fatigue"
import { listSenderFatigueEvents, listSenderPools } from "@/lib/growth/sender-pools/sender-pool-repository"

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function reputationScoreFromTier(tier: ReturnType<typeof tierFromSenderReputationScore>): number {
  switch (tier) {
    case "healthy":
      return 90
    case "monitor":
      return 72
    case "warning":
      return 52
    case "critical":
      return 28
    default:
      return 70
  }
}

async function loadPlatformSignals(admin: SupabaseClient) {
  const [
    senders,
    domains,
    dnsChecks,
    warmupProfiles,
    bounces,
    complaints,
    unsubscribes,
    engagementRows,
    rateLimits,
    deliveryAttempts,
    senderPools,
    fatigueEvents,
    routes,
  ] = await Promise.all([
    listSenderAccounts(admin),
    admin.schema("growth").from("sender_domains").select("*"),
    admin.schema("growth").from("domain_dns_checks").select("*").order("updated_at", { ascending: false }).limit(50),
    admin.schema("growth").from("warmup_profiles").select("*").limit(100),
    admin.schema("growth").from("email_bounces").select("id").gte(
      "created_at",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    ),
    admin.schema("growth").from("email_complaints").select("id").gte(
      "created_at",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    ),
    admin.schema("growth").from("unsubscribe_registry").select("id").gte(
      "created_at",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    ),
    admin.schema("growth").from("engagement_scores").select("open_rate, click_rate, reply_rate").limit(200),
    admin.schema("growth").from("provider_rate_limits").select("*").limit(50),
    admin.schema("growth").from("delivery_attempts").select("id, status").gte(
      "created_at",
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    ),
    listSenderPools(admin),
    listSenderFatigueEvents(admin, { limit: 50 }),
    listDeliveryRoutes(admin),
  ])

  const activeSenders = senders.filter((s) => !s.deleted_at && s.status !== "disabled")
  const sentTotal = activeSenders.reduce((sum, s) => sum + s.daily_send_used, 0) || 1
  const bounceRate = ((bounces.data ?? []).length / sentTotal) * 100
  const complaintRate = ((complaints.data ?? []).length / sentTotal) * 100
  const unsubscribeRate = ((unsubscribes.data ?? []).length / sentTotal) * 100

  const engagement = (engagementRows.data ?? []) as Array<{
    open_rate?: number
    click_rate?: number
    reply_rate?: number
  }>
  const openRate =
    engagement.length > 0
      ? engagement.reduce((sum, row) => sum + asNumber(row.open_rate), 0) / engagement.length
      : 22
  const clickRate =
    engagement.length > 0
      ? engagement.reduce((sum, row) => sum + asNumber(row.click_rate), 0) / engagement.length
      : 3
  const replyRate =
    engagement.length > 0
      ? engagement.reduce((sum, row) => sum + asNumber(row.reply_rate), 0) / engagement.length
      : 2

  const domainRows = (domains.data ?? []) as Array<Record<string, unknown>>
  const domainHealthAvg =
    domainRows.length > 0
      ? domainRows.reduce(
          (sum, row) => sum + asNumber(row.deliverability_score ?? row.reputation_score, 75),
          0,
        ) / domainRows.length
      : 75

  const dnsRows = (dnsChecks.data ?? []) as Array<Record<string, unknown>>
  const spfValidPct =
    dnsRows.length > 0
      ? (dnsRows.filter((row) => row.spf_valid === true).length / dnsRows.length) * 100
      : 100
  const dkimValidPct =
    dnsRows.length > 0
      ? (dnsRows.filter((row) => row.dkim_valid === true).length / dnsRows.length) * 100
      : 100
  const dmarcValidPct =
    dnsRows.length > 0
      ? (dnsRows.filter((row) => row.dmarc_valid === true).length / dnsRows.length) * 100
      : 100

  const warmupRows = (warmupProfiles.data ?? []) as Array<Record<string, unknown>>
  const warmupHealthAvg =
    warmupRows.length > 0
      ? warmupRows.reduce((sum, row) => sum + asNumber(row.warmup_score, 80), 0) / warmupRows.length
      : 85

  const reputationScores = activeSenders.map((sender) => {
    const metrics = buildSenderPerformanceMetrics({
      sent: sender.daily_send_used,
      warmupProgress: sender.warmup_enabled ? 50 : 100,
    })
    return reputationScoreFromTier(tierFromSenderReputationScore(metrics.reputation_score))
  })
  const senderReputationAvg =
    reputationScores.length > 0
      ? reputationScores.reduce((sum, score) => sum + score, 0) / reputationScores.length
      : 80

  const providerHealthAvg =
    routes.length > 0
      ? routes.reduce((sum, route) => sum + asNumber(route.health_weight, 80), 0) / routes.length
      : 80

  const rateLimitRows = (rateLimits.data ?? []) as Array<Record<string, unknown>>
  const rateLimitUtilization =
    rateLimitRows.length > 0
      ? rateLimitRows.reduce((sum, row) => {
          const used = asNumber(row.current_day)
          const cap = asNumber(row.day_cap, 1) || 1
          return sum + (used / cap) * 100
        }, 0) / rateLimitRows.length
      : 20

  const attempts = (deliveryAttempts.data ?? []) as Array<{ status?: string }>
  const volumePressureAvg = Math.min(
    100,
    (attempts.length / Math.max(activeSenders.length, 1)) * 8 + rateLimitUtilization * 0.4,
  )

  return {
    activeSenders,
    domainRows,
    dnsRows,
    warmupRows,
    senderPools,
    fatigueEvents,
    routes,
    bounceRate,
    complaintRate,
    unsubscribeRate,
    openRate,
    clickRate,
    replyRate,
    domainHealthAvg,
    spfValidPct,
    dkimValidPct,
    dmarcValidPct,
    warmupHealthAvg,
    senderReputationAvg,
    providerHealthAvg,
    rateLimitUtilization,
    volumePressureAvg,
  }
}

async function syncRisksAndRecommendations(
  admin: SupabaseClient,
  signals: Awaited<ReturnType<typeof loadPlatformSignals>>,
): Promise<void> {
  const platformRisks = detectDeliverabilityRisks({
    entityType: "platform",
    entityLabel: "Platform",
    bounceRate: signals.bounceRate,
    complaintRate: signals.complaintRate,
    unsubscribeRate: signals.unsubscribeRate,
    openRate: signals.openRate,
    clickRate: signals.clickRate,
    replyRate: signals.replyRate,
    spfValid: signals.spfValidPct >= 90,
    dkimValid: signals.dkimValidPct >= 90,
    dmarcValid: signals.dmarcValidPct >= 90,
    rateLimitUtilizationPct: signals.rateLimitUtilization,
    poolFatigueWarnings: signals.fatigueEvents.length,
  })

  for (const sender of signals.activeSenders) {
    const label = maskSenderEntityLabel(sender.email_address, sender.display_name)
    const metrics = buildSenderPerformanceMetrics({
      sent: sender.daily_send_used,
      warmupProgress: sender.warmup_enabled ? 50 : 100,
    })
    const fatigue = detectSenderFatigueSignals({
      recentVolume: sender.daily_send_used,
      bounceRate: signals.bounceRate,
      complaintRate: signals.complaintRate,
    })
    const fatigueScore = fatigue.length > 0 ? 75 : metrics.fatigue_score

    platformRisks.push(
      ...detectDeliverabilityRisks({
        entityType: "sender",
        entityId: sender.id,
        entityLabel: label,
        recentVolume: sender.daily_send_used,
        warmupEnabled: sender.warmup_enabled,
        warmupProgress: sender.warmup_enabled ? 45 : 100,
        fatigueScore,
        bounceRate: signals.bounceRate,
        complaintRate: signals.complaintRate,
      }),
    )
  }

  for (const domainRow of signals.domainRows) {
    const domain = String(domainRow.domain ?? "")
    const label = maskDomainLabel(domain)
    const dns = signals.dnsRows.find((row) => String(row.domain_id ?? "") === String(domainRow.id ?? ""))
    platformRisks.push(
      ...detectDeliverabilityRisks({
        entityType: "domain",
        entityId: String(domainRow.id ?? ""),
        entityLabel: label,
        spfValid: dns ? dns.spf_valid !== false : true,
        dkimValid: dns ? dns.dkim_valid !== false : true,
        dmarcValid: dns ? dns.dmarc_valid !== false : true,
        domainReputationScore: asNumber(domainRow.reputation_score, 80),
        bounceRate: signals.bounceRate,
        complaintRate: signals.complaintRate,
      }),
    )

    const authScore = aggregateDomainAuthenticationScore({
      spfValid: dns?.spf_valid !== false,
      dkimValid: dns?.dkim_valid !== false,
      dmarcValid: dns?.dmarc_valid !== false,
    })
    const snapshot = buildDomainReputationSnapshot({
      domainId: String(domainRow.id ?? ""),
      domain,
      reputationScore: asNumber(domainRow.reputation_score, 80),
      bounceRate: signals.bounceRate,
      complaintRate: signals.complaintRate,
      authenticationScore: authScore,
    })
    await recordDomainReputationHistory(admin, snapshot).catch(() => undefined)
  }

  for (const route of signals.routes) {
    platformRisks.push(
      ...detectDeliverabilityRisks({
        entityType: "route",
        entityId: route.id,
        entityLabel: route.sender_label || route.provider_name || "Route",
        providerHealthScore: asNumber(route.health_weight, 80),
        rateLimitUtilizationPct:
          route.daily_cap > 0 ? (route.current_volume / route.daily_cap) * 100 : signals.rateLimitUtilization,
      }),
    )
  }

  for (const pool of signals.senderPools.filter((p) => p.status === "active")) {
    const poolFatigue = signals.fatigueEvents.filter((e) => e.senderPoolId === pool.id).length
    if (poolFatigue > 0) {
      platformRisks.push(
        ...detectDeliverabilityRisks({
          entityType: "pool",
          entityId: pool.id,
          entityLabel: pool.name,
          fatigueScore: poolFatigue * 20,
        }),
      )
    }
  }

  for (const risk of platformRisks) {
    const existing = await findOpenRiskByFingerprint(admin, {
      riskType: risk.riskType,
      entityLabel: risk.entityLabel,
    })
    if (existing) continue

    const created = await createDeliverabilityRiskEvent(admin, {
      riskType: risk.riskType,
      severity: risk.severity,
      title: risk.title,
      description: risk.description,
      entityType: risk.entityType,
      entityId: risk.entityId,
      entityLabel: risk.entityLabel,
      signals: risk.signals,
    })

    await appendDeliverabilityOpsTimelineEvent(admin, {
      eventType: "deliverability_risk_detected",
      title: risk.title,
      summary: risk.description,
      metadata: { risk_type: risk.riskType, entity_label: risk.entityLabel },
    }).catch(() => undefined)

    const taskDraft = buildRemediationTasksFromRisk(risk)
    await createDeliverabilityRemediationTask(admin, {
      riskEventId: created.id,
      ...taskDraft,
    })
    await appendDeliverabilityOpsTimelineEvent(admin, {
      eventType: "deliverability_remediation_task_created",
      title: taskDraft.title,
      summary: taskDraft.description,
    }).catch(() => undefined)
  }

  const recommendations = generateDeliverabilityRecommendations(platformRisks)
  for (const rec of recommendations) {
    if (!hasMinimumRecommendationEvidence(rec.evidence)) continue
    const existing = await findOpenRecommendationByFingerprint(admin, {
      recommendationType: rec.recommendationType,
      entityLabel: rec.entityLabel,
    })
    if (existing) continue

    const created = await createDeliverabilityRecommendation(admin, rec)
    await appendDeliverabilityOpsTimelineEvent(admin, {
      eventType: "deliverability_recommendation_created",
      title: rec.title,
      summary: rec.description,
      metadata: { recommendation_type: rec.recommendationType },
    }).catch(() => undefined)

    const taskDraft = buildRemediationTasksFromRecommendation(rec)
    await createDeliverabilityRemediationTask(admin, {
      recommendationId: created.id,
      ...taskDraft,
    })
  }
}

function buildEntityRiskSummaries(
  riskEvents: Awaited<ReturnType<typeof listDeliverabilityRiskEvents>>,
  entityType: "sender" | "route",
): GrowthDeliverabilitySenderRiskSummary[] | GrowthDeliverabilityProviderRouteRiskSummary[] {
  const grouped = new Map<string, typeof riskEvents>()
  for (const event of riskEvents.filter((e) => e.entityType === entityType && !e.resolved)) {
    const list = grouped.get(event.entityLabel) ?? []
    list.push(event)
    grouped.set(event.entityLabel, list)
  }

  return Array.from(grouped.entries()).map(([entityLabel, events]) => ({
    entityLabel,
    riskCount: events.length,
    highestSeverity: highestSeverity(events.map((e) => e.severity)),
    topRiskType: events[0]?.riskType ?? null,
  }))
}

export async function fetchGrowthDeliverabilityOpsDashboard(
  admin: SupabaseClient,
): Promise<GrowthDeliverabilityOpsDashboard> {
  const signals = await loadPlatformSignals(admin)
  await syncRisksAndRecommendations(admin, signals).catch(() => undefined)

  const openRisks = await listDeliverabilityRiskEvents(admin, { resolved: false, limit: 100 })
  const scores = aggregateDeliverabilityScores({
    senderReputationAvg: signals.senderReputationAvg,
    domainHealthAvg: signals.domainHealthAvg,
    providerHealthAvg: signals.providerHealthAvg,
    complianceRiskAvg: signals.bounceRate + signals.complaintRate * 5 + signals.unsubscribeRate,
    warmupHealthAvg: signals.warmupHealthAvg,
    volumePressureAvg: signals.volumePressureAvg,
    openRiskCount: openRisks.length,
    bounceRate: signals.bounceRate,
    complaintRate: signals.complaintRate,
    unsubscribeRate: signals.unsubscribeRate,
    openRate: signals.openRate,
    clickRate: signals.clickRate,
    replyRate: signals.replyRate,
    spfValidPct: signals.spfValidPct,
    dkimValidPct: signals.dkimValidPct,
    dmarcValidPct: signals.dmarcValidPct,
    rateLimitPressurePct: signals.rateLimitUtilization,
    poolFatigueWarnings: signals.fatigueEvents.length,
  })

  const snapshot = await recordDeliverabilityOpsSnapshot(admin, {
    overallScore: scores.overallDeliverability,
    senderReputationScore: scores.senderReputation,
    domainHealthScore: scores.domainHealth,
    providerHealthScore: scores.providerHealth,
    complianceRiskScore: scores.complianceRisk,
    warmupHealthScore: scores.warmupHealth,
    volumePressureScore: scores.volumePressure,
    openRiskAlerts: scores.riskAlerts,
  }).catch(async () => (await getLatestDeliverabilityOpsSnapshot(admin)) ?? null)

  await appendDeliverabilityOpsTimelineEvent(admin, {
    eventType: "deliverability_ops_snapshot_recorded",
    title: "Deliverability ops snapshot recorded",
    summary: `Overall score ${scores.overallDeliverability}`,
  }).catch(() => undefined)

  const [recommendations, riskEvents, remediationTasks, domainReputationHistory] = await Promise.all([
    listDeliverabilityRecommendations(admin, { limit: 50 }),
    listDeliverabilityRiskEvents(admin, { limit: 50 }),
    listDeliverabilityRemediationTasks(admin, { limit: 50 }),
    listDomainReputationHistory(admin, { limit: 40 }),
  ])

  return {
    qa_marker: GROWTH_DELIVERABILITY_OPS_QA_MARKER,
    overallDeliverability: scores.overallDeliverability,
    senderReputation: scores.senderReputation,
    domainHealth: scores.domainHealth,
    providerHealth: scores.providerHealth,
    complianceRisk: scores.complianceRisk,
    warmupHealth: scores.warmupHealth,
    volumePressure: scores.volumePressure,
    riskAlerts: openRisks.length,
    latestSnapshot: snapshot,
    recommendations,
    riskEvents,
    remediationTasks,
    domainReputationHistory,
    senderRiskSummary: buildEntityRiskSummaries(riskEvents, "sender") as GrowthDeliverabilitySenderRiskSummary[],
    providerRouteRiskSummary: buildEntityRiskSummaries(
      riskEvents,
      "route",
    ) as GrowthDeliverabilityProviderRouteRiskSummary[],
  }
}

export async function acknowledgeDeliverabilityRecommendation(
  admin: SupabaseClient,
  input: { recommendationId: string; actorUserId: string },
): Promise<GrowthDeliverabilityRecommendation> {
  const updated = await updateDeliverabilityRecommendationStatus(admin, {
    id: input.recommendationId,
    status: "acknowledged",
    actorUserId: input.actorUserId,
  })
  await acknowledgeDeliverabilityRecommendationWithTimeline(admin, {
    recommendationId: input.recommendationId,
    actorUserId: input.actorUserId,
    title: updated.title,
  })
  return updated
}

export async function completeDeliverabilityRecommendation(
  admin: SupabaseClient,
  input: { recommendationId: string; actorUserId: string; note?: string },
): Promise<GrowthDeliverabilityRecommendation> {
  const updated = await updateDeliverabilityRecommendationStatus(admin, {
    id: input.recommendationId,
    status: "completed",
    actorUserId: input.actorUserId,
  })
  await completeDeliverabilityRecommendationWithTimeline(admin, {
    recommendationId: input.recommendationId,
    actorUserId: input.actorUserId,
    title: updated.title,
    note: input.note,
  })
  return updated
}

export async function dismissDeliverabilityRecommendation(
  admin: SupabaseClient,
  input: { recommendationId: string; actorUserId: string; reason?: string },
): Promise<GrowthDeliverabilityRecommendation> {
  const updated = await updateDeliverabilityRecommendationStatus(admin, {
    id: input.recommendationId,
    status: "dismissed",
    actorUserId: input.actorUserId,
    dismissReason: input.reason,
  })
  await dismissDeliverabilityRecommendationWithTimeline(admin, {
    recommendationId: input.recommendationId,
    actorUserId: input.actorUserId,
    title: updated.title,
    reason: input.reason,
  })
  return updated
}
