import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildCapacityRecommendation,
  buildHealthTrendDirection,
  buildThrottleRecommendation,
  computeMailboxHealthScore,
  deriveMailboxHealthState,
} from "@/lib/growth/deliverability/mailbox-health-score"
import {
  GROWTH_MAILBOX_HEALTH_INTELLIGENCE_QA_MARKER,
  type GrowthMailboxHealthDashboard,
  type GrowthMailboxHealthIntelRow,
  type GrowthMailboxHealthTrendPoint,
} from "@/lib/growth/deliverability/mailbox-health-score-types"
import {
  assessMailboxReputation,
  assessAllMailboxReputations,
  loadMailboxSendPolicy,
} from "@/lib/growth/deliverability/mailbox-reputation-repository"
import { evaluateSendThrottle } from "@/lib/growth/deliverability/send-throttle-engine"
import { loadSenderDeliverabilityPauseState } from "@/lib/growth/deliverability/sender-pause-state"
import { buildWarmupRampGuidance } from "@/lib/growth/deliverability/warmup-ramp-engine"
import { GROWTH_REPUTATION_PROTECTION_PRIVACY_NOTE } from "@/lib/growth/deliverability/reputation-protection-types"
import { getMailboxConnectionBySender } from "@/lib/growth/mailboxes/mailbox-repository"
import { getSenderAccount, listSenderAccounts, updateSenderAccount } from "@/lib/growth/sender/sender-repository"
import {
  computeSenderFatigueScore,
  computeSenderHealthScore,
} from "@/lib/growth/sender-pools/sender-operational-pause"
import {
  isGrowthDeliverabilityH1SchemaReady,
  isGrowthMailboxHealthIntelligenceSchemaReady,
} from "@/lib/growth/deliverability/reputation-protection-schema-health"

function sinceDaysIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

async function countDeliveryOutcomes(
  admin: SupabaseClient,
  senderAccountId: string,
  sinceIso: string,
): Promise<{ sent: number; failed: number }> {
  const [sentRes, failedRes] = await Promise.all([
    admin
      .schema("growth")
      .from("delivery_attempts")
      .select("id", { count: "exact", head: true })
      .eq("sender_account_id", senderAccountId)
      .gte("created_at", sinceIso)
      .eq("status", "sent"),
    admin
      .schema("growth")
      .from("delivery_attempts")
      .select("id", { count: "exact", head: true })
      .eq("sender_account_id", senderAccountId)
      .gte("created_at", sinceIso)
      .in("status", ["failed", "cancelled"]),
  ])
  return { sent: sentRes.count ?? 0, failed: failedRes.count ?? 0 }
}

async function countWarmupThrottleEvents(
  admin: SupabaseClient,
  senderAccountId: string,
  sinceIso: string,
): Promise<number> {
  const { data: profile } = await admin
    .schema("growth")
    .from("warmup_profiles")
    .select("id")
    .eq("sender_account_id", senderAccountId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!profile) return 0
  const profileId = String((profile as Record<string, unknown>).id)

  const { count } = await admin
    .schema("growth")
    .from("warmup_events")
    .select("id", { count: "exact", head: true })
    .eq("warmup_profile_id", profileId)
    .gte("created_at", sinceIso)
    .in("severity", ["high", "critical"])
    .eq("resolved", false)
    .in("event_type", ["warmup_throttled", "warmup_health_warning", "warmup_volume_behind", "warmup_progress_stalled"])

  return count ?? 0
}

async function loadWarmupProfileRow(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .schema("growth")
    .from("warmup_profiles")
    .select(
      "status, warmup_progress, target_daily_volume, current_daily_volume, sends_today, sends_today_date, throttled_at",
    )
    .eq("sender_account_id", senderAccountId)
    .is("deleted_at", null)
    .maybeSingle()
  return (data as Record<string, unknown>) ?? null
}

async function loadHealthTrend(
  admin: SupabaseClient,
  senderAccountId: string,
  days = 14,
): Promise<GrowthMailboxHealthTrendPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data } = await admin
    .schema("growth")
    .from("mailbox_reputation_snapshots")
    .select("snapshot_date, risk_score, health_state, risk_score_delta")
    .eq("sender_account_id", senderAccountId)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: true })

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const risk = Number(r.risk_score ?? 0)
    const healthState = String(r.health_state ?? "warning")
    return {
      snapshot_date: String(r.snapshot_date),
      health_score: Number(r.health_score ?? risk),
      health_state: healthState as GrowthMailboxHealthTrendPoint["health_state"],
      risk_score_delta:
        r.risk_score_delta != null && Number.isFinite(Number(r.risk_score_delta))
          ? Number(r.risk_score_delta)
          : null,
    }
  })
}

export async function buildMailboxHealthIntelRow(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<GrowthMailboxHealthIntelRow | null> {
  const assessment = await assessMailboxReputation(admin, senderAccountId)
  if (!assessment) return null

  const sender = await getSenderAccount(admin, senderAccountId)
  if (!sender) return null

  const since7d = sinceDaysIso(7)
  const [outcomes, throttleEvents, pauseState, policy, warmupRow] = await Promise.all([
    countDeliveryOutcomes(admin, senderAccountId, since7d),
    countWarmupThrottleEvents(admin, senderAccountId, since7d),
    loadSenderDeliverabilityPauseState(admin, senderAccountId),
    loadMailboxSendPolicy(admin, senderAccountId),
    loadWarmupProfileRow(admin, senderAccountId),
  ])

  const attempted = outcomes.sent + outcomes.failed
  const delivery_success_rate =
    attempted > 0 ? Number(((outcomes.sent / attempted) * 100).toFixed(1)) : 100

  const warmupStatus = warmupRow ? String(warmupRow.status ?? "") : null
  const warmupThrottled = warmupStatus === "throttled"

  const scoreInput = {
    assessment,
    sender_status: sender.status,
    sender_health_status: sender.health_status,
    warmup_status: warmupStatus,
    warmup_throttled: warmupThrottled,
    deliverability_paused: pauseState?.paused ?? false,
    throttle_events_7d: throttleEvents,
    delivery_success_rate,
  }

  const health_score = computeMailboxHealthScore(scoreInput)
  const health_state = deriveMailboxHealthState(scoreInput)
  const throttle = evaluateSendThrottle({ policy, assessment })

  const today = new Date().toISOString().slice(0, 10)
  const sendsToday =
    warmupRow && String(warmupRow.sends_today_date ?? "") === today
      ? Number(warmupRow.sends_today ?? sender.daily_send_used)
      : sender.daily_send_used

  const ramp = buildWarmupRampGuidance({
    sender_email: sender.email_address,
    warmup_enabled: sender.warmup_enabled,
    warmup_status: warmupStatus,
    warmup_progress: warmupRow ? Number(warmupRow.warmup_progress ?? null) : null,
    target_daily_volume: warmupRow ? Number(warmupRow.target_daily_volume ?? policy.daily_send_cap) : null,
    current_daily_volume: warmupRow ? Number(warmupRow.current_daily_volume ?? policy.daily_send_cap) : null,
    daily_send_used: sendsToday,
    bounce_rate: assessment.metrics.bounce_rate,
  })

  const daily_capacity = sender.warmup_enabled
    ? Math.min(policy.daily_send_cap, ramp.recommended_max_daily_volume)
    : policy.daily_send_cap

  const capUtil =
    daily_capacity > 0 ? Math.round((sendsToday / daily_capacity) * 100) : 0

  const throttle_status: GrowthMailboxHealthIntelRow["throttle_status"] = throttle.paused
    ? "paused"
    : throttle.throttled
      ? "throttled"
      : "ok"

  const health_trend = await loadHealthTrend(admin, senderAccountId)

  return {
    sender_account_id: senderAccountId,
    mailbox_connection_id: assessment.metrics.mailbox_connection_id,
    email_address: assessment.metrics.email_address,
    health_score,
    health_state,
    reputation_tier: assessment.health_tier,
    warmup_status: warmupStatus,
    warmup_progress: warmupRow ? Number(warmupRow.warmup_progress ?? null) : assessment.metrics.warmup_progress,
    daily_capacity,
    sends_today: sendsToday,
    bounce_rate: assessment.metrics.bounce_rate,
    reply_rate: assessment.metrics.reply_rate,
    complaint_rate: assessment.metrics.spam_complaint_rate,
    unsubscribe_rate: assessment.metrics.unsubscribe_rate,
    delivery_success_rate,
    send_volume_7d: assessment.metrics.rolling_7d_send_volume,
    throttle_status,
    throttle_recommendation: buildThrottleRecommendation({
      throttled: throttle.throttled,
      paused: throttle.paused,
      reason: throttle.reason,
      minimum_delay_seconds: throttle.recommended_delay_seconds,
    }),
    capacity_recommendation: buildCapacityRecommendation({
      daily_capacity,
      sends_today: sendsToday,
      warmup_status: warmupStatus,
      cap_utilization_pct: capUtil,
      unsafe_to_scale: ramp.unsafe_to_scale,
    }),
    health_trend,
    primary_risk_reason: assessment.risk_reasons[0] ?? null,
  }
}

export async function syncSenderHealthFromIntelRow(
  admin: SupabaseClient,
  row: GrowthMailboxHealthIntelRow,
): Promise<void> {
  const senderHealth =
    row.health_state === "critical" || row.health_state === "disabled"
      ? "critical"
      : row.health_state === "at_risk"
        ? "degraded"
        : row.health_state === "warning"
          ? "warming"
          : "healthy"

  await updateSenderAccount(admin, row.sender_account_id, {
    health_status: senderHealth,
  }).catch(() => undefined)
}

export async function persistMailboxHealthSnapshotFields(
  admin: SupabaseClient,
  row: GrowthMailboxHealthIntelRow,
): Promise<void> {
  const schemaReady = await isGrowthMailboxHealthIntelligenceSchemaReady(admin)
  if (!schemaReady) return

  const snapshotDate = new Date().toISOString().slice(0, 10)
  const { error } = await admin
    .schema("growth")
    .from("mailbox_reputation_snapshots")
    .update({
      health_score: row.health_score,
      health_state: row.health_state,
      delivery_success_rate: row.delivery_success_rate,
      throttle_status: row.throttle_status,
      metadata: {
        snapshot_source: "mailbox_health_intelligence_v1",
        trend_direction: buildHealthTrendDirection(row.health_trend),
      },
    })
    .eq("sender_account_id", row.sender_account_id)
    .eq("snapshot_date", snapshotDate)

  if (error) {
    const { error: upsertErr } = await admin.schema("growth").from("mailbox_reputation_snapshots").upsert(
      {
        sender_account_id: row.sender_account_id,
        mailbox_connection_id: row.mailbox_connection_id,
        snapshot_date: snapshotDate,
        email_address: row.email_address,
        health_score: row.health_score,
        health_state: row.health_state,
        delivery_success_rate: row.delivery_success_rate,
        throttle_status: row.throttle_status,
        risk_score: row.health_score,
        health_tier: row.reputation_tier,
        metadata: { snapshot_source: "mailbox_health_intelligence_v1" },
      },
      { onConflict: "sender_account_id,snapshot_date" },
    )
    if (upsertErr) throw new Error(upsertErr.message)
    return
  }
}

export async function buildMailboxHealthIntelligenceDashboard(
  admin: SupabaseClient,
): Promise<GrowthMailboxHealthDashboard> {
  const senders = await listSenderAccounts(admin)
  const rows: GrowthMailboxHealthIntelRow[] = []

  for (const sender of senders.slice(0, 50)) {
    const row = await buildMailboxHealthIntelRow(admin, sender.id)
    if (row) rows.push(row)
  }

  rows.sort((a, b) => a.health_score - b.health_score)

  const summary = {
    total_mailboxes: rows.length,
    healthy_count: rows.filter((r) => r.health_state === "healthy").length,
    warning_count: rows.filter((r) => r.health_state === "warning").length,
    at_risk_count: rows.filter((r) => r.health_state === "at_risk").length,
    critical_count: rows.filter((r) => r.health_state === "critical").length,
    disabled_count: rows.filter((r) => r.health_state === "disabled").length,
    average_health_score:
      rows.length > 0
        ? Math.round(rows.reduce((sum, r) => sum + r.health_score, 0) / rows.length)
        : 100,
    throttled_count: rows.filter((r) => r.throttle_status === "throttled").length,
    paused_count: rows.filter((r) => r.throttle_status === "paused").length,
  }

  const recommended_actions = [
    ...new Set(
      rows
        .filter((r) => r.health_state !== "healthy")
        .flatMap((r) => [r.throttle_recommendation, r.capacity_recommendation, r.primary_risk_reason])
        .filter((v): v is string => Boolean(v)),
    ),
  ].slice(0, 10)

  return {
    qa_marker: GROWTH_MAILBOX_HEALTH_INTELLIGENCE_QA_MARKER,
    privacy_note: GROWTH_REPUTATION_PROTECTION_PRIVACY_NOTE,
    summary,
    mailboxes: rows,
    recommended_actions,
    last_calculated_at: new Date().toISOString(),
  }
}

export type GrowthMailboxHealthRollupResult = {
  qa_marker: typeof GROWTH_MAILBOX_HEALTH_INTELLIGENCE_QA_MARKER
  processed: number
  synced_sender_health: number
  snapshots_updated: number
}

async function persistSenderReputationSnapshot(
  admin: SupabaseClient,
  row: GrowthMailboxHealthIntelRow,
): Promise<void> {
  const snapshotDate = new Date().toISOString().slice(0, 10)
  await admin.schema("growth").from("sender_reputation_snapshots").upsert(
    {
      sender_account_id: row.sender_account_id,
      snapshot_date: snapshotDate,
      deliverability_score: row.health_score,
      bounce_rate: row.bounce_rate,
      reply_rate: row.reply_rate,
      spam_risk: row.complaint_rate >= 0.3 ? 85 : row.complaint_rate >= 0.1 ? 50 : 15,
      daily_send_volume: row.sends_today,
    },
    { onConflict: "sender_account_id,snapshot_date" },
  )
}

export async function runMailboxHealthIntelligenceRollup(
  admin: SupabaseClient,
  options?: { skipReputationAssess?: boolean },
): Promise<GrowthMailboxHealthRollupResult> {
  if (!options?.skipReputationAssess) {
    await assessAllMailboxReputations(admin, { persistSnapshots: true })
  }

  const senders = await listSenderAccounts(admin)
  let synced = 0
  let snapshotsUpdated = 0

  for (const sender of senders.slice(0, 50)) {
    const row = await buildMailboxHealthIntelRow(admin, sender.id)
    if (!row) continue
    await syncSenderHealthFromIntelRow(admin, row)
    synced += 1
    await persistMailboxHealthSnapshotFields(admin, row).catch(() => undefined)
    snapshotsUpdated += 1
    await persistSenderReputationSnapshot(admin, row).catch(() => undefined)
  }

  return {
    qa_marker: GROWTH_MAILBOX_HEALTH_INTELLIGENCE_QA_MARKER,
    processed: senders.length,
    synced_sender_health: synced,
    snapshots_updated: snapshotsUpdated,
  }
}

/** Legacy operational health (Phase 2 deliverability intelligence). */
export type MailboxOperationalHealth = {
  senderAccountId: string
  mailboxConnectionId: string | null
  emailAddress: string
  trustScore: number
  fatigueScore: number
  operationalStatus: "healthy" | "degraded" | "critical" | "paused"
  riskReasons: string[]
  cooldownRecommendation: string | null
  signals: {
    oauthFailures: number
    tokenRefreshFailures: number
    providerRejections24h: number
    bounces24h: number
    complaints24h: number
    sendFailures24h: number
    webhookSilenceHours: number | null
    dailyCapUtilization: number
  }
}

function since24hIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export async function computeMailboxOperationalHealth(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<MailboxOperationalHealth | null> {
  const sender = await getSenderAccount(admin, senderAccountId)
  if (!sender || sender.deleted_at) return null

  const mailbox = await getMailboxConnectionBySender(admin, senderAccountId).catch(() => null)
  const since24h = since24hIso()

  const [{ count: failedSends }, { count: bounces }, { count: complaints }] = await Promise.all([
    admin
      .schema("growth")
      .from("delivery_attempts")
      .select("id", { count: "exact", head: true })
      .eq("sender_account_id", senderAccountId)
      .eq("status", "failed")
      .gte("created_at", since24h),
    admin
      .schema("growth")
      .from("email_bounces")
      .select("id", { count: "exact", head: true })
      .eq("sender_account_id", senderAccountId)
      .gte("occurred_at", since24h),
    admin
      .schema("growth")
      .from("email_complaints")
      .select("id", { count: "exact", head: true })
      .eq("sender_account_id", senderAccountId)
      .gte("occurred_at", since24h),
  ])

  const { data: auditEvents } = await admin
    .schema("growth")
    .from("internal_outbound_audit_events")
    .select("event_type")
    .eq("sender_account_id", senderAccountId)
    .gte("created_at", since24h)

  const oauthFailures = (auditEvents ?? []).filter((e) => e.event_type === "oauth_failure").length
  const tokenRefreshFailures = (auditEvents ?? []).filter((e) => e.event_type === "token_refresh_failure").length

  const { data: lastWebhook } = await admin
    .schema("growth")
    .from("provider_delivery_events")
    .select("occurred_at")
    .eq("sender_account_id", senderAccountId)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let webhookSilenceHours: number | null = null
  if (lastWebhook?.occurred_at) {
    webhookSilenceHours = Math.round((Date.now() - Date.parse(String(lastWebhook.occurred_at))) / 3600000)
  } else if (sender.last_send_at) {
    webhookSilenceHours = Math.round((Date.now() - Date.parse(sender.last_send_at)) / 3600000)
  }

  const dailyCapUtilization =
    sender.daily_send_limit > 0 ? Math.round((sender.daily_send_used / sender.daily_send_limit) * 100) : 0

  const bounceRate = sender.daily_send_used > 0 ? ((bounces ?? 0) / sender.daily_send_used) * 100 : 0
  const fatigueScore = computeSenderFatigueScore({
    recentVolume: sender.daily_send_used,
    bounceRisk: bounceRate,
    complaintRisk: (complaints ?? 0) * 10,
    warmupProgress: sender.warmup_enabled ? 50 : 100,
    warmupEnabled: sender.warmup_enabled,
  })

  const trustScore = computeSenderHealthScore({
    healthScore: sender.sender_score,
    bounceRisk: bounceRate,
    complaintRisk: (complaints ?? 0) * 10,
    memberStatus: sender.health_status === "critical" ? "paused" : "eligible",
    dailyCapRemaining: Math.max(0, sender.daily_send_limit - sender.daily_send_used),
  })

  const riskReasons: string[] = []
  if (mailbox && !["connected", "healthy", "warning"].includes(mailbox.status)) {
    riskReasons.push(`Mailbox status: ${mailbox.status}`)
  }
  if (oauthFailures > 0) riskReasons.push(`${oauthFailures} OAuth failure(s) in 24h.`)
  if (tokenRefreshFailures > 0) riskReasons.push(`${tokenRefreshFailures} token refresh failure(s) in 24h.`)
  if ((failedSends ?? 0) >= 3) riskReasons.push(`${failedSends} send failures in 24h.`)
  if ((bounces ?? 0) >= 2) riskReasons.push(`${bounces} bounces in 24h.`)
  if ((complaints ?? 0) >= 1) riskReasons.push(`${complaints} complaint(s) in 24h.`)
  if (webhookSilenceHours != null && webhookSilenceHours >= 48 && sender.last_send_at) {
    riskReasons.push(`Webhook silence ~${webhookSilenceHours}h after recent sends.`)
  }

  let operationalStatus: MailboxOperationalHealth["operationalStatus"] = "healthy"
  if (sender.status === "disabled" || mailbox?.status === "disabled") operationalStatus = "paused"
  else if (trustScore < 30 || oauthFailures >= 2) operationalStatus = "critical"
  else if (trustScore < 55 || riskReasons.length >= 2) operationalStatus = "degraded"

  const cooldownRecommendation =
    fatigueScore >= 70
      ? "Recommend cooldown — fatigue score elevated."
      : dailyCapUtilization >= 95
        ? "Daily cap nearly exhausted."
        : null

  return {
    senderAccountId,
    mailboxConnectionId: mailbox?.id ?? null,
    emailAddress: sender.email_address,
    trustScore,
    fatigueScore,
    operationalStatus,
    riskReasons,
    cooldownRecommendation,
    signals: {
      oauthFailures,
      tokenRefreshFailures,
      providerRejections24h: failedSends ?? 0,
      bounces24h: bounces ?? 0,
      complaints24h: complaints ?? 0,
      sendFailures24h: failedSends ?? 0,
      webhookSilenceHours,
      dailyCapUtilization,
    },
  }
}

export async function persistMailboxHealthSnapshot(
  admin: SupabaseClient,
  health: MailboxOperationalHealth,
): Promise<void> {
  const { error } = await admin.schema("growth").from("mailbox_health_snapshots").upsert(
    {
      sender_account_id: health.senderAccountId,
      mailbox_connection_id: health.mailboxConnectionId,
      snapshot_date: new Date().toISOString().slice(0, 10),
      trust_score: health.trustScore,
      fatigue_score: health.fatigueScore,
      operational_status: health.operationalStatus,
      risk_reasons: health.riskReasons,
      metadata: health.signals,
    },
    { onConflict: "sender_account_id,snapshot_date" },
  )
  if (error) console.error("[mailbox-health-snapshot]", error.message)
}
