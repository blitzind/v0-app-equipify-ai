import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendDeliverabilityGovernanceEvent } from "@/lib/growth/deliverability/deliverability-governance-events"
import { assessMailboxReputation } from "@/lib/growth/deliverability/mailbox-reputation-repository"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import { getSenderAccount, updateSenderAccount } from "@/lib/growth/sender/sender-repository"
import { computeCurrentWarmupDay } from "@/lib/growth/warmup/warmup-health"
import { resolveWarmupAlignedSenderHealthStatus } from "@/lib/growth/warmup/warmup-sender-health-gate"
import {
  applyWarmupVelocityReduction,
  evaluateWarmupReputationThrottle,
  evaluateWarmupThrottleClear,
  GROWTH_WARMUP_REPUTATION_THROTTLE_1L_QA_MARKER,
} from "@/lib/growth/warmup/warmup-reputation-throttle-policy"
import {
  GROWTH_NATIVE_WARMUP_EXECUTION_QA_MARKER,
  type GrowthWarmupProgressionRunResult,
} from "@/lib/growth/warmup/warmup-execution-types"
import { getPlannedVolumeForDay, interpolateWarmupVolume } from "@/lib/growth/warmup/warmup-scheduler"
import type { GrowthWarmupProfile, GrowthWarmupProfileStatus } from "@/lib/growth/warmup/warmup-types"
import { getWarmupProfile, recomputeWarmupProfile, listWarmupProfiles } from "@/lib/growth/warmup/warmup-repository"
import { createWarmupEvent } from "@/lib/growth/warmup/warmup-events"

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

/** Planned cap after reputation velocity reduction (if any). */
export function resolveEffectiveWarmupDailyCapacity(
  profile: GrowthWarmupProfile,
  dayNumber?: number,
): number {
  const planned = resolveWarmupDailyCapacity(profile, dayNumber)
  if (
    profile.current_daily_volume > 0 &&
    profile.current_daily_volume < planned &&
    (profile.status === "warming" || profile.status === "throttled")
  ) {
    return profile.current_daily_volume
  }
  return planned
}

export async function syncSenderWarmupCapacity(
  admin: SupabaseClient,
  profile: GrowthWarmupProfile,
): Promise<void> {
  const dailyCap = resolveEffectiveWarmupDailyCapacity(profile)
  const warmupActive = profile.status === "warming" || profile.status === "throttled"
  const senderHealth = resolveWarmupAlignedSenderHealthStatus({
    profileStatus: profile.status,
    warmupHealth: profile.warmup_health,
  })

  const existingSender = await getSenderAccount(admin, profile.sender_account_id)
  const preserveBlocked = String(existingSender?.health_status ?? "") === "blocked"

  await updateSenderAccount(admin, profile.sender_account_id, {
    warmup_eligible: true,
    warmup_enabled: warmupActive,
    daily_send_limit: profile.status === "active" ? Math.max(dailyCap, profile.target_daily_volume) : dailyCap,
    daily_send_used: profile.sends_today,
    ...(preserveBlocked ? {} : { health_status: senderHealth, skipHealthRecompute: true }),
  })

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

export type WarmupSenderHealthRepairResult = {
  scanned: number
  repaired: number
  skipped: number
  repaired_profile_ids: string[]
}

export type WarmupStaleThrottleRepairResult = {
  scanned: number
  cleared: number
  still_blocked: number
  cleared_profile_ids: string[]
  blocked_details: Array<{ profile_id: string; sender_email: string; reason: string }>
}

/** Re-align sender_accounts health for warming profiles clobbered by DNS-stub recompute. */
export async function repairWarmupAlignedSenderHealthBatch(
  admin: SupabaseClient,
  input?: { profileIds?: string[] },
): Promise<WarmupSenderHealthRepairResult> {
  const profiles = input?.profileIds?.length
    ? (
        await Promise.all(input.profileIds.map((profileId) => getWarmupProfile(admin, profileId)))
      ).filter((profile): profile is GrowthWarmupProfile => profile != null)
    : await listWarmupProfiles(admin)

  let repaired = 0
  let skipped = 0
  const repairedProfileIds: string[] = []

  for (const profile of profiles) {
    if (profile.status !== "warming" || profile.warmup_health === "critical") {
      skipped += 1
      continue
    }

    const sender = await getSenderAccount(admin, profile.sender_account_id)
    if (!sender || sender.status !== "connected") {
      skipped += 1
      continue
    }

    if (sender.health_status !== "degraded") {
      skipped += 1
      continue
    }

    await syncSenderWarmupCapacity(admin, profile)
    repaired += 1
    repairedProfileIds.push(profile.id)
  }

  return {
    scanned: profiles.length,
    repaired,
    skipped,
    repaired_profile_ids: repairedProfileIds,
  }
}

/** Clears stale warmup throttles where controlled warmup is safe per reputation policy. */
export async function repairStaleWarmupThrottlesBatch(
  admin: SupabaseClient,
  input?: { profileIds?: string[] },
): Promise<WarmupStaleThrottleRepairResult> {
  const profiles = input?.profileIds?.length
    ? (
        await Promise.all(input.profileIds.map((profileId) => getWarmupProfile(admin, profileId)))
      ).filter((profile): profile is GrowthWarmupProfile => profile != null)
    : (await listWarmupProfiles(admin)).filter((profile) => profile.status === "throttled")

  let cleared = 0
  let stillBlocked = 0
  const clearedProfileIds: string[] = []
  const blockedDetails: WarmupStaleThrottleRepairResult["blocked_details"] = []

  for (const profile of profiles) {
    if (profile.status !== "throttled") {
      stillBlocked += 1
      blockedDetails.push({
        profile_id: profile.id,
        sender_email: profile.sender_email,
        reason: `Profile status is ${profile.status}, not throttled.`,
      })
      continue
    }

    const sender = await getSenderAccount(admin, profile.sender_account_id)
    const reputation = await assessMailboxReputation(admin, profile.sender_account_id).catch(() => null)
    const clearEval = evaluateWarmupThrottleClear({
      profileWarmupHealth: profile.warmup_health,
      profileStatus: profile.status,
      senderStatus: sender?.status ?? null,
      senderHealthStatus: sender?.health_status ?? null,
      reputation,
    })

    if (!clearEval.canClear) {
      stillBlocked += 1
      blockedDetails.push({
        profile_id: profile.id,
        sender_email: profile.sender_email,
        reason: clearEval.reason,
      })
      continue
    }

    const now = new Date().toISOString()
    await admin
      .schema("growth")
      .from("warmup_profiles")
      .update({
        status: "warming",
        throttle_reason: null,
        throttled_at: null,
        updated_at: now,
      })
      .eq("id", profile.id)
      .is("deleted_at", null)

    await createWarmupEvent(admin, {
      warmup_profile_id: profile.id,
      event_type: "warmup_throttle_cleared",
      severity: "low",
      title: "Warmup throttle cleared",
      description: `${profile.sender_email}: ${clearEval.reason}`,
      metadata: {
        qa_marker: GROWTH_WARMUP_REPUTATION_THROTTLE_1L_QA_MARKER,
        previous_status: "throttled",
        classification: clearEval.classification,
      },
    }).catch(() => undefined)

    await recordInternalOutboundAuditEvent(admin, {
      eventType: "warmup_throttle_repaired",
      severity: "low",
      title: "Stale warmup throttle cleared",
      summary: `${profile.sender_email}: ${clearEval.reason}`,
      senderAccountId: profile.sender_account_id,
      metadata: {
        warmup_profile_id: profile.id,
        qa_marker: GROWTH_WARMUP_REPUTATION_THROTTLE_1L_QA_MARKER,
        classification: clearEval.classification,
      },
    }).catch(() => undefined)

    const refreshed = await getWarmupProfile(admin, profile.id)
    if (refreshed) {
      await syncSenderWarmupCapacity(admin, refreshed)
    }

    cleared += 1
    clearedProfileIds.push(profile.id)
  }

  return {
    scanned: profiles.length,
    cleared,
    still_blocked: stillBlocked,
    cleared_profile_ids: clearedProfileIds,
    blocked_details: blockedDetails,
  }
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

  const refreshed = await getWarmupProfile(admin, profile.id)
  if (!refreshed) return

  await syncSenderWarmupCapacity(admin, {
    ...refreshed,
    sends_today: sendsToday,
    current_warmup_day: dayNumber,
  }).catch(() => undefined)

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
  let velocityReductionReason: string | null = null

  const sender = await getSenderAccount(admin, profile.sender_account_id).catch(() => null)
  const reputation = await assessMailboxReputation(admin, profile.sender_account_id).catch(() => null)
  const throttleDecision = evaluateWarmupReputationThrottle({
    profileWarmupHealth: profile.warmup_health,
    profileStatus: profile.status,
    senderStatus: sender?.status ?? null,
    senderHealthStatus: sender?.health_status ?? null,
    reputation,
  })

  if (profile.status === "warming" && throttleDecision.action === "full_throttle") {
    nextStatus = "throttled"
    throttleReason = throttleDecision.reason ?? "Reputation protection requires reduced velocity."
    throttled = true
  } else if (profile.status === "throttled" && throttleDecision.action !== "full_throttle") {
    nextStatus = "warming"
    throttleReason = null
  }

  if (throttleDecision.action === "velocity_reduction") {
    velocityReductionReason = throttleDecision.reason
  }

  let effectiveDailyCap = resolveWarmupDailyCapacity(profile, dayNumber)
  if (throttleDecision.action === "velocity_reduction") {
    effectiveDailyCap = applyWarmupVelocityReduction(
      effectiveDailyCap,
      throttleDecision.velocityReductionFactor,
    )
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
        reason: throttleReason ?? velocityReductionReason ?? undefined,
      })
    }
  } else if (
    velocityReductionReason &&
    profile.status === "warming" &&
    effectiveDailyCap < resolveWarmupDailyCapacity(profile, dayNumber) &&
    profile.current_daily_volume >= resolveWarmupDailyCapacity(profile, dayNumber)
  ) {
    await createWarmupEvent(admin, {
      warmup_profile_id: profileId,
      event_type: "warmup_velocity_reduction",
      severity: "medium",
      title: "Warmup velocity reduced",
      description: `${profile.sender_email}: ${velocityReductionReason}`,
      metadata: {
        qa_marker: GROWTH_WARMUP_REPUTATION_THROTTLE_1L_QA_MARKER,
        daily_cap: effectiveDailyCap,
      },
    }).catch(() => undefined)
  }

  await recomputeWarmupProfile(admin, profileId, { forceStatus: nextStatus })
  const finalProfile = await getWarmupProfile(admin, profileId)
  if (finalProfile) {
    await admin
      .schema("growth")
      .from("warmup_profiles")
      .update({
        current_daily_volume: effectiveDailyCap,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId)
      .is("deleted_at", null)

    await syncSenderWarmupCapacity(admin, {
      ...finalProfile,
      sends_today: sendsToday,
      current_warmup_day: dayNumber,
      current_daily_volume: effectiveDailyCap,
    })
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
