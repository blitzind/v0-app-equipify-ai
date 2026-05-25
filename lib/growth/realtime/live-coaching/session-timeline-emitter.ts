import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeCallExecutionScore, computeLiveMomentum } from "@/lib/growth/live-guidance/live-execution-score"
import { appendLiveCoachingSessionTimelineEvent } from "@/lib/growth/realtime/live-coaching/session-timeline-repository"
import type {
  LiveCoachingSessionTimelineEventType,
  LiveCoachingSessionTimelineSeverity,
} from "@/lib/growth/realtime/live-coaching/session-timeline-types"
import { diffRealtimeSnapshot } from "@/lib/growth/realtime/realtime-session-analyzer"
import type {
  GrowthRealtimeCallSession,
  GrowthRealtimeLiveSnapshot,
  GrowthRealtimeTranscriptEvent,
} from "@/lib/growth/realtime/realtime-call-types"

type EmitInput = {
  leadId: string
  sessionId: string
  eventType: LiveCoachingSessionTimelineEventType
  severity?: LiveCoachingSessionTimelineSeverity
  providerId?: string | null
  detail?: Record<string, unknown>
  dedupeKey?: string | null
}

async function emit(admin: SupabaseClient, input: EmitInput): Promise<void> {
  await appendLiveCoachingSessionTimelineEvent(admin, {
    leadId: input.leadId,
    sessionId: input.sessionId,
    eventType: input.eventType,
    severity: input.severity ?? "info",
    providerId: input.providerId ?? null,
    detail: input.detail,
    dedupeKey: input.dedupeKey ?? null,
  })
}

export async function emitLiveCoachingSessionStartedTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "session_started",
    providerId: session.providerId,
    dedupeKey: `session_started:${session.id}`,
    detail: { transcriptSource: session.transcriptSource },
  })
}

export async function emitLiveCoachingSessionPausedTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "session_paused",
    providerId: session.providerId,
    detail: { status: session.status },
  })
}

export async function emitLiveCoachingSessionResumedTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "session_resumed",
    providerId: session.providerId,
    detail: { status: session.status },
  })
}

export async function emitLiveCoachingSessionStoppedTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "session_stopped",
    providerId: session.providerId,
    detail: { captureStatus: session.browserAudioCaptureStatus },
  })
}

export async function emitLiveCoachingSessionCompletedTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "session_completed",
    providerId: session.providerId,
    dedupeKey: `session_completed:${session.id}`,
    detail: { durationMs: session.endedAt && session.startedAt
      ? new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
      : null },
  })
}

export async function emitLiveCoachingSessionDiscardedTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "session_discarded",
    providerId: session.providerId,
    dedupeKey: `session_discarded:${session.id}`,
  })
}

export async function emitLiveCoachingMicPermissionTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  input: { granted: boolean; errorCode?: string | null },
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: input.granted ? "mic_permission_granted" : "mic_permission_denied",
    severity: input.granted ? "info" : "warning",
    providerId: session.providerId,
    detail: { errorCode: input.errorCode ?? null },
  })
}

export async function emitLiveCoachingProviderConnectingTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "provider_connecting",
    providerId: session.providerId,
  })
}

export async function emitLiveCoachingProviderConnectedTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "provider_connected",
    providerId: session.providerId,
    detail: { streamStatus: "listening" },
  })
}

export async function emitLiveCoachingProviderDisconnectedTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  input?: { reasonCode?: string | null },
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "provider_disconnected",
    severity: "warning",
    providerId: session.providerId,
    detail: { reasonCode: input?.reasonCode ?? null },
  })
}

export async function emitLiveCoachingProviderDegradedTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  input?: { reasonCode?: string | null },
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "provider_degraded",
    severity: "warning",
    providerId: session.providerId,
    detail: { reasonCode: input?.reasonCode ?? null },
  })
}

export async function emitLiveCoachingProviderFallbackTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  input: { providerId: string; failoverCount: number },
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "provider_fallback_activated",
    severity: "warning",
    providerId: input.providerId,
    detail: { failoverCount: input.failoverCount },
  })
}

export async function emitLiveCoachingProviderRetryTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  input: { attempt: number },
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "provider_retry",
    severity: "warning",
    providerId: session.providerId,
    detail: { attempt: input.attempt },
  })
}

export async function emitLiveCoachingCircuitBreakerTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "circuit_breaker_triggered",
    severity: "critical",
    providerId: session.providerId,
    detail: { circuitOpen: true },
  })
}

export async function emitLiveCoachingTranscriptChunkTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  input: {
    sequenceNumber: number
    speaker: string
    isFinal: boolean
    latencyMs?: number
    confidence?: number
  },
): Promise<void> {
  const eventType = input.isFinal ? "transcript_finalized" : "transcript_chunk_received"
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType,
    providerId: session.providerId,
    detail: {
      sequenceNumber: input.sequenceNumber,
      speaker: input.speaker,
      isFinal: input.isFinal,
      latencyMs: input.latencyMs ?? null,
      confidence: input.confidence ?? null,
    },
    dedupeKey: `${eventType}:${session.id}:${input.sequenceNumber}:${input.isFinal ? "final" : "partial"}`,
  })
}

export async function emitLiveCoachingGuidanceGeneratedTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  input: { guidanceId: string; guidanceType: string; severity: string },
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "guidance_generated",
    severity: input.severity === "high" ? "critical" : input.severity === "medium" ? "warning" : "info",
    providerId: session.providerId,
    detail: {
      guidanceId: input.guidanceId,
      guidanceType: input.guidanceType,
    },
    dedupeKey: `guidance_generated:${input.guidanceId}`,
  })
}

export async function emitLiveCoachingSnapshotDiffTimeline(
  admin: SupabaseClient,
  input: {
    session: GrowthRealtimeCallSession
    previousSnapshot: GrowthRealtimeLiveSnapshot | null
    nextSnapshot: GrowthRealtimeLiveSnapshot
    events: Pick<GrowthRealtimeTranscriptEvent, "content">[]
    previousExecutionScore?: number | null
  },
): Promise<void> {
  const diff = diffRealtimeSnapshot(input.previousSnapshot, input.nextSnapshot)
  const providerId = input.session.providerId

  for (const signalKey of diff.newBuyingSignals) {
    await emit(admin, {
      leadId: input.session.leadId,
      sessionId: input.session.id,
      eventType: "buying_signal_detected",
      providerId,
      detail: { signalKey },
      dedupeKey: `buying_signal:${input.session.id}:${signalKey}`,
    })
  }

  for (const objectionKey of diff.newObjections) {
    await emit(admin, {
      leadId: input.session.leadId,
      sessionId: input.session.id,
      eventType: "objection_detected",
      severity: "warning",
      providerId,
      detail: { signalKey: objectionKey },
      dedupeKey: `objection:${input.session.id}:${objectionKey}`,
    })
  }

  for (const area of diff.newDiscoveryGaps) {
    await emit(admin, {
      leadId: input.session.leadId,
      sessionId: input.session.id,
      eventType: "discovery_gap_detected",
      providerId,
      detail: { area },
      dedupeKey: `discovery_gap:${input.session.id}:${area}`,
    })
  }

  const previousCompetitors = new Set(
    input.previousSnapshot?.competitorGuidance.map((entry) => entry.competitor) ?? [],
  )
  for (const entry of input.nextSnapshot.competitorGuidance) {
    if (previousCompetitors.has(entry.competitor)) continue
    await emit(admin, {
      leadId: input.session.leadId,
      sessionId: input.session.id,
      eventType: "competitor_pressure_detected",
      severity: "warning",
      providerId,
      detail: { competitorKey: entry.competitor },
      dedupeKey: `competitor:${input.session.id}:${entry.competitor}`,
    })
  }

  const previousMomentum = input.previousSnapshot
    ? computeLiveMomentum(input.previousSnapshot)
    : null
  const nextMomentum = computeLiveMomentum(input.nextSnapshot)
  if (previousMomentum && previousMomentum !== nextMomentum) {
    await emit(admin, {
      leadId: input.session.leadId,
      sessionId: input.session.id,
      eventType: "momentum_change",
      severity: nextMomentum === "at_risk" ? "critical" : nextMomentum === "slowing" ? "warning" : "info",
      providerId,
      detail: { previousMomentum, momentum: nextMomentum },
      dedupeKey: `momentum:${input.session.id}:${nextMomentum}`,
    })
  }

  const nextExecutionScore = computeCallExecutionScore({
    snapshot: input.nextSnapshot,
    events: input.events,
  }).score
  const previousScore = input.previousExecutionScore
  if (previousScore != null && previousScore !== nextExecutionScore) {
    await emit(admin, {
      leadId: input.session.leadId,
      sessionId: input.session.id,
      eventType: "execution_score_change",
      providerId,
      detail: { previousScore, score: nextExecutionScore },
      dedupeKey: `execution_score:${input.session.id}:${nextExecutionScore}`,
    })
  }
}

export async function emitLiveCoachingMeetingCaptureStartedTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  input: {
    captureSourceMode: string
    meetingProvider?: string | null
    mixedAudioEnabled?: boolean
  },
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "meeting_capture_started",
    providerId: session.providerId,
    detail: {
      captureSourceMode: input.captureSourceMode,
      meetingProvider: input.meetingProvider ?? null,
      mixedAudioEnabled: Boolean(input.mixedAudioEnabled),
    },
    dedupeKey: `meeting_capture_started:${session.id}:${input.captureSourceMode}`,
  })
}

export async function emitLiveCoachingMeetingCaptureStoppedTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "meeting_capture_stopped",
    providerId: session.providerId,
    detail: { captureStatus: session.browserAudioCaptureStatus },
    dedupeKey: `meeting_capture_stopped:${session.id}`,
  })
}

export async function emitLiveCoachingMeetingProviderDetectedTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  input: { meetingProvider: string },
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "meeting_provider_detected",
    providerId: session.providerId,
    detail: { meetingProvider: input.meetingProvider },
    dedupeKey: `meeting_provider_detected:${session.id}:${input.meetingProvider}`,
  })
}

export async function emitLiveCoachingMixedAudioEnabledTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "mixed_audio_enabled",
    providerId: session.providerId,
    dedupeKey: `mixed_audio_enabled:${session.id}`,
  })
}

export async function emitLiveCoachingMeetingAudioPermissionTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  input: { errorCode?: string | null },
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "meeting_audio_permission_denied",
    severity: "warning",
    providerId: session.providerId,
    detail: { errorCode: input.errorCode ?? null },
  })
}

export async function emitLiveCoachingMeetingCaptureFailedTimeline(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  input: { errorCode?: string | null },
): Promise<void> {
  await emit(admin, {
    leadId: session.leadId,
    sessionId: session.id,
    eventType: "meeting_capture_failed",
    severity: "warning",
    providerId: session.providerId,
    detail: { errorCode: input.errorCode ?? null },
  })
}
