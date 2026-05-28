import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { aggregateMailboxEngagementMetrics } from "@/lib/growth/deliverability/mailbox-engagement-metrics"
import {
  aggregateBounceTrend,
  aggregateComplaintTrend,
  computeMailboxReputationAssessment,
} from "@/lib/growth/deliverability/mailbox-reputation-engine"
import { getMailboxConnectionBySender } from "@/lib/growth/mailboxes/mailbox-repository"
import type {
  GrowthMailboxReputationAssessment,
  GrowthMailboxReputationMetrics,
  GrowthMailboxSendPolicy,
} from "@/lib/growth/deliverability/reputation-protection-types"
import { DEFAULT_MAILBOX_SEND_POLICY } from "@/lib/growth/deliverability/send-throttle-engine"
import {
  isGrowthDeliverabilityH1SchemaReady,
  isGrowthDeliverabilityReputationProtectionSchemaReady,
} from "@/lib/growth/deliverability/reputation-protection-schema-health"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"

function sinceDaysIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function ratePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Number(((numerator / denominator) * 100).toFixed(2))
}

async function countSince(
  admin: SupabaseClient,
  table: "delivery_attempts" | "email_bounces" | "email_complaints",
  senderAccountId: string,
  sinceIso: string,
  status?: string,
): Promise<number> {
  let query = admin
    .schema("growth")
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("sender_account_id", senderAccountId)
    .gte(table === "delivery_attempts" ? "created_at" : "occurred_at", sinceIso)

  if (status && table === "delivery_attempts") {
    query = query.eq("status", status)
  }

  const { count } = await query
  return count ?? 0
}

export async function loadMailboxSendPolicy(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<GrowthMailboxSendPolicy> {
  const ready = await isGrowthDeliverabilityReputationProtectionSchemaReady(admin)
  if (!ready) {
    return { ...DEFAULT_MAILBOX_SEND_POLICY, sender_account_id: senderAccountId }
  }

  const { data } = await admin
    .schema("growth")
    .from("mailbox_send_policies")
    .select("*")
    .eq("sender_account_id", senderAccountId)
    .maybeSingle()

  if (!data) {
    const sender = (await listSenderAccounts(admin)).find((row) => row.id === senderAccountId)
    return {
      ...DEFAULT_MAILBOX_SEND_POLICY,
      sender_account_id: senderAccountId,
      daily_send_cap: sender?.daily_send_limit ?? 50,
    }
  }

  const row = data as Record<string, unknown>
  return {
    sender_account_id: senderAccountId,
    daily_send_cap: Number(row.daily_send_cap ?? 50),
    hourly_send_cap: Number(row.hourly_send_cap ?? 12),
    minimum_delay_seconds: Number(row.minimum_delay_seconds ?? 120),
    sequence_concurrency_limit: Number(row.sequence_concurrency_limit ?? 3),
    cooldown_hours: Number(row.cooldown_hours ?? 24),
    auto_pause_on_bounce_threshold: Number(row.auto_pause_on_bounce_threshold ?? 8),
    auto_pause_on_complaint_threshold: Number(row.auto_pause_on_complaint_threshold ?? 0.3),
    operator_override: Boolean(row.operator_override),
    override_reason: typeof row.override_reason === "string" ? row.override_reason : null,
  }
}

export async function assessMailboxReputation(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<GrowthMailboxReputationAssessment | null> {
  const senders = await listSenderAccounts(admin)
  const sender = senders.find((row) => row.id === senderAccountId)
  if (!sender) return null

  const mailbox = await getMailboxConnectionBySender(admin, senderAccountId).catch(() => null)
  const since24h = sinceDaysIso(1)
  const since7d = sinceDaysIso(7)
  const since30d = sinceDaysIso(30)

  const [sent24h, sent7d, sent30d, bounces24h, complaints24h, sequences] = await Promise.all([
    countSince(admin, "delivery_attempts", senderAccountId, since24h, "sent"),
    countSince(admin, "delivery_attempts", senderAccountId, since7d, "sent"),
    countSince(admin, "delivery_attempts", senderAccountId, since30d, "sent"),
    countSince(admin, "email_bounces", senderAccountId, since24h),
    countSince(admin, "email_complaints", senderAccountId, since24h),
    admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("manual_sender_account_id", senderAccountId)
      .in("status", ["active", "paused"]),
  ])

  const engagementRates = await aggregateMailboxEngagementMetrics(admin, {
    senderAccountId,
    mailboxConnectionId: mailbox?.id ?? null,
    since7d,
    sent7d,
  }).catch(() => ({
    reply_rate: 0,
    positive_reply_rate: 0,
    unsubscribe_rate: 0,
    open_rate: 0,
  }))

  const inactivityDays = sender.last_send_at
    ? Math.max(0, Math.round((Date.now() - Date.parse(sender.last_send_at)) / 86400000))
    : 0

  let warmupStatus: string | null = sender.warmup_enabled ? "warming" : "not_started"
  let warmupProgress: number | null = null
  const { data: warmupProfile } = await admin
    .schema("growth")
    .from("warmup_profiles")
    .select("status, warmup_progress")
    .eq("sender_account_id", senderAccountId)
    .is("deleted_at", null)
    .maybeSingle()

  if (warmupProfile) {
    warmupStatus = String((warmupProfile as Record<string, unknown>).status ?? warmupStatus)
    warmupProgress =
      typeof (warmupProfile as Record<string, unknown>).warmup_progress === "number"
        ? ((warmupProfile as Record<string, unknown>).warmup_progress as number)
        : null
  }

  const metrics: GrowthMailboxReputationMetrics = {
    sender_account_id: senderAccountId,
    mailbox_connection_id: mailbox?.id ?? null,
    email_address: sender.email_address,
    daily_send_count: sender.daily_send_used,
    rolling_7d_send_volume: sent7d,
    rolling_30d_send_volume: sent30d,
    bounce_rate: ratePercent(bounces24h, Math.max(sent24h, sender.daily_send_used, 1)),
    reply_rate: engagementRates.reply_rate,
    positive_reply_rate: engagementRates.positive_reply_rate,
    unsubscribe_rate: engagementRates.unsubscribe_rate,
    spam_complaint_rate: ratePercent(complaints24h, Math.max(sent24h, 1)),
    open_rate: engagementRates.open_rate,
    inactivity_days: inactivityDays,
    sequence_participation_count: sequences.count ?? 0,
    warmup_status: warmupStatus,
    warmup_progress: warmupProgress,
  }

  const capUtil =
    sender.daily_send_limit > 0
      ? Math.round((sender.daily_send_used / sender.daily_send_limit) * 100)
      : 0

  return computeMailboxReputationAssessment({
    metrics,
    sender_status: sender.status,
    sender_health_status: sender.health_status,
    daily_cap_utilization_pct: capUtil,
  })
}

export async function persistMailboxReputationSnapshot(
  admin: SupabaseClient,
  assessment: GrowthMailboxReputationAssessment,
): Promise<void> {
  const ready = await isGrowthDeliverabilityReputationProtectionSchemaReady(admin)
  if (!ready) return

  const m = assessment.metrics
  const snapshotDate = new Date().toISOString().slice(0, 10)

  const { data: previous } = await admin
    .schema("growth")
    .from("mailbox_reputation_snapshots")
    .select("risk_score, health_tier")
    .eq("sender_account_id", m.sender_account_id)
    .lt("snapshot_date", snapshotDate)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  const previousRow = previous as Record<string, unknown> | null
  const previousScore = previousRow ? Number(previousRow.risk_score) : assessment.risk_score
  const previousTier = previousRow ? String(previousRow.health_tier) : assessment.health_tier
  const riskScoreDelta = assessment.risk_score - previousScore
  const healthTierChanged = previousTier !== assessment.health_tier
  const h1Ready = await isGrowthDeliverabilityH1SchemaReady(admin)

  await admin.schema("growth").from("mailbox_reputation_snapshots").upsert(
    {
      sender_account_id: m.sender_account_id,
      mailbox_connection_id: m.mailbox_connection_id,
      snapshot_date: snapshotDate,
      email_address: m.email_address,
      daily_send_count: m.daily_send_count,
      rolling_7d_send_volume: m.rolling_7d_send_volume,
      rolling_30d_send_volume: m.rolling_30d_send_volume,
      bounce_rate: m.bounce_rate,
      reply_rate: m.reply_rate,
      positive_reply_rate: m.positive_reply_rate,
      unsubscribe_rate: m.unsubscribe_rate,
      spam_complaint_rate: m.spam_complaint_rate,
      open_rate: m.open_rate,
      inactivity_days: m.inactivity_days,
      sequence_participation_count: m.sequence_participation_count,
      warmup_status: m.warmup_status,
      warmup_progress: m.warmup_progress,
      risk_score: assessment.risk_score,
      health_tier: assessment.health_tier,
      risk_reasons: assessment.risk_reasons,
      recommended_actions: assessment.recommended_actions,
      score_explanation: assessment.score_explanation,
      ...(h1Ready
        ? {
            risk_score_delta: riskScoreDelta,
            previous_health_tier: previousTier,
            health_tier_changed: healthTierChanged,
          }
        : {}),
      metadata: { snapshot_source: "reputation_protection" },
    },
    { onConflict: "sender_account_id,snapshot_date" },
  )
}

export async function assessAllMailboxReputations(
  admin: SupabaseClient,
  options?: { persistSnapshots?: boolean },
): Promise<GrowthMailboxReputationAssessment[]> {
  const senders = await listSenderAccounts(admin)
  const assessments: GrowthMailboxReputationAssessment[] = []
  const persist = options?.persistSnapshots !== false

  for (const sender of senders.slice(0, 50)) {
    const assessment = await assessMailboxReputation(admin, sender.id)
    if (assessment) {
      assessments.push(assessment)
      if (persist) {
        await persistMailboxReputationSnapshot(admin, assessment).catch(() => undefined)
      }
    }
  }

  return assessments.sort((a, b) => a.risk_score - b.risk_score)
}

export function buildReputationTrendSections(assessments: GrowthMailboxReputationAssessment[]) {
  return {
    bounce_trends: aggregateBounceTrend(assessments),
    complaint_trends: aggregateComplaintTrend(assessments),
  }
}
