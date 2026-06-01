import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchGrowthRealtimeCallSession,
  listGrowthRealtimeCallSessionsForLead,
} from "@/lib/growth/realtime/realtime-call-repository"
import { completeGrowthRealtimeCallSession } from "@/lib/growth/realtime/run-realtime-call-session"
import type { GrowthRealtimeCallSessionStatus } from "@/lib/growth/realtime/realtime-call-types"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

const OPEN_REALTIME_SESSION_STATUSES: GrowthRealtimeCallSessionStatus[] = ["preparing", "active", "paused"]

const ACTIVE_NATIVE_LINKER_STATUSES = [
  "ringing",
  "active",
  "on_hold",
  "external_bridge_pending",
  "wrapping",
] as const

export type CompleteCallWorkspaceLiveCoachingResult = {
  completed: boolean
  realtimeSessionId: string | null
  reason?: "not_linked" | "already_closed" | "session_not_found"
}

export async function countActiveNativeSessionsLinkedToRealtimeSession(
  admin: SupabaseClient,
  realtimeSessionId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("native_call_workspace_sessions")
    .select("id", { count: "exact", head: true })
    .eq("realtime_session_id", realtimeSessionId)
    .in("status", [...ACTIVE_NATIVE_LINKER_STATUSES])
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function completeCallWorkspaceLiveCoachingForNativeSession(
  admin: SupabaseClient,
  input: { nativeSessionId: string; actor?: { userId: string | null; email: string | null } },
): Promise<CompleteCallWorkspaceLiveCoachingResult> {
  const { data: nativeRow, error: nativeError } = await admin
    .schema("growth")
    .from("native_call_workspace_sessions")
    .select("realtime_session_id, voice_call_id")
    .eq("id", input.nativeSessionId)
    .maybeSingle()
  if (nativeError) throw new Error(nativeError.message)

  const realtimeSessionId = (nativeRow?.realtime_session_id as string | null) ?? null
  if (!realtimeSessionId) {
    return { completed: false, realtimeSessionId: null, reason: "not_linked" }
  }

  const realtimeSession = await fetchGrowthRealtimeCallSession(admin, realtimeSessionId)
  if (!realtimeSession) {
    return { completed: false, realtimeSessionId, reason: "session_not_found" }
  }

  if (realtimeSession.status === "completed" || realtimeSession.status === "discarded") {
    return { completed: false, realtimeSessionId: realtimeSession.id, reason: "already_closed" }
  }

  await completeGrowthRealtimeCallSession(admin, {
    sessionId: realtimeSession.id,
    actor: input.actor,
  })

  logVoiceInfrastructure("voice_growth_coaching_session_completed", {
    nativeSessionId: input.nativeSessionId,
    realtimeSessionId: realtimeSession.id,
    voiceCallId: (nativeRow?.voice_call_id as string | null) ?? null,
  })

  return { completed: true, realtimeSessionId: realtimeSession.id }
}

/**
 * Closes stale realtime coaching sessions that remain open after every linked native
 * workspace session has finished (prevents cross-call reuse on the same anchor lead).
 */
export async function completeOrphanedActiveRealtimeCoachingSessionsForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<string[]> {
  const sessions = await listGrowthRealtimeCallSessionsForLead(admin, leadId, 25)
  const completedIds: string[] = []

  for (const session of sessions) {
    if (!OPEN_REALTIME_SESSION_STATUSES.includes(session.status)) continue
    const activeLinks = await countActiveNativeSessionsLinkedToRealtimeSession(admin, session.id)
    if (activeLinks > 0) continue

    await completeGrowthRealtimeCallSession(admin, { sessionId: session.id })
    completedIds.push(session.id)
    logVoiceInfrastructure("voice_growth_coaching_orphan_completed", {
      leadId,
      realtimeSessionId: session.id,
    })
  }

  return completedIds
}
