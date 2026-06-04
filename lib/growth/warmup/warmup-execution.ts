import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendDeliverabilityGovernanceEvent } from "@/lib/growth/deliverability/deliverability-governance-events"
import { assessMailboxReputation } from "@/lib/growth/deliverability/mailbox-reputation-repository"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import { getSenderAccount, incrementSenderDailySendUsed, updateSenderAccount } from "@/lib/growth/sender/sender-repository"
import { computeCurrentWarmupDay } from "@/lib/growth/warmup/warmup-health"
import {
  GROWTH_NATIVE_WARMUP_EXECUTION_QA_MARKER,
  type GrowthWarmupProgressionRunResult,
} from "@/lib/growth/warmup/warmup-execution-types"
import { getPlannedVolumeForDay, interpolateWarmupVolume } from "@/lib/growth/warmup/warmup-scheduler"
import type { GrowthWarmupProfile, GrowthWarmupProfileStatus } from "@/lib/growth/warmup/warmup-types"
import { getWarmupProfile, recomputeWarmupProfile } from "@/lib/growth/warmup/warmup-repository"

function utcDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export async function getWarmupProfileForSender(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<GrowthWarmupProfile | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("warmup_profiles")
    .select("id")
    .eq("sender_account_id", senderAccountId)
    .is("deleted_at", null)
    .in("status", ["new", "warming", "active", "throttled", "paused"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return getWarmupProfile(admin, String((data as Record<string, unknown>).id))
}

export function resolveWarmupDailyCapacity(profile: GrowthWarmupProfile, dayNumber?: number): number {
  const day = dayNumber ?? profile.current_warmup_day ?? computeCurrentWarmupDay(profile.started_at)
  const schedule = (profile.schedule ?? []).map((row) => ({
    day_number: row.day_number,
    planned_volume: row.planned_volume,
  }))
  if (schedule.length > 0) {
    return getPlannedVolumeForDay(schedule, day)
  }
  return interpolateWarmupVolume(day)
}

export async function syncSenderWarmupCapacity(
  admin: SupabaseClient,
  profile: GrowthWarmupProfile,
): Promise<void> {
  const dailyCap = resolveWarmupDailyCapacity(profile)
  const warmupActive = profile.status === "warming" || profile.status === "throttled"
  const senderHealth =
    profile.status === "throttled" || profile.warmup_health === "critical"
      ? "degraded"
      : profile.status === "warming"
        ? "warming"
        : profile.warmup_health === "degraded"
          ? "degraded"
          : "healthy"

  await updateSenderAccount(admin, profile.sender_account_id, {
    warmup_eligible: true,
    warmup_enabled: warmupActive,
    daily_send_limit: profile.status === "active" ? Math.max(dailyCap, profile.target_daily_volume) : dailyCap,
    daily_send_used: profile.sends_today,
  })

  const sender = await getSenderAccount(admin, profile.sender_account_id)
  if (sender && sender.health_status !== "blocked") {
    await admin
      .schema("growth")
      .from("sender_accounts")
      .update({ health_status: senderHealth, updated_at: new Date().toISOString() })
      .eq("id", profile.sender_account_id)
      .is("deleted_at", null)
  }

  const now = new Date().toISOString()
  await admin
    .schema("growth")
    .from("warmup_profiles")
    .update({
      current_daily_volume: dailyCap,
      current_warmup_day: profile.current_warmup_day,
      last_capacity_sync_at: now,
      updated_at: now,
    })
    .eq("id", profile.id)
    .is("deleted_at", null)
}

async function emitWarmupStageChanged(
  admin: SupabaseClient,
  input: {
    profile: GrowthWarmupProfile
    previousStatus: GrowthWarmupProfileStatus
    nextStatus: GrowthWarmupProfileStatus
    reason?: string
  },
): Promise<void> {
  if (input.previousStatus === input.nextStatus) return

  await appendDeliverabilityGovernanceEvent(admin, {
    event_type: "warmup_stage_changed",
    sender_account_id: input.profile.sender_account_id,
    title: `Warmup stage: ${input.previousStatus} → ${input.nextStatus}`,
    summary: input.reason ?? `Mailbox warmup lifecycle updated for ${input.profile.sender_email}.`,
    severity: input.nextStatus === "throttled" ? "high" : "low",
    reversible: input.nextStatus !== "disabled",
    metadata: {
      previous_status: input.previousStatus,
      next_status: input.nextStatus,
      warmup_profile_id: input.profile.id,
    },
  }).catch(() => undefined)

  await recordInternalOutboundAuditEvent(admin, {
    eventType: "warmup_stage_changed",
    severity: input.nextStatus === "throttled" ? "high" : "low",
    title: "Warmup lifecycle stage changed",
    summary: `${input.profile.sender_email}: ${input.previousStatus} → ${input.nextStatus}`,
    senderAccountId: input.profile.sender_account_id,
    metadata: {
      warmup_profile_id: input.profile.id,
      previous_status: input.previousStatus,
      next_status: input.nextStatus,
    },
  }).catch(() => undefined)
}

export async function recordNativeWarmupSend(
  admin: SupabaseClient,
  input: { senderAccountId: string; deliveryAttemptId?: string | null },
): Promise<void> {
  const profile = await getWarmupProfileForSender(admin, input.senderAccountId)
  if (!profile) return
  if (!["warming", "throttled", "active"].includes(profile.status)) return

  const today = utcDateString()
  let sendsToday = profile.sends_today
  if (profile.sends_today_date !== today) {
    sendsToday = 0
  }
  sendsToday += 1

  const dayNumber = computeCurrentWarmupDay(profile.started_at)
  const dailyCap = resolveWarmupDailyCapacity(profile, dayNumber)
  const now = new Date().toISOString()

  await admin
    .schema("growth")
    .from("warmup_profiles")
    .update({
      sends_today: sendsToday,
      sends_today_date: today,
      current_warmup_day: dayNumber,
      last_progress_at: now,
      updated_at: now,
    })
    .eq("id", profile.id)
    .is("deleted_at", null)

  const scheduleDay = (profile.schedule ?? []).find((row) => row.day_number === dayNumber)
  if (scheduleDay) {
    const nextActual = (scheduleDay.actual_volume ?? 0) + 1
    const completed = nextActual >= scheduleDay.planned_volume
    await admin
      .schema("growth")
      .from("warmup_schedule")
      .update({
        actual_volume: nextActual,
        completed,
        completed_at: completed ? now : scheduleDay.completed_at,
      })
      .eq("id", scheduleDay.id)
  }

  await incrementSenderDailySendUsed(admin, input.senderAccountId, 1).catch(() => undefined)

  const refreshed = await getWarmupProfile(admin, profile.id)
  if (!refreshed) return

  if (refreshed.status === "warming" && sendsToday >= dailyCap) {
    await recomputeWarmupProfile(admin, profile.id, {})
  }

  if (input.deliveryAttemptId) {
    await recordInternalOutboundAuditEvent(admin, {
      eventType: "warmup_send_recorded",
      severity: "low",
      title: "Warmup send counted",
      summary: `${refreshed.sender_email} send ${sendsToday}/${dailyCap} on day ${dayNumber}.`,
      senderAccountId: input.senderAccountId,
      metadata: {
        warmup_profile_id: profile.id,
        delivery_attempt_id: input.deliveryAttemptId,
        sends_today: sendsToday,
        daily_cap: dailyCap,
      },
    }).catch(() => undefined)
  }
}

export async function runWarmupProgressionForProfile(
  admin: SupabaseClient,
  profileId: string,
): Promise<{ capacity_synced: boolean; day_advanced: boolean; throttled: boolean; activated: boolean; daily_reset: boolean }> {
  const profile = await getWarmupProfile(admin, profileId)
  if (!profile) {
    return { capacity_synced: false, day_advanced: false, throttled: false, activated: false, daily_reset: false }
  }

  if (["disabled", "paused", "new"].includes(profile.status)) {
    return { capacity_synced: false, day_advanced: false, throttled: false, activated: false, daily_reset: false }
  }

  const today = utcDateString()
  let dailyReset = false
  let sendsToday = profile.sends_today
  if (profile.sends_today_date !== today) {
    sendsToday = 0
    dailyReset = true
    await admin
      .schema("growth")
      .from("warmup_profiles")
      .update({ sends_today: 0, sends_today_date: today, updated_at: new Date().toISOString() })
      .eq("id", profile.id)

    await updateSenderAccount(admin, profile.sender_account_id, { daily_send_used: 0 }).catch(() => undefined)
  }

  const dayNumber = computeCurrentWarmupDay(profile.started_at)
  const dayAdvanced = dayNumber !== profile.current_warmup_day
  if (dayAdvanced) {
    await admin
      .schema("growth")
      .from("warmup_profiles")
      .update({ current_warmup_day: dayNumber, updated_at: new Date().toISOString() })
      .eq("id", profile.id)
  }

  let nextStatus = profile.status
  let throttleReason: string | null = profile.throttle_reason
  let throttled = false
  let activated = false

  const reputation = await assessMailboxReputation(admin, profile.sender_account_id).catch(() => null)
  if (
    reputation &&
    (reputation.health_tier === "critical" || reputation.risk_score >= 75) &&
    profile.status === "warming"
  ) {
    nextStatus = "throttled"
    throttleReason = reputation.risk_reasons[0] ?? "Reputation protection requires reduced velocity."
    throttled = true
  } else if (profile.status === "throttled" && reputation && reputation.health_tier === "healthy") {
    nextStatus = "warming"
    throttleReason = null
  }

  const refreshedForProgress = await getWarmupProfile(admin, profileId)
  if (refreshedForProgress && refreshedForProgress.warmup_progress >= 100 && refreshedForProgress.status === "warming") {
    nextStatus = "active"
    activated = true
  }

  if (nextStatus !== profile.status) {
    const now = new Date().toISOString()
    await admin
      .schema("growth")
      .from("warmup_profiles")
      .update({
        status: nextStatus,
        throttled_at: nextStatus === "throttled" ? profile.throttled_at ?? now : null,
        throttle_reason: nextStatus === "throttled" ? throttleReason : null,
        completed_at: nextStatus === "active" ? profile.completed_at ?? now : profile.completed_at,
        updated_at: now,
      })
      .eq("id", profileId)

    const mapped = await getWarmupProfile(admin, profileId)
    if (mapped) {
      await emitWarmupStageChanged(admin, {
        profile: mapped,
        previousStatus: profile.status,
        nextStatus,
        reason: throttleReason ?? undefined,
      })
    }
  }

  await recomputeWarmupProfile(admin, profileId, { forceStatus: nextStatus })
  const finalProfile = await getWarmupProfile(admin, profileId)
  if (finalProfile) {
    await syncSenderWarmupCapacity(admin, { ...finalProfile, sends_today: sendsToday, current_warmup_day: dayNumber })
  }

  return {
    capacity_synced: true,
    day_advanced: dayAdvanced,
    throttled,
    activated,
    daily_reset: dailyReset,
  }
}

export async function runNativeWarmupProgressionBatch(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<GrowthWarmupProgressionRunResult> {
  const limit = input?.limit ?? 100
  const { data, error } = await admin
    .schema("growth")
    .from("warmup_profiles")
    .select("id")
    .is("deleted_at", null)
    .in("status", ["warming", "throttled", "active"])
    .order("last_progress_at", { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error) throw new Error(error.message)

  const counts = {
    capacity_synced: 0,
    day_advanced: 0,
    throttled: 0,
    activated: 0,
    daily_counters_reset: 0,
    sender_daily_resets: 0,
  }

  for (const row of data ?? []) {
    const result = await runWarmupProgressionForProfile(admin, String((row as Record<string, unknown>).id))
    if (result.capacity_synced) counts.capacity_synced += 1
    if (result.day_advanced) counts.day_advanced += 1
    if (result.throttled) counts.throttled += 1
    if (result.activated) counts.activated += 1
    if (result.daily_reset) {
      counts.daily_counters_reset += 1
      counts.sender_daily_resets += 1
    }
  }

  return {
    qa_marker: GROWTH_NATIVE_WARMUP_EXECUTION_QA_MARKER,
    scanned: data?.length ?? 0,
    ...counts,
  }
}
