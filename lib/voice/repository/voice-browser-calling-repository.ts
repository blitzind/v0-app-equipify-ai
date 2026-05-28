import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { VOICE_CALL_TIMELINE_EVENT_LABELS } from "@/lib/voice/browser-calling/status-mapping"
import type {
  VoiceBrowserDevicePublicView,
  VoiceBrowserDeviceStatus,
  VoiceCallRecordingVisibilityView,
  VoiceCallTimelineEventView,
  VoiceInboundBrowserOfferView,
  VoiceOperatorPresencePublicView,
  VoiceOperatorPresenceStatus,
} from "@/lib/voice/browser-calling/types"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

function browserDevicesTable(admin: SupabaseClient) {
  return admin.schema("voice").from("voice_browser_devices")
}

function operatorPresenceTable(admin: SupabaseClient) {
  return admin.schema("voice").from("voice_operator_presence")
}

function mapDeviceRow(row: Record<string, unknown>): VoiceBrowserDevicePublicView {
  return {
    id: row.id as string,
    clientIdentity: row.client_identity as string,
    provider: row.provider as VoiceBrowserDevicePublicView["provider"],
    status: row.status as VoiceBrowserDeviceStatus,
    lastRegisteredAt: row.last_registered_at as string,
    lastHeartbeatAt: row.last_heartbeat_at as string,
    activeVoiceCallId: (row.active_voice_call_id as string | null) ?? null,
  }
}

function mapPresenceRow(row: Record<string, unknown>): VoiceOperatorPresencePublicView {
  return {
    userId: row.user_id as string,
    status: row.status as VoiceOperatorPresenceStatus,
    activeDeviceCount: row.active_device_count as number,
    activeVoiceCallId: (row.active_voice_call_id as string | null) ?? null,
    activeWorkspaceSessionId: (row.active_workspace_session_id as string | null) ?? null,
    lastSeenAt: row.last_seen_at as string,
  }
}

export async function registerVoiceBrowserDevice(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    clientIdentity: string
    provider: VoiceBrowserDevicePublicView["provider"]
    deviceFingerprint?: string
    userAgent?: string
  },
): Promise<VoiceBrowserDevicePublicView> {
  const now = new Date().toISOString()
  const { data: existing } = await browserDevicesTable(admin)
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("client_identity", input.clientIdentity)
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await browserDevicesTable(admin)
      .update({
        user_id: input.userId,
        provider: input.provider,
        device_fingerprint: input.deviceFingerprint ?? "",
        user_agent: input.userAgent ?? "",
        status: "available",
        last_registered_at: now,
        last_heartbeat_at: now,
        disconnected_at: null,
        updated_at: now,
      })
      .eq("id", existing.id as string)
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    await refreshVoiceOperatorPresence(admin, input.organizationId, input.userId)
    logVoiceInfrastructure("voice_browser_device_reregistered", {
      organizationId: input.organizationId,
      userId: input.userId,
      clientIdentity: input.clientIdentity,
    })
    return mapDeviceRow(data as Record<string, unknown>)
  }

  const { data, error } = await browserDevicesTable(admin)
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      provider: input.provider,
      client_identity: input.clientIdentity,
      device_fingerprint: input.deviceFingerprint ?? "",
      user_agent: input.userAgent ?? "",
      status: "available",
      last_registered_at: now,
      last_heartbeat_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  await refreshVoiceOperatorPresence(admin, input.organizationId, input.userId)
  logVoiceInfrastructure("voice_browser_device_registered", {
    organizationId: input.organizationId,
    userId: input.userId,
    clientIdentity: input.clientIdentity,
  })
  return mapDeviceRow(data as Record<string, unknown>)
}

export async function heartbeatVoiceBrowserDevice(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    clientIdentity: string
    status?: VoiceBrowserDeviceStatus
  },
): Promise<VoiceBrowserDevicePublicView | null> {
  const now = new Date().toISOString()
  const { data, error } = await browserDevicesTable(admin)
    .update({
      last_heartbeat_at: now,
      status: input.status ?? "available",
      updated_at: now,
    })
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .eq("client_identity", input.clientIdentity)
    .select("*")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  await refreshVoiceOperatorPresence(admin, input.organizationId, input.userId)
  return mapDeviceRow(data as Record<string, unknown>)
}

export async function disconnectVoiceBrowserDevice(
  admin: SupabaseClient,
  input: { organizationId: string; userId: string; clientIdentity: string },
): Promise<void> {
  const now = new Date().toISOString()
  await browserDevicesTable(admin)
    .update({
      status: "offline",
      disconnected_at: now,
      active_voice_call_id: null,
      updated_at: now,
    })
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .eq("client_identity", input.clientIdentity)
  await refreshVoiceOperatorPresence(admin, input.organizationId, input.userId)
}

export async function refreshVoiceOperatorPresence(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<VoiceOperatorPresencePublicView> {
  const now = new Date().toISOString()
  const { data: devices } = await browserDevicesTable(admin)
    .select("status, active_voice_call_id, last_heartbeat_at")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)

  const activeDevices = (devices ?? []).filter((row) =>
    ["available", "busy", "reconnecting"].includes(String(row.status)),
  )
  const activeVoiceCallId =
    activeDevices.find((row) => row.active_voice_call_id)?.active_voice_call_id ?? null
  const status: VoiceOperatorPresenceStatus = activeVoiceCallId
    ? "on_call"
    : activeDevices.some((row) => row.status === "reconnecting")
      ? "reconnecting"
      : activeDevices.length > 0
        ? "online"
        : "offline"

  const { data, error } = await operatorPresenceTable(admin)
    .upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        status,
        active_device_count: activeDevices.length,
        active_voice_call_id: activeVoiceCallId as string | null,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "organization_id,user_id" },
    )
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapPresenceRow(data as Record<string, unknown>)
}

export async function listOnlineVoiceBrowserDevices(
  admin: SupabaseClient,
  organizationId: string,
  input?: { userIds?: string[] },
): Promise<VoiceBrowserDevicePublicView[]> {
  let query = browserDevicesTable(admin)
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", ["available", "busy", "reconnecting"])
    .order("last_heartbeat_at", { ascending: false })
  if (input?.userIds?.length) {
    query = query.in("user_id", input.userIds)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapDeviceRow(row as Record<string, unknown>))
}

export async function listVoiceOperatorPresence(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceOperatorPresencePublicView[]> {
  const { data, error } = await operatorPresenceTable(admin)
    .select("*")
    .eq("organization_id", organizationId)
    .order("last_seen_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapPresenceRow(row as Record<string, unknown>))
}

export async function fetchVoiceCallTimeline(
  admin: SupabaseClient,
  voiceCallId: string,
): Promise<VoiceCallTimelineEventView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_call_events")
    .select("id, event_type, event_timestamp, payload_json")
    .eq("voice_call_id", voiceCallId)
    .order("event_timestamp", { ascending: true })
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const eventType = row.event_type as string
    const payload = row.payload_json as Record<string, unknown> | null
    return {
      id: row.id as string,
      eventType,
      eventTimestamp: row.event_timestamp as string,
      label: VOICE_CALL_TIMELINE_EVENT_LABELS[eventType] ?? eventType.replace(/_/g, " "),
      payloadSummary:
        typeof payload?.summary === "string"
          ? payload.summary
          : typeof payload?.message === "string"
            ? payload.message
            : null,
    }
  })
}

export async function fetchVoiceCallRecordingVisibility(
  admin: SupabaseClient,
  voiceCallId: string,
): Promise<VoiceCallRecordingVisibilityView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_recordings")
    .select("id, recording_kind, duration_seconds, retention_expires_at, transcription_status, storage_path")
    .eq("voice_call_id", voiceCallId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const playbackAvailable = Boolean((data.storage_path as string | null)?.trim())
  return {
    recordingId: data.id as string,
    recordingKind: data.recording_kind as string,
    durationSeconds: (data.duration_seconds as number | null) ?? null,
    retentionExpiresAt: (data.retention_expires_at as string | null) ?? null,
    transcriptionStatus: data.transcription_status as string,
    playbackAvailable,
    playbackPlaceholder: playbackAvailable
      ? "Recording available — playback UI placeholder (no transcription in Phase 1D)."
      : "Recording metadata captured — playback pending provider storage sync.",
  }
}

export async function fetchInboundBrowserOfferForUser(
  admin: SupabaseClient,
  input: { organizationId: string; userId: string },
): Promise<VoiceInboundBrowserOfferView | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("native_call_workspace_sessions")
    .select("id, voice_call_id, phone_number, contact_name, started_at, owner_user_id, status, direction")
    .eq("organization_id", input.organizationId)
    .eq("owner_user_id", input.userId)
    .eq("direction", "inbound")
    .eq("status", "ringing")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.voice_call_id) return null

  const { data: callRow } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("from_number, to_number")
    .eq("id", data.voice_call_id as string)
    .maybeSingle()

  return {
    voiceCallId: data.voice_call_id as string,
    workspaceSessionId: data.id as string,
    fromNumber: (callRow?.from_number as string | null) ?? (data.phone_number as string | null) ?? "Unknown",
    toNumber: (callRow?.to_number as string | null) ?? "Unknown",
    contactLabel: (data.contact_name as string | null) ?? null,
    offeredAt: data.started_at as string,
  }
}

export async function countVoiceBrowserPresenceSummary(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ connectedOperatorCount: number; activeDeviceCount: number }> {
  const { count: activeDeviceCount } = await browserDevicesTable(admin)
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", organizationId)
    .in("status", ["available", "busy", "reconnecting"])

  const { count: connectedOperatorCount } = await operatorPresenceTable(admin)
    .select("user_id", { head: true, count: "exact" })
    .eq("organization_id", organizationId)
    .in("status", ["online", "on_call", "reconnecting"])

  return {
    connectedOperatorCount: connectedOperatorCount ?? 0,
    activeDeviceCount: activeDeviceCount ?? 0,
  }
}

export async function assertVoiceCallPickupAllowed(
  admin: SupabaseClient,
  input: { organizationId: string; userId: string; voiceCallId: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: callRow } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("assigned_user_id, status")
    .eq("id", input.voiceCallId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()

  if (!callRow) return { ok: false, reason: "Voice call not found." }
  if (["completed", "failed", "canceled", "busy", "no_answer"].includes(String(callRow.status))) {
    return { ok: false, reason: "Call is no longer active." }
  }
  if (callRow.assigned_user_id && callRow.assigned_user_id !== input.userId) {
    return { ok: false, reason: "Call is owned by another operator." }
  }

  const { data: conflicting } = await admin
    .schema("growth")
    .from("native_call_workspace_sessions")
    .select("id, owner_user_id, status")
    .eq("voice_call_id", input.voiceCallId)
    .in("status", ["ringing", "active", "on_hold"])
    .maybeSingle()

  if (conflicting?.owner_user_id && conflicting.owner_user_id !== input.userId) {
    return { ok: false, reason: "Another operator already picked up this call." }
  }

  return { ok: true }
}
