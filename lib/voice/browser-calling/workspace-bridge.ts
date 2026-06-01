import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  mapVoiceCallStatusToBrowserCallState,
  resolveInboundNativeSessionStatusFromVoiceCall,
} from "@/lib/voice/browser-calling/status-mapping"
import { shouldSyncNativeSessionFromVoiceCall } from "@/lib/voice/browser-calling/call-lifecycle-reconciliation"
import type { NativeCallWorkspaceSessionPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
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
import { ensureInboundCallWorkspaceLiveCoachingLinked } from "@/lib/growth/native-dialer/call-workspace-coaching-service"
import { fetchUnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/operator-assist-service"
import { fetchRelationshipMemoryWorkspaceSnapshot } from "@/lib/voice/relationship-memory/relationship-memory-service"
import { fetchRevenueIntelligenceWorkspaceSnapshot } from "@/lib/voice/revenue-intelligence/revenue-intelligence-service"
import { fetchRetentionIntelligenceWorkspaceSnapshot } from "@/lib/voice/retention-intelligence/retention-intelligence-service"
import { fetchAiCopilotWorkspaceSnapshot } from "@/lib/voice/ai-copilot/ai-copilot-service"
import { fetchAiReceptionistWorkspaceSnapshot } from "@/lib/voice/ai-receptionist/receptionist-service"
import { fetchMissedCallRecoveryWorkspaceSnapshot } from "@/lib/voice/missed-call-recovery/missed-call-recovery-service"
import { appendVoiceCallEvent } from "@/lib/voice/repository/voice-repository"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import { VoiceRouteTimer } from "@/lib/voice/performance/voice-route-timing"
import type { VoiceCallStatus } from "@/lib/voice/types"
import {
  INBOUND_RING_DIAG_EVENTS,
  logInboundRingDiagnostic,
  withInboundRingElapsed,
} from "@/lib/voice/browser-calling/inbound-ring-diagnostics"

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

  const nativeStatus = resolveInboundNativeSessionStatusFromVoiceCall({
    voiceStatus: callRow.status as VoiceCallStatus,
    direction: sessionRow.direction as "inbound" | "outbound",
    answeredAt: (callRow.answered_at as string | null) ?? null,
    onHold: Boolean(sessionRow.on_hold),
  })
  const currentStatus = sessionRow.status as NativeCallWorkspaceSessionPublicView["status"]
  if (
    ["wrapping", "completed", "missed", "failed", "no_answer", "cancelled"].includes(currentStatus) &&
    (nativeStatus === "active" || nativeStatus === "on_hold" || nativeStatus === "ringing")
  ) {
    return
  }
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

  const isAnsweredInbound =
    sessionRow.direction === "inbound" &&
    Boolean(callRow.answered_at) &&
    (nativeStatus === "active" || nativeStatus === "on_hold") &&
    !(sessionRow.realtime_session_id as string | null)
  if (isAnsweredInbound) {
    try {
      await ensureInboundCallWorkspaceLiveCoachingLinked(admin, {
        voiceCallId: input.voiceCallId,
        createdBy: (sessionRow.owner_user_id as string | null) ?? null,
      })
    } catch (error) {
      logVoiceInfrastructure("voice_transcript_failed", {
        organizationId: input.organizationId,
        voiceCallId: input.voiceCallId,
        stage: "coaching_auto_link",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

const LIVE_BROWSER_SESSION_STATUSES = new Set<NativeCallWorkspaceSessionPublicView["status"]>([
  "ringing",
  "active",
  "on_hold",
  "external_bridge_pending",
])

function isLiveBrowserWorkspaceSession(
  status: NativeCallWorkspaceSessionPublicView["status"] | null | undefined,
): boolean {
  return status != null && LIVE_BROWSER_SESSION_STATUSES.has(status)
}

function emptyVoiceBrowserSyncSnapshot(input: {
  generatedAt: string
  device: VoiceBrowserSyncSnapshot["device"]
  inboundRinging: VoiceBrowserSyncSnapshot["inboundRinging"]
}): VoiceBrowserSyncSnapshot {
  return {
    qaMarker: VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER,
    generatedAt: input.generatedAt,
    browserCallState: "idle",
    device: input.device,
    presence: null,
    activeVoiceCallId: null,
    workspaceSessionId: null,
    timeline: [],
    recording: null,
    inboundRinging: input.inboundRinging,
    participants: [],
    activeTransfer: null,
    liveTranscript: null,
    conversationIntelligence: null,
    operatorAssist: null,
    relationshipMemory: null,
    revenueIntelligence: null,
    retentionIntelligence: null,
    aiCopilot: null,
    aiReceptionist: null,
    missedCallRecovery: null,
  }
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
  const timer = new VoiceRouteTimer("voice_browser_sync")
  const generatedAt = new Date().toISOString()

  let device = null
  if (input.clientIdentity) {
    device = await timer.measure("heartbeat", () =>
      heartbeatVoiceBrowserDevice(admin, {
        organizationId: input.organizationId,
        userId: input.userId,
        clientIdentity: input.clientIdentity,
      }),
    )
  }

  let activeVoiceCallId: string | null = null
  let workspaceSessionId = input.workspaceSessionId ?? null
  let voiceStatus: VoiceCallStatus | null = null
  let muted = false
  let onHold = false
  let sessionPhone: string | null = null
  let sessionLeadId: string | null = null
  let sessionContactName: string | null = null
  let sessionStatusForSync: NativeCallWorkspaceSessionPublicView["status"] | null = null

  if (workspaceSessionId) {
    const sessionRow = await timer.measure("session_lookup", async () => {
      const { data } = await sessionsTable(admin)
        .select("voice_call_id, muted, on_hold, status, phone_number, lead_id, contact_name")
        .eq("id", workspaceSessionId)
        .maybeSingle()
      return data
    })
    if (!isLiveBrowserWorkspaceSession(sessionRow?.status as NativeCallWorkspaceSessionPublicView["status"] | null)) {
      workspaceSessionId = null
    } else {
      activeVoiceCallId = (sessionRow?.voice_call_id as string | null) ?? null
      sessionStatusForSync = (sessionRow?.status as NativeCallWorkspaceSessionPublicView["status"] | null) ?? null
      muted = Boolean(sessionRow?.muted)
      onHold = Boolean(sessionRow?.on_hold)
      sessionPhone = (sessionRow?.phone_number as string | null) ?? null
      sessionLeadId = (sessionRow?.lead_id as string | null) ?? null
      sessionContactName = (sessionRow?.contact_name as string | null) ?? null
    }
  }

  if (!workspaceSessionId) {
    const activeSession = await timer.measure("active_session_lookup", async () => {
      const { data } = await sessionsTable(admin)
        .select("id, voice_call_id, muted, on_hold, status, owner_user_id, phone_number, lead_id, contact_name")
        .eq("organization_id", input.organizationId)
        .eq("owner_user_id", input.userId)
        .in("status", ["ringing", "active", "on_hold", "external_bridge_pending"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      return data
    })
    workspaceSessionId = (activeSession?.id as string | null) ?? null
    activeVoiceCallId = (activeSession?.voice_call_id as string | null) ?? null
    sessionStatusForSync = (activeSession?.status as NativeCallWorkspaceSessionPublicView["status"] | null) ?? null
    muted = Boolean(activeSession?.muted)
    onHold = Boolean(activeSession?.on_hold)
    sessionPhone = (activeSession?.phone_number as string | null) ?? null
    sessionLeadId = (activeSession?.lead_id as string | null) ?? null
    sessionContactName = (activeSession?.contact_name as string | null) ?? null
  }

  const inboundRinging = await timer.measure("inbound_offer", () =>
    fetchInboundBrowserOfferForUser(admin, {
      organizationId: input.organizationId,
      userId: input.userId,
    }),
  )

  if (inboundRinging && !activeVoiceCallId) {
    activeVoiceCallId = inboundRinging.voiceCallId
    workspaceSessionId = inboundRinging.workspaceSessionId
    sessionStatusForSync = "ringing"
  }

  const hasActiveLiveSession =
    Boolean(activeVoiceCallId) &&
    isLiveBrowserWorkspaceSession(sessionStatusForSync) &&
    sessionStatusForSync !== "ringing"

  if (!hasActiveLiveSession && !inboundRinging) {
    timer.finish({ mode: "idle" })
    return emptyVoiceBrowserSyncSnapshot({ generatedAt, device, inboundRinging })
  }

  if (!hasActiveLiveSession && inboundRinging) {
    timer.finish({ mode: "ringing", workspaceSessionId: inboundRinging.workspaceSessionId })
    logInboundRingDiagnostic(
      INBOUND_RING_DIAG_EVENTS.BROWSER_SYNC_INBOUND_RINGING,
      withInboundRingElapsed(inboundRinging.voiceCallCreatedAt, {
        voice_call_id: inboundRinging.voiceCallId,
        native_session_id: inboundRinging.workspaceSessionId,
        user_id: input.userId,
        client_identity: input.clientIdentity ?? null,
      }),
    )
    return {
      ...emptyVoiceBrowserSyncSnapshot({ generatedAt, device, inboundRinging }),
      browserCallState: "ringing",
      activeVoiceCallId: inboundRinging.voiceCallId,
      workspaceSessionId: inboundRinging.workspaceSessionId,
    }
  }

  if (activeVoiceCallId) {
    const callRow = await timer.measure("voice_call_status", async () => {
      const { data } = await admin
        .schema("voice")
        .from("voice_calls")
        .select("status")
        .eq("id", activeVoiceCallId)
        .maybeSingle()
      return data
    })
    voiceStatus = (callRow?.status as VoiceCallStatus | null) ?? null
    if (shouldSyncNativeSessionFromVoiceCall(sessionStatusForSync)) {
      await timer.measure("session_sync_write", () =>
        syncWorkspaceSessionFromVoiceCall(admin, {
          voiceCallId: activeVoiceCallId,
          organizationId: input.organizationId,
        }),
      )
    }
  }

  const browserCallState: VoiceBrowserCallState = mapVoiceCallStatusToBrowserCallState({
    voiceStatus,
    muted,
    onHold,
  })

  const timeline = activeVoiceCallId
    ? await timer.measure("timeline", () => fetchVoiceCallTimeline(admin, activeVoiceCallId))
    : []
  const recording = activeVoiceCallId
    ? await timer.measure("recording", () => fetchVoiceCallRecordingVisibility(admin, activeVoiceCallId))
    : null
  const controlSnapshot = activeVoiceCallId
    ? await timer.measure("call_control", () =>
        fetchVoiceCallControlSnapshot(admin, input.organizationId, activeVoiceCallId),
      )
    : { participants: [], activeTransfer: null }
  const liveTranscript = activeVoiceCallId
    ? await timer.measure("transcript", () =>
        fetchVoiceCallTranscriptSnapshot(admin, input.organizationId, activeVoiceCallId),
      )
    : null
  const conversationIntelligence = activeVoiceCallId
    ? await timer.measure("conversation_intelligence", () =>
        fetchVoiceCallConversationIntelligenceSnapshot(admin, input.organizationId, activeVoiceCallId),
      )
    : null
  const operatorAssist = await timer.measure("operator_assist", () =>
    fetchUnifiedOperatorAssistSnapshot(admin, {
      organizationId: input.organizationId,
      userId: input.userId,
      workspaceSessionId,
      voiceCallId: activeVoiceCallId,
      voiceTranscript: liveTranscript,
      conversationIntelligence,
      participants: controlSnapshot.participants,
    }),
  )
  const relationshipMemory = sessionPhone
    ? await timer.measure("relationship_memory", () =>
        fetchRelationshipMemoryWorkspaceSnapshot(admin, {
          organizationId: input.organizationId,
          phoneNumber: sessionPhone,
          leadId: sessionLeadId,
          contactName: sessionContactName,
          activeVoiceCallId,
        }),
      )
    : null
  const revenueIntelligence = sessionPhone
    ? await timer.measure("revenue_intelligence", () =>
        fetchRevenueIntelligenceWorkspaceSnapshot(admin, {
          organizationId: input.organizationId,
          phoneNumber: sessionPhone,
          leadId: sessionLeadId,
          activeVoiceCallId,
          relationshipMemoryProfileId: relationshipMemory?.profile?.id ?? null,
        }),
      )
    : null
  const retentionIntelligence = sessionPhone
    ? await timer.measure("retention_intelligence", () =>
        fetchRetentionIntelligenceWorkspaceSnapshot(admin, {
          organizationId: input.organizationId,
          phoneNumber: sessionPhone,
          leadId: sessionLeadId,
          activeVoiceCallId,
          relationshipMemoryProfileId: relationshipMemory?.profile?.id ?? null,
        }),
      )
    : null
  const aiCopilot = activeVoiceCallId
    ? await timer.measure("ai_copilot", () =>
        fetchAiCopilotWorkspaceSnapshot(admin, {
          organizationId: input.organizationId,
          voiceCallId: activeVoiceCallId,
          operatorAssist,
          liveTranscript,
          retentionIntelligence,
        }),
      )
    : null
  const aiReceptionist = activeVoiceCallId
    ? await timer.measure("ai_receptionist", () =>
        fetchAiReceptionistWorkspaceSnapshot(admin, {
          organizationId: input.organizationId,
          voiceCallId: activeVoiceCallId,
        }),
      )
    : null
  const missedCallRecovery = activeVoiceCallId
    ? await timer.measure("missed_call_recovery", () =>
        fetchMissedCallRecoveryWorkspaceSnapshot(admin, {
          organizationId: input.organizationId,
          voiceCallId: activeVoiceCallId,
        }),
      )
    : null

  if (inboundRinging) {
    logInboundRingDiagnostic(
      INBOUND_RING_DIAG_EVENTS.BROWSER_SYNC_INBOUND_RINGING,
      withInboundRingElapsed(inboundRinging.voiceCallCreatedAt, {
        voice_call_id: inboundRinging.voiceCallId,
        native_session_id: inboundRinging.workspaceSessionId,
        user_id: input.userId,
        client_identity: input.clientIdentity ?? null,
      }),
    )
  }

  timer.finish({ mode: "live", activeVoiceCallId, workspaceSessionId })

  const presenceRow = await timer.measure("presence", async () => {
    const { data } = await admin
      .schema("voice")
      .from("voice_operator_presence")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("user_id", input.userId)
      .maybeSingle()
    return data
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
    retentionIntelligence,
    aiCopilot,
    aiReceptionist,
    missedCallRecovery,
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

    const { data: inserted, error: insertError } = await sessionsTable(admin)
      .insert({
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
      .select("id")
      .single()
    if (insertError) {
      logInboundRingDiagnostic(INBOUND_RING_DIAG_EVENTS.NATIVE_SESSION_CREATED, {
        voice_call_id: input.voiceCallId,
        owner_user_id: userId,
        organization_id: input.organizationId,
        provision_error: insertError.message,
      })
      continue
    }

    const { data: callRow } = await admin
      .schema("voice")
      .from("voice_calls")
      .select("started_at")
      .eq("id", input.voiceCallId)
      .maybeSingle()
    const voiceCallCreatedAt = (callRow?.started_at as string | null) ?? null

    logInboundRingDiagnostic(
      INBOUND_RING_DIAG_EVENTS.NATIVE_SESSION_CREATED,
      withInboundRingElapsed(voiceCallCreatedAt, {
        voice_call_id: input.voiceCallId,
        native_session_id: inserted.id as string,
        owner_user_id: userId,
        organization_id: input.organizationId,
      }),
    )
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
  logInboundRingDiagnostic(INBOUND_RING_DIAG_EVENTS.VOICE_CALL_CREATED, {
    voice_call_id: voiceCallId,
    provider_call_id: input.providerCallId,
    voice_call_created_at: now,
    organization_id: input.organizationId,
    from_number: input.fromNumber,
    to_number: input.toNumber,
  })
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
