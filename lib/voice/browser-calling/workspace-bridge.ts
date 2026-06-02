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
import type { VoiceRelationshipMemoryWorkspaceSnapshot } from "@/lib/voice/relationship-memory/types"
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
const VOICE_OPERATOR_PRESENCE_SELECT =
  "user_id, status, active_device_count, active_voice_call_id, active_workspace_session_id, last_seen_at"
const RELATIONSHIP_MEMORY_SYNC_CACHE_TTL_MS = 30_000
const RELATIONSHIP_MEMORY_SYNC_CACHE_MAX_ENTRIES = 500

type VoiceBrowserSyncMode = "fast" | "enrichment"

type VoiceBrowserSyncStats = {
  queryCount: number
  rowsReturned: number
  relationshipMemoryCache: "hit" | "miss" | "bypass" | "none"
}

type RelationshipMemoryCacheEntry = {
  expiresAt: number
  snapshot: VoiceRelationshipMemoryWorkspaceSnapshot
}

const relationshipMemorySyncCache = new Map<string, RelationshipMemoryCacheEntry>()

function createVoiceBrowserSyncStats(): VoiceBrowserSyncStats {
  return {
    queryCount: 0,
    rowsReturned: 0,
    relationshipMemoryCache: "none",
  }
}

function recordVoiceSyncQuery(stats: VoiceBrowserSyncStats, rows: unknown, count = 1): void {
  stats.queryCount += count
  if (Array.isArray(rows)) {
    stats.rowsReturned += rows.length
    return
  }
  if (rows) stats.rowsReturned += 1
}

function relationshipMemoryCacheKey(input: {
  organizationId: string
  phoneNumber: string
  leadId: string | null
  activeVoiceCallId: string | null
}): string {
  return [input.organizationId, input.phoneNumber, input.leadId ?? "", input.activeVoiceCallId ?? ""].join(":")
}

function pruneRelationshipMemorySyncCache(now = Date.now()): void {
  if (relationshipMemorySyncCache.size <= RELATIONSHIP_MEMORY_SYNC_CACHE_MAX_ENTRIES) return
  for (const [key, entry] of relationshipMemorySyncCache) {
    if (entry.expiresAt <= now) relationshipMemorySyncCache.delete(key)
  }
  while (relationshipMemorySyncCache.size > RELATIONSHIP_MEMORY_SYNC_CACHE_MAX_ENTRIES) {
    const oldestKey = relationshipMemorySyncCache.keys().next().value
    if (!oldestKey) return
    relationshipMemorySyncCache.delete(oldestKey)
  }
}

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
  input: {
    voiceCallId: string
    organizationId: string
    workspaceSessionId?: string | null
    userId?: string | null
    preventActiveToRingingDowngrade?: boolean
  },
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

  let sessionQuery = sessionsTable(admin)
    .select(SESSION_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("voice_call_id", input.voiceCallId)

  if (input.workspaceSessionId) {
    sessionQuery = sessionQuery.eq("id", input.workspaceSessionId)
  } else if (callRow.assigned_user_id) {
    sessionQuery = sessionQuery.eq("owner_user_id", callRow.assigned_user_id as string)
  } else if (input.userId) {
    sessionQuery = sessionQuery.eq("owner_user_id", input.userId)
  }

  const { data: sessionRow, error: sessionError } = await sessionQuery
    .order("connected_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (sessionError) throw new Error(sessionError.message)
  if (!sessionRow) return

  const nativeStatus = resolveInboundNativeSessionStatusFromVoiceCall({
    voiceStatus: callRow.status as VoiceCallStatus,
    direction: sessionRow.direction as "inbound" | "outbound",
    answeredAt: (callRow.answered_at as string | null) ?? null,
    onHold: Boolean(sessionRow.on_hold),
  })
  const currentStatus = sessionRow.status as NativeCallWorkspaceSessionPublicView["status"]
  if (
    input.preventActiveToRingingDowngrade &&
    input.workspaceSessionId &&
    nativeStatus === "ringing" &&
    (currentStatus === "active" || currentStatus === "on_hold")
  ) {
    return
  }
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
        nativeSessionId: sessionRow.id as string,
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

    const { data: voiceCallRow } = await admin
      .schema("voice")
      .from("voice_calls")
      .select("provider_call_id, direction")
      .eq("id", input.voiceCallId)
      .maybeSingle()
    const providerCallId = (voiceCallRow?.provider_call_id as string | null) ?? null
    if (voiceCallRow?.direction === "inbound" && providerCallId) {
      const { ensureAnsweredInboundCallMediaStream } = await import(
        "@/lib/voice/media-streaming/ensure-answered-inbound-media-stream"
      )
      void ensureAnsweredInboundCallMediaStream(admin, {
        organizationId: input.organizationId,
        voiceCallId: input.voiceCallId,
        providerCallId,
      }).catch(() => undefined)
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
  syncMode: VoiceBrowserSyncMode
  diagnostics: VoiceBrowserSyncSnapshot["diagnostics"]
}): VoiceBrowserSyncSnapshot {
  return {
    qaMarker: VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER,
    generatedAt: input.generatedAt,
    syncMode: input.syncMode,
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
    diagnostics: input.diagnostics,
  }
}

export async function buildVoiceBrowserSyncSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    clientIdentity?: string | null
    workspaceSessionId?: string | null
    mode?: VoiceBrowserSyncMode
  },
): Promise<VoiceBrowserSyncSnapshot> {
  const timer = new VoiceRouteTimer("voice_browser_sync")
  const startedAt = Date.now()
  const stats = createVoiceBrowserSyncStats()
  const syncMode = input.mode ?? "fast"
  const includeEnrichment = syncMode === "enrichment"
  const generatedAt = new Date().toISOString()

  const buildDiagnostics = (): VoiceBrowserSyncSnapshot["diagnostics"] => ({
    durationMs: Date.now() - startedAt,
    queryCount: stats.queryCount,
    rowsReturned: stats.rowsReturned,
    relationshipMemoryCache: stats.relationshipMemoryCache,
  })

  let device = null
  if (input.clientIdentity) {
    device = await timer.measure("heartbeat", () =>
      heartbeatVoiceBrowserDevice(admin, {
        organizationId: input.organizationId,
        userId: input.userId,
        clientIdentity: input.clientIdentity,
      }),
    )
    recordVoiceSyncQuery(stats, device, 3)
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
      recordVoiceSyncQuery(stats, data)
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
      recordVoiceSyncQuery(stats, data)
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
  recordVoiceSyncQuery(stats, inboundRinging, 2)

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
    const diagnostics = buildDiagnostics()
    timer.finish({ mode: "idle", syncMode, ...diagnostics })
    return emptyVoiceBrowserSyncSnapshot({ generatedAt, device, inboundRinging, syncMode, diagnostics })
  }

  if (!hasActiveLiveSession && inboundRinging) {
    const diagnostics = buildDiagnostics()
    timer.finish({ mode: "ringing", syncMode, workspaceSessionId: inboundRinging.workspaceSessionId, ...diagnostics })
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
      ...emptyVoiceBrowserSyncSnapshot({ generatedAt, device, inboundRinging, syncMode, diagnostics }),
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
      recordVoiceSyncQuery(stats, data)
      return data
    })
    voiceStatus = (callRow?.status as VoiceCallStatus | null) ?? null
    if (shouldSyncNativeSessionFromVoiceCall(sessionStatusForSync)) {
      await timer.measure("session_sync_write", () =>
        syncWorkspaceSessionFromVoiceCall(admin, {
          voiceCallId: activeVoiceCallId,
          organizationId: input.organizationId,
          workspaceSessionId,
          userId: input.userId,
        }),
      )
      recordVoiceSyncQuery(stats, null)
    }
  }

  const browserCallState: VoiceBrowserCallState = mapVoiceCallStatusToBrowserCallState({
    voiceStatus,
    muted,
    onHold,
  })

  const timeline = includeEnrichment && activeVoiceCallId
    ? await timer.measure("timeline", () => fetchVoiceCallTimeline(admin, activeVoiceCallId))
    : []
  recordVoiceSyncQuery(stats, timeline, includeEnrichment && activeVoiceCallId ? 1 : 0)
  const recording = includeEnrichment && activeVoiceCallId
    ? await timer.measure("recording", () => fetchVoiceCallRecordingVisibility(admin, activeVoiceCallId))
    : null
  recordVoiceSyncQuery(stats, recording, includeEnrichment && activeVoiceCallId ? 1 : 0)
  const controlSnapshot = includeEnrichment && activeVoiceCallId
    ? await timer.measure("call_control", () =>
        fetchVoiceCallControlSnapshot(admin, input.organizationId, activeVoiceCallId),
      )
    : { participants: [], activeTransfer: null }
  recordVoiceSyncQuery(stats, controlSnapshot.participants, includeEnrichment && activeVoiceCallId ? 1 : 0)
  const liveTranscript = includeEnrichment && activeVoiceCallId
    ? await timer.measure("transcript", () =>
        fetchVoiceCallTranscriptSnapshot(admin, input.organizationId, activeVoiceCallId),
      )
    : null
  recordVoiceSyncQuery(stats, liveTranscript ? liveTranscript.segments : [], includeEnrichment && activeVoiceCallId ? 1 : 0)
  const conversationIntelligence = includeEnrichment && activeVoiceCallId
    ? await timer.measure("conversation_intelligence", () =>
        fetchVoiceCallConversationIntelligenceSnapshot(admin, input.organizationId, activeVoiceCallId),
      )
    : null
  recordVoiceSyncQuery(stats, conversationIntelligence, includeEnrichment && activeVoiceCallId ? 1 : 0)
  const operatorAssist = includeEnrichment
    ? await timer.measure("operator_assist", () =>
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
    : null
  recordVoiceSyncQuery(stats, operatorAssist?.feed ?? [], includeEnrichment ? 1 : 0)
  const relationshipMemory = includeEnrichment && sessionPhone
    ? await timer.measure("relationship_memory", async () => {
        const key = relationshipMemoryCacheKey({
          organizationId: input.organizationId,
          phoneNumber: sessionPhone,
          leadId: sessionLeadId,
          activeVoiceCallId,
        })
        const cached = relationshipMemorySyncCache.get(key)
        if (cached && cached.expiresAt > Date.now()) {
          stats.relationshipMemoryCache = "hit"
          return cached.snapshot
        }
        stats.relationshipMemoryCache = "miss"
        const snapshot = await fetchRelationshipMemoryWorkspaceSnapshot(admin, {
          organizationId: input.organizationId,
          phoneNumber: sessionPhone,
          leadId: sessionLeadId,
          contactName: sessionContactName,
          activeVoiceCallId,
        })
        relationshipMemorySyncCache.set(key, {
          expiresAt: Date.now() + RELATIONSHIP_MEMORY_SYNC_CACHE_TTL_MS,
          snapshot,
        })
        pruneRelationshipMemorySyncCache()
        return snapshot
      })
    : null
  if (!includeEnrichment) stats.relationshipMemoryCache = "bypass"
  recordVoiceSyncQuery(
    stats,
    stats.relationshipMemoryCache === "miss" ? (relationshipMemory?.timeline ?? []) : [],
    includeEnrichment && sessionPhone && stats.relationshipMemoryCache === "miss" ? 4 : 0,
  )
  const revenueIntelligence = includeEnrichment && sessionPhone
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
  recordVoiceSyncQuery(stats, revenueIntelligence, includeEnrichment && sessionPhone ? 1 : 0)
  const retentionIntelligence = includeEnrichment && sessionPhone
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
  recordVoiceSyncQuery(stats, retentionIntelligence, includeEnrichment && sessionPhone ? 1 : 0)
  const aiCopilot = includeEnrichment && activeVoiceCallId
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
  recordVoiceSyncQuery(stats, aiCopilot?.activeSuggestions ?? [], includeEnrichment && activeVoiceCallId ? 1 : 0)
  const aiReceptionist = includeEnrichment && activeVoiceCallId
    ? await timer.measure("ai_receptionist", () =>
        fetchAiReceptionistWorkspaceSnapshot(admin, {
          organizationId: input.organizationId,
          voiceCallId: activeVoiceCallId,
        }),
      )
    : null
  recordVoiceSyncQuery(stats, aiReceptionist, includeEnrichment && activeVoiceCallId ? 1 : 0)
  const missedCallRecovery = includeEnrichment && activeVoiceCallId
    ? await timer.measure("missed_call_recovery", () =>
        fetchMissedCallRecoveryWorkspaceSnapshot(admin, {
          organizationId: input.organizationId,
          voiceCallId: activeVoiceCallId,
        }),
      )
    : null
  recordVoiceSyncQuery(stats, missedCallRecovery, includeEnrichment && activeVoiceCallId ? 1 : 0)

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

  const presenceRow = await timer.measure("presence", async () => {
    const { data } = await admin
      .schema("voice")
      .from("voice_operator_presence")
      .select(VOICE_OPERATOR_PRESENCE_SELECT)
      .eq("organization_id", input.organizationId)
      .eq("user_id", input.userId)
      .maybeSingle()
    recordVoiceSyncQuery(stats, data)
    return data
  })
  const diagnostics = buildDiagnostics()
  timer.finish({ mode: "live", syncMode, activeVoiceCallId, workspaceSessionId, ...diagnostics })

  return {
    qaMarker: VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER,
    generatedAt,
    syncMode,
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
    diagnostics,
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
