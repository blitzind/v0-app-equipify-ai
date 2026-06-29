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
import {
  emptyCallWorkspaceAnswerPipelineDiagnostics,
  type CallWorkspaceAnswerPipelineDiagnostics,
  type LinkNativeCallRealtimeSessionResult,
} from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import { describeVoiceMediaStreamWssTarget } from "@/lib/voice/call-control/urls"
import { runVoiceBackgroundTask } from "@/lib/voice/performance/run-voice-background-task"
import { appendVoiceCallEvent } from "@/lib/voice/repository/voice-repository"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import {
  logCoachingLinkPipelineStage,
  type CoachingLinkPipelineTelemetryContext,
} from "@/lib/growth/native-dialer/call-workspace-coaching-link-pipeline-telemetry"
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
const LIVE_COACHING_AUTO_START_QA_MARKER = "growth-live-coaching-auto-start-qa-v1" as const

function logLiveCoachingAutoStartQa(event: string, details: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      source: "native-dialer-repository",
      qaMarker: LIVE_COACHING_AUTO_START_QA_MARKER,
      event,
      ts: new Date().toISOString(),
      ...details,
    }),
  )
}

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

type InboundAnswerDeferredWorkInput = {
  sessionId: string
  voiceCallId: string
  organizationId: string
  ownerUserId: string | null
  providerCallRef: string | null
  pipelineTelemetry?: CoachingLinkPipelineTelemetryContext
}

async function runInboundAnswerDeferredWork(
  admin: SupabaseClient,
  input: InboundAnswerDeferredWorkInput,
): Promise<void> {
  const { sessionId, voiceCallId, organizationId: orgId, ownerUserId, providerCallRef, pipelineTelemetry } =
    input

  await syncWorkspaceSessionFromVoiceCall(admin, {
    voiceCallId,
    organizationId: orgId,
    workspaceSessionId: sessionId,
    userId: ownerUserId,
    preventActiveToRingingDowngrade: true,
  })

  if (!ownerUserId) return

  const { autoStartCallWorkspaceLiveCoachingOnAnswer } = await import(
    "@/lib/growth/native-dialer/call-workspace-coaching-service"
  )
  try {
    const coachingStartedAt = Date.now()
    logLiveCoachingAutoStartQa("autoStartCallWorkspaceLiveCoachingOnAnswer_start", {
      nativeSessionId: sessionId,
      voiceCallId,
      organizationId: orgId,
      ownerUserId,
      direction: "inbound",
      status: "active",
      deferred: true,
    })
    const coaching = await autoStartCallWorkspaceLiveCoachingOnAnswer(admin, {
      nativeSessionId: sessionId,
      createdBy: ownerUserId,
      pipelineTelemetry: {
        pipelineRunId: pipelineTelemetry?.pipelineRunId ?? null,
        callSid: pipelineTelemetry?.callSid ?? providerCallRef,
      },
    })
    logLiveCoachingAutoStartQa("autoStartCallWorkspaceLiveCoachingOnAnswer_result", {
      nativeSessionId: sessionId,
      voiceCallId,
      organizationId: orgId,
      ownerUserId,
      realtimeSessionId: coaching.realtimeSessionId,
      reason: coaching.reason,
      linkResultLinked: coaching.linkResult?.linked ?? null,
      linkResultReason: coaching.linkResult?.reason ?? null,
      durationMs: Date.now() - coachingStartedAt,
      deferred: true,
    })
    if (!coaching.realtimeSessionId || !coaching.linkResult?.linked) {
      logVoiceInfrastructure("voice_growth_coaching_link_missing_after_answer", {
        nativeSessionId: sessionId,
        voiceCallId,
        organizationId: orgId,
        ownerUserId,
        direction: "inbound",
        status: "active",
        phase: "active",
        reason: coaching.reason ?? "realtime_session_not_linked_after_answer",
        realtimeSessionId: coaching.realtimeSessionId,
        linkResult: coaching.linkResult,
        persistedRealtimeSessionId: coaching.realtimeSessionId,
        deferred: true,
      })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const failureReason =
      errorMessage === "realtime_session_create_failed"
        ? "realtime_session_create_failed"
        : "auto_start_exception"
    logLiveCoachingAutoStartQa("autoStartCallWorkspaceLiveCoachingOnAnswer_failure", {
      nativeSessionId: sessionId,
      voiceCallId,
      organizationId: orgId,
      ownerUserId,
      direction: "inbound",
      status: "active",
      reason: failureReason,
      message: errorMessage,
      deferred: true,
    })
    logVoiceInfrastructure("voice_growth_coaching_auto_start_failed", {
      nativeSessionId: sessionId,
      voiceCallId,
      organizationId: orgId,
      ownerUserId,
      direction: "inbound",
      status: "active",
      phase: "active",
      stage: "inbound_answer_deferred_work",
      reason: failureReason,
      message: errorMessage,
      stack: error instanceof Error ? error.stack?.slice(0, 500) ?? null : null,
    })
  }

  const { data: voiceCallRow } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("provider_call_id")
    .eq("id", voiceCallId)
    .maybeSingle()
  const providerCallId = (voiceCallRow?.provider_call_id as string | null) ?? null
  if (!providerCallId) return

  const mediaStreamWssHost = describeVoiceMediaStreamWssTarget(null).wssHost
  const { ensureAnsweredInboundCallMediaStream } = await import(
    "@/lib/voice/media-streaming/ensure-answered-inbound-media-stream"
  )
  try {
    const mediaResult = await ensureAnsweredInboundCallMediaStream(admin, {
      organizationId: orgId,
      voiceCallId,
      providerCallId,
    })
    if (!mediaResult.started) {
      logVoiceInfrastructure("voice_answered_inbound_media_stream_failed", {
        voiceCallId,
        providerCallId,
        stage: "inbound_answer_deferred_work",
        reason: mediaResult.reason,
        wssHost: mediaStreamWssHost,
      })
    }
  } catch (error) {
    logVoiceInfrastructure("voice_answered_inbound_media_stream_failed", {
      voiceCallId,
      providerCallId,
      stage: "inbound_answer_deferred_work",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.slice(0, 500) ?? null : null,
      wssHost: mediaStreamWssHost,
    })
  }
}

function scheduleInboundAnswerDeferredWork(
  admin: SupabaseClient,
  input: InboundAnswerDeferredWorkInput,
): void {
  runVoiceBackgroundTask("inbound_answer_coaching_link", () => runInboundAnswerDeferredWork(admin, input))
}

export type NativeCallAnswerResult = {
  session: NativeCallWorkspaceSessionPublicView
  pipeline: CallWorkspaceAnswerPipelineDiagnostics
}

export async function answerNativeCallSession(
  admin: SupabaseClient,
  sessionId: string,
  ownerUserId?: string | null,
  pipelineTelemetry?: CoachingLinkPipelineTelemetryContext,
): Promise<NativeCallAnswerResult> {
  const stageStartedAt = Date.now()
  logCoachingLinkPipelineStage({
    stage: "server_answer_native_call_session",
    outcome: "entered",
    pipelineRunId: pipelineTelemetry?.pipelineRunId ?? null,
    workspaceSessionId: sessionId,
    nativeCallWorkspaceSessionId: sessionId,
    callSid: pipelineTelemetry?.callSid ?? null,
    ownerUserId: ownerUserId ?? null,
  })

  const pipeline = emptyCallWorkspaceAnswerPipelineDiagnostics()
  const { data: existing, error: fetchError } = await sessionsTable(admin).select(SESSION_SELECT).eq("id", sessionId).maybeSingle()
  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error("Call session not found.")
  const existingStatus = existing.status as NativeCallWorkspaceSessionPublicView["status"]
  const existingDirection = existing.direction as string
  const existingRealtimeSessionId = (existing.realtime_session_id as string | null) ?? null
  logLiveCoachingAutoStartQa("answer_native_call_session_loaded", {
    nativeSessionId: sessionId,
    voiceCallId: (existing.voice_call_id as string | null) ?? null,
    ownerUserId: ownerUserId ?? (existing.owner_user_id as string | null) ?? null,
    direction: existingDirection,
    status: existingStatus,
    realtimeSessionId: existingRealtimeSessionId,
  })
  const canReconcileAlreadyAnsweredInbound =
    existingDirection === "inbound" &&
    (existingStatus === "active" || existingStatus === "on_hold") &&
    !existingRealtimeSessionId
  if (existingStatus !== "ringing" && !canReconcileAlreadyAnsweredInbound) {
    logCoachingLinkPipelineStage({
      stage: "server_answer_native_call_session",
      outcome: "failed",
      durationMs: Date.now() - stageStartedAt,
      pipelineRunId: pipelineTelemetry?.pipelineRunId ?? null,
      workspaceSessionId: sessionId,
      nativeCallWorkspaceSessionId: sessionId,
      callSid: pipelineTelemetry?.callSid ?? null,
      ownerUserId: ownerUserId ?? null,
      failureReason: "call_not_ringing",
      extra: {
        existingStatus,
        existingDirection,
        canReconcileAlreadyAnsweredInbound,
        existingRealtimeSessionId,
      },
    })
    throw new Error("Call is not ringing.")
  }

  const orgId = await getGrowthEngineAiOrgId(admin)
  const voiceCallId = (existing.voice_call_id as string | null) ?? null
  const now = new Date().toISOString()

  if (existingStatus === "ringing") {
    if (voiceCallId && ownerUserId) {
      const claim = await claimInboundVoiceCallForOperator(admin, {
        organizationId: orgId,
        userId: ownerUserId,
        voiceCallId,
        workspaceSessionId: sessionId,
      })
      if (!claim.ok) throw new Error(claim.reason)

      const { data: answeredVoiceCall, error: answerVoiceCallError } = await admin
        .schema("voice")
        .from("voice_calls")
        .update({ status: "in_progress", answered_at: now, updated_at: now })
        .eq("id", voiceCallId)
        .eq("organization_id", orgId)
        .select("id,status,answered_at")
        .maybeSingle()
      if (answerVoiceCallError) throw new Error("voice_call_answer_update_failed")
      if (!answeredVoiceCall) throw new Error("voice_call_answer_update_missing")
      if ((answeredVoiceCall.status as string | null) !== "in_progress") {
        throw new Error("voice_call_answer_status_not_in_progress")
      }
      if (!((answeredVoiceCall.answered_at as string | null) ?? null)) {
        throw new Error("voice_call_answered_at_missing")
      }

      await appendVoiceCallEvent(admin, {
        organizationId: orgId,
        voiceCallId,
        provider: "twilio",
        eventType: "answered",
        eventTimestamp: now,
        payloadJson: { source: "call_workspace", sessionId },
        idempotencyKey: `workspace:${sessionId}:answered`,
      })
    } else if (voiceCallId && existingDirection === "inbound" && !ownerUserId) {
      pipeline.liveCoachingLinked = false
      pipeline.liveCoachingFailureReason = "missing_owner_user_id"
      pipeline.liveCoachingError = "missing_owner_user_id"
      logVoiceInfrastructure("voice_growth_coaching_link_missing_after_answer", {
        nativeSessionId: sessionId,
        voiceCallId,
        organizationId: orgId,
        direction: existing.direction as string | null,
        status: existing.status as string | null,
        phase: existing.status as string | null,
        reason: pipeline.liveCoachingFailureReason,
        realtimeSessionId: null,
        linkResult: null,
        persistedRealtimeSessionId: null,
      })
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
      return { session: mapNativeCallSessionRow(active as SessionRow), pipeline }
    }

    const { error: activeError } = await sessionsTable(admin)
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
  } else if (!voiceCallId) {
    throw new Error("Call session is missing voice call.")
  }

  pipeline.mediaStreamWssHost = describeVoiceMediaStreamWssTarget(null).wssHost
  const isInbound = (existing.direction as string) === "inbound"
  const shouldDeferInboundAnswerWork =
    isInbound &&
    Boolean(voiceCallId) &&
    Boolean(ownerUserId) &&
    !existingRealtimeSessionId &&
    pipeline.liveCoachingFailureReason !== "missing_owner_user_id"

  if (!isInbound) {
    logCoachingLinkPipelineStage({
      stage: "server_auto_start_coaching_on_answer",
      outcome: "skipped",
      pipelineRunId: pipelineTelemetry?.pipelineRunId ?? null,
      workspaceSessionId: sessionId,
      nativeCallWorkspaceSessionId: sessionId,
      voiceCallId,
      callSid: pipelineTelemetry?.callSid ?? (existing.provider_call_ref as string | null) ?? null,
      ownerUserId: ownerUserId ?? null,
      failureReason: "native_session_not_inbound",
      extra: { direction: existing.direction as string },
    })
  }

  if (shouldDeferInboundAnswerWork) {
    pipeline.coachingLinkPending = true
    pipeline.liveCoachingLinked = false
    scheduleInboundAnswerDeferredWork(admin, {
      sessionId,
      voiceCallId: voiceCallId!,
      organizationId: orgId,
      ownerUserId: ownerUserId ?? null,
      providerCallRef:
        pipelineTelemetry?.callSid ?? (existing.provider_call_ref as string | null) ?? null,
      pipelineTelemetry,
    })
    logCoachingLinkPipelineStage({
      stage: "server_auto_start_coaching_on_answer",
      outcome: "skipped",
      pipelineRunId: pipelineTelemetry?.pipelineRunId ?? null,
      workspaceSessionId: sessionId,
      nativeCallWorkspaceSessionId: sessionId,
      voiceCallId,
      callSid: pipelineTelemetry?.callSid ?? (existing.provider_call_ref as string | null) ?? null,
      ownerUserId: ownerUserId ?? null,
      failureReason: "deferred_to_background",
      extra: { coachingLinkPending: true },
    })
  }

  const { data: refreshed, error: refreshError } = await sessionsTable(admin)
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .maybeSingle()
  if (refreshError) throw new Error(refreshError.message)
  if (!refreshed) throw new Error("Call session not found after answer.")

  const refreshedRealtimeSessionId = (refreshed.realtime_session_id as string | null) ?? null
  pipeline.realtimeSessionId = refreshedRealtimeSessionId
  if (refreshedRealtimeSessionId) {
    pipeline.liveCoachingLinked = true
    pipeline.coachingLinkPending = false
  }
  logCoachingLinkPipelineStage({
    stage: "server_pipeline_persisted_read",
    outcome: "completed",
    durationMs: Date.now() - stageStartedAt,
    pipelineRunId: pipelineTelemetry?.pipelineRunId ?? null,
    workspaceSessionId: sessionId,
    nativeCallWorkspaceSessionId: sessionId,
    nativeCallWorkspaceRealtimeSessionId: refreshedRealtimeSessionId,
    realtimeSessionId: refreshedRealtimeSessionId,
    voiceCallId,
    callSid: pipelineTelemetry?.callSid ?? (refreshed.provider_call_ref as string | null) ?? null,
    organizationId: orgId,
    ownerUserId: ownerUserId ?? (refreshed.owner_user_id as string | null) ?? null,
    liveCoachingLinked: pipeline.liveCoachingLinked,
    linkResultLinked: pipeline.linkResult?.linked ?? null,
    linkResultReason: pipeline.linkResult?.reason ?? null,
    failureReason: pipeline.liveCoachingFailureReason,
    extra: {
      coachingLinkPending: pipeline.coachingLinkPending,
      pipelineRealtimeSessionId: pipeline.realtimeSessionId,
    },
  })
  logLiveCoachingAutoStartQa("answer_native_call_session_refreshed", {
    nativeSessionId: sessionId,
    voiceCallId,
    organizationId: orgId,
    ownerUserId: ownerUserId ?? (refreshed.owner_user_id as string | null) ?? null,
    direction: refreshed.direction as string | null,
    status: refreshed.status as string | null,
    realtimeSessionId: refreshedRealtimeSessionId,
    liveCoachingLinked: pipeline.liveCoachingLinked,
    coachingLinkPending: pipeline.coachingLinkPending,
    liveCoachingFailureReason: pipeline.liveCoachingFailureReason,
  })

  logCoachingLinkPipelineStage({
    stage: "server_answer_native_call_session",
    outcome: "completed",
    durationMs: Date.now() - stageStartedAt,
    pipelineRunId: pipelineTelemetry?.pipelineRunId ?? null,
    workspaceSessionId: sessionId,
    nativeCallWorkspaceSessionId: sessionId,
    nativeCallWorkspaceRealtimeSessionId: refreshedRealtimeSessionId,
    realtimeSessionId: refreshedRealtimeSessionId,
    voiceCallId,
    callSid: pipelineTelemetry?.callSid ?? (refreshed.provider_call_ref as string | null) ?? null,
    organizationId: orgId,
    ownerUserId: ownerUserId ?? (refreshed.owner_user_id as string | null) ?? null,
    liveCoachingLinked: pipeline.liveCoachingLinked,
    linkResultLinked: pipeline.linkResult?.linked ?? null,
    linkResultReason: pipeline.linkResult?.reason ?? null,
    failureReason: pipeline.liveCoachingFailureReason,
    extra: { coachingLinkPending: pipeline.coachingLinkPending },
  })

  return { session: mapNativeCallSessionRow(refreshed as SessionRow), pipeline }
}

export async function retryAnsweredInboundMediaStreamForNativeSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<{ started: boolean; reason: string; wssHost: string | null }> {
  const orgId = await getGrowthEngineAiOrgId(admin)
  const { data: sessionRow, error } = await sessionsTable(admin)
    .select("voice_call_id, direction, status")
    .eq("id", sessionId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!sessionRow) throw new Error("Call session not found.")
  if ((sessionRow.direction as string) !== "inbound") {
    return { started: false, reason: "not_inbound", wssHost: null }
  }
  if (sessionRow.status !== "active" && sessionRow.status !== "on_hold") {
    return { started: false, reason: "call_not_active", wssHost: null }
  }

  const voiceCallId = (sessionRow.voice_call_id as string | null) ?? null
  if (!voiceCallId) return { started: false, reason: "voice_call_missing", wssHost: null }

  const { data: voiceCallRow } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("provider_call_id, answered_at")
    .eq("id", voiceCallId)
    .maybeSingle()
  const providerCallId = (voiceCallRow?.provider_call_id as string | null) ?? null
  if (!providerCallId || !voiceCallRow?.answered_at) {
    return { started: false, reason: "call_not_answered", wssHost: null }
  }

  const wssHost = describeVoiceMediaStreamWssTarget(null).wssHost
  const { ensureAnsweredInboundCallMediaStream } = await import(
    "@/lib/voice/media-streaming/ensure-answered-inbound-media-stream"
  )
  const mediaResult = await ensureAnsweredInboundCallMediaStream(admin, {
    organizationId: orgId,
    voiceCallId,
    providerCallId,
  })
  if (!mediaResult.started) {
    logVoiceInfrastructure("voice_answered_inbound_media_stream_failed", {
      voiceCallId,
      providerCallId,
      stage: "media_stream_retry",
      reason: mediaResult.reason,
      wssHost,
    })
  }
  return { ...mediaResult, wssHost }
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
    await syncWorkspaceSessionFromVoiceCall(admin, {
      voiceCallId,
      organizationId: orgId,
      workspaceSessionId: sessionId,
    })
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
  const { data: session, error: sessionError } = await sessionsTable(admin)
    .select("id, lead_id, queue_item_id")
    .eq("id", input.sessionId)
    .maybeSingle()
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

  if (session.queue_item_id) {
    await queueTable(admin)
      .update({ status: "completed", updated_at: now })
      .eq("id", session.queue_item_id as string)
  }

  await completeCallWorkspaceLiveCoachingForNativeSession(admin, { nativeSessionId: input.sessionId }).catch(
    () => undefined,
  )

  const wrapup = mapWrapupRow(data as WrapupRow)
  const { emitCallRevenueOutcomeFromWrapup } = await import(
    "@/lib/growth/revenue-outcomes/revenue-outcome-runtime-bridge"
  )
  if (wrapup.leadId) {
    emitCallRevenueOutcomeFromWrapup(admin, {
      leadId: wrapup.leadId,
      sessionId: input.sessionId,
      wrapupId: wrapup.id,
      outcome: input.wrapup.outcome,
      occurredAt: now,
    })
  }

  return wrapup
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

export async function scheduleNativeDialerCallbackQueueItem(
  admin: SupabaseClient,
  input: {
    leadId: string
    phoneNumber: string
    contactName?: string | null
    companyName?: string | null
    callbackDueAt: string
    reason?: string
    ownerUserId?: string | null
  },
): Promise<NativeDialerQueueItemPublicView> {
  const orgId = await getGrowthEngineAiOrgId(admin)
  const { data, error } = await queueTable(admin)
    .insert({
      organization_id: orgId,
      lead_id: input.leadId,
      owner_user_id: input.ownerUserId ?? null,
      queue_mode: "callback",
      status: "callback_due",
      priority_score: 60,
      callback_due_at: input.callbackDueAt,
      phone_number: input.phoneNumber,
      contact_name: input.contactName ?? null,
      company_name: input.companyName ?? null,
      reason: input.reason ?? "Operator-scheduled callback from call workspace",
      source_system: "call_workspace",
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
  input: { nativeSessionId: string; realtimeSessionId: string; organizationId: string | null },
): Promise<LinkNativeCallRealtimeSessionResult> {
  const { data, error } = await sessionsTable(admin)
    .update({
      realtime_session_id: input.realtimeSessionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.nativeSessionId)
    .eq("organization_id", input.organizationId)
    .select("id, realtime_session_id")
    .maybeSingle()
  if (error) {
    return {
      linked: false,
      nativeSessionId: input.nativeSessionId,
      realtimeSessionId: input.realtimeSessionId,
      reason: "native_session_update_failed",
    }
  }
  if (!data) {
    return {
      linked: false,
      nativeSessionId: input.nativeSessionId,
      realtimeSessionId: input.realtimeSessionId,
      reason: "native_session_not_found",
    }
  }
  const persistedRealtimeSessionId = (data.realtime_session_id as string | null) ?? null
  if (persistedRealtimeSessionId !== input.realtimeSessionId) {
    return {
      linked: false,
      nativeSessionId: input.nativeSessionId,
      realtimeSessionId: input.realtimeSessionId,
      reason: "realtime_session_not_persisted",
    }
  }
  return {
    linked: true,
    nativeSessionId: input.nativeSessionId,
    realtimeSessionId: input.realtimeSessionId,
    reason: null,
  }
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

export async function updateNativeCallSessionNotesDraft(
  admin: SupabaseClient,
  sessionId: string,
  notesDraft: string,
): Promise<NativeCallWorkspaceSessionPublicView> {
  const { data, error } = await sessionsTable(admin)
    .update({ notes_draft: notesDraft, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select(SESSION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapNativeCallSessionRow(data as SessionRow)
}

export async function markNativeDialerQueueItemPreviewing(
  admin: SupabaseClient,
  queueItemId: string,
): Promise<NativeDialerQueueItemPublicView> {
  const { data, error } = await queueTable(admin)
    .update({ status: "previewing", updated_at: new Date().toISOString() })
    .eq("id", queueItemId)
    .select("id, lead_id, owner_user_id, queue_mode, status, priority_score, callback_due_at, phone_number, contact_name, company_name, reason")
    .single()
  if (error) throw new Error(error.message)
  return mapQueueRow(data as QueueRow)
}

export async function skipNativeDialerQueueItem(
  admin: SupabaseClient,
  queueItemId: string,
): Promise<NativeDialerQueueItemPublicView> {
  const { data, error } = await queueTable(admin)
    .update({ status: "skipped", updated_at: new Date().toISOString() })
    .eq("id", queueItemId)
    .select("id, lead_id, owner_user_id, queue_mode, status, priority_score, callback_due_at, phone_number, contact_name, company_name, reason")
    .single()
  if (error) throw new Error(error.message)
  return mapQueueRow(data as QueueRow)
}

export async function snoozeNativeDialerQueueItem(
  admin: SupabaseClient,
  queueItemId: string,
): Promise<NativeDialerQueueItemPublicView> {
  const { data: existing, error: fetchError } = await queueTable(admin)
    .select("priority_score")
    .eq("id", queueItemId)
    .maybeSingle()
  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error("Queue item not found.")

  const snoozedScore = Math.max(0, (existing.priority_score as number) - 25)
  const { data, error } = await queueTable(admin)
    .update({
      status: "pending",
      priority_score: snoozedScore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", queueItemId)
    .select("id, lead_id, owner_user_id, queue_mode, status, priority_score, callback_due_at, phone_number, contact_name, company_name, reason")
    .single()
  if (error) throw new Error(error.message)
  return mapQueueRow(data as QueueRow)
}

export async function completeNativeDialerQueueItem(admin: SupabaseClient, queueItemId: string): Promise<void> {
  const { error } = await queueTable(admin)
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", queueItemId)
  if (error) throw new Error(error.message)
}

export async function fetchNextNativeDialerQueueItem(
  admin: SupabaseClient,
  input?: { excludeQueueItemId?: string | null; modes?: NativeDialerQueueMode[] },
): Promise<NativeDialerQueueItemPublicView | null> {
  const items = await listNativeDialerQueue(admin, { limit: 50, modes: input?.modes })
  return items.find((item) => item.id !== input?.excludeQueueItemId) ?? null
}

export { commandLeadFocusHref }
