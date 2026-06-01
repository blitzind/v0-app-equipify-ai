import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  createGrowthRealtimeCallSession,
  getGrowthRealtimeCallSessionDetail,
  startGrowthRealtimeCallSession,
} from "@/lib/growth/realtime/run-realtime-call-session"
import {
  fetchGrowthRealtimeCallSession,
} from "@/lib/growth/realtime/realtime-call-repository"
import { bootstrapConversationCoachForSession } from "@/lib/growth/live-coaching/sync-conversation-coach"
import type { GrowthLiveCoachingState } from "@/lib/growth/live-guidance/live-guidance-types"
import type { GrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-types"
import {
  callWorkspaceCoachingModeForLead,
  ensureCallWorkspaceTranscriptAnchorLead,
} from "@/lib/growth/native-dialer/call-workspace-coaching-lead"
import type { CallWorkspaceCoachingMode } from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import {
  completeOrphanedActiveRealtimeCoachingSessionsForLead,
} from "@/lib/growth/native-dialer/call-workspace-coaching-lifecycle"
import {
  attachLeadToNativeCallSession,
  fetchNativeCallSessionById,
  linkNativeCallRealtimeSession,
} from "@/lib/growth/native-dialer/native-dialer-repository"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

const ACTIVE_NATIVE_WORKSPACE_STATUSES = [
  "ringing",
  "active",
  "on_hold",
  "external_bridge_pending",
] as const

export type CallWorkspaceCoachingContext = {
  nativeSessionId: string
  coachingLeadId: string
  sessionLeadId: string | null
  coachingMode: CallWorkspaceCoachingMode
  leadLinked: boolean
  realtimeSession: GrowthRealtimeCallSession | null
  coachingState: GrowthLiveCoachingState | null
}

async function resolveCoachingLeadId(
  admin: SupabaseClient,
  nativeSession: { leadId: string | null; phoneNumber: string | null },
  createdBy?: string | null,
): Promise<{ coachingLeadId: string; coachingMode: CallWorkspaceCoachingMode; leadLinked: boolean }> {
  if (nativeSession.leadId) {
    const lead = await fetchGrowthLeadById(admin, nativeSession.leadId)
    const coachingMode = callWorkspaceCoachingModeForLead(nativeSession.leadId, lead)
    return {
      coachingLeadId: nativeSession.leadId,
      coachingMode,
      leadLinked: coachingMode === "lead_linked",
    }
  }

  const anchor = await ensureCallWorkspaceTranscriptAnchorLead(admin, {
    phoneNumber: nativeSession.phoneNumber ?? "",
    createdBy,
  })
  return {
    coachingLeadId: anchor.id,
    coachingMode: "transcript_only",
    leadLinked: false,
  }
}

export async function fetchCallWorkspaceLiveCoaching(
  admin: SupabaseClient,
  nativeSessionId: string,
): Promise<CallWorkspaceCoachingContext> {
  const nativeSession = await fetchNativeCallSessionById(admin, nativeSessionId)
  if (!nativeSession) throw new Error("Call session not found.")

  const { coachingLeadId, coachingMode, leadLinked } = await resolveCoachingLeadId(admin, nativeSession)

  let realtimeSession: GrowthRealtimeCallSession | null = null
  if (nativeSession.realtimeSessionId) {
    realtimeSession = await fetchGrowthRealtimeCallSession(admin, nativeSession.realtimeSessionId)
  }

  let coachingState: GrowthLiveCoachingState | null = null
  if (realtimeSession) {
    const detail = await getGrowthRealtimeCallSessionDetail(admin, realtimeSession.id)
    realtimeSession = detail?.session ?? realtimeSession
    coachingState = detail?.coachingState ?? null
  }

  return {
    nativeSessionId,
    coachingLeadId,
    sessionLeadId: nativeSession.leadId,
    coachingMode,
    leadLinked,
    realtimeSession,
    coachingState,
  }
}

export async function startCallWorkspaceLiveCoaching(
  admin: SupabaseClient,
  input: {
    nativeSessionId: string
    createdBy?: string | null
    userEmail?: string | null
    hydrateDetail?: boolean
  },
): Promise<CallWorkspaceCoachingContext> {
  const nativeSession = await fetchNativeCallSessionById(admin, input.nativeSessionId)
  if (!nativeSession) throw new Error("Call session not found.")

  const { coachingLeadId, coachingMode, leadLinked } = await resolveCoachingLeadId(admin, nativeSession, input.createdBy)

  let realtimeSession =
    nativeSession.realtimeSessionId
      ? await fetchGrowthRealtimeCallSession(admin, nativeSession.realtimeSessionId)
      : null

  if (
    realtimeSession &&
    (realtimeSession.status === "completed" || realtimeSession.status === "discarded")
  ) {
    realtimeSession = null
  }

  if (!realtimeSession) {
    try {
      await completeOrphanedActiveRealtimeCoachingSessionsForLead(admin, coachingLeadId)
    } catch (error) {
      logVoiceInfrastructure("voice_growth_coaching_orphan_cleanup_failed", {
        nativeSessionId: nativeSession.id,
        coachingLeadId,
        voiceCallId: nativeSession.voiceCallId ?? null,
        message: error instanceof Error ? error.message : String(error),
      })
    }

    realtimeSession = await createGrowthRealtimeCallSession(admin, {
      leadId: coachingLeadId,
      createdBy: input.createdBy ?? null,
    })
    logVoiceInfrastructure("voice_growth_coaching_session_created", {
      nativeSessionId: nativeSession.id,
      realtimeSessionId: realtimeSession.id,
      coachingLeadId,
      voiceCallId: nativeSession.voiceCallId ?? null,
    })
  }

  if (nativeSession.realtimeSessionId !== realtimeSession.id) {
    await linkNativeCallRealtimeSession(admin, {
      nativeSessionId: nativeSession.id,
      realtimeSessionId: realtimeSession.id,
    })
    logVoiceInfrastructure("voice_growth_coaching_native_linked", {
      nativeSessionId: nativeSession.id,
      realtimeSessionId: realtimeSession.id,
      voiceCallId: nativeSession.voiceCallId ?? null,
    })
  }

  if (realtimeSession.status === "preparing" || realtimeSession.status === "paused") {
    try {
      realtimeSession = await startGrowthRealtimeCallSession(admin, {
        sessionId: realtimeSession.id,
        actor: { userId: input.createdBy ?? null, email: input.userEmail ?? null },
      })
    } catch (error) {
      logVoiceInfrastructure("voice_growth_coaching_session_start_failed", {
        nativeSessionId: nativeSession.id,
        realtimeSessionId: realtimeSession.id,
        voiceCallId: nativeSession.voiceCallId ?? null,
        message: error instanceof Error ? error.message : String(error),
      })
      realtimeSession =
        (await fetchGrowthRealtimeCallSession(admin, realtimeSession.id)) ?? realtimeSession
    }
  }

  const nativeDirection = (nativeSession.direction as "inbound" | "outbound" | undefined) ?? "outbound"
  if (!realtimeSession.liveSnapshot.conversationCoach) {
    try {
      await bootstrapConversationCoachForSession(admin, {
        session: realtimeSession,
        direction: nativeDirection,
      })
      realtimeSession =
        (await fetchGrowthRealtimeCallSession(admin, realtimeSession.id)) ?? realtimeSession
    } catch (error) {
      logVoiceInfrastructure("voice_growth_coaching_bootstrap_failed", {
        nativeSessionId: nativeSession.id,
        realtimeSessionId: realtimeSession.id,
        voiceCallId: nativeSession.voiceCallId ?? null,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (input.hydrateDetail === false) {
    const bootstrapCoach = realtimeSession.liveSnapshot.conversationCoach ?? null
    return {
      nativeSessionId: nativeSession.id,
      coachingLeadId,
      sessionLeadId: nativeSession.leadId,
      coachingMode,
      leadLinked,
      realtimeSession,
      coachingState: bootstrapCoach
        ? {
            executionScore: {
              score: 70,
              badge: "good",
              badgeLabel: "Good",
              factors: {
                talkRatio: 80,
                discoveryCoverage: 0,
                objectionsHandled: 100,
                buyingSignalsCaptured: 0,
                timelineDiscovered: false,
                decisionMakerIdentified: false,
                nextStepSecured: false,
              },
            },
            suggestedNextQuestion: bootstrapCoach.primaryPhrase,
            riskLevel: "low",
            momentum: "stable",
            activeGuidance: [],
            guidanceLatencyMs: 0,
            conversationStage: bootstrapCoach.stage,
            stageObjective: bootstrapCoach.stageObjective,
            primaryCoach: bootstrapCoach,
          }
        : null,
    }
  }

  const detail = await getGrowthRealtimeCallSessionDetail(admin, realtimeSession.id)

  return {
    nativeSessionId: nativeSession.id,
    coachingLeadId,
    sessionLeadId: nativeSession.leadId,
    coachingMode,
    leadLinked,
    realtimeSession: detail?.session ?? realtimeSession,
    coachingState: detail?.coachingState ?? null,
  }
}

export async function attachCallWorkspaceLead(
  admin: SupabaseClient,
  input: { nativeSessionId: string; leadId: string },
) {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("Lead not found.")
  return attachLeadToNativeCallSession(admin, input)
}

/**
 * Links an inbound native workspace session to a Growth realtime coaching session when
 * the operator has an answered call in the workspace (Operator Assist context).
 * Idempotent — no-op when already linked or session is not an active inbound call.
 */
export async function ensureInboundCallWorkspaceLiveCoachingLinked(
  admin: SupabaseClient,
  input: { voiceCallId: string; createdBy?: string | null; userEmail?: string | null },
): Promise<string | null> {
  const { data: sessionRow, error } = await admin
    .schema("growth")
    .from("native_call_workspace_sessions")
    .select("id, direction, realtime_session_id, owner_user_id, status")
    .eq("voice_call_id", input.voiceCallId)
    .eq("direction", "inbound")
    .in("status", [...ACTIVE_NATIVE_WORKSPACE_STATUSES])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!sessionRow) return null

  const existingRealtimeSessionId = (sessionRow.realtime_session_id as string | null) ?? null
  if (existingRealtimeSessionId) return existingRealtimeSessionId

  if (sessionRow.status !== "active" && sessionRow.status !== "on_hold") {
    return null
  }

  const { data: voiceCallRow, error: voiceCallError } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("answered_at")
    .eq("id", input.voiceCallId)
    .maybeSingle()
  if (voiceCallError) throw new Error(voiceCallError.message)
  if (!voiceCallRow?.answered_at) return null

  const coaching = await startCallWorkspaceLiveCoaching(admin, {
    nativeSessionId: sessionRow.id as string,
    createdBy: input.createdBy ?? (sessionRow.owner_user_id as string | null) ?? null,
    userEmail: input.userEmail ?? null,
  })

  const realtimeSessionId = coaching.realtimeSession?.id ?? null
  if (realtimeSessionId) {
    logVoiceInfrastructure("voice_growth_coaching_auto_linked", {
      voiceCallId: input.voiceCallId,
      nativeSessionId: sessionRow.id,
      realtimeSessionId,
    })
  }

  return realtimeSessionId
}

/** Starts coaching and seeds the opening coach line when an inbound call is answered. */
export async function autoStartCallWorkspaceLiveCoachingOnAnswer(
  admin: SupabaseClient,
  input: { nativeSessionId: string; createdBy?: string | null; userEmail?: string | null },
): Promise<CallWorkspaceCoachingContext | null> {
  const nativeSession = await fetchNativeCallSessionById(admin, input.nativeSessionId)
  if (!nativeSession || nativeSession.direction !== "inbound") return null
  if (nativeSession.status !== "active" && nativeSession.status !== "on_hold") return null

  const context = await startCallWorkspaceLiveCoaching(admin, {
    nativeSessionId: input.nativeSessionId,
    createdBy: input.createdBy ?? nativeSession.ownerUserId ?? null,
    userEmail: input.userEmail ?? null,
    hydrateDetail: false,
  })

  const realtimeSessionId = context.realtimeSession?.id ?? null
  if (realtimeSessionId) {
    logVoiceInfrastructure("voice_growth_coaching_auto_linked", {
      nativeSessionId: input.nativeSessionId,
      realtimeSessionId,
      voiceCallId: nativeSession.voiceCallId ?? null,
      stage: "answer",
    })
  } else {
    logVoiceInfrastructure("voice_growth_coaching_auto_start_failed", {
      nativeSessionId: input.nativeSessionId,
      voiceCallId: nativeSession.voiceCallId ?? null,
      reason: "realtime_session_missing_after_start",
    })
  }

  return context
}
