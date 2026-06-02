import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  mapVoiceCallStatusToBrowserCallState,
  resolveInboundNativeSessionStatusFromVoiceCall,
} from "@/lib/voice/browser-calling/status-mapping"
import { shouldSyncNativeSessionFromVoiceCall, reconcileBrowserSyncInboundSelection, isVoiceCallOfferable } from "@/lib/voice/browser-calling/call-lifecycle-reconciliation"
import {
  reconcileStaleRingingOfferCandidates,
  resolveInboundBrowserOfferForUser,
  type InboundBrowserOfferCandidate,
  type InboundBrowserOfferSelection,
} from "@/lib/voice/browser-calling/inbound-browser-offer-resolver"
import type { NativeCallWorkspaceSessionPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import { VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER } from "@/lib/voice/browser-calling/types"
import type { VoiceBrowserCallState, VoiceBrowserSyncSnapshot, VoiceOperatorPresenceStatus } from "@/lib/voice/browser-calling/types"
import type { VoiceRelationshipMemoryWorkspaceSnapshot } from "@/lib/voice/relationship-memory/types"
import {
  assertVoiceCallPickupAllowed,
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
import { VoiceRouteTimer, withVoiceTimeout } from "@/lib/voice/performance/voice-route-timing"
import { BrowserSyncEnrichmentTimer } from "@/lib/voice/browser-calling/browser-sync-enrichment-timing"
import { runVoiceBackgroundTask } from "@/lib/voice/performance/run-voice-background-task"
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
const STALE_RINGING_CLEANUP_MIN_INTERVAL_MS = 60_000
const ENRICHMENT_SYNC_BUDGET_MS = 8_000
const ENRICHMENT_STEP_TIMEOUT_MS = 2_500
const ENRICHMENT_SESSION_SELECT =
  "id, voice_call_id, muted, on_hold, status, phone_number, lead_id, contact_name, direction"

const staleRingingCleanupLastRunMs = new Map<string, number>()

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

function logBrowserSyncCallSelection(input: {
  organizationId: string
  userId: string
  clientIdentity?: string | null
  selection: InboundBrowserOfferSelection
  selectionReason: string
  pinnedWorkspaceSessionId?: string | null
  activeVoiceCallId: string | null
  activeVoiceCallProviderCallId: string | null
  activeVoiceCallCreatedAt: string | null
  activeVoiceCallStatus: string | null
}): void {
  logVoiceInfrastructure("voice_browser_sync_call_selected", {
    organizationId: input.organizationId,
    userId: input.userId,
    voiceCallId: input.activeVoiceCallId ?? input.selection.selectedVoiceCallId ?? null,
    providerCallId: input.activeVoiceCallProviderCallId ?? input.selection.selectedProviderCallId ?? null,
    voiceCallCreatedAt: input.activeVoiceCallCreatedAt ?? input.selection.selectedVoiceCallCreatedAt ?? null,
    voiceCallStatus: input.activeVoiceCallStatus ?? input.selection.selectedVoiceCallStatus ?? null,
    selectionReason: input.selectionReason,
    candidateCount: input.selection.candidateCount,
    inboundOfferVoiceCallId: input.selection.selectedVoiceCallId ?? null,
    pinnedWorkspaceSessionId: input.pinnedWorkspaceSessionId ?? null,
    clientIdentity: input.clientIdentity ?? null,
  })
}

async function fetchVoiceCallSyncMetadata(
  admin: SupabaseClient,
  voiceCallId: string | null,
): Promise<{
  status: string | null
  answeredAt: string | null
  startedAt: string | null
  providerCallId: string | null
  offerable: boolean
} | null> {
  if (!voiceCallId) return null
  const { data } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("status, answered_at, started_at, provider_call_id")
    .eq("id", voiceCallId)
    .maybeSingle()
  if (!data) return null
  const status = (data.status as string | null) ?? null
  const answeredAt = (data.answered_at as string | null) ?? null
  return {
    status,
    answeredAt,
    startedAt: (data.started_at as string | null) ?? null,
    providerCallId: (data.provider_call_id as string | null) ?? null,
    offerable: isVoiceCallOfferable({ status, answeredAt }),
  }
}

function voiceCallMetaFromOfferCandidate(
  candidate: InboundBrowserOfferCandidate | undefined,
): {
  status: string | null
  startedAt: string | null
  providerCallId: string | null
  offerable: boolean
} | null {
  if (!candidate) return null
  return {
    status: candidate.voiceCallStatus,
    startedAt: candidate.voiceCallCreatedAt,
    providerCallId: candidate.providerCallId,
    offerable: candidate.excludedReason === null,
  }
}

async function resolveVoiceCallMetaForSync(
  admin: SupabaseClient,
  voiceCallId: string | null,
  candidateByVoiceCallId: Map<string, InboundBrowserOfferCandidate>,
): Promise<{
  status: string | null
  startedAt: string | null
  providerCallId: string | null
  offerable: boolean
} | null> {
  const fromCandidate = voiceCallMetaFromOfferCandidate(
    voiceCallId ? candidateByVoiceCallId.get(voiceCallId) : undefined,
  )
  if (fromCandidate) return fromCandidate
  const fetched = await fetchVoiceCallSyncMetadata(admin, voiceCallId)
  if (!fetched) return null
  return {
    status: fetched.status,
    startedAt: fetched.startedAt,
    providerCallId: fetched.providerCallId,
    offerable: fetched.offerable,
  }
}

type BrowserSyncPhaseTimings = {
  candidateLookupMs: number
  reconciliationMs: number
  staleCleanupMs: number
}

function scheduleStaleRingingCleanupIfNeeded(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    syncMode: VoiceBrowserSyncMode
    candidates: InboundBrowserOfferCandidate[]
  },
): "skipped_fast" | "skipped_recent" | "skipped_none" | "scheduled" {
  if (input.syncMode !== "enrichment") return "skipped_fast"
  const hasStaleCandidates = input.candidates.some(
    (candidate) =>
      candidate.excludedReason === "voice_call_terminal" ||
      candidate.excludedReason === "voice_call_answered" ||
      candidate.excludedReason === "voice_call_in_progress",
  )
  if (!hasStaleCandidates) return "skipped_none"
  const key = `${input.organizationId}:${input.userId}`
  const now = Date.now()
  if (now - (staleRingingCleanupLastRunMs.get(key) ?? 0) < STALE_RINGING_CLEANUP_MIN_INTERVAL_MS) {
    return "skipped_recent"
  }
  staleRingingCleanupLastRunMs.set(key, now)
  runVoiceBackgroundTask("browser_sync_stale_ringing_cleanup", async () => {
    await reconcileStaleRingingOfferCandidates(admin, {
      organizationId: input.organizationId,
      candidates: input.candidates,
    })
  })
  return "scheduled"
}

function logBrowserSyncTiming(input: {
  organizationId: string
  userId: string
  syncMode: VoiceBrowserSyncMode
  phaseTimings: BrowserSyncPhaseTimings
  snapshotBuildMs: number
  staleCleanupAction: ReturnType<typeof scheduleStaleRingingCleanupIfNeeded>
  selectionReason?: string | null
  candidateCount?: number
}): void {
  logVoiceInfrastructure("voice_browser_sync_timing", {
    organizationId: input.organizationId,
    userId: input.userId,
    mode: input.syncMode,
    candidateLookupMs: input.phaseTimings.candidateLookupMs,
    reconciliationMs: input.phaseTimings.reconciliationMs,
    staleCleanupMs: input.phaseTimings.staleCleanupMs,
    snapshotBuildMs: input.snapshotBuildMs,
    totalSyncDurationMs: input.snapshotBuildMs,
    staleCleanupAction: input.staleCleanupAction,
    selectionReason: input.selectionReason ?? null,
    candidateCount: input.candidateCount ?? null,
  })
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

async function resolveEnrichmentSessionContext(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    workspaceSessionId?: string | null
  },
): Promise<{
  workspaceSessionId: string | null
  activeVoiceCallId: string | null
  sessionStatus: NativeCallWorkspaceSessionPublicView["status"] | null
  muted: boolean
  onHold: boolean
  sessionPhone: string | null
  sessionLeadId: string | null
  sessionContactName: string | null
} | null> {
  if (input.workspaceSessionId) {
    const { data } = await sessionsTable(admin)
      .select(ENRICHMENT_SESSION_SELECT)
      .eq("id", input.workspaceSessionId)
      .maybeSingle()
    if (
      data &&
      isLiveBrowserWorkspaceSession(data.status as NativeCallWorkspaceSessionPublicView["status"])
    ) {
      return {
        workspaceSessionId: data.id as string,
        activeVoiceCallId: (data.voice_call_id as string | null) ?? null,
        sessionStatus: data.status as NativeCallWorkspaceSessionPublicView["status"],
        muted: Boolean(data.muted),
        onHold: Boolean(data.on_hold),
        sessionPhone: (data.phone_number as string | null) ?? null,
        sessionLeadId: (data.lead_id as string | null) ?? null,
        sessionContactName: (data.contact_name as string | null) ?? null,
      }
    }
  }

  const { data } = await sessionsTable(admin)
    .select(ENRICHMENT_SESSION_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("owner_user_id", input.userId)
    .in("status", ["ringing", "active", "on_hold", "external_bridge_pending"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return {
    workspaceSessionId: data.id as string,
    activeVoiceCallId: (data.voice_call_id as string | null) ?? null,
    sessionStatus: data.status as NativeCallWorkspaceSessionPublicView["status"],
    muted: Boolean(data.muted),
    onHold: Boolean(data.on_hold),
    sessionPhone: (data.phone_number as string | null) ?? null,
    sessionLeadId: (data.lead_id as string | null) ?? null,
    sessionContactName: (data.contact_name as string | null) ?? null,
  }
}

async function measureEnrichmentStep<T>(
  timer: BrowserSyncEnrichmentTimer,
  step: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  return timer.measure(step, () =>
    withVoiceTimeout(`voice_browser_sync_enrichment_${step}`, ENRICHMENT_STEP_TIMEOUT_MS, fn, fallback),
  )
}

async function buildVoiceBrowserEnrichmentSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    clientIdentity?: string | null
    workspaceSessionId?: string | null
  },
): Promise<VoiceBrowserSyncSnapshot> {
  const startedAt = Date.now()
  const stats = createVoiceBrowserSyncStats()
  const generatedAt = new Date().toISOString()
  const enrichmentTimer = new BrowserSyncEnrichmentTimer({
    organizationId: input.organizationId,
    userId: input.userId,
    workspaceSessionId: input.workspaceSessionId ?? null,
  })

  const buildDiagnostics = (): VoiceBrowserSyncSnapshot["diagnostics"] => ({
    durationMs: Date.now() - startedAt,
    queryCount: stats.queryCount,
    rowsReturned: stats.rowsReturned,
    relationshipMemoryCache: stats.relationshipMemoryCache,
  })

  const sessionContext = await enrichmentTimer.measure("session_context", () =>
    resolveEnrichmentSessionContext(admin, input),
  )
  recordVoiceSyncQuery(stats, sessionContext, sessionContext ? 1 : 0)

  if (!sessionContext?.activeVoiceCallId) {
    enrichmentTimer.finish("idle_no_active_call")
    return {
      ...emptyVoiceBrowserSyncSnapshot({
        generatedAt,
        device: null,
        inboundRinging: null,
        syncMode: "enrichment",
        diagnostics: buildDiagnostics(),
      }),
      syncMode: "enrichment",
    }
  }

  const {
    workspaceSessionId,
    activeVoiceCallId,
    sessionStatus,
    muted,
    onHold,
    sessionPhone,
    sessionLeadId,
    sessionContactName,
  } = sessionContext

  if (shouldSyncNativeSessionFromVoiceCall(sessionStatus)) {
    runVoiceBackgroundTask("browser_sync_session_sync", () =>
      syncWorkspaceSessionFromVoiceCall(admin, {
        voiceCallId: activeVoiceCallId,
        organizationId: input.organizationId,
        workspaceSessionId,
        userId: input.userId,
      }),
    )
  }

  const voiceStatusRow = await enrichmentTimer.measure("voice_call_status", async () => {
    const { data } = await admin
      .schema("voice")
      .from("voice_calls")
      .select("status")
      .eq("id", activeVoiceCallId)
      .maybeSingle()
    recordVoiceSyncQuery(stats, data)
    return data
  })
  const voiceStatus = (voiceStatusRow?.status as VoiceCallStatus | null) ?? null
  const browserCallState = mapVoiceCallStatusToBrowserCallState({ voiceStatus, muted, onHold })

  const timeline = await measureEnrichmentStep(
    enrichmentTimer,
    "timeline",
    () => fetchVoiceCallTimeline(admin, activeVoiceCallId),
    [],
  )
  recordVoiceSyncQuery(stats, timeline, 1)
  const recording = await measureEnrichmentStep(
    enrichmentTimer,
    "recording",
    () => fetchVoiceCallRecordingVisibility(admin, activeVoiceCallId),
    null,
  )
  recordVoiceSyncQuery(stats, recording, 1)
  const controlSnapshot = await measureEnrichmentStep(
    enrichmentTimer,
    "call_control",
    () => fetchVoiceCallControlSnapshot(admin, input.organizationId, activeVoiceCallId),
    { participants: [], activeTransfer: null },
  )
  recordVoiceSyncQuery(stats, controlSnapshot.participants, 1)
  const liveTranscript = await measureEnrichmentStep(
    enrichmentTimer,
    "transcript",
    () => fetchVoiceCallTranscriptSnapshot(admin, input.organizationId, activeVoiceCallId),
    null,
  )
  recordVoiceSyncQuery(stats, liveTranscript ? liveTranscript.segments : [], 1)
  const conversationIntelligence = await measureEnrichmentStep(
    enrichmentTimer,
    "conversation_intelligence",
    () => fetchVoiceCallConversationIntelligenceSnapshot(admin, input.organizationId, activeVoiceCallId),
    null,
  )
  recordVoiceSyncQuery(stats, conversationIntelligence, 1)
  const operatorAssist = await measureEnrichmentStep(
    enrichmentTimer,
    "operator_assist",
    () =>
      fetchUnifiedOperatorAssistSnapshot(admin, {
        organizationId: input.organizationId,
        userId: input.userId,
        workspaceSessionId,
        voiceCallId: activeVoiceCallId,
        voiceTranscript: liveTranscript,
        conversationIntelligence,
        participants: controlSnapshot.participants,
      }),
    null,
  )
  recordVoiceSyncQuery(stats, operatorAssist?.feed ?? [], 1)

  let relationshipMemory: VoiceRelationshipMemoryWorkspaceSnapshot | null = null
  if (sessionPhone) {
    relationshipMemory = await enrichmentTimer.measure("relationship_memory", async () => {
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
      const snapshot = await withVoiceTimeout(
        "voice_browser_sync_enrichment_relationship_memory",
        ENRICHMENT_STEP_TIMEOUT_MS,
        () =>
          fetchRelationshipMemoryWorkspaceSnapshot(admin, {
            organizationId: input.organizationId,
            phoneNumber: sessionPhone,
            leadId: sessionLeadId,
            contactName: sessionContactName,
            activeVoiceCallId,
          }),
        null,
      )
      if (snapshot) {
        relationshipMemorySyncCache.set(key, {
          expiresAt: Date.now() + RELATIONSHIP_MEMORY_SYNC_CACHE_TTL_MS,
          snapshot,
        })
        pruneRelationshipMemorySyncCache()
      }
      return snapshot
    })
  }
  recordVoiceSyncQuery(
    stats,
    stats.relationshipMemoryCache === "miss" ? (relationshipMemory?.timeline ?? []) : [],
    sessionPhone && stats.relationshipMemoryCache === "miss" ? 4 : 0,
  )

  const revenueIntelligence = sessionPhone
    ? await measureEnrichmentStep(
        enrichmentTimer,
        "revenue_intelligence",
        () =>
          fetchRevenueIntelligenceWorkspaceSnapshot(admin, {
            organizationId: input.organizationId,
            phoneNumber: sessionPhone,
            leadId: sessionLeadId,
            activeVoiceCallId,
            relationshipMemoryProfileId: relationshipMemory?.profile?.id ?? null,
          }),
        null,
      )
    : null
  recordVoiceSyncQuery(stats, revenueIntelligence, sessionPhone ? 1 : 0)
  const retentionIntelligence = sessionPhone
    ? await measureEnrichmentStep(
        enrichmentTimer,
        "retention_intelligence",
        () =>
          fetchRetentionIntelligenceWorkspaceSnapshot(admin, {
            organizationId: input.organizationId,
            phoneNumber: sessionPhone,
            leadId: sessionLeadId,
            activeVoiceCallId,
            relationshipMemoryProfileId: relationshipMemory?.profile?.id ?? null,
          }),
        null,
      )
    : null
  recordVoiceSyncQuery(stats, retentionIntelligence, sessionPhone ? 1 : 0)
  const aiCopilot = await measureEnrichmentStep(
    enrichmentTimer,
    "ai_copilot",
    () =>
      fetchAiCopilotWorkspaceSnapshot(admin, {
        organizationId: input.organizationId,
        voiceCallId: activeVoiceCallId,
        operatorAssist,
        liveTranscript,
        retentionIntelligence,
      }),
    null,
  )
  recordVoiceSyncQuery(stats, aiCopilot?.activeSuggestions ?? [], 1)
  const aiReceptionist = await measureEnrichmentStep(
    enrichmentTimer,
    "ai_receptionist",
    () =>
      fetchAiReceptionistWorkspaceSnapshot(admin, {
        organizationId: input.organizationId,
        voiceCallId: activeVoiceCallId,
      }),
    null,
  )
  recordVoiceSyncQuery(stats, aiReceptionist, 1)
  const missedCallRecovery = await measureEnrichmentStep(
    enrichmentTimer,
    "missed_call_recovery",
    () =>
      fetchMissedCallRecoveryWorkspaceSnapshot(admin, {
        organizationId: input.organizationId,
        voiceCallId: activeVoiceCallId,
      }),
    null,
  )
  recordVoiceSyncQuery(stats, missedCallRecovery, 1)

  const diagnostics = buildDiagnostics()
  enrichmentTimer.finish("live", {
    activeVoiceCallId,
    workspaceSessionId,
    durationMs: diagnostics.durationMs,
  })

  return {
    qaMarker: VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER,
    generatedAt,
    syncMode: "enrichment",
    browserCallState,
    device: null,
    presence: null,
    activeVoiceCallId,
    workspaceSessionId,
    timeline,
    recording,
    inboundRinging: null,
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
  const generatedAt = new Date().toISOString()

  if (syncMode === "enrichment") {
    const emptyEnrichment = emptyVoiceBrowserSyncSnapshot({
      generatedAt,
      device: null,
      inboundRinging: null,
      syncMode: "enrichment",
      diagnostics: {
        durationMs: 0,
        queryCount: 0,
        rowsReturned: 0,
        relationshipMemoryCache: "none",
        enrichmentTimedOut: true,
      },
    })
    const snapshot = await withVoiceTimeout(
      "voice_browser_sync_enrichment",
      ENRICHMENT_SYNC_BUDGET_MS,
      () => buildVoiceBrowserEnrichmentSnapshot(admin, input),
      emptyEnrichment,
    )
    if (snapshot.diagnostics?.enrichmentTimedOut) {
      logVoiceInfrastructure("voice_browser_sync_enrichment_timeout", {
        organizationId: input.organizationId,
        userId: input.userId,
        workspaceSessionId: input.workspaceSessionId ?? null,
        timeoutMs: ENRICHMENT_SYNC_BUDGET_MS,
      })
    }
    return snapshot
  }

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
  let callSelectionReason = input.workspaceSessionId ? "client_pinned_session" : "none"
  let activeVoiceCallCreatedAt: string | null = null
  let activeVoiceCallProviderCallId: string | null = null
  let activeVoiceCallStatus: string | null = null
  const phaseTimings: BrowserSyncPhaseTimings = {
    candidateLookupMs: 0,
    reconciliationMs: 0,
    staleCleanupMs: 0,
  }

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
      callSelectionReason = "pinned_session_not_live"
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
    if (activeSession) {
      callSelectionReason = "active_session_lookup"
    }
  }

  const candidateLookupStartedAt = Date.now()
  const inboundSelection = await timer.measure("inbound_offer", () =>
    resolveInboundBrowserOfferForUser(admin, {
      organizationId: input.organizationId,
      userId: input.userId,
    }),
  )
  phaseTimings.candidateLookupMs = Date.now() - candidateLookupStartedAt
  recordVoiceSyncQuery(stats, inboundSelection.offer, 2)

  const candidateByVoiceCallId = new Map(
    inboundSelection.candidates.map((candidate) => [candidate.voiceCallId, candidate]),
  )

  if (activeVoiceCallId && sessionStatusForSync === "ringing") {
    const ringingVoiceCall = await timer.measure("ringing_voice_call_lookup", () =>
      resolveVoiceCallMetaForSync(admin, activeVoiceCallId, candidateByVoiceCallId),
    )
    recordVoiceSyncQuery(stats, ringingVoiceCall)
    if (ringingVoiceCall) {
      activeVoiceCallCreatedAt = ringingVoiceCall.startedAt
      activeVoiceCallProviderCallId = ringingVoiceCall.providerCallId
      activeVoiceCallStatus = ringingVoiceCall.status
    }
    if (ringingVoiceCall && !ringingVoiceCall.offerable) {
      activeVoiceCallId = null
      workspaceSessionId = null
      sessionStatusForSync = null
      activeVoiceCallCreatedAt = null
      activeVoiceCallProviderCallId = null
      activeVoiceCallStatus = null
      callSelectionReason =
        callSelectionReason === "client_pinned_session"
          ? "pinned_session_voice_call_not_offerable"
          : "active_session_voice_call_not_offerable"
    }
  }

  const staleCleanupStartedAt = Date.now()
  const staleCleanupAction = scheduleStaleRingingCleanupIfNeeded(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    syncMode,
    candidates: inboundSelection.candidates,
  })
  phaseTimings.staleCleanupMs = Date.now() - staleCleanupStartedAt

  const inboundRinging = inboundSelection.offer
  const reconciliationStartedAt = Date.now()
  const reconciledSelection = reconcileBrowserSyncInboundSelection({
    activeVoiceCallId,
    workspaceSessionId,
    sessionStatusForSync,
    activeVoiceCallCreatedAt,
    inboundOffer: inboundRinging,
    baseSelectionReason: callSelectionReason,
    inboundSelectionReason: inboundSelection.selectionReason,
  })
  phaseTimings.reconciliationMs = Date.now() - reconciliationStartedAt
  activeVoiceCallId = reconciledSelection.activeVoiceCallId
  workspaceSessionId = reconciledSelection.workspaceSessionId
  sessionStatusForSync = reconciledSelection.sessionStatusForSync
  callSelectionReason = reconciledSelection.selectionReason

  if (inboundRinging && activeVoiceCallId === inboundRinging.voiceCallId) {
    activeVoiceCallCreatedAt = inboundRinging.voiceCallCreatedAt ?? activeVoiceCallCreatedAt
    activeVoiceCallProviderCallId = inboundSelection.selectedProviderCallId ?? activeVoiceCallProviderCallId
    activeVoiceCallStatus = inboundSelection.selectedVoiceCallStatus ?? activeVoiceCallStatus
  }

  logBrowserSyncCallSelection({
    organizationId: input.organizationId,
    userId: input.userId,
    clientIdentity: input.clientIdentity,
    selection: inboundSelection,
    selectionReason: callSelectionReason,
    pinnedWorkspaceSessionId: input.workspaceSessionId ?? null,
    activeVoiceCallId,
    activeVoiceCallProviderCallId,
    activeVoiceCallCreatedAt,
    activeVoiceCallStatus,
  })

  const emitSyncTiming = (extra?: Record<string, unknown>) => {
    logBrowserSyncTiming({
      organizationId: input.organizationId,
      userId: input.userId,
      syncMode,
      phaseTimings,
      snapshotBuildMs: Date.now() - startedAt,
      staleCleanupAction,
      selectionReason: callSelectionReason,
      candidateCount: inboundSelection.candidateCount,
      ...extra,
    })
  }

  const hasActiveLiveSession =
    Boolean(activeVoiceCallId) &&
    isLiveBrowserWorkspaceSession(sessionStatusForSync) &&
    sessionStatusForSync !== "ringing"

  if (!hasActiveLiveSession && !inboundRinging) {
    const diagnostics = buildDiagnostics()
    emitSyncTiming({ mode: "idle" })
    timer.finish({ mode: "idle", syncMode, ...diagnostics })
    return emptyVoiceBrowserSyncSnapshot({ generatedAt, device, inboundRinging, syncMode, diagnostics })
  }

  if (!hasActiveLiveSession && inboundRinging) {
    const diagnostics = buildDiagnostics()
    emitSyncTiming({ mode: "ringing", workspaceSessionId: inboundRinging.workspaceSessionId })
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
    if (activeVoiceCallStatus) {
      voiceStatus = activeVoiceCallStatus as VoiceCallStatus
    } else {
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
      activeVoiceCallStatus = voiceStatus
    }
  }

  const browserCallState: VoiceBrowserCallState = mapVoiceCallStatusToBrowserCallState({
    voiceStatus,
    muted,
    onHold,
  })

  stats.relationshipMemoryCache = "bypass"
  const timeline: VoiceBrowserSyncSnapshot["timeline"] = []
  const recording: VoiceBrowserSyncSnapshot["recording"] = null
  const controlSnapshot = { participants: [], activeTransfer: null }
  const liveTranscript: VoiceBrowserSyncSnapshot["liveTranscript"] = null
  const conversationIntelligence: VoiceBrowserSyncSnapshot["conversationIntelligence"] = null
  const operatorAssist: VoiceBrowserSyncSnapshot["operatorAssist"] = null
  const relationshipMemory: VoiceBrowserSyncSnapshot["relationshipMemory"] = null
  const revenueIntelligence: VoiceBrowserSyncSnapshot["revenueIntelligence"] = null
  const retentionIntelligence: VoiceBrowserSyncSnapshot["retentionIntelligence"] = null
  const aiCopilot: VoiceBrowserSyncSnapshot["aiCopilot"] = null
  const aiReceptionist: VoiceBrowserSyncSnapshot["aiReceptionist"] = null
  const missedCallRecovery: VoiceBrowserSyncSnapshot["missedCallRecovery"] = null

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
  emitSyncTiming({ mode: "live", activeVoiceCallId, workspaceSessionId })
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

export {
  createInboundVoiceCallFromTwilio,
  provisionInboundBrowserWorkspaceOffers,
} from "@/lib/voice/browser-calling/inbound-workspace-provision"

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
