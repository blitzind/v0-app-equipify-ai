import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  mapVoiceCallStatusToBrowserCallState,
  mapVoiceCallStatusToNativeSessionStatus,
} from "@/lib/voice/browser-calling/status-mapping"
import { VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER } from "@/lib/voice/browser-calling/types"
import type { VoiceBrowserCallState, VoiceBrowserSyncSnapshot, VoiceOperatorPresenceStatus } from "@/lib/voice/browser-calling/types"
import {
  assertVoiceCallPickupAllowed,
  fetchInboundBrowserOfferForUser,
  fetchVoiceCallRecordingVisibility,
  fetchVoiceCallTimeline,
  heartbeatVoiceBrowserDevice,
  listOnlineVoiceBrowserDevices,
} from "@/lib/voice/repository/voice-browser-calling-repository"
import { fetchVoiceCallControlSnapshot } from "@/lib/voice/transfer-control/call-control-service"
import { fetchVoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/media-session-service"
import { fetchVoiceCallConversationIntelligenceSnapshot } from "@/lib/voice/intelligence/intelligence-service"
import { fetchUnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/operator-assist-service"
import { fetchRelationshipMemoryWorkspaceSnapshot } from "@/lib/voice/relationship-memory/relationship-memory-service"
import { fetchRevenueIntelligenceWorkspaceSnapshot } from "@/lib/voice/revenue-intelligence/revenue-intelligence-service"
import { appendVoiceCallEvent } from "@/lib/voice/repository/voice-repository"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import type { VoiceCallStatus } from "@/lib/voice/types"

const SESSION_SELECT =
  "id, lead_id, owner_user_id, queue_item_id, provider, fallback_provider, dial_mode, direction, status, phone_number, contact_name, company_name, started_at, connected_at, ended_at, duration_seconds, recording_state, muted, on_hold, transfer_target, notes_draft, realtime_session_id, call_copilot_session_id, provider_call_ref, safe_summary, voice_call_id"

function sessionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("native_call_workspace_sessions")
}

export async function createVoiceCallForWorkspaceSession(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sessionId: string
    ownerUserId: string | null
    direction: "inbound" | "outbound"
    fromNumber: string
    toNumber: string
    provider?: string
    providerCallId?: string | null
    leadId?: string | null
    dialMode?: string
  },
): Promise<string> {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("voice")
    .from("voice_calls")
    .insert({
      organization_id: input.organizationId,
      provider: input.provider ?? "twilio",
      provider_call_id: input.providerCallId ?? `workspace:${input.sessionId}`,
      direction: input.direction,
      status: input.direction === "inbound" ? "ringing" : "initiated",
      from_number: input.fromNumber,
      to_number: input.toNumber,
      assigned_user_id: input.ownerUserId,
      lead_id: input.leadId ?? null,
      started_at: now,
      metadata_json: {
        workspace_session_id: input.sessionId,
        dial_mode: input.dialMode ?? "manual",
        source: "call_workspace",
      },
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)

  const voiceCallId = data.id as string
  await sessionsTable(admin)
    .update({ voice_call_id: voiceCallId, updated_at: now })
    .eq("id", input.sessionId)

  await appendVoiceCallEvent(admin, {
    organizationId: input.organizationId,
    voiceCallId,
    provider: (input.provider ?? "twilio") as import("@/lib/voice/types").VoiceProviderId,
    eventType: "initiated",
    eventTimestamp: now,
    payloadJson: { source: "call_workspace", sessionId: input.sessionId },
    idempotencyKey: `workspace:${input.sessionId}:initiated`,
  })

  logVoiceInfrastructure("voice_workspace_call_linked", {
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    voiceCallId,
  })
  return voiceCallId
}

export async function syncWorkspaceSessionFromVoiceCall(
  admin: SupabaseClient,
  input: { voiceCallId: string; organizationId: string },
): Promise<void> {
  const { data: callRow, error: callError } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("status, answered_at, ended_at, duration_seconds, recording_available, assigned_user_id")
    .eq("id", input.voiceCallId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()
  if (callError) throw new Error(callError.message)
  if (!callRow) return

  const { data: sessionRow } = await sessionsTable(admin)
    .select(SESSION_SELECT)
    .eq("voice_call_id", input.voiceCallId)
    .maybeSingle()
  if (!sessionRow) return

  const nativeStatus = mapVoiceCallStatusToNativeSessionStatus(callRow.status as VoiceCallStatus, {
    onHold: Boolean(sessionRow.on_hold),
  })
  const patch: Record<string, unknown> = {
    status: nativeStatus,
    updated_at: new Date().toISOString(),
  }
  if (callRow.answered_at && !sessionRow.connected_at) patch.connected_at = callRow.answered_at
  if (callRow.ended_at) patch.ended_at = callRow.ended_at
  if (typeof callRow.duration_seconds === "number") patch.duration_seconds = callRow.duration_seconds
  if (callRow.recording_available) patch.recording_state = "active"
  if (nativeStatus === "completed" || nativeStatus === "failed" || nativeStatus === "no_answer") {
    if (sessionRow.status !== "wrapping" && sessionRow.status !== "completed") {
      patch.status = nativeStatus === "completed" ? "wrapping" : nativeStatus
    }
  }

  await sessionsTable(admin).update(patch).eq("id", sessionRow.id as string)
}

export async function buildVoiceBrowserSyncSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    clientIdentity?: string | null
    workspaceSessionId?: string | null
  },
): Promise<VoiceBrowserSyncSnapshot> {
  const generatedAt = new Date().toISOString()
  let device = null
  if (input.clientIdentity) {
    device = await heartbeatVoiceBrowserDevice(admin, {
      organizationId: input.organizationId,
      userId: input.userId,
      clientIdentity: input.clientIdentity,
    })
  }

  const { data: presenceRow } = await admin
    .schema("voice")
    .from("voice_operator_presence")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .maybeSingle()

  let activeVoiceCallId: string | null = null
  let workspaceSessionId = input.workspaceSessionId ?? null
  let voiceStatus: VoiceCallStatus | null = null
  let muted = false
  let onHold = false
  let sessionPhone: string | null = null
  let sessionLeadId: string | null = null
  let sessionContactName: string | null = null

  if (workspaceSessionId) {
    const { data: sessionRow } = await sessionsTable(admin)
      .select("voice_call_id, muted, on_hold, status, phone_number, lead_id, contact_name")
      .eq("id", workspaceSessionId)
      .maybeSingle()
    activeVoiceCallId = (sessionRow?.voice_call_id as string | null) ?? null
    muted = Boolean(sessionRow?.muted)
    onHold = Boolean(sessionRow?.on_hold)
    sessionPhone = (sessionRow?.phone_number as string | null) ?? null
    sessionLeadId = (sessionRow?.lead_id as string | null) ?? null
    sessionContactName = (sessionRow?.contact_name as string | null) ?? null
  } else {
    const { data: activeSession } = await sessionsTable(admin)
      .select("id, voice_call_id, muted, on_hold, status, owner_user_id, phone_number, lead_id, contact_name")
      .eq("organization_id", input.organizationId)
      .eq("owner_user_id", input.userId)
      .in("status", ["ringing", "active", "on_hold", "external_bridge_pending"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    workspaceSessionId = (activeSession?.id as string | null) ?? null
    activeVoiceCallId = (activeSession?.voice_call_id as string | null) ?? null
    muted = Boolean(activeSession?.muted)
    onHold = Boolean(activeSession?.on_hold)
    sessionPhone = (activeSession?.phone_number as string | null) ?? null
    sessionLeadId = (activeSession?.lead_id as string | null) ?? null
    sessionContactName = (activeSession?.contact_name as string | null) ?? null
  }

  if (activeVoiceCallId) {
    const { data: callRow } = await admin
      .schema("voice")
      .from("voice_calls")
      .select("status")
      .eq("id", activeVoiceCallId)
      .maybeSingle()
    voiceStatus = (callRow?.status as VoiceCallStatus | null) ?? null
    await syncWorkspaceSessionFromVoiceCall(admin, {
      voiceCallId: activeVoiceCallId,
      organizationId: input.organizationId,
    })
  }

  const browserCallState: VoiceBrowserCallState = mapVoiceCallStatusToBrowserCallState({
    voiceStatus,
    muted,
    onHold,
  })

  const timeline = activeVoiceCallId ? await fetchVoiceCallTimeline(admin, activeVoiceCallId) : []
  const recording = activeVoiceCallId
    ? await fetchVoiceCallRecordingVisibility(admin, activeVoiceCallId)
    : null
  const controlSnapshot = activeVoiceCallId
    ? await fetchVoiceCallControlSnapshot(admin, input.organizationId, activeVoiceCallId)
    : { participants: [], activeTransfer: null }
  const liveTranscript = activeVoiceCallId
    ? await fetchVoiceCallTranscriptSnapshot(admin, input.organizationId, activeVoiceCallId)
    : null
  const conversationIntelligence = activeVoiceCallId
    ? await fetchVoiceCallConversationIntelligenceSnapshot(admin, input.organizationId, activeVoiceCallId)
    : null
  const operatorAssist = await fetchUnifiedOperatorAssistSnapshot(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    workspaceSessionId,
    voiceCallId: activeVoiceCallId,
    voiceTranscript: liveTranscript,
    conversationIntelligence,
    participants: controlSnapshot.participants,
  })
  const relationshipMemory = sessionPhone
    ? await fetchRelationshipMemoryWorkspaceSnapshot(admin, {
        organizationId: input.organizationId,
        phoneNumber: sessionPhone,
        leadId: sessionLeadId,
        contactName: sessionContactName,
        activeVoiceCallId,
      })
    : null
  const revenueIntelligence = sessionPhone
    ? await fetchRevenueIntelligenceWorkspaceSnapshot(admin, {
        organizationId: input.organizationId,
        phoneNumber: sessionPhone,
        leadId: sessionLeadId,
        activeVoiceCallId,
        relationshipMemoryProfileId: relationshipMemory?.profile?.id ?? null,
      })
    : null
  const inboundRinging = await fetchInboundBrowserOfferForUser(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
  })

  return {
    qaMarker: VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER,
    generatedAt,
    browserCallState,
    device,
    presence: presenceRow
      ? {
          userId: presenceRow.user_id as string,
          status: presenceRow.status as VoiceOperatorPresenceStatus,
          activeDeviceCount: presenceRow.active_device_count as number,
          activeVoiceCallId: (presenceRow.active_voice_call_id as string | null) ?? null,
          activeWorkspaceSessionId: (presenceRow.active_workspace_session_id as string | null) ?? null,
          lastSeenAt: presenceRow.last_seen_at as string,
        }
      : null,
    activeVoiceCallId,
    workspaceSessionId,
    timeline,
    recording,
    inboundRinging,
    participants: controlSnapshot.participants,
    activeTransfer: controlSnapshot.activeTransfer,
    liveTranscript,
    conversationIntelligence,
    operatorAssist,
    relationshipMemory,
    revenueIntelligence,
  }
}

export async function resolveBrowserClientIdentitiesForRouting(
  admin: SupabaseClient,
  input: { organizationId: string; userIds: string[] },
): Promise<string[]> {
  if (!input.userIds.length) return []
  const devices = await listOnlineVoiceBrowserDevices(admin, input.organizationId, {
    userIds: input.userIds,
  })
  return devices.map((device) => device.clientIdentity)
}

export async function provisionInboundBrowserWorkspaceOffers(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    targetUserIds: string[]
    fromNumber: string
    toNumber: string
  },
): Promise<void> {
  if (!input.targetUserIds.length) return

  const now = new Date().toISOString()
  for (const userId of input.targetUserIds) {
    const { data: existing } = await sessionsTable(admin)
      .select("id")
      .eq("voice_call_id", input.voiceCallId)
      .eq("owner_user_id", userId)
      .maybeSingle()
    if (existing?.id) continue

    await sessionsTable(admin).insert({
      organization_id: input.organizationId,
      owner_user_id: userId,
      direction: "inbound",
      dial_mode: "inbound",
      status: "ringing",
      phone_number: input.fromNumber,
      contact_name: null,
      company_name: null,
      provider: "twilio",
      fallback_provider: null,
      voice_call_id: input.voiceCallId,
      recording_state: "pending",
      safe_summary: `Inbound browser offer from ${input.fromNumber} to ${input.toNumber}.`,
      started_at: now,
    })
  }
}

export async function createInboundVoiceCallFromTwilio(
  admin: SupabaseClient,
  input: {
    organizationId: string
    providerCallId: string
    fromNumber: string
    toNumber: string
    assignedUserId?: string | null
  },
): Promise<string> {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("voice")
    .from("voice_calls")
    .upsert(
      {
        organization_id: input.organizationId,
        provider: "twilio",
        provider_call_id: input.providerCallId,
        direction: "inbound",
        status: "ringing",
        from_number: input.fromNumber,
        to_number: input.toNumber,
        assigned_user_id: input.assignedUserId ?? null,
        started_at: now,
        metadata_json: { source: "inbound_twilio", browser_routing: true },
      },
      { onConflict: "organization_id,provider,provider_call_id" },
    )
    .select("id")
    .single()
  if (error) throw new Error(error.message)

  const voiceCallId = data.id as string
  await appendVoiceCallEvent(admin, {
    organizationId: input.organizationId,
    voiceCallId,
    provider: "twilio",
    eventType: "ringing",
    eventTimestamp: now,
    payloadJson: { source: "inbound_twilio" },
    idempotencyKey: `inbound:${input.providerCallId}:ringing`,
  })

  return voiceCallId
}

export async function claimInboundVoiceCallForOperator(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    voiceCallId: string
    workspaceSessionId: string
  },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const allowed = await assertVoiceCallPickupAllowed(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    voiceCallId: input.voiceCallId,
  })
  if (!allowed.ok) return allowed

  const now = new Date().toISOString()
  await admin
    .schema("voice")
    .from("voice_calls")
    .update({ assigned_user_id: input.userId, updated_at: now })
    .eq("id", input.voiceCallId)
    .eq("organization_id", input.organizationId)

  await sessionsTable(admin)
    .update({ owner_user_id: input.userId, updated_at: now })
    .eq("id", input.workspaceSessionId)

  await admin
    .schema("voice")
    .from("voice_operator_presence")
    .upsert(
      {
        organization_id: input.organizationId,
        user_id: input.userId,
        active_voice_call_id: input.voiceCallId,
        active_workspace_session_id: input.workspaceSessionId,
        status: "on_call",
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "organization_id,user_id" },
    )

  return { ok: true }
}
