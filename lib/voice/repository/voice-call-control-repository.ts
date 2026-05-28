import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"
import type {
  VoiceCallControlSettingsRecord,
  VoiceRecordingPolicy,
} from "@/lib/voice/call-control/types"
import type {
  VoiceBusinessHoursRecord,
  VoiceNumberRecord,
  VoiceRoutingMode,
  VoiceRoutingProfileMemberRecord,
  VoiceRoutingProfileRecord,
  VoiceVoicemailBoxRecord,
} from "@/lib/voice/types"

function mapSettings(row: Record<string, unknown>): VoiceCallControlSettingsRecord {
  return {
    organizationId: String(row.organization_id),
    defaultRecordingPolicy: row.default_recording_policy as VoiceRecordingPolicy,
    recordingDisclosureText: String(row.recording_disclosure_text ?? ""),
    inboundCallControlReady: Boolean(row.inbound_call_control_ready),
    voicemailCallbackReady: Boolean(row.voicemail_callback_ready),
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapNumber(row: Record<string, unknown>): VoiceNumberRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    provider: row.provider as VoiceNumberRecord["provider"],
    providerNumberId: String(row.provider_number_id ?? ""),
    phoneNumber: String(row.phone_number),
    displayName: String(row.display_name ?? ""),
    capabilitiesJson: (row.capabilities_json as Record<string, unknown>) ?? {},
    status: row.status as VoiceNumberRecord["status"],
    smsEnabled: Boolean(row.sms_enabled),
    voiceEnabled: Boolean(row.voice_enabled),
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    routingProfileId: row.routing_profile_id ? String(row.routing_profile_id) : null,
    routingMode: (row.routing_mode as VoiceRoutingMode | null) ?? null,
    defaultForwardingTarget: String(row.default_forwarding_target ?? ""),
    recordingPolicy: (row.recording_policy as VoiceRecordingPolicy | null) ?? null,
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapRoutingProfile(row: Record<string, unknown>): VoiceRoutingProfileRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    description: String(row.description ?? ""),
    routingMode: row.routing_mode as VoiceRoutingMode,
    fallbackMode: row.fallback_mode as VoiceRoutingMode,
    fallbackPhoneNumber: String(row.fallback_phone_number ?? ""),
    voicemailBoxId: row.voicemail_box_id ? String(row.voicemail_box_id) : null,
    businessHoursId: row.business_hours_id ? String(row.business_hours_id) : null,
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapRoutingMember(row: Record<string, unknown>): VoiceRoutingProfileMemberRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    routingProfileId: String(row.routing_profile_id),
    userId: String(row.user_id),
    priority: Number(row.priority ?? 0),
    isActive: Boolean(row.is_active),
    forwardingPhoneNumber: String(row.forwarding_phone_number ?? ""),
    browserClientIdentity: (row.browser_client_identity as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapBusinessHours(row: Record<string, unknown>): VoiceBusinessHoursRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    timezone: String(row.timezone ?? "America/New_York"),
    weeklyScheduleJson: (row.weekly_schedule_json as Record<string, unknown>) ?? {},
    holidayRulesJson: Array.isArray(row.holiday_rules_json) ? row.holiday_rules_json : [],
    afterHoursRoutingMode: row.after_hours_routing_mode as VoiceRoutingMode,
    afterHoursForwardingNumber: String(row.after_hours_forwarding_number ?? ""),
    afterHoursVoicemailBoxId: row.after_hours_voicemail_box_id
      ? String(row.after_hours_voicemail_box_id)
      : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapVoicemailBox(row: Record<string, unknown>): VoiceVoicemailBoxRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    greetingText: String(row.greeting_text ?? ""),
    greetingRecordingPath: row.greeting_recording_path ? String(row.greeting_recording_path) : null,
    notificationEmail: String(row.notification_email ?? ""),
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    retentionDays: Number(row.retention_days ?? 30),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function fetchVoiceCallControlSettings(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceCallControlSettingsRecord | null> {
  const { data } = await admin
    .schema("voice")
    .from("voice_call_control_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (!data) return null
  return mapSettings(data as Record<string, unknown>)
}

export async function upsertVoiceCallControlSettings(
  admin: SupabaseClient,
  organizationId: string,
  patch: Partial<{
    defaultRecordingPolicy: VoiceRecordingPolicy
    recordingDisclosureText: string
    inboundCallControlReady: boolean
    voicemailCallbackReady: boolean
  }>,
): Promise<VoiceCallControlSettingsRecord | null> {
  const existing = await fetchVoiceCallControlSettings(admin, organizationId)
  const payload = {
    organization_id: organizationId,
    default_recording_policy: patch.defaultRecordingPolicy ?? existing?.defaultRecordingPolicy ?? "disabled",
    recording_disclosure_text:
      patch.recordingDisclosureText ??
      existing?.recordingDisclosureText ??
      "This call may be recorded for quality assurance.",
    inbound_call_control_ready: patch.inboundCallControlReady ?? existing?.inboundCallControlReady ?? false,
    voicemail_callback_ready: patch.voicemailCallbackReady ?? existing?.voicemailCallbackReady ?? false,
    metadata_json: existing?.metadataJson ?? { phase: "1c" },
  }

  const { data, error } = await admin
    .schema("voice")
    .from("voice_call_control_settings")
    .upsert(payload, { onConflict: "organization_id" })
    .select("*")
    .single()

  if (error || !data) return null
  return mapSettings(data as Record<string, unknown>)
}

export async function fetchVoiceNumberByPhone(
  admin: SupabaseClient,
  phoneNumber: string,
): Promise<VoiceNumberRecord | null> {
  const normalized = normalizePhoneNumber(phoneNumber)
  if (!normalized) return null

  const { data } = await admin
    .schema("voice")
    .from("voice_numbers")
    .select("*")
    .eq("phone_number", normalized)
    .maybeSingle()

  if (!data) return null
  return mapNumber(data as Record<string, unknown>)
}

export async function fetchVoiceRoutingProfileById(
  admin: SupabaseClient,
  organizationId: string,
  profileId: string,
): Promise<VoiceRoutingProfileRecord | null> {
  const { data } = await admin
    .schema("voice")
    .from("voice_routing_profiles")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", profileId)
    .maybeSingle()
  if (!data) return null
  return mapRoutingProfile(data as Record<string, unknown>)
}

export async function fetchVoiceRoutingProfileMembers(
  admin: SupabaseClient,
  organizationId: string,
  routingProfileId: string,
): Promise<VoiceRoutingProfileMemberRecord[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_routing_profile_members")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("routing_profile_id", routingProfileId)
    .order("priority", { ascending: true })
  if (error || !data) return []
  return data.map((row) => mapRoutingMember(row as Record<string, unknown>))
}

export async function fetchVoiceBusinessHoursById(
  admin: SupabaseClient,
  organizationId: string,
  businessHoursId: string,
): Promise<VoiceBusinessHoursRecord | null> {
  const { data } = await admin
    .schema("voice")
    .from("voice_business_hours")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", businessHoursId)
    .maybeSingle()
  if (!data) return null
  return mapBusinessHours(data as Record<string, unknown>)
}

export async function fetchVoiceVoicemailBoxes(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceVoicemailBoxRecord[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_voicemail_boxes")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })
  if (error || !data) return []
  return data.map((row) => mapVoicemailBox(row as Record<string, unknown>))
}

export async function pickRoundRobinMemberForwardNumber(
  admin: SupabaseClient,
  organizationId: string,
  routingProfileId: string,
  members: VoiceRoutingProfileMemberRecord[],
): Promise<string | null> {
  const active = members
    .filter((m) => m.isActive && m.forwardingPhoneNumber)
    .sort((a, b) => a.priority - b.priority)
  if (active.length === 0) return null

  const settings = await fetchVoiceCallControlSettings(admin, organizationId)
  const cursorRaw = settings?.metadataJson?.round_robin_cursor
  const cursor = typeof cursorRaw === "number" ? cursorRaw : 0
  const nextIndex = cursor % active.length
  const nextMember = active[nextIndex]
  if (!nextMember) return null

  await admin
    .schema("voice")
    .from("voice_call_control_settings")
    .upsert(
      {
        organization_id: organizationId,
        default_recording_policy: settings?.defaultRecordingPolicy ?? "disabled",
        recording_disclosure_text: settings?.recordingDisclosureText ?? "This call may be recorded for quality assurance.",
        inbound_call_control_ready: settings?.inboundCallControlReady ?? false,
        voicemail_callback_ready: settings?.voicemailCallbackReady ?? false,
        metadata_json: {
          ...(settings?.metadataJson ?? {}),
          round_robin_cursor: nextIndex + 1,
          round_robin_profile_id: routingProfileId,
        },
      },
      { onConflict: "organization_id" },
    )

  return normalizePhoneNumber(nextMember.forwardingPhoneNumber) || nextMember.forwardingPhoneNumber
}

export async function ingestVoicemailRecordingCallback(
  admin: SupabaseClient,
  input: {
    organizationId: string
    provider: "twilio"
    providerCallId: string
    providerRecordingId: string
    recordingUrl?: string | null
    durationSeconds?: number | null
    voicemailBoxId?: string | null
  },
): Promise<{ ok: boolean; recordingId?: string }> {
  const { data: call } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("provider", input.provider)
    .eq("provider_call_id", input.providerCallId)
    .maybeSingle()

  const insertPayload: Record<string, unknown> = {
    organization_id: input.organizationId,
    provider: input.provider,
    provider_recording_id: input.providerRecordingId,
    storage_path: input.recordingUrl ?? null,
    duration_seconds: input.durationSeconds ?? null,
    recording_kind: "voicemail",
    voicemail_box_id: input.voicemailBoxId ?? null,
    transcription_status: "pending",
  }
  if (call?.id) insertPayload.voice_call_id = call.id

  const { data, error } = await admin
    .schema("voice")
    .from("voice_recordings")
    .insert(insertPayload)
    .select("id")
    .single()

  if (error || !data) return { ok: false }
  await upsertVoiceCallControlSettings(admin, input.organizationId, { voicemailCallbackReady: true })
  return { ok: true, recordingId: String(data.id) }
}

export { mapNumber }
