import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildWarmupDashboard } from "@/lib/growth/warmup/warmup-dashboard"
import { buildWarmupStatusChangeEvents } from "@/lib/growth/warmup/warmup-event-builder"
import {
  listWarmupEvents,
  persistWarmupEventDrafts,
  profileHasCriticalWarmupEvent,
} from "@/lib/growth/warmup/warmup-events"
import {
  computeCurrentWarmupDay,
  computeWarmupProgress,
  detectProgressMilestone,
  evaluateWarmupHealth,
} from "@/lib/growth/warmup/warmup-health"
import {
  computeDailyIncrement,
  computeTargetDailyVolume,
  generateWarmupScheduleDays,
  getPlannedVolumeForDay,
} from "@/lib/growth/warmup/warmup-scheduler"
import type {
  GrowthWarmupProfile,
  GrowthWarmupProfileStatus,
  GrowthWarmupScheduleDay,
} from "@/lib/growth/warmup/warmup-types"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"

type WarmupRow = Record<string, unknown>

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function profilesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("warmup_profiles")
}

function scheduleTable(admin: SupabaseClient) {
  return admin.schema("growth").from("warmup_schedule")
}

function activeProfilesQuery(admin: SupabaseClient) {
  return profilesTable(admin).select("*").is("deleted_at", null)
}

async function loadSenderSummary(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<{ email: string; display_name: string }> {
  const sender = await getSenderAccount(admin, senderAccountId)
  if (!sender) return { email: "", display_name: "" }
  return { email: sender.email_address, display_name: sender.display_name }
}

function mapScheduleRow(row: WarmupRow): GrowthWarmupScheduleDay {
  return {
    id: asString(row.id),
    warmup_profile_id: asString(row.warmup_profile_id),
    day_number: asNumber(row.day_number, 1),
    planned_volume: asNumber(row.planned_volume, 0),
    actual_volume: asNumber(row.actual_volume, 0),
    completed: Boolean(row.completed),
    completed_at: asString(row.completed_at) || null,
    created_at: asString(row.created_at),
  }
}

async function listScheduleForProfile(admin: SupabaseClient, profileId: string): Promise<GrowthWarmupScheduleDay[]> {
  const { data, error } = await scheduleTable(admin)
    .select("*")
    .eq("warmup_profile_id", profileId)
    .order("day_number", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapScheduleRow(row as WarmupRow))
}

async function mapProfile(admin: SupabaseClient, row: WarmupRow, includeSchedule = false): Promise<GrowthWarmupProfile> {
  const sender = await loadSenderSummary(admin, asString(row.sender_account_id))
  const profile: GrowthWarmupProfile = {
    id: asString(row.id),
    sender_account_id: asString(row.sender_account_id),
    sender_email: sender.email,
    sender_display_name: sender.display_name,
    status: asString(row.status) as GrowthWarmupProfileStatus,
    target_daily_volume: asNumber(row.target_daily_volume, 0),
    current_daily_volume: asNumber(row.current_daily_volume, 0),
    daily_increment: asNumber(row.daily_increment, 0),
    warmup_days: asNumber(row.warmup_days, 30),
    warmup_progress: asNumber(row.warmup_progress, 0),
    warmup_score: asNumber(row.warmup_score, 100),
    warmup_health: asString(row.warmup_health) as GrowthWarmupProfile["warmup_health"],
    started_at: asString(row.started_at) || null,
    completed_at: asString(row.completed_at) || null,
    last_progress_at: asString(row.last_progress_at) || null,
    current_warmup_day: asNumber(row.current_warmup_day, 1),
    sends_today: asNumber(row.sends_today, 0),
    sends_today_date: asString(row.sends_today_date) || null,
    throttled_at: asString(row.throttled_at) || null,
    throttle_reason: asString(row.throttle_reason) || null,
    last_capacity_sync_at: asString(row.last_capacity_sync_at) || null,
    notes: asString(row.notes) || null,
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    deleted_at: asString(row.deleted_at) || null,
  }

  if (includeSchedule) {
    profile.schedule = await listScheduleForProfile(admin, profile.id)
  }

  return profile
}

export async function recomputeWarmupProfile(
  admin: SupabaseClient,
  profileId: string,
  input?: {
    actorUserId?: string | null
    actorEmail?: string | null
    forceStatus?: GrowthWarmupProfileStatus
  },
): Promise<GrowthWarmupProfile> {
  const { data: existing, error: loadError } = await activeProfilesQuery(admin).select("*").eq("id", profileId).maybeSingle()
  if (loadError) throw new Error(loadError.message)
  if (!existing) throw new Error("warmup_profile_not_found")

  const previous = await mapProfile(admin, existing as WarmupRow, true)
  const scheduleDraft = (previous.schedule ?? []).map((day) => ({
    day_number: day.day_number,
    planned_volume: day.planned_volume,
  }))
  const completedDays = (previous.schedule ?? []).filter((day) => day.completed).length
  const currentDay = computeCurrentWarmupDay(previous.started_at)
  const hasCritical = await profileHasCriticalWarmupEvent(admin, profileId)

  const health = evaluateWarmupHealth({
    status: input?.forceStatus ?? previous.status,
    warmup_days: previous.warmup_days,
    warmup_progress: previous.warmup_progress,
    current_daily_volume: previous.current_daily_volume,
    current_day_number: currentDay,
    schedule: scheduleDraft.length > 0 ? scheduleDraft : generateWarmupScheduleDays(previous.warmup_days),
    last_progress_at: previous.last_progress_at,
    has_critical_event: hasCritical,
  })

  const nextProgress = computeWarmupProgress({
    status: input?.forceStatus ?? previous.status,
    warmup_days: previous.warmup_days,
    completed_days: completedDays,
    current_day_number: currentDay,
  })

  let nextStatus = input?.forceStatus ?? previous.status
  if (nextProgress >= 100 && nextStatus === "warming") {
    nextStatus = "active"
  }

  const plannedToday = getPlannedVolumeForDay(
    scheduleDraft.length > 0 ? scheduleDraft : generateWarmupScheduleDays(previous.warmup_days),
    currentDay,
  )

  const now = new Date().toISOString()
  const { data, error } = await profilesTable(admin)
    .update({
      status: nextStatus,
      warmup_progress: nextProgress,
      warmup_score: health.warmup_score,
      warmup_health: health.warmup_health,
      current_daily_volume:
        nextStatus === "warming" ? Math.min(plannedToday, previous.current_daily_volume || plannedToday) : previous.current_daily_volume,
      completed_at: nextStatus === "active" ? previous.completed_at ?? now : previous.completed_at,
      updated_at: now,
    })
    .is("deleted_at", null)
    .eq("id", profileId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  const updated = await mapProfile(admin, data as WarmupRow, true)
  const milestone = detectProgressMilestone(previous.warmup_progress, updated.warmup_progress)
  const drafts = buildWarmupStatusChangeEvents({
    senderEmail: updated.sender_email,
    previousStatus: previous.status,
    nextStatus: updated.status,
    previousScore: previous.warmup_score,
    nextScore: updated.warmup_score,
    previousProgress: previous.warmup_progress,
    nextProgress: updated.warmup_progress,
    progressMilestone: milestone,
  })

  if (health.progress_stalled || health.volume_behind_plan) {
    if (health.progress_stalled) {
      drafts.push({
        event_type: "warmup_progress_stalled",
        severity: "high",
        title: "Warmup progress stalled",
        description: `${updated.sender_email} has not recorded warmup progress recently.`,
      })
    }
    if (health.volume_behind_plan) {
      drafts.push({
        event_type: "warmup_volume_behind",
        severity: "medium",
        title: "Warmup volume behind plan",
        description: `${updated.sender_email} planned volume is ahead of recorded progression.`,
      })
    }
  }

  if (drafts.length > 0) {
    await persistWarmupEventDrafts(admin, profileId, drafts, {
      actorUserId: input?.actorUserId,
      actorEmail: input?.actorEmail,
    })
  }

  return updated
}

export async function listWarmupProfiles(admin: SupabaseClient): Promise<GrowthWarmupProfile[]> {
  const { data, error } = await activeProfilesQuery(admin).select("*").order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return Promise.all((data ?? []).map((row) => mapProfile(admin, row as WarmupRow, true)))
}

export async function getWarmupProfile(admin: SupabaseClient, profileId: string): Promise<GrowthWarmupProfile | null> {
  const { data, error } = await activeProfilesQuery(admin).select("*").eq("id", profileId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapProfile(admin, data as WarmupRow, true)
}

export async function createWarmupProfile(
  admin: SupabaseClient,
  input: {
    sender_account_id: string
    warmup_days?: number
    notes?: string | null
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthWarmupProfile> {
  const sender = await getSenderAccount(admin, input.sender_account_id)
  if (!sender) throw new Error("sender_not_found")

  const warmup_days = Math.max(1, input.warmup_days ?? 30)
  const scheduleDraft = generateWarmupScheduleDays(warmup_days)
  const now = new Date().toISOString()

  const { data, error } = await profilesTable(admin)
    .insert({
      sender_account_id: input.sender_account_id,
      status: "new",
      target_daily_volume: computeTargetDailyVolume(warmup_days),
      current_daily_volume: scheduleDraft[0]?.planned_volume ?? 0,
      daily_increment: computeDailyIncrement(scheduleDraft),
      warmup_days,
      warmup_progress: 0,
      warmup_score: 100,
      warmup_health: "healthy",
      notes: input.notes ?? null,
      updated_at: now,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapProfile(admin, data as WarmupRow)
}

export async function updateWarmupProfile(
  admin: SupabaseClient,
  profileId: string,
  input: {
    notes?: string | null
    status?: GrowthWarmupProfileStatus
    warmup_days?: number
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthWarmupProfile> {
  const existing = await getWarmupProfile(admin, profileId)
  if (!existing) throw new Error("warmup_profile_not_found")

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.notes !== undefined) updates.notes = input.notes
  if (input.status !== undefined) updates.status = input.status
  if (input.warmup_days !== undefined) {
    updates.warmup_days = Math.max(1, input.warmup_days)
    const scheduleDraft = generateWarmupScheduleDays(updates.warmup_days as number)
    updates.target_daily_volume = computeTargetDailyVolume(updates.warmup_days as number)
    updates.daily_increment = computeDailyIncrement(scheduleDraft)
  }

  const { error } = await profilesTable(admin).update(updates).is("deleted_at", null).eq("id", profileId)
  if (error) throw new Error(error.message)

  return recomputeWarmupProfile(admin, profileId, {
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    forceStatus: input.status,
  })
}

export async function softDeleteWarmupProfile(
  admin: SupabaseClient,
  profileId: string,
): Promise<{ id: string; deleted_at: string }> {
  const existing = await getWarmupProfile(admin, profileId)
  if (!existing) throw new Error("warmup_profile_not_found")

  const deletedAt = new Date().toISOString()
  const { data, error } = await profilesTable(admin)
    .update({ deleted_at: deletedAt, status: "disabled", updated_at: deletedAt })
    .is("deleted_at", null)
    .eq("id", profileId)
    .select("id")
    .single()

  if (error) throw new Error(error.message)
  return { id: asString((data as WarmupRow).id), deleted_at: deletedAt }
}

export async function generateWarmupSchedule(
  admin: SupabaseClient,
  profileId: string,
  input?: { actorUserId?: string | null; actorEmail?: string | null },
): Promise<GrowthWarmupProfile> {
  const existing = await getWarmupProfile(admin, profileId)
  if (!existing) throw new Error("warmup_profile_not_found")

  const scheduleDraft = generateWarmupScheduleDays(existing.warmup_days)
  await scheduleTable(admin).delete().eq("warmup_profile_id", profileId)

  const { error: insertError } = await scheduleTable(admin).insert(
    scheduleDraft.map((day) => ({
      warmup_profile_id: profileId,
      day_number: day.day_number,
      planned_volume: day.planned_volume,
      completed: false,
    })),
  )
  if (insertError) throw new Error(insertError.message)

  const now = new Date().toISOString()
  const firstDayVolume = scheduleDraft[0]?.planned_volume ?? 0
  const { error } = await profilesTable(admin)
    .update({
      status: existing.status === "new" || existing.status === "paused" ? "warming" : existing.status,
      target_daily_volume: computeTargetDailyVolume(existing.warmup_days),
      daily_increment: computeDailyIncrement(scheduleDraft),
      current_daily_volume: firstDayVolume,
      started_at: existing.started_at ?? now,
      last_progress_at: now,
      updated_at: now,
    })
    .is("deleted_at", null)
    .eq("id", profileId)

  if (error) throw new Error(error.message)

  const updated = await recomputeWarmupProfile(admin, profileId, input)
  const { syncSenderWarmupCapacity } = await import("@/lib/growth/warmup/warmup-execution")
  await syncSenderWarmupCapacity(admin, updated).catch(() => undefined)
  return updated
}

export async function pauseWarmupProfile(
  admin: SupabaseClient,
  profileId: string,
  input?: { actorUserId?: string | null; actorEmail?: string | null },
): Promise<GrowthWarmupProfile> {
  const existing = await getWarmupProfile(admin, profileId)
  if (!existing) throw new Error("warmup_profile_not_found")
  if (existing.status !== "warming") throw new Error("warmup_not_active")

  const now = new Date().toISOString()
  const { error } = await profilesTable(admin)
    .update({ status: "paused", updated_at: now })
    .is("deleted_at", null)
    .eq("id", profileId)

  if (error) throw new Error(error.message)
  return recomputeWarmupProfile(admin, profileId, { ...input, forceStatus: "paused" })
}

export async function resumeWarmupProfile(
  admin: SupabaseClient,
  profileId: string,
  input?: { actorUserId?: string | null; actorEmail?: string | null },
): Promise<GrowthWarmupProfile> {
  const existing = await getWarmupProfile(admin, profileId)
  if (!existing) throw new Error("warmup_profile_not_found")
  if (existing.status !== "paused") throw new Error("warmup_not_paused")

  const schedule = existing.schedule ?? []
  if (schedule.length === 0) {
    return generateWarmupSchedule(admin, profileId, input)
  }

  const now = new Date().toISOString()
  const { error } = await profilesTable(admin)
    .update({ status: "warming", last_progress_at: now, updated_at: now })
    .is("deleted_at", null)
    .eq("id", profileId)

  if (error) throw new Error(error.message)
  return recomputeWarmupProfile(admin, profileId, { ...input, forceStatus: "warming" })
}

export async function fetchWarmupDashboard(admin: SupabaseClient) {
  const profiles = await listWarmupProfiles(admin)
  return buildWarmupDashboard(profiles)
}

export { listWarmupEvents }
