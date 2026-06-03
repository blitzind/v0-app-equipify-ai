import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { syncLiveGuidanceForSession } from "@/lib/growth/live-guidance/sync-live-guidance"
import { resolveNativeCallDirectionForRealtimeSession } from "@/lib/growth/live-coaching/resolve-call-direction"
import type { GrowthLiveCoachingState } from "@/lib/growth/live-guidance/live-guidance-types"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  appendGrowthRealtimeTranscriptEvent,
  fetchGrowthRealtimeCallSession,
  insertGrowthRealtimeCallSession,
  listGrowthRealtimeCallSessionsForLead,
  listGrowthRealtimeTranscriptEvents,
  updateGrowthRealtimeCallSession,
} from "@/lib/growth/realtime/realtime-call-repository"
import type {
  GrowthRealtimeCallSession,
  GrowthRealtimeCallSpeaker,
  GrowthRealtimeTranscriptEvent,
} from "@/lib/growth/realtime/realtime-call-types"
import { buildGrowthLeadRealtimeIntelligenceInput } from "@/lib/growth/realtime/realtime-lead-intelligence"
import { analyzeRealtimeCallTranscript, diffRealtimeSnapshot } from "@/lib/growth/realtime/realtime-session-analyzer"
import { reconcileVoiceTranscriptBridgeForCall } from "@/lib/growth/realtime/reconcile-voice-transcript-bridge"
import { createRealtimeTranscriptProvider } from "@/lib/growth/realtime/realtime-transcript-provider"
import {
  attachRealtimeProviderToSession,
  detachRealtimeProviderFromSession,
} from "@/lib/growth/realtime/providers/provider-session-manager"
import {
  emitGrowthBuyingSignalDetectedNotification,
  emitGrowthCoachingSignalNotification,
} from "@/lib/growth/notifications/notification-integrations"
import {
  emitGrowthLeadLiveCallCompletedTimeline,
  emitGrowthLeadLiveCallStartedTimeline,
  emitGrowthLeadRealtimeBuyingSignalDetectedTimeline,
  emitGrowthLeadRealtimeCallRiskDetectedTimeline,
  emitGrowthLeadRealtimeDiscoveryGapDetectedTimeline,
  emitGrowthLeadRealtimeObjectionDetectedTimeline,
} from "@/lib/growth/timeline-emitter"
import { stopBrowserAudioCaptureForSession } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-service"
import { computeCallExecutionScore } from "@/lib/growth/live-guidance/live-execution-score"
import {
  emitLiveCoachingSessionCompletedTimeline,
  emitLiveCoachingSessionDiscardedTimeline,
  emitLiveCoachingSessionPausedTimeline,
  emitLiveCoachingSessionResumedTimeline,
  emitLiveCoachingSessionStartedTimeline,
  emitLiveCoachingSnapshotDiffTimeline,
} from "@/lib/growth/realtime/live-coaching/session-timeline-emitter"
import { recomputeLiveCoachingSessionInsights } from "@/lib/growth/realtime/live-coaching/session-insights-service"
import { generateCallIntelligenceScorecard } from "@/lib/growth/call-intelligence/call-intelligence-service"

type Actor = { userId: string | null; email: string | null }

export async function recomputeGrowthRealtimeCallSession(
  admin: SupabaseClient,
  sessionId: string,
  actor?: Actor,
): Promise<{ session: GrowthRealtimeCallSession; coachingState: GrowthLiveCoachingState | null } | null> {
  const session = await fetchGrowthRealtimeCallSession(admin, sessionId)
  if (!session) return null
  return recomputeAndPersistSnapshot(admin, session, actor)
}

async function recomputeAndPersistSnapshot(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  actor?: Actor,
): Promise<{ session: GrowthRealtimeCallSession; coachingState: GrowthLiveCoachingState | null }> {
  const lead = await fetchGrowthLeadById(admin, session.leadId)
  if (!lead) throw new Error("not_found")

  const events = await listGrowthRealtimeTranscriptEvents(admin, session.id)
  const snapshot = analyzeRealtimeCallTranscript({
    events,
    lead: await buildGrowthLeadRealtimeIntelligenceInput(admin, lead),
  })

  const diff = diffRealtimeSnapshot(session.liveSnapshot, snapshot)
  const previousExecutionScore = computeCallExecutionScore({
    snapshot: session.liveSnapshot,
    events,
  }).score

  if (actor) {
    for (const signalKey of diff.newBuyingSignals) {
      await emitGrowthLeadRealtimeBuyingSignalDetectedTimeline(admin, {
        leadId: session.leadId,
        sessionId: session.id,
        signalKey,
        actor,
      })
      await emitGrowthBuyingSignalDetectedNotification(admin, {
        leadId: session.leadId,
        companyName: lead.companyName,
        signalKey,
        ownerUserId: lead.assignedTo,
        sessionId: session.id,
      })
    }
    for (const objectionKey of diff.newObjections) {
      await emitGrowthLeadRealtimeObjectionDetectedTimeline(admin, {
        leadId: session.leadId,
        sessionId: session.id,
        objectionKey,
        actor,
      })
      await emitGrowthCoachingSignalNotification(admin, {
        leadId: session.leadId,
        companyName: lead.companyName,
        notificationType: "objection_detected",
        signalKey: objectionKey,
        ownerUserId: lead.assignedTo,
        sessionId: session.id,
      })
    }
    for (const area of diff.newDiscoveryGaps) {
      await emitGrowthLeadRealtimeDiscoveryGapDetectedTimeline(admin, {
        leadId: session.leadId,
        sessionId: session.id,
        area,
        actor,
      })
      await emitGrowthCoachingSignalNotification(admin, {
        leadId: session.leadId,
        companyName: lead.companyName,
        notificationType: "discovery_gap_detected",
        signalKey: area,
        ownerUserId: lead.assignedTo,
        sessionId: session.id,
      })
    }
    for (const riskFlag of diff.newRiskFlags) {
      await emitGrowthLeadRealtimeCallRiskDetectedTimeline(admin, {
        leadId: session.leadId,
        sessionId: session.id,
        riskFlag,
        actor,
      })
    }
  }

  await emitLiveCoachingSnapshotDiffTimeline(admin, {
    session,
    previousSnapshot: session.liveSnapshot,
    nextSnapshot: snapshot,
    events,
    previousExecutionScore,
  })

  let coachingState: GrowthLiveCoachingState | null = null
  let liveSnapshot = snapshot
  if (session.guidanceEnabled) {
    const organizationId = getGrowthEngineAiOrgId()
    const direction = await resolveNativeCallDirectionForRealtimeSession(admin, session.id).catch(() => null)
    const synced = await syncLiveGuidanceForSession(admin, {
      leadId: session.leadId,
      sessionId: session.id,
      snapshot,
      events,
      lead: await buildGrowthLeadRealtimeIntelligenceInput(admin, lead),
      organizationId,
      direction,
      session,
      actor,
    })
    coachingState = synced.coachingState
    liveSnapshot = synced.liveSnapshot
  }

  const updated = await updateGrowthRealtimeCallSession(admin, session.id, {
    liveSnapshot,
    guidanceLatencyMs: coachingState?.guidanceLatencyMs ?? session.guidanceLatencyMs,
  })

  return { session: updated, coachingState }
}

export async function listGrowthRealtimeCallSessions(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthRealtimeCallSession[]> {
  return listGrowthRealtimeCallSessionsForLead(admin, leadId)
}

export async function createGrowthRealtimeCallSession(
  admin: SupabaseClient,
  input: {
    leadId: string
    callCopilotSessionId?: string | null
    createdBy?: string | null
  },
): Promise<GrowthRealtimeCallSession> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("not_found")
  return insertGrowthRealtimeCallSession(admin, input)
}

export async function startGrowthRealtimeCallSession(
  admin: SupabaseClient,
  input: { sessionId: string; actor?: Actor },
): Promise<GrowthRealtimeCallSession> {
  const session = await fetchGrowthRealtimeCallSession(admin, input.sessionId)
  if (!session) throw new Error("not_found")
  if (session.status === "completed" || session.status === "discarded") {
    throw new Error("session_closed")
  }

  const wasPaused = session.status === "paused"

  const provider = createRealtimeTranscriptProvider("stub")
  await provider.connect(session.id)

  const now = new Date().toISOString()
  await updateGrowthRealtimeCallSession(admin, session.id, {
    status: "active",
    startedAt: session.startedAt ?? now,
    transcriptStatus: "connecting",
  })

  const updated = await attachRealtimeProviderToSession(admin, session, input.actor)

  const finalSession = await updateGrowthRealtimeCallSession(admin, session.id, {
    status: "active",
    transcriptStatus: updated.transcriptStatus === "failed" ? "failed" : "live",
  })

  await emitGrowthLeadLiveCallStartedTimeline(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    actor: input.actor,
  })

  await emitLiveCoachingSessionStartedTimeline(admin, finalSession)
  if (wasPaused) {
    await emitLiveCoachingSessionResumedTimeline(admin, finalSession)
  }

  return finalSession
}

export async function pauseGrowthRealtimeCallSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<GrowthRealtimeCallSession> {
  const session = await fetchGrowthRealtimeCallSession(admin, sessionId)
  if (!session) throw new Error("not_found")
  await detachRealtimeProviderFromSession(sessionId)
  await stopBrowserAudioCaptureForSession(admin, sessionId)
  const updated = await updateGrowthRealtimeCallSession(admin, sessionId, { status: "paused" })
  await emitLiveCoachingSessionPausedTimeline(admin, updated)
  return updated
}

export async function completeGrowthRealtimeCallSession(
  admin: SupabaseClient,
  input: { sessionId: string; actor?: Actor },
): Promise<GrowthRealtimeCallSession> {
  const session = await fetchGrowthRealtimeCallSession(admin, input.sessionId)
  if (!session) throw new Error("not_found")

  const refreshed = await recomputeAndPersistSnapshot(admin, session, input.actor)
  await detachRealtimeProviderFromSession(session.id)
  await stopBrowserAudioCaptureForSession(admin, session.id)
  const updated = await updateGrowthRealtimeCallSession(admin, session.id, {
    status: "completed",
    endedAt: new Date().toISOString(),
    transcriptStatus: "inactive",
    liveSnapshot: refreshed.session.liveSnapshot,
  })

  await emitGrowthLeadLiveCallCompletedTimeline(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    actor: input.actor,
  })

  await emitLiveCoachingSessionCompletedTimeline(admin, updated)

  void recomputeLiveCoachingSessionInsights(admin, {
    leadId: session.leadId,
    sessionId: session.id,
  }).catch(() => undefined)

  void generateCallIntelligenceScorecard({
    admin,
    leadId: session.leadId,
    realtimeSessionId: session.id,
    trigger: "session_complete",
  }).catch(() => undefined)

  return updated
}

export async function discardGrowthRealtimeCallSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<GrowthRealtimeCallSession> {
  const session = await fetchGrowthRealtimeCallSession(admin, sessionId)
  if (!session) throw new Error("not_found")
  await detachRealtimeProviderFromSession(sessionId)
  await stopBrowserAudioCaptureForSession(admin, sessionId)
  const updated = await updateGrowthRealtimeCallSession(admin, sessionId, {
    status: "discarded",
    endedAt: new Date().toISOString(),
    transcriptStatus: "inactive",
  })
  await emitLiveCoachingSessionDiscardedTimeline(admin, updated)
  void recomputeLiveCoachingSessionInsights(admin, {
    leadId: updated.leadId,
    sessionId: updated.id,
  }).catch(() => undefined)
  return updated
}

export async function appendGrowthRealtimeCallTranscript(
  admin: SupabaseClient,
  input: {
    sessionId: string
    speaker: GrowthRealtimeCallSpeaker
    content: string
    sequenceNumber: number
    timestampMs?: number
    actor?: Actor
  },
): Promise<{
  session: GrowthRealtimeCallSession
  event: GrowthRealtimeTranscriptEvent
  coachingState: GrowthLiveCoachingState | null
}> {
  const session = await fetchGrowthRealtimeCallSession(admin, input.sessionId)
  if (!session) throw new Error("not_found")
  if (session.status === "completed" || session.status === "discarded") {
    throw new Error("session_closed")
  }

  const event = await appendGrowthRealtimeTranscriptEvent(admin, input)
  const refreshed = await recomputeAndPersistSnapshot(admin, session, input.actor)
  return { session: refreshed.session, event, coachingState: refreshed.coachingState }
}

export async function getGrowthRealtimeCallSessionDetail(
  admin: SupabaseClient,
  sessionId: string,
): Promise<{
  session: GrowthRealtimeCallSession
  events: GrowthRealtimeTranscriptEvent[]
  coachingState: GrowthLiveCoachingState | null
} | null> {
  const session = await fetchGrowthRealtimeCallSession(admin, sessionId)
  if (!session) return null
  const lead = await fetchGrowthLeadById(admin, session.leadId)
  if (!lead) return null

  const organizationId = getGrowthEngineAiOrgId()
  const { data: nativeLink } = await admin
    .schema("growth")
    .from("native_call_workspace_sessions")
    .select("voice_call_id")
    .eq("realtime_session_id", sessionId)
    .maybeSingle()
  const linkedVoiceCallId = (nativeLink?.voice_call_id as string | null) ?? null
  if (linkedVoiceCallId && session.status !== "completed" && session.status !== "discarded") {
    await reconcileVoiceTranscriptBridgeForCall(admin, {
      organizationId,
      voiceCallId: linkedVoiceCallId,
      realtimeSessionId: sessionId,
    }).catch(() => undefined)
  }

  const events = await listGrowthRealtimeTranscriptEvents(admin, sessionId)
  const analyzedSnapshot = analyzeRealtimeCallTranscript({
    events,
    lead: await buildGrowthLeadRealtimeIntelligenceInput(admin, lead),
  })

  let coachingState: GrowthLiveCoachingState | null = null
  let liveSnapshot = analyzedSnapshot
  if (session.guidanceEnabled) {
    const direction = await resolveNativeCallDirectionForRealtimeSession(admin, sessionId).catch(() => null)
    const synced = await syncLiveGuidanceForSession(admin, {
      leadId: session.leadId,
      sessionId,
      snapshot: analyzedSnapshot,
      events,
      lead: await buildGrowthLeadRealtimeIntelligenceInput(admin, lead),
      organizationId,
      direction,
      session,
    })
    coachingState = synced.coachingState
    liveSnapshot = synced.liveSnapshot
  }

  const refreshed = await updateGrowthRealtimeCallSession(admin, sessionId, {
    liveSnapshot,
    guidanceLatencyMs: coachingState?.guidanceLatencyMs ?? session.guidanceLatencyMs,
  })

  return { session: refreshed, events, coachingState }
}
