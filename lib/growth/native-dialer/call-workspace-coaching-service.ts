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
  listGrowthRealtimeCallSessionsForLead,
} from "@/lib/growth/realtime/realtime-call-repository"
import type { GrowthLiveCoachingState } from "@/lib/growth/live-guidance/live-guidance-types"
import type { GrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-types"
import {
  callWorkspaceCoachingModeForLead,
  ensureCallWorkspaceTranscriptAnchorLead,
} from "@/lib/growth/native-dialer/call-workspace-coaching-lead"
import type { CallWorkspaceCoachingMode } from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import {
  attachLeadToNativeCallSession,
  fetchNativeCallSessionById,
  linkNativeCallRealtimeSession,
} from "@/lib/growth/native-dialer/native-dialer-repository"

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
  } else {
    const sessions = await listGrowthRealtimeCallSessionsForLead(admin, coachingLeadId)
    realtimeSession =
      sessions.find((session) => ["preparing", "active", "paused"].includes(session.status)) ?? null
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
  input: { nativeSessionId: string; createdBy?: string | null; userEmail?: string | null },
): Promise<CallWorkspaceCoachingContext> {
  const nativeSession = await fetchNativeCallSessionById(admin, input.nativeSessionId)
  if (!nativeSession) throw new Error("Call session not found.")

  const { coachingLeadId, coachingMode, leadLinked } = await resolveCoachingLeadId(admin, nativeSession, input.createdBy)

  let realtimeSession =
    nativeSession.realtimeSessionId
      ? await fetchGrowthRealtimeCallSession(admin, nativeSession.realtimeSessionId)
      : null

  if (!realtimeSession) {
    const existing = await listGrowthRealtimeCallSessionsForLead(admin, coachingLeadId)
    realtimeSession =
      existing.find((session) => ["preparing", "active", "paused"].includes(session.status)) ?? null
  }

  if (!realtimeSession) {
    realtimeSession = await createGrowthRealtimeCallSession(admin, {
      leadId: coachingLeadId,
      createdBy: input.createdBy ?? null,
    })
  }

  if (realtimeSession.status === "preparing" || realtimeSession.status === "paused") {
    realtimeSession = await startGrowthRealtimeCallSession(admin, {
      sessionId: realtimeSession.id,
      actor: { userId: input.createdBy ?? null, email: input.userEmail ?? null },
    })
  }

  await linkNativeCallRealtimeSession(admin, {
    nativeSessionId: nativeSession.id,
    realtimeSessionId: realtimeSession.id,
  })

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
