import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

const ACTIVE_NATIVE_WORKSPACE_STATUSES = [
  "ringing",
  "active",
  "on_hold",
  "external_bridge_pending",
  "wrapping",
] as const

export type VoiceCallCopilotResolution = {
  voiceCallId: string
  nativeSessionId: string | null
  resolvedFrom: "voice_call_id" | "native_session_id" | "realtime_session_id" | "workspace_session_id"
}

async function confirmVoiceCallInOrg(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<boolean> {
  const { data } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("id")
    .eq("id", voiceCallId)
    .eq("organization_id", organizationId)
    .maybeSingle()
  return Boolean(data?.id)
}

async function resolveVoiceCallFromNativeSession(
  admin: SupabaseClient,
  organizationId: string,
  nativeSessionId: string,
): Promise<VoiceCallCopilotResolution | null> {
  const { data } = await admin
    .schema("growth")
    .from("native_call_workspace_sessions")
    .select("id, voice_call_id")
    .eq("id", nativeSessionId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const voiceCallId = (data?.voice_call_id as string | null) ?? null
  if (!voiceCallId) return null
  if (!(await confirmVoiceCallInOrg(admin, organizationId, voiceCallId))) return null

  return {
    voiceCallId,
    nativeSessionId: data!.id as string,
    resolvedFrom: "native_session_id",
  }
}

async function resolveVoiceCallFromRealtimeSession(
  admin: SupabaseClient,
  organizationId: string,
  realtimeSessionId: string,
): Promise<VoiceCallCopilotResolution | null> {
  const { data } = await admin
    .schema("growth")
    .from("native_call_workspace_sessions")
    .select("id, voice_call_id")
    .eq("realtime_session_id", realtimeSessionId)
    .eq("organization_id", organizationId)
    .in("status", [...ACTIVE_NATIVE_WORKSPACE_STATUSES])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.voice_call_id) return null
  const voiceCallId = data.voice_call_id as string
  if (!(await confirmVoiceCallInOrg(admin, organizationId, voiceCallId))) return null

  return {
    voiceCallId,
    nativeSessionId: data.id as string,
    resolvedFrom: "realtime_session_id",
  }
}

/**
 * Copilot routes accept voice_call_id, native_session_id, or realtime_session_id in the URL
 * segment. Guidance/coaching paths often surface realtime_session_id while copilot persistence
 * is keyed on voice.voice_calls.id — resolve to the canonical voice call before lookup/generation.
 */
export async function resolveVoiceCallForCopilot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    callId: string
    workspaceSessionId?: string | null
  },
): Promise<VoiceCallCopilotResolution | null> {
  if (await confirmVoiceCallInOrg(admin, input.organizationId, input.callId)) {
    const nativeSessionId =
      input.workspaceSessionId ??
      (await admin
        .schema("growth")
        .from("native_call_workspace_sessions")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("voice_call_id", input.callId)
        .in("status", [...ACTIVE_NATIVE_WORKSPACE_STATUSES])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((result) => (result.data?.id as string | null) ?? null))

    return {
      voiceCallId: input.callId,
      nativeSessionId,
      resolvedFrom: "voice_call_id",
    }
  }

  const fromNative = await resolveVoiceCallFromNativeSession(admin, input.organizationId, input.callId)
  if (fromNative) return fromNative

  const fromRealtime = await resolveVoiceCallFromRealtimeSession(admin, input.organizationId, input.callId)
  if (fromRealtime) return fromRealtime

  if (input.workspaceSessionId && input.workspaceSessionId !== input.callId) {
    return resolveVoiceCallFromNativeSession(admin, input.organizationId, input.workspaceSessionId)
  }

  return null
}
