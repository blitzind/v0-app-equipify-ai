import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthPerformancePeriodKey,
  GrowthPerformanceTrend,
  GrowthProviderPerformanceMetrics,
  GrowthSenderPerformanceMetrics,
  GrowthSequencePerformanceMetrics,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"
import { buildSequencePerformanceMetrics, mergeSequencePerformanceMetrics } from "@/lib/growth/revenue-intelligence/sequence-intelligence"
import { buildSenderPerformanceMetrics } from "@/lib/growth/revenue-intelligence/sender-intelligence"
import { buildProviderPerformanceMetrics } from "@/lib/growth/revenue-intelligence/provider-intelligence"
import { detectRateTrend } from "@/lib/growth/revenue-intelligence/trend-detector"

type Row = Record<string, unknown>

function sequenceSnapshotsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_performance_snapshots")
}

function senderSnapshotsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sender_performance_snapshots")
}

function providerSnapshotsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("provider_route_performance_snapshots")
}

function parseMetrics<T extends Record<string, number>>(row: Row | null, keys: readonly string[], fallback: T): T {
  const raw = (row?.metrics as Record<string, number> | undefined) ?? {}
  const result = { ...fallback }
  for (const key of keys) {
    if (typeof raw[key] === "number") result[key as keyof T] = raw[key] as T[keyof T]
  }
  return result
}

export async function upsertSequencePerformanceSnapshot(
  admin: SupabaseClient,
  input: {
    sequenceId?: string | null
    sequenceEnrollmentId?: string | null
    periodKey?: GrowthPerformancePeriodKey
    delta?: Partial<GrowthSequencePerformanceMetrics>
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const periodKey = input.periodKey ?? "30d"
  let query = sequenceSnapshotsTable(admin).select("*").eq("period_key", periodKey)
  if (input.sequenceId) query = query.eq("sequence_id", input.sequenceId)
  if (input.sequenceEnrollmentId) query = query.eq("sequence_enrollment_id", input.sequenceEnrollmentId)
  const { data: existing } = await query.order("snapshot_at", { ascending: false }).limit(1).maybeSingle()

  const previousMetrics = existing
    ? parseMetrics(existing as Row, [
        "sent", "delivered", "opens", "clicks", "replies", "positive_replies", "meetings",
        "opportunities", "wins", "pipeline_value", "revenue", "bounce_pct", "unsubscribe_pct",
        "complaint_pct", "reply_pct", "meeting_pct", "open_pct", "click_pct", "lift_pct", "sequence_velocity",
      ], buildSequencePerformanceMetrics({}))
    : buildSequencePerformanceMetrics({})

  const metrics = input.delta ? mergeSequencePerformanceMetrics(previousMetrics, input.delta) : previousMetrics
  const trend = detectRateTrend(metrics.reply_pct, previousMetrics.reply_pct)
  const now = new Date().toISOString()

  if (existing) {
    const { error } = await sequenceSnapshotsTable(admin)
      .update({
        metrics,
        trend,
        snapshot_at: now,
        updated_at: now,
        metadata: { ...((existing as Row).metadata as Record<string, unknown>), ...(input.metadata ?? {}) },
      })
      .eq("id", String((existing as Row).id))
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await sequenceSnapshotsTable(admin).insert({
    sequence_id: input.sequenceId ?? null,
    sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
    period_key: periodKey,
    metrics,
    trend,
    snapshot_at: now,
    metadata: input.metadata ?? {},
    updated_at: now,
  })
  if (error) throw new Error(error.message)
}

export async function upsertSenderPerformanceSnapshot(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    periodKey?: GrowthPerformancePeriodKey
    delta?: { sent?: number; hardBounces?: number; softBounces?: number; complaints?: number; opens?: number; clicks?: number; replies?: number }
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const periodKey = input.periodKey ?? "30d"
  const { data: existing } = await senderSnapshotsTable(admin)
    .select("*")
    .eq("sender_account_id", input.senderAccountId)
    .eq("period_key", periodKey)
    .order("snapshot_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const metrics = buildSenderPerformanceMetrics(input.delta ?? {})
  const previous = existing
    ? parseMetrics(existing as Row, [
        "deliverability", "bounce_trend", "complaint_trend", "warmup_trend",
        "engagement_trend", "fatigue_score", "reputation_score",
      ], buildSenderPerformanceMetrics({}))
    : buildSenderPerformanceMetrics({})

  const trend = detectRateTrend(metrics.engagement_trend, previous.engagement_trend)
  const now = new Date().toISOString()

  if (existing) {
    const { error } = await senderSnapshotsTable(admin)
      .update({ metrics, trend, snapshot_at: now, updated_at: now, metadata: input.metadata ?? {} })
      .eq("id", String((existing as Row).id))
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await senderSnapshotsTable(admin).insert({
    sender_account_id: input.senderAccountId,
    period_key: periodKey,
    metrics,
    trend,
    snapshot_at: now,
    metadata: input.metadata ?? {},
    updated_at: now,
  })
  if (error) throw new Error(error.message)
}

export async function upsertProviderRoutePerformanceSnapshot(
  admin: SupabaseClient,
  input: {
    providerId?: string | null
    routeId?: string | null
    periodKey?: GrowthPerformancePeriodKey
    success?: boolean
    latencyMs?: number
    bounced?: boolean
    complained?: boolean
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const periodKey = input.periodKey ?? "30d"
  let query = providerSnapshotsTable(admin).select("*").eq("period_key", periodKey)
  if (input.providerId) query = query.eq("provider_id", input.providerId)
  if (input.routeId) query = query.eq("route_id", input.routeId)
  const { data: existing } = await query.order("snapshot_at", { ascending: false }).limit(1).maybeSingle()

  const prevRaw = (existing as Row | null)?.metrics as GrowthProviderPerformanceMetrics | undefined
  const prevAttempts = prevRaw ? Math.max(1, Math.round(prevRaw.delivery_success_pct)) : 0
  const metrics = buildProviderPerformanceMetrics({
    attempts: prevAttempts + 1,
    successes: (prevRaw?.delivery_success_pct ?? 0) + (input.success ? 1 : 0),
    failures: (prevRaw?.failure_pct ?? 0) + (input.success ? 0 : 1),
    bounces: (prevRaw?.bounce_pct ?? 0) + (input.bounced ? 1 : 0),
    complaints: (prevRaw?.complaint_pct ?? 0) + (input.complained ? 1 : 0),
    totalLatencyMs: (prevRaw?.delivery_latency_ms ?? 0) + (input.latencyMs ?? 0),
  })

  const trend: GrowthPerformanceTrend =
    prevRaw && metrics.delivery_success_pct < prevRaw.delivery_success_pct - 5 ? "declining" : "stable"
  const now = new Date().toISOString()

  if (existing) {
    const { error } = await providerSnapshotsTable(admin)
      .update({ metrics, trend, snapshot_at: now, updated_at: now, metadata: input.metadata ?? {} })
      .eq("id", String((existing as Row).id))
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await providerSnapshotsTable(admin).insert({
    provider_id: input.providerId ?? null,
    route_id: input.routeId ?? null,
    period_key: periodKey,
    metrics,
    trend,
    snapshot_at: now,
    metadata: input.metadata ?? {},
    updated_at: now,
  })
  if (error) throw new Error(error.message)
}

export async function listSequencePerformanceSnapshots(
  admin: SupabaseClient,
  input?: { periodKey?: GrowthPerformancePeriodKey; limit?: number },
) {
  const { data, error } = await sequenceSnapshotsTable(admin)
    .select("*")
    .eq("period_key", input?.periodKey ?? "30d")
    .order("snapshot_at", { ascending: false })
    .limit(input?.limit ?? 50)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listSenderPerformanceSnapshots(admin: SupabaseClient, limit = 50) {
  const { data, error } = await senderSnapshotsTable(admin)
    .select("*")
    .eq("period_key", "30d")
    .order("snapshot_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listProviderRoutePerformanceSnapshots(admin: SupabaseClient, limit = 50) {
  const { data, error } = await providerSnapshotsTable(admin)
    .select("*")
    .eq("period_key", "30d")
    .order("snapshot_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function recordPerformanceSnapshotAfterSend(
  admin: SupabaseClient,
  input: {
    leadId: string
    sequenceEnrollmentId?: string | null
    senderAccountId?: string | null
    providerId?: string | null
    deliveryAttemptId?: string | null
    experimentId?: string | null
    variantId?: string | null
  },
): Promise<void> {
  let sequenceId: string | null = null
  if (input.sequenceEnrollmentId) {
    const { data } = await admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("sequence_pattern_id")
      .eq("id", input.sequenceEnrollmentId)
      .maybeSingle()
    sequenceId = data?.sequence_pattern_id ? String(data.sequence_pattern_id) : null
  }

  await upsertSequencePerformanceSnapshot(admin, {
    sequenceId,
    sequenceEnrollmentId: input.sequenceEnrollmentId ?? null,
    delta: { sent: 1, delivered: 1 },
    metadata: {
      lead_id: input.leadId,
      delivery_attempt_id: input.deliveryAttemptId ?? null,
      experiment_id: input.experimentId ?? null,
      variant_id: input.variantId ?? null,
    },
  }).catch(() => undefined)

  if (input.senderAccountId) {
    await upsertSenderPerformanceSnapshot(admin, {
      senderAccountId: input.senderAccountId,
      delta: { sent: 1 },
    }).catch(() => undefined)
  }

  if (input.providerId) {
    await upsertProviderRoutePerformanceSnapshot(admin, {
      providerId: input.providerId,
      success: true,
    }).catch(() => undefined)
  }
}

export async function recordPerformanceEngagementForLead(
  admin: SupabaseClient,
  input: { leadId: string; metric: "replies" | "positive_replies" | "meetings" },
): Promise<void> {
  const { data, error } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("id, sequence_enrollment_id, metadata")
    .eq("lead_id", input.leadId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return

  await recordPerformanceEngagementFromDeliveryAttempt(admin, {
    deliveryAttemptId: String((data as Row).id),
    metric: input.metric,
  }).catch(() => undefined)
}

export async function recordPerformanceEngagementFromDeliveryAttempt(
  admin: SupabaseClient,
  input: { deliveryAttemptId: string; metric: "opens" | "clicks" | "replies" | "positive_replies" | "meetings" | "bounces" | "unsubscribes" | "complaints" },
): Promise<void> {
  const { data, error } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("id, lead_id, sender_account_id, provider_id, sequence_enrollment_id, metadata")
    .eq("id", input.deliveryAttemptId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return

  const row = data as Row
  const metadata = row.metadata as Row | null
  let sequenceId: string | null = null
  const enrollmentId = row.sequence_enrollment_id ? String(row.sequence_enrollment_id) : null
  if (enrollmentId) {
    const { data: enrollment } = await admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("sequence_pattern_id")
      .eq("id", enrollmentId)
      .maybeSingle()
    sequenceId = enrollment?.sequence_pattern_id ? String(enrollment.sequence_pattern_id) : null
  }

  const delta: Partial<GrowthSequencePerformanceMetrics> = {}
  if (input.metric === "opens") delta.opens = 1
  if (input.metric === "clicks") delta.clicks = 1
  if (input.metric === "replies") delta.replies = 1
  if (input.metric === "positive_replies") delta.positive_replies = 1
  if (input.metric === "meetings") delta.meetings = 1
  if (input.metric === "bounces") delta.bounce_pct = 1
  if (input.metric === "unsubscribes") delta.unsubscribe_pct = 1
  if (input.metric === "complaints") delta.complaint_pct = 1

  await upsertSequencePerformanceSnapshot(admin, {
    sequenceId,
    sequenceEnrollmentId: enrollmentId,
    delta,
    metadata: {
      delivery_attempt_id: input.deliveryAttemptId,
      experiment_id: metadata?.experiment_id ?? null,
      variant_id: metadata?.experiment_variant_id ?? null,
    },
  }).catch(() => undefined)

  if (row.sender_account_id && ["opens", "clicks", "replies"].includes(input.metric)) {
    await upsertSenderPerformanceSnapshot(admin, {
      senderAccountId: String(row.sender_account_id),
      delta: {
        opens: input.metric === "opens" ? 1 : 0,
        clicks: input.metric === "clicks" ? 1 : 0,
        replies: input.metric === "replies" ? 1 : 0,
      },
    }).catch(() => undefined)
  }

  if (row.provider_id && ["bounces", "complaints"].includes(input.metric)) {
    await upsertProviderRoutePerformanceSnapshot(admin, {
      providerId: String(row.provider_id),
      success: false,
      bounced: input.metric === "bounces",
      complained: input.metric === "complaints",
    }).catch(() => undefined)
  }
}
