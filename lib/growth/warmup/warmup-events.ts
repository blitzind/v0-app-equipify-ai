import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthWarmupEvent,
  GrowthWarmupEventSeverity,
  GrowthWarmupProfile,
  GrowthWarmupScheduleDay,
  GrowthWarmupTimelineEventType,
} from "@/lib/growth/warmup/warmup-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("warmup_events")
}

function timelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

function mapEvent(row: Record<string, unknown>, senderEmail = ""): GrowthWarmupEvent {
  return {
    id: asString(row.id),
    warmup_profile_id: asString(row.warmup_profile_id),
    sender_email: senderEmail,
    severity: asString(row.severity) as GrowthWarmupEventSeverity,
    event_type: asString(row.event_type) || "health_check",
    title: asString(row.title),
    description: asString(row.description),
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    resolved: Boolean(row.resolved),
    resolved_at: asString(row.resolved_at) || null,
    created_at: asString(row.created_at),
  }
}

export async function createWarmupEvent(
  admin: SupabaseClient,
  input: {
    warmup_profile_id: string
    event_type: string
    severity: GrowthWarmupEventSeverity
    title: string
    description: string
    metadata?: Record<string, unknown>
  },
): Promise<GrowthWarmupEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      warmup_profile_id: input.warmup_profile_id,
      event_type: input.event_type,
      severity: input.severity,
      title: input.title,
      description: input.description,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapEvent(data as Record<string, unknown>)
}

export async function listWarmupEvents(
  admin: SupabaseClient,
  input?: { limit?: number; warmup_profile_id?: string; unresolved_only?: boolean },
): Promise<GrowthWarmupEvent[]> {
  let query = eventsTable(admin).select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 50)
  if (input?.warmup_profile_id) query = query.eq("warmup_profile_id", input.warmup_profile_id)
  if (input?.unresolved_only) query = query.eq("resolved", false)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const profileIds = [...new Set((data ?? []).map((row) => asString((row as Record<string, unknown>).warmup_profile_id)).filter(Boolean))]
  const senderMap = await loadSenderEmailsForProfiles(admin, profileIds)

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    return mapEvent(record, senderMap.get(asString(record.warmup_profile_id)) ?? "")
  })
}

async function loadSenderEmailsForProfiles(admin: SupabaseClient, profileIds: string[]): Promise<Map<string, string>> {
  const senderMap = new Map<string, string>()
  if (profileIds.length === 0) return senderMap

  const { data: profiles } = await admin
    .schema("growth")
    .from("warmup_profiles")
    .select("id, sender_account_id")
    .in("id", profileIds)

  const senderIds = [...new Set((profiles ?? []).map((row) => asString((row as Record<string, unknown>).sender_account_id)).filter(Boolean))]
  const senderEmailById = new Map<string, string>()
  if (senderIds.length > 0) {
    const { data: senders } = await admin
      .schema("growth")
      .from("sender_accounts")
      .select("id, email_address")
      .in("id", senderIds)
    for (const row of senders ?? []) {
      const record = row as Record<string, unknown>
      senderEmailById.set(asString(record.id), asString(record.email_address))
    }
  }

  for (const row of profiles ?? []) {
    const record = row as Record<string, unknown>
    const profileId = asString(record.id)
    const senderId = asString(record.sender_account_id)
    senderMap.set(profileId, senderEmailById.get(senderId) ?? "")
  }

  return senderMap
}

export async function appendWarmupTimelineEvent(
  admin: SupabaseClient,
  input: {
    eventType: GrowthWarmupTimelineEventType
    title: string
    summary?: string | null
    warmupProfileId?: string | null
    payload?: Record<string, unknown>
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<void> {
  const { error } = await timelineTable(admin).insert({
    connection_id: null,
    event_type: input.eventType,
    title: input.title,
    summary: input.summary ?? null,
    payload: {
      ...(input.payload ?? {}),
      warmup_profile_id: input.warmupProfileId ?? null,
    },
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function listWarmupTimelineEvents(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<
  Array<{
    id: string
    event_type: GrowthWarmupTimelineEventType
    title: string
    summary: string | null
    payload: Record<string, unknown>
    occurred_at: string
  }>
> {
  const { data, error } = await timelineTable(admin)
    .select("id, event_type, title, summary, payload, occurred_at")
    .in("event_type", [
      "warmup_started",
      "warmup_paused",
      "warmup_completed",
      "warmup_health_declined",
      "warmup_progress_milestone",
    ])
    .order("occurred_at", { ascending: false })
    .limit(input?.limit ?? 30)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      id: asString(record.id),
      event_type: asString(record.event_type) as GrowthWarmupTimelineEventType,
      title: asString(record.title),
      summary: asString(record.summary) || null,
      payload: record.payload && typeof record.payload === "object" ? (record.payload as Record<string, unknown>) : {},
      occurred_at: asString(record.occurred_at),
    }
  })
}

export async function profileHasCriticalWarmupEvent(admin: SupabaseClient, profileId: string): Promise<boolean> {
  const { data, error } = await eventsTable(admin)
    .select("id")
    .eq("warmup_profile_id", profileId)
    .eq("resolved", false)
    .eq("severity", "critical")
    .limit(1)

  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

export async function persistWarmupEventDrafts(
  admin: SupabaseClient,
  profileId: string,
  drafts: Array<{
    event_type: string
    severity: GrowthWarmupEventSeverity
    title: string
    description: string
    timeline_type?: GrowthWarmupTimelineEventType
    metadata?: Record<string, unknown>
  }>,
  actor?: { actorUserId?: string | null; actorEmail?: string | null },
): Promise<void> {
  for (const draft of drafts) {
    await createWarmupEvent(admin, {
      warmup_profile_id: profileId,
      event_type: draft.event_type,
      severity: draft.severity,
      title: draft.title,
      description: draft.description,
      metadata: draft.metadata,
    })
    if (draft.timeline_type) {
      await appendWarmupTimelineEvent(admin, {
        eventType: draft.timeline_type,
        title: draft.title,
        summary: draft.description,
        warmupProfileId: profileId,
        payload: draft.metadata,
        actorUserId: actor?.actorUserId,
        actorEmail: actor?.actorEmail,
      })
    }
  }
}

export type { GrowthWarmupProfile, GrowthWarmupScheduleDay }
