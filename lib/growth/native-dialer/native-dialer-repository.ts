import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { commandLeadFocusHref } from "@/lib/growth/command/command-action-catalog"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { nativeCallWorkspaceHref } from "@/lib/growth/native-dialer/native-dialer-navigation"
import {
  buildSuggestedWrapupNextActions,
  normalizeWrapupFlags,
  type NativeCallWrapupInput,
} from "@/lib/growth/native-dialer/native-dialer-wrapup-engine"
import { routeNativeDialerProvider } from "@/lib/growth/native-dialer/native-dialer-provider-registry"
import { resolveCallWorkspaceLeadByPhone } from "@/lib/growth/native-dialer/call-workspace-phone-lead-resolve"
import {
  claimInboundVoiceCallForOperator,
  createVoiceCallForWorkspaceSession,
  syncWorkspaceSessionFromVoiceCall,
} from "@/lib/voice/browser-calling/workspace-bridge"
import {
  completeCallWorkspaceLiveCoachingForNativeSession,
} from "@/lib/growth/native-dialer/call-workspace-coaching-lifecycle"
import { appendVoiceCallEvent } from "@/lib/voice/repository/voice-repository"
import {
  INBOUND_RING_DIAG_EVENTS,
  logInboundRingDiagnostic,
  withInboundRingElapsed,
} from "@/lib/voice/browser-calling/inbound-ring-diagnostics"
import type {
  NativeCallSessionStatus,
  NativeCallWrapupPublicView,
  NativeCallWorkspaceSessionPublicView,
  NativeDialerProviderId,
  NativeDialerQueueItemPublicView,
  NativeDialerQueueMode,
} from "@/lib/growth/native-dialer/native-dialer-types"

const SESSION_SELECT =
  "id, lead_id, owner_user_id, queue_item_id, provider, fallback_provider, dial_mode, direction, status, phone_number, contact_name, company_name, started_at, connected_at, ended_at, duration_seconds, recording_state, muted, on_hold, transfer_target, notes_draft, realtime_session_id, call_copilot_session_id, provider_call_ref, safe_summary, voice_call_id"

type SessionRow = Record<string, unknown>
type QueueRow = Record<string, unknown>
type WrapupRow = Record<string, unknown>

function sessionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("native_call_workspace_sessions")
}

function queueTable(admin: SupabaseClient) {
  return admin.schema("growth").from("native_dialer_queue_items")
}

function wrapupsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("native_call_wrapups")
}

async function resolveDefaultOutboundCallerId(admin: SupabaseClient, organizationId: string): Promise<string> {
  const { data } = await admin
    .schema("voice")
    .from("voice_numbers")
    .select("phone_number")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data?.phone_number as string | null) ?? "browser:outbound"
}

function settingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("native_dialer_settings")
}

export function mapNativeCallSessionRow(row: SessionRow): NativeCallWorkspaceSessionPublicView {
  return {
    id: row.id as string,
    leadId: (row.lead_id as string | null) ?? null,
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    provider: row.provider as NativeDialerProviderId,
    fallbackProvider: (row.fallback_provider as NativeDialerProviderId | null) ?? null,
    dialMode: row.dial_mode as NativeCallWorkspaceSessionPublicView["dialMode"],
    direction: row.direction as "outbound" | "inbound",
    status: row.status as NativeCallSessionStatus,
    phoneNumber: (row.phone_number as string | null) ?? null,
    contactName: (row.contact_name as string | null) ?? null,
    companyName: (row.company_name as string | null) ?? null,
    startedAt: row.started_at as string,
    connectedAt: (row.connected_at as string | null) ?? null,
    endedAt: (row.ended_at as string | null) ?? null,
    durationSeconds: row.duration_seconds as number,
    recordingState: row.recording_state as NativeCallWorkspaceSessionPublicView["recordingState"],
    muted: row.muted as boolean,
    onHold: row.on_hold as boolean,
    transferTarget: (row.transfer_target as string | null) ?? null,
    notesDraft: row.notes_draft as string,
    realtimeSessionId: (row.realtime_session_id as string | null) ?? null,
    callCopilotSessionId: (row.call_copilot_session_id as string | null) ?? null,
    providerCallRef: (row.provider_call_ref as string | null) ?? null,
    safeSummary: row.safe_summary as string,
    voiceCallId: (row.voice_call_id as string | null) ?? null,
  }
}

function mapQueueRow(row: QueueRow): NativeDialerQueueItemPublicView {
  const leadId = row.lead_id as string
  return {
    id: row.id as string,
    leadId,
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    queueMode: row.queue_mode as NativeDialerQueueMode,
    status: row.status as string,
    priorityScore: row.priority_score as number,
    callbackDueAt: (row.callback_due_at as string | null) ?? null,
    phoneNumber: (row.phone_number as string | null) ?? null,
    contactName: (row.contact_name as string | null) ?? null,
    companyName: (row.company_name as string | null) ?? null,
    reason: row.reason as string,
    ctaHref: nativeCallWorkspaceHref({ leadId, phone: row.phone_number as string | null, queueItemId: row.id as string }),
  }
}

function mapWrapupRow(row: WrapupRow): NativeCallWrapupPublicView {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    leadId: (row.lead_id as string | null) ?? null,
    outcome: row.outcome as NativeCallWrapupPublicView["outcome"],
    leftVoicemail: row.left_voicemail as boolean,
    noAnswer: row.no_answer as boolean,
    connected: row.connected as boolean,
    meetingBooked: row.meeting_booked as boolean,
    followUpNeeded: row.follow_up_needed as boolean,
    objectionCategory: (row.objection_category as string | null) ?? null,
    buyingSignals: Array.isArray(row.buying_signals) ? (row.buying_signals as string[]) : [],
    competitorMentioned: row.competitor_mentioned as boolean,
    timelineDetected: row.timeline_detected as boolean,
    budgetDetected: row.budget_detected as boolean,
    championIdentified: row.champion_identified as boolean,
    decisionMakerPresent: row.decision_maker_present as boolean,
    suggestedNextActions: Array.isArray(row.suggested_next_actions)
      ? (row.suggested_next_actions as string[])
      : [],
    notes: row.notes as string,
    operatorConfirmedAt: (row.operator_confirmed_at as string | null) ?? null,
  }
}

export async function resolveNativeDialerProviders(
  admin: SupabaseClient,
): Promise<{ primaryProvider: NativeDialerProviderId; fallbackProvider: NativeDialerProviderId }> {
  const orgId = await getGrowthEngineAiOrgId(admin)
  const { data } = await settingsTable(admin).select("primary_provider, fallback_provider").eq("organization_id", orgId).maybeSingle()
  return {
    primaryProvider: (data?.primary_provider as NativeDialerProviderId) ?? "stub",
    fallbackProvider: (data?.fallback_provider as NativeDialerProviderId) ?? "stub",
  }
}

export async function startNativeCallSession(
  admin: SupabaseClient,
  input: {
    leadId?: string | null
    ownerUserId?: string | null
    phoneNumber: string
    dialMode?: NativeDialerQueueMode | "inbound"
    direction?: "outbound" | "inbound"
    queueItemId?: string | null
    contactName?: string | null
    companyName?: string | null
  },
): Promise<NativeCallWorkspaceSessionPublicView> {
  const orgId = await getGrowthEngineAiOrgId(admin)
  const providers = await resolveNativeDialerProviders(admin)

  let leadId = input.leadId ?? null
  if (!leadId) {
    const phoneMatch = await resolveCallWorkspaceLeadByPhone(admin, input.phoneNumber)
    if (phoneMatch?.leadId) leadId = phoneMatch.leadId
  }

  let contactName = input.contactName ?? null
  let companyName = input.companyName ?? null
  if (leadId) {
    const lead = await fetchGrowthLeadById(admin, leadId)
    if (lead) {
      contactName = contactName ?? lead.contactName
      companyName = companyName ?? lead.companyName
    }
  }

  const { data: inserted, error } = await sessionsTable(admin)
    .insert({
      organization_id: orgId,
      lead_id: leadId,
      owner_user_id: input.ownerUserId ?? null,
      queue_item_id: input.queueItemId ?? null,
      provider: providers.primaryProvider,
      fallback_provider: providers.fallbackProvider,
      dial_mode: input.dialMode ?? "manual",
      direction: input.direction ?? "outbound",
      status: "ringing",
      phone_number: input.phoneNumber.trim(),
      contact_name: contactName,
      company_name: companyName,
      recording_state: "pending",
      safe_summary: "Operator-controlled call — awaiting connection.",
    })
    .select(SESSION_SELECT)
    .single()
  if (error) throw new Error(error.message)

  if (input.direction === "inbound") {
    return mapNativeCallSessionRow(inserted as SessionRow)
  }

  const routed = await routeNativeDialerProvider(providers)
  const startResult = await routed.provider.startCall({
    sessionId: inserted.id as string,
    phoneNumber: input.phoneNumber,
    leadId: input.leadId,
    contactName,
    companyName,
  })

  const now = new Date().toISOString()
  const isGoogleVoiceBridge = routed.providerId === "google_voice_bridge"
  const isTwilioVoicePath = routed.providerId === "twilio"

  if (isTwilioVoicePath) {
    const fromNumber = await resolveDefaultOutboundCallerId(admin, orgId)
    await createVoiceCallForWorkspaceSession(admin, {
      organizationId: orgId,
      sessionId: inserted.id as string,
      ownerUserId: input.ownerUserId ?? null,
      direction: input.direction ?? "outbound",
      fromNumber,
      toNumber: input.phoneNumber.trim(),
      provider: "twilio",
      providerCallId: startResult.providerCallRef,
      leadId,
      dialMode: input.dialMode ?? "manual",
    })

    const { data: pending, error: pendingError } = await sessionsTable(admin)
      .update({
        status: "ringing",
        provider: routed.providerId,
        fallback_provider: routed.failoverApplied ? providers.fallbackProvider : providers.primaryProvider,
        provider_call_ref: startResult.providerCallRef,
        recording_state: "pending",
        safe_summary: "Browser calling session linked to canonical voice infrastructure — connect via Voice SDK.",
        updated_at: now,
      })
      .eq("id", inserted.id as string)
      .select(SESSION_SELECT)
      .single()
    if (pendingError) throw new Error(pendingError.message)

    if (input.queueItemId) {
      await queueTable(admin)
        .update({ status: "dialing", updated_at: now })
        .eq("id", input.queueItemId)
    }

    return mapNativeCallSessionRow(pending as SessionRow)
  }

  if (isGoogleVoiceBridge) {
    const { data: pending, error: pendingError } = await sessionsTable(admin)
      .update({
        status: "external_bridge_pending",
        provider: routed.providerId,
        fallback_provider: routed.failoverApplied ? providers.fallbackProvider : providers.primaryProvider,
        provider_call_ref: startResult.providerCallRef,
        recording_state: "none",
        safe_summary: startResult.message,
        updated_at: now,
      })
      .eq("id", inserted.id as string)
      .select(SESSION_SELECT)
      .single()
    if (pendingError) throw new Error(pendingError.message)

    if (input.queueItemId) {
      await queueTable(admin)
        .update({ status: "dialing", updated_at: now })
        .eq("id", input.queueItemId)
    }

    return mapNativeCallSessionRow(pending as SessionRow)
  }

  const { data: active, error: activeError } = await sessionsTable(admin)
    .update({
      status: "active",
      connected_at: now,
      provider: routed.providerId,
      fallback_provider: routed.failoverApplied ? providers.fallbackProvider : providers.primaryProvider,
      provider_call_ref: startResult.providerCallRef,
      recording_state: "active",
      safe_summary: startResult.message,
      updated_at: now,
    })
    .eq("id", inserted.id as string)
    .select(SESSION_SELECT)
    .single()
  if (activeError) throw new Error(activeError.message)

  if (input.queueItemId) {
    await queueTable(admin)
      .update({ status: "dialing", updated_at: now })
      .eq("id", input.queueItemId)
  }

  return mapNativeCallSessionRow(active as SessionRow)
}

export async function markNativeCallBridgeStarted(
  admin: SupabaseClient,
  sessionId: string,
): Promise<NativeCallWorkspaceSessionPublicView> {
  const { data: existing, error: fetchError } = await sessionsTable(admin)
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .maybeSingle()
  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error("Call session not found.")
  if (existing.status !== "external_bridge_pending") {
    throw new Error("Call is not awaiting external bridge confirmation.")
  }
  if (existing.provider !== "google_voice_bridge") {
    throw new Error("External bridge confirmation is only supported for Google Voice bridge.")
  }

  const now = new Date().toISOString()
  const { data, error } = await sessionsTable(admin)
    .update({
      status: "active",
      connected_at: now,
      recording_state: "none",
      safe_summary: "External bridge call active — manual provider telemetry unavailable.",
      updated_at: now,
    })
    .eq("id", sessionId)
    .select(SESSION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapNativeCallSessionRow(data as SessionRow)
}

export async function fetchNativeDialerSettingsRow(
  admin: SupabaseClient,
): Promise<{
  primaryProvider: NativeDialerProviderId
  fallbackProvider: NativeDialerProviderId
  defaultQueueMode: NativeDialerQueueMode
  powerDialEnabled: boolean
  previewDialEnabled: boolean
}> {
  const orgId = await getGrowthEngineAiOrgId(admin)
  const { data, error } = await settingsTable(admin)
    .select("primary_provider, fallback_provider, default_queue_mode, power_dial_enabled, preview_dial_enabled")
    .eq("organization_id", orgId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return {
    primaryProvider: (data?.primary_provider as NativeDialerProviderId) ?? "stub",
    fallbackProvider: (data?.fallback_provider as NativeDialerProviderId) ?? "stub",
    defaultQueueMode: (data?.default_queue_mode as NativeDialerQueueMode) ?? "manual",
    powerDialEnabled: Boolean(data?.power_dial_enabled),
    previewDialEnabled: data?.preview_dial_enabled !== false,
  }
}

export async function updateNativeDialerSettingsRow(
  admin: SupabaseClient,
  input: {
    primaryProvider?: NativeDialerProviderId
    fallbackProvider?: NativeDialerProviderId
  },
): Promise<{ primaryProvider: NativeDialerProviderId; fallbackProvider: NativeDialerProviderId }> {
  const orgId = await getGrowthEngineAiOrgId(admin)
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { updated_at: now }
  if (input.primaryProvider) patch.primary_provider = input.primaryProvider
  if (input.fallbackProvider) patch.fallback_provider = input.fallbackProvider

  const { data, error } = await settingsTable(admin)
    .upsert({ organization_id: orgId, ...patch }, { onConflict: "organization_id" })
    .select("primary_provider, fallback_provider")
    .single()
  if (error) throw new Error(error.message)
  return {
    primaryProvider: data.primary_provider as NativeDialerProviderId,
    fallbackProvider: data.fallback_provider as NativeDialerProviderId,
  }
}

export async function answerNativeCallSession(
  admin: SupabaseClient,
  sessionId: string,
  ownerUserId?: string | null,
): Promise<NativeCallWorkspaceSessionPublicView> {
  const { data: existing, error: fetchError } = await sessionsTable(admin).select(SESSION_SELECT).eq("id", sessionId).maybeSingle()
  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error("Call session not found.")
  if (existing.status !== "ringing") throw new Error("Call is not ringing.")

  const orgId = await getGrowthEngineAiOrgId(admin)
  const voiceCallId = (existing.voice_call_id as string | null) ?? null
  const now = new Date().toISOString()

  if (voiceCallId && ownerUserId) {
    const claim = await claimInboundVoiceCallForOperator(admin, {
      organizationId: orgId,
      userId: ownerUserId,
      voiceCallId,
      workspaceSessionId: sessionId,
    })
    if (!claim.ok) throw new Error(claim.reason)

    await admin
      .schema("voice")
      .from("voice_calls")
      .update({ status: "in_progress", answered_at: now, updated_at: now })
      .eq("id", voiceCallId)
      .eq("organization_id", orgId)

    await appendVoiceCallEvent(admin, {
      organizationId: orgId,
      voiceCallId,
      provider: "twilio",
      eventType: "answered",
      eventTimestamp: now,
      payloadJson: { source: "call_workspace", sessionId },
      idempotencyKey: `workspace:${sessionId}:answered`,
    })

    if ((existing.direction as string) === "inbound") {
      const { data: voiceCallRow } = await admin
        .schema("voice")
        .from("voice_calls")
        .select("provider_call_id")
        .eq("id", voiceCallId)
        .maybeSingle()
      const providerCallId = (voiceCallRow?.provider_call_id as string | null) ?? null
      if (providerCallId) {
        const { ensureAnsweredInboundCallMediaStream } = await import(
          "@/lib/voice/media-streaming/ensure-answered-inbound-media-stream"
        )
        void ensureAnsweredInboundCallMediaStream(admin, {
          organizationId: orgId,
          voiceCallId,
          providerCallId,
        }).catch(() => undefined)
      }
    }
  } else {
    const providers = await resolveNativeDialerProviders(admin)
    const routed = await routeNativeDialerProvider(providers)
    const startResult = await routed.provider.startCall({
      sessionId,
      phoneNumber: existing.phone_number as string,
      leadId: (existing.lead_id as string | null) ?? null,
      contactName: (existing.contact_name as string | null) ?? null,
      companyName: (existing.company_name as string | null) ?? null,
    })

    const { data: active, error: activeError } = await sessionsTable(admin)
      .update({
        status: "active",
        connected_at: now,
        provider: routed.providerId,
        fallback_provider: routed.failoverApplied ? providers.fallbackProvider : providers.primaryProvider,
        provider_call_ref: startResult.providerCallRef,
        recording_state: "active",
        safe_summary: startResult.message,
        updated_at: now,
      })
      .eq("id", sessionId)
      .select(SESSION_SELECT)
      .single()
    if (activeError) throw new Error(activeError.message)
    return mapNativeCallSessionRow(active as SessionRow)
  }

  const { data: active, error: activeError } = await sessionsTable(admin)
    .update({
      status: "active",
      connected_at: now,
      owner_user_id: ownerUserId ?? existing.owner_user_id,
      recording_state: "active",
      safe_summary: "Inbound call answered via canonical voice infrastructure.",
      updated_at: now,
    })
    .eq("id", sessionId)
    .select(SESSION_SELECT)
    .single()
  if (activeError) throw new Error(activeError.message)
  await syncWorkspaceSessionFromVoiceCall(admin, { voiceCallId: voiceCallId!, organizationId: orgId })

  if ((existing.direction as string) === "inbound") {
    const { autoStartCallWorkspaceLiveCoachingOnAnswer } = await import(
      "@/lib/growth/native-dialer/call-workspace-coaching-service"
    )
    void autoStartCallWorkspaceLiveCoachingOnAnswer(admin, {
      nativeSessionId: sessionId,
      createdBy: ownerUserId ?? null,
    }).catch(() => undefined)
  }

  return mapNativeCallSessionRow(active as SessionRow)
}

export async function declineNativeCallSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<NativeCallWorkspaceSessionPublicView> {
  const orgId = await getGrowthEngineAiOrgId(admin)
  const { data: existing } = await sessionsTable(admin).select("voice_call_id").eq("id", sessionId).maybeSingle()
  const voiceCallId = (existing?.voice_call_id as string | null) ?? null
  const now = new Date().toISOString()

  let voiceCallCreatedAt: string | null = null
  if (voiceCallId) {
    const { data: callRow } = await admin
      .schema("voice")
      .from("voice_calls")
      .select("started_at")
      .eq("id", voiceCallId)
      .maybeSingle()
    voiceCallCreatedAt = (callRow?.started_at as string | null) ?? null
  }

  logInboundRingDiagnostic(
    INBOUND_RING_DIAG_EVENTS.DECLINE_API_CALLED,
    withInboundRingElapsed(voiceCallCreatedAt, {
      native_session_id: sessionId,
      voice_call_id: voiceCallId,
    }),
  )

  if (voiceCallId) {
    await admin
      .schema("voice")
      .from("voice_calls")
      .update({ status: "no_answer", ended_at: now, updated_at: now })
      .eq("id", voiceCallId)
      .eq("organization_id", orgId)
    await appendVoiceCallEvent(admin, {
      organizationId: orgId,
      voiceCallId,
      provider: "twilio",
      eventType: "no_answer",
      eventTimestamp: now,
      payloadJson: { source: "call_workspace", sessionId },
      idempotencyKey: `workspace:${sessionId}:no_answer`,
    })
  }

  const { data: declined, error } = await sessionsTable(admin)
    .update({
      status: "missed",
      ended_at: now,
      recording_state: "stopped",
      safe_summary: "Operator declined inbound call.",
      updated_at: now,
    })
    .eq("id", sessionId)
    .eq("status", "ringing")
    .select(SESSION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  await completeCallWorkspaceLiveCoachingForNativeSession(admin, { nativeSessionId: sessionId }).catch(
    () => undefined,
  )
  return mapNativeCallSessionRow(declined as SessionRow)
}

const PRE_WRAPUP_ENDABLE_SESSION_STATUSES = new Set([
  "active",
  "on_hold",
  "external_bridge_pending",
  "ringing",
])

export async function endNativeCallSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<NativeCallWorkspaceSessionPublicView> {
  const { data: existing, error: fetchError } = await sessionsTable(admin).select(SESSION_SELECT).eq("id", sessionId).maybeSingle()
  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error("Call session not found.")

  const existingStatus = existing.status as NativeCallWorkspaceSessionPublicView["status"]
  if (existingStatus === "wrapping" || existingStatus === "completed") {
    return mapNativeCallSessionRow(existing as SessionRow)
  }

  const connectedAt = existing.connected_at as string | null
  const startedAt = existing.started_at as string
  const endedAt = new Date()
  const durationSeconds = connectedAt
    ? Math.max(0, Math.round((endedAt.getTime() - Date.parse(connectedAt)) / 1000))
    : Math.max(0, Math.round((endedAt.getTime() - Date.parse(startedAt)) / 1000))

  if (existing.provider_call_ref) {
    const routed = await routeNativeDialerProvider({
      primaryProvider: existing.provider as NativeDialerProviderId,
      fallbackProvider: (existing.fallback_provider as NativeDialerProviderId) ?? "stub",
    })
    await routed.provider.endCall(existing.provider_call_ref as string).catch(() => undefined)
  }

  const orgId = await getGrowthEngineAiOrgId(admin)
  const voiceCallId = (existing.voice_call_id as string | null) ?? null
  if (voiceCallId) {
    await admin
      .schema("voice")
      .from("voice_calls")
      .update({
        status: "completed",
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        updated_at: endedAt.toISOString(),
      })
      .eq("id", voiceCallId)
      .eq("organization_id", orgId)
    await appendVoiceCallEvent(admin, {
      organizationId: orgId,
      voiceCallId,
      provider: "twilio",
      eventType: "completed",
      eventTimestamp: endedAt.toISOString(),
      payloadJson: { source: "call_workspace", sessionId },
      idempotencyKey: `workspace:${sessionId}:completed`,
    })
    await syncWorkspaceSessionFromVoiceCall(admin, { voiceCallId, organizationId: orgId })
  }

  const { data, error } = await sessionsTable(admin)
    .update({
      status: "wrapping",
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      recording_state: "stopped",
      on_hold: false,
      muted: false,
      updated_at: endedAt.toISOString(),
    })
    .eq("id", sessionId)
    .select(SESSION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  await completeCallWorkspaceLiveCoachingForNativeSession(admin, { nativeSessionId: sessionId }).catch(
    () => undefined,
  )
  return mapNativeCallSessionRow(data as SessionRow)
}

export async function ensureNativeCallSessionReadyForWrapup(
  admin: SupabaseClient,
  sessionId: string,
): Promise<void> {
  const { data: session, error: sessionError } = await sessionsTable(admin)
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle()
  if (sessionError) throw new Error(sessionError.message)
  if (!session) throw new Error("Call session not found.")

  const status = session.status as NativeCallWorkspaceSessionPublicView["status"]
  if (status === "wrapping" || status === "completed") return
  if (PRE_WRAPUP_ENDABLE_SESSION_STATUSES.has(status)) {
    await endNativeCallSession(admin, sessionId)
  }
}

export async function saveNativeCallWrapup(
  admin: SupabaseClient,
  input: {
    sessionId: string
    ownerUserId?: string | null
    wrapup: NativeCallWrapupInput
  },
): Promise<NativeCallWrapupPublicView> {
  await ensureNativeCallSessionReadyForWrapup(admin, input.sessionId)

  const orgId = await getGrowthEngineAiOrgId(admin)
  const { data: session, error: sessionError } = await sessionsTable(admin).select("id, lead_id").eq("id", input.sessionId).maybeSingle()
  if (sessionError) throw new Error(sessionError.message)
  if (!session) throw new Error("Call session not found.")

  const flags = normalizeWrapupFlags(input.wrapup)
  const suggestedNextActions = buildSuggestedWrapupNextActions(input.wrapup)
  const now = new Date().toISOString()

  const { data, error } = await wrapupsTable(admin)
    .upsert(
      {
        organization_id: orgId,
        session_id: input.sessionId,
        lead_id: session.lead_id as string | null,
        owner_user_id: input.ownerUserId ?? null,
        outcome: input.wrapup.outcome,
        left_voicemail: flags.leftVoicemail,
        no_answer: flags.noAnswer,
        connected: flags.connected,
        meeting_booked: flags.meetingBooked,
        follow_up_needed: flags.followUpNeeded,
        objection_category: input.wrapup.objectionCategory ?? null,
        buying_signals: input.wrapup.buyingSignals ?? [],
        competitor_mentioned: flags.competitorMentioned,
        timeline_detected: flags.timelineDetected,
        budget_detected: flags.budgetDetected,
        champion_identified: flags.championIdentified,
        decision_maker_present: flags.decisionMakerPresent,
        suggested_next_actions: suggestedNextActions,
        notes: input.wrapup.notes ?? "",
        operator_confirmed_at: now,
      },
      { onConflict: "session_id" },
    )
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await sessionsTable(admin)
    .update({ status: "completed", updated_at: now })
    .eq("id", input.sessionId)

  await completeCallWorkspaceLiveCoachingForNativeSession(admin, { nativeSessionId: input.sessionId }).catch(
    () => undefined,
  )

  return mapWrapupRow(data as WrapupRow)
}

export async function fetchNativeCallWrapupBySessionId(
  admin: SupabaseClient,
  sessionId: string,
): Promise<NativeCallWrapupPublicView | null> {
  const { data, error } = await wrapupsTable(admin).select("*").eq("session_id", sessionId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapWrapupRow(data as WrapupRow) : null
}

export async function listNativeDialerQueue(
  admin: SupabaseClient,
  input?: { limit?: number; modes?: NativeDialerQueueMode[] },
): Promise<NativeDialerQueueItemPublicView[]> {
  let query = queueTable(admin)
    .select("id, lead_id, owner_user_id, queue_mode, status, priority_score, callback_due_at, phone_number, contact_name, company_name, reason")
    .in("status", ["pending", "previewing", "callback_due"])
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(input?.limit ?? 50)
  if (input?.modes?.length) query = query.in("queue_mode", input.modes)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapQueueRow(row as QueueRow))
}

export async function fetchActiveNativeCallSession(
  admin: SupabaseClient,
  ownerUserId?: string | null,
): Promise<NativeCallWorkspaceSessionPublicView | null> {
  let query = sessionsTable(admin)
    .select(SESSION_SELECT)
    .in("status", ["ringing", "external_bridge_pending", "active", "on_hold", "wrapping"])
    .order("started_at", { ascending: false })
    .limit(1)
  if (ownerUserId) query = query.eq("owner_user_id", ownerUserId)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapNativeCallSessionRow(data as SessionRow) : null
}

export async function listRecentNativeCallSessions(
  admin: SupabaseClient,
  limit = 12,
): Promise<NativeCallWorkspaceSessionPublicView[]> {
  const { data, error } = await sessionsTable(admin)
    .select(SESSION_SELECT)
    .order("started_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapNativeCallSessionRow(row as SessionRow))
}

export async function seedNativeDialerQueueFromCallQueue(
  admin: SupabaseClient,
  input: { leadId: string; phoneNumber: string; contactName?: string | null; companyName?: string | null; reason: string; queueMode?: NativeDialerQueueMode; priorityScore?: number },
): Promise<NativeDialerQueueItemPublicView> {
  const orgId = await getGrowthEngineAiOrgId(admin)
  const { data, error } = await queueTable(admin)
    .insert({
      organization_id: orgId,
      lead_id: input.leadId,
      queue_mode: input.queueMode ?? "priority",
      status: "pending",
      priority_score: input.priorityScore ?? 50,
      phone_number: input.phoneNumber,
      contact_name: input.contactName ?? null,
      company_name: input.companyName ?? null,
      reason: input.reason,
      source_system: "call_queue",
      source_id: input.leadId,
    })
    .select("id, lead_id, owner_user_id, queue_mode, status, priority_score, callback_due_at, phone_number, contact_name, company_name, reason")
    .single()
  if (error) throw new Error(error.message)
  return mapQueueRow(data as QueueRow)
}

export async function fetchNativeCallSessionById(
  admin: SupabaseClient,
  sessionId: string,
): Promise<NativeCallWorkspaceSessionPublicView | null> {
  const { data, error } = await sessionsTable(admin).select(SESSION_SELECT).eq("id", sessionId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapNativeCallSessionRow(data as SessionRow) : null
}

export async function linkNativeCallRealtimeSession(
  admin: SupabaseClient,
  input: { nativeSessionId: string; realtimeSessionId: string },
): Promise<void> {
  const { error } = await sessionsTable(admin)
    .update({
      realtime_session_id: input.realtimeSessionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.nativeSessionId)
  if (error) throw new Error(error.message)
}

export async function attachLeadToNativeCallSession(
  admin: SupabaseClient,
  input: { nativeSessionId: string; leadId: string },
): Promise<NativeCallWorkspaceSessionPublicView> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("Lead not found.")

  const { data, error } = await sessionsTable(admin)
    .update({
      lead_id: input.leadId,
      contact_name: lead.contactName,
      company_name: lead.companyName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.nativeSessionId)
    .select(SESSION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapNativeCallSessionRow(data as SessionRow)
}

export { commandLeadFocusHref }
