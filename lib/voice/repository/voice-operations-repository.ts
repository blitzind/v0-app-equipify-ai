import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  evaluateVoiceBusinessHours,
  voiceBusinessHoursStatusLabel,
} from "@/lib/voice/business-hours/business-hours-evaluator"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"
import type {
  VoiceBusinessHoursRecord,
  VoiceComplianceReadinessSnapshot,
  VoiceNumberListItem,
  VoiceNumberRecord,
  VoiceNumberStatus,
  VoiceOperationsReadinessSnapshot,
  VoiceRoutingMode,
  VoiceRoutingProfileMemberRecord,
  VoiceRoutingProfileRecord,
  VoiceVoicemailBoxRecord,
} from "@/lib/voice/types"
import {
  VOICE_OPERATIONS_QA_MARKER,
  VOICE_ROUTING_MODE_LABELS,
} from "@/lib/voice/types"
import { fetchVoiceCallControlReadiness } from "@/lib/voice/call-control/readiness"
import {
  countVoiceOptOuts,
  fetchVoiceInfrastructureReadiness,
} from "@/lib/voice/repository/voice-repository"

function mapNumber(row: Record<string, unknown>): VoiceNumberRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    provider: row.provider as VoiceNumberRecord["provider"],
    providerNumberId: String(row.provider_number_id ?? ""),
    phoneNumber: String(row.phone_number),
    displayName: String(row.display_name ?? ""),
    capabilitiesJson: (row.capabilities_json as Record<string, unknown>) ?? {},
    status: row.status as VoiceNumberStatus,
    smsEnabled: Boolean(row.sms_enabled),
    voiceEnabled: Boolean(row.voice_enabled),
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    routingProfileId: row.routing_profile_id ? String(row.routing_profile_id) : null,
    routingMode: (row.routing_mode as VoiceRoutingMode | null) ?? null,
    defaultForwardingTarget: String(row.default_forwarding_target ?? ""),
    recordingPolicy: (row.recording_policy as VoiceNumberRecord["recordingPolicy"]) ?? null,
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

export async function fetchVoiceNumbersList(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceNumberListItem[]> {
  const { data: numbers, error } = await admin
    .schema("voice")
    .from("voice_numbers")
    .select("*")
    .eq("organization_id", organizationId)
    .order("phone_number", { ascending: true })

  if (error || !numbers) return []

  const profileIds = [...new Set(numbers.map((n) => n.routing_profile_id).filter(Boolean))] as string[]
  const profiles = new Map<string, VoiceRoutingProfileRecord>()
  const businessHours = new Map<string, VoiceBusinessHoursRecord>()

  if (profileIds.length > 0) {
    const { data: profileRows } = await admin
      .schema("voice")
      .from("voice_routing_profiles")
      .select("*")
      .in("id", profileIds)
    for (const row of profileRows ?? []) {
      const mapped = mapRoutingProfile(row as Record<string, unknown>)
      profiles.set(mapped.id, mapped)
    }

    const hoursIds = [...new Set([...profiles.values()].map((p) => p.businessHoursId).filter(Boolean))] as string[]
    if (hoursIds.length > 0) {
      const { data: hoursRows } = await admin
        .schema("voice")
        .from("voice_business_hours")
        .select("*")
        .in("id", hoursIds)
      for (const row of hoursRows ?? []) {
        const mapped = mapBusinessHours(row as Record<string, unknown>)
        businessHours.set(mapped.id, mapped)
      }
    }
  }

  return numbers.map((row) => {
    const number = mapNumber(row as Record<string, unknown>)
    const profile = number.routingProfileId ? profiles.get(number.routingProfileId) ?? null : null
    const hours = profile?.businessHoursId ? businessHours.get(profile.businessHoursId) ?? null : null
    const effectiveMode = number.routingMode ?? profile?.routingMode ?? null
    const businessHoursStatus = evaluateVoiceBusinessHours(hours)
    return {
      ...number,
      routingModeLabel: effectiveMode ? VOICE_ROUTING_MODE_LABELS[effectiveMode] : "Not configured",
      businessHoursStatus,
      businessHoursStatusLabel: voiceBusinessHoursStatusLabel(businessHoursStatus),
    }
  })
}

export async function updateVoiceNumber(
  admin: SupabaseClient,
  organizationId: string,
  numberId: string,
  patch: Partial<{
    displayName: string
    assignedUserId: string | null
    defaultForwardingTarget: string
    routingMode: VoiceRoutingMode | null
    routingProfileId: string | null
    status: VoiceNumberStatus
    voiceEnabled: boolean
    smsEnabled: boolean
    recordingPolicy: import("@/lib/voice/call-control/types").VoiceRecordingPolicy | null
  }>,
): Promise<VoiceNumberRecord | null> {
  const payload: Record<string, unknown> = {}
  if (patch.displayName !== undefined) payload.display_name = patch.displayName
  if (patch.assignedUserId !== undefined) payload.assigned_user_id = patch.assignedUserId
  if (patch.defaultForwardingTarget !== undefined) {
    payload.default_forwarding_target = normalizePhoneNumber(patch.defaultForwardingTarget) || patch.defaultForwardingTarget
  }
  if (patch.routingMode !== undefined) payload.routing_mode = patch.routingMode
  if (patch.routingProfileId !== undefined) payload.routing_profile_id = patch.routingProfileId
  if (patch.status !== undefined) payload.status = patch.status
  if (patch.voiceEnabled !== undefined) payload.voice_enabled = patch.voiceEnabled
  if (patch.smsEnabled !== undefined) payload.sms_enabled = patch.smsEnabled
  if (patch.recordingPolicy !== undefined) payload.recording_policy = patch.recordingPolicy

  const { data, error } = await admin
    .schema("voice")
    .from("voice_numbers")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", numberId)
    .select("*")
    .maybeSingle()

  if (error || !data) return null
  return mapNumber(data as Record<string, unknown>)
}

export async function fetchVoiceRoutingProfiles(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceRoutingProfileRecord[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_routing_profiles")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })
  if (error || !data) return []
  return data.map((row) => mapRoutingProfile(row as Record<string, unknown>))
}

export async function createVoiceRoutingProfile(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    name: string
    description?: string
    routingMode?: VoiceRoutingMode
    fallbackMode?: VoiceRoutingMode
    fallbackPhoneNumber?: string
    voicemailBoxId?: string | null
    businessHoursId?: string | null
  },
): Promise<VoiceRoutingProfileRecord | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_routing_profiles")
    .insert({
      organization_id: organizationId,
      name: input.name.trim(),
      description: input.description ?? "",
      routing_mode: input.routingMode ?? "assigned_user",
      fallback_mode: input.fallbackMode ?? "voicemail_only",
      fallback_phone_number: input.fallbackPhoneNumber ?? "",
      voicemail_box_id: input.voicemailBoxId ?? null,
      business_hours_id: input.businessHoursId ?? null,
      metadata_json: { phase: "1b" },
    })
    .select("*")
    .single()
  if (error || !data) return null
  return mapRoutingProfile(data as Record<string, unknown>)
}

export async function updateVoiceRoutingProfile(
  admin: SupabaseClient,
  organizationId: string,
  profileId: string,
  patch: Partial<{
    name: string
    description: string
    routingMode: VoiceRoutingMode
    fallbackMode: VoiceRoutingMode
    fallbackPhoneNumber: string
    voicemailBoxId: string | null
    businessHoursId: string | null
  }>,
): Promise<VoiceRoutingProfileRecord | null> {
  const payload: Record<string, unknown> = {}
  if (patch.name !== undefined) payload.name = patch.name.trim()
  if (patch.description !== undefined) payload.description = patch.description
  if (patch.routingMode !== undefined) payload.routing_mode = patch.routingMode
  if (patch.fallbackMode !== undefined) payload.fallback_mode = patch.fallbackMode
  if (patch.fallbackPhoneNumber !== undefined) payload.fallback_phone_number = patch.fallbackPhoneNumber
  if (patch.voicemailBoxId !== undefined) payload.voicemail_box_id = patch.voicemailBoxId
  if (patch.businessHoursId !== undefined) payload.business_hours_id = patch.businessHoursId

  const { data, error } = await admin
    .schema("voice")
    .from("voice_routing_profiles")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", profileId)
    .select("*")
    .maybeSingle()
  if (error || !data) return null
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

export async function fetchVoiceBusinessHoursList(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceBusinessHoursRecord[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_business_hours")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })
  if (error || !data) return []
  return data.map((row) => mapBusinessHours(row as Record<string, unknown>))
}

export async function createVoiceBusinessHours(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    name: string
    timezone?: string
    weeklyScheduleJson?: Record<string, unknown>
    holidayRulesJson?: unknown[]
    afterHoursRoutingMode?: VoiceRoutingMode
    afterHoursForwardingNumber?: string
    afterHoursVoicemailBoxId?: string | null
  },
): Promise<VoiceBusinessHoursRecord | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_business_hours")
    .insert({
      organization_id: organizationId,
      name: input.name.trim(),
      timezone: input.timezone ?? "America/New_York",
      weekly_schedule_json: input.weeklyScheduleJson ?? {
        monday: { open: "09:00", close: "17:00" },
        tuesday: { open: "09:00", close: "17:00" },
        wednesday: { open: "09:00", close: "17:00" },
        thursday: { open: "09:00", close: "17:00" },
        friday: { open: "09:00", close: "17:00" },
        saturday: { closed: true },
        sunday: { closed: true },
      },
      holiday_rules_json: input.holidayRulesJson ?? [],
      after_hours_routing_mode: input.afterHoursRoutingMode ?? "voicemail_only",
      after_hours_forwarding_number: input.afterHoursForwardingNumber ?? "",
      after_hours_voicemail_box_id: input.afterHoursVoicemailBoxId ?? null,
    })
    .select("*")
    .single()
  if (error || !data) return null
  return mapBusinessHours(data as Record<string, unknown>)
}

export async function updateVoiceBusinessHours(
  admin: SupabaseClient,
  organizationId: string,
  businessHoursId: string,
  patch: Partial<{
    name: string
    timezone: string
    weeklyScheduleJson: Record<string, unknown>
    holidayRulesJson: unknown[]
    afterHoursRoutingMode: VoiceRoutingMode
    afterHoursForwardingNumber: string
    afterHoursVoicemailBoxId: string | null
  }>,
): Promise<VoiceBusinessHoursRecord | null> {
  const payload: Record<string, unknown> = {}
  if (patch.name !== undefined) payload.name = patch.name.trim()
  if (patch.timezone !== undefined) payload.timezone = patch.timezone
  if (patch.weeklyScheduleJson !== undefined) payload.weekly_schedule_json = patch.weeklyScheduleJson
  if (patch.holidayRulesJson !== undefined) payload.holiday_rules_json = patch.holidayRulesJson
  if (patch.afterHoursRoutingMode !== undefined) payload.after_hours_routing_mode = patch.afterHoursRoutingMode
  if (patch.afterHoursForwardingNumber !== undefined) {
    payload.after_hours_forwarding_number = patch.afterHoursForwardingNumber
  }
  if (patch.afterHoursVoicemailBoxId !== undefined) {
    payload.after_hours_voicemail_box_id = patch.afterHoursVoicemailBoxId
  }

  const { data, error } = await admin
    .schema("voice")
    .from("voice_business_hours")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", businessHoursId)
    .select("*")
    .maybeSingle()
  if (error || !data) return null
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

export async function createVoiceVoicemailBox(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    name: string
    greetingText?: string
    notificationEmail?: string
    assignedUserId?: string | null
    retentionDays?: number
  },
): Promise<VoiceVoicemailBoxRecord | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_voicemail_boxes")
    .insert({
      organization_id: organizationId,
      name: input.name.trim(),
      greeting_text: input.greetingText ?? "",
      notification_email: input.notificationEmail ?? "",
      assigned_user_id: input.assignedUserId ?? null,
      retention_days: input.retentionDays ?? 30,
    })
    .select("*")
    .single()
  if (error || !data) return null
  return mapVoicemailBox(data as Record<string, unknown>)
}

export async function updateVoiceVoicemailBox(
  admin: SupabaseClient,
  organizationId: string,
  voicemailBoxId: string,
  patch: Partial<{
    name: string
    greetingText: string
    notificationEmail: string
    assignedUserId: string | null
    retentionDays: number
  }>,
): Promise<VoiceVoicemailBoxRecord | null> {
  const payload: Record<string, unknown> = {}
  if (patch.name !== undefined) payload.name = patch.name.trim()
  if (patch.greetingText !== undefined) payload.greeting_text = patch.greetingText
  if (patch.notificationEmail !== undefined) payload.notification_email = patch.notificationEmail
  if (patch.assignedUserId !== undefined) payload.assigned_user_id = patch.assignedUserId
  if (patch.retentionDays !== undefined) payload.retention_days = patch.retentionDays

  const { data, error } = await admin
    .schema("voice")
    .from("voice_voicemail_boxes")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", voicemailBoxId)
    .select("*")
    .maybeSingle()
  if (error || !data) return null
  return mapVoicemailBox(data as Record<string, unknown>)
}

export async function fetchVoiceNumberByPhone(
  admin: SupabaseClient,
  organizationId: string,
  phoneNumber: string,
): Promise<VoiceNumberRecord | null> {
  const normalized = normalizePhoneNumber(phoneNumber)
  if (!normalized) return null
  const { data } = await admin
    .schema("voice")
    .from("voice_numbers")
    .select("*")
    .eq("organization_id", organizationId)
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

export async function buildVoiceComplianceReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceComplianceReadinessSnapshot> {
  const optOutCount = await countVoiceOptOuts(admin, organizationId)
  return {
    optOutTableReady: true,
    optOutCount,
    dncEnforcementMessage: "DNC enforcement is pending a future compliance phase.",
    callRecordingDisclosureMessage: "Call recording disclosure workflows are pending a future phase.",
    aiDisclosureMessage: "AI voice disclosure requirements are pending a future phase.",
  }
}

export async function fetchVoiceOperationsReadiness(
  admin: SupabaseClient,
  organizationId: string | null,
): Promise<VoiceOperationsReadinessSnapshot> {
  const base = await fetchVoiceInfrastructureReadiness(admin, organizationId)
  if (!organizationId) {
    return {
      ...base,
      operationsQaMarker: VOICE_OPERATIONS_QA_MARKER,
      routingProfileCount: 0,
      businessHoursCount: 0,
      voicemailBoxCount: 0,
      complianceReadinessExtended: {
        optOutTableReady: true,
        optOutCount: 0,
        dncEnforcementMessage: "DNC enforcement is pending a future compliance phase.",
        callRecordingDisclosureMessage: "Call recording disclosure workflows are pending a future phase.",
        aiDisclosureMessage: "AI voice disclosure requirements are pending a future phase.",
      },
    }
  }

  const [profiles, hours, boxes, compliance, callControlReadiness] = await Promise.all([
    fetchVoiceRoutingProfiles(admin, organizationId),
    fetchVoiceBusinessHoursList(admin, organizationId),
    fetchVoiceVoicemailBoxes(admin, organizationId),
    buildVoiceComplianceReadiness(admin, organizationId),
    fetchVoiceCallControlReadiness(admin, organizationId),
  ])

  return {
    ...base,
    operationsQaMarker: VOICE_OPERATIONS_QA_MARKER,
    routingProfileCount: profiles.length,
    businessHoursCount: hours.length,
    voicemailBoxCount: boxes.length,
    complianceReadinessExtended: compliance,
    callControlReadiness,
    infrastructureMessage:
      base.phoneNumberCount === 0
        ? "Number provisioning will be connected after provider credentials are fully validated."
        : base.infrastructureMessage,
  }
}

export {
  mapNumber,
  mapRoutingProfile,
  mapBusinessHours,
  mapVoicemailBox,
  mapRoutingMember,
}
