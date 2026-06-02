/**
 * Local call lifecycle authority — Twilio SDK phase wins over DB/sync for UI phase.
 */

import type { NativeCallWorkspaceSessionPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import type { GrowthCallWorkspacePhase } from "@/components/growth/growth-call-workspace-center-panel"
import type { CallLifecycleLockSnapshot } from "@/lib/voice/browser-calling/call-lifecycle-reconciliation"
import {
  mergeServerSessionIntoLocal,
  resolveAuthoritativeNativeSessionId,
} from "@/lib/voice/browser-calling/call-lifecycle-reconciliation"

export const CALL_LIFECYCLE_AUTHORITY_QA_MARKER = "call-lifecycle-authority-v1" as const

export type CallLifecycleAuthorityPhase =
  | "idle"
  | "incoming"
  | "accepting"
  | "active"
  | "ending"
  | "wrapup"
  | "completed"

export type CallLifecycleAuthorityState = {
  phase: CallLifecycleAuthorityPhase
  voiceCallId: string | null
  sessionId: string | null
  callSid: string | null
  connectedAt: string | null
  endedAt: string | null
  frozenDurationSeconds: number | null
}

export type CallLifecycleAuthorityEvent =
  | { type: "sdk_incoming"; callSid?: string | null; voiceCallId?: string | null; sessionId?: string | null }
  | { type: "sdk_accept_started" }
  | { type: "sdk_accept_succeeded"; callSid?: string | null; connectedAt?: string }
  | { type: "sdk_disconnected"; reason?: string }
  | { type: "local_end_requested"; endedAt: string; voiceCallId?: string | null; sessionId?: string | null }
  | { type: "wrapup_confirmed" }
  | { type: "decline_or_cancel" }
  | { type: "bind_session"; voiceCallId?: string | null; sessionId?: string | null }

export function createInitialCallLifecycleAuthority(): CallLifecycleAuthorityState {
  return {
    phase: "idle",
    voiceCallId: null,
    sessionId: null,
    callSid: null,
    connectedAt: null,
    endedAt: null,
    frozenDurationSeconds: null,
  }
}

const LIVE_AUTHORITY_PHASES = new Set<CallLifecycleAuthorityPhase>([
  "incoming",
  "accepting",
  "active",
])

const TERMINAL_AUTHORITY_PHASES = new Set<CallLifecycleAuthorityPhase>(["ending", "wrapup", "completed"])

export function isCallLifecycleAuthorityLive(
  phase: CallLifecycleAuthorityPhase | null | undefined,
): boolean {
  return phase != null && LIVE_AUTHORITY_PHASES.has(phase)
}

export function isCallLifecycleAuthorityTerminal(
  phase: CallLifecycleAuthorityPhase | null | undefined,
): boolean {
  return phase != null && TERMINAL_AUTHORITY_PHASES.has(phase)
}

export function transitionCallLifecycleAuthority(
  state: CallLifecycleAuthorityState,
  event: CallLifecycleAuthorityEvent,
): CallLifecycleAuthorityState {
  switch (event.type) {
    case "sdk_incoming": {
      if (isCallLifecycleAuthorityTerminal(state.phase)) return state
      if (state.phase === "active" || state.phase === "accepting") return state
      return {
        ...state,
        phase: "incoming",
        callSid: event.callSid ?? state.callSid,
        voiceCallId: event.voiceCallId ?? state.voiceCallId,
        sessionId: event.sessionId ?? state.sessionId,
      }
    }
    case "sdk_accept_started": {
      if (isCallLifecycleAuthorityTerminal(state.phase)) return state
      return { ...state, phase: "accepting" }
    }
    case "sdk_accept_succeeded": {
      if (isCallLifecycleAuthorityTerminal(state.phase)) return state
      const connectedAt = event.connectedAt ?? state.connectedAt ?? new Date().toISOString()
      return {
        ...state,
        phase: "active",
        callSid: event.callSid ?? state.callSid,
        connectedAt,
        endedAt: null,
        frozenDurationSeconds: null,
      }
    }
    case "sdk_disconnected": {
      if (state.phase === "idle" || state.phase === "completed") return state
      if (state.phase === "ending" || state.phase === "wrapup") {
        return {
          ...state,
          phase: state.phase === "ending" ? "wrapup" : state.phase,
          endedAt: state.endedAt ?? new Date().toISOString(),
          frozenDurationSeconds: computeFrozenDurationSeconds(state.connectedAt, state.endedAt),
        }
      }
      const endedAt = new Date().toISOString()
      return {
        ...state,
        phase: "wrapup",
        endedAt,
        frozenDurationSeconds: computeFrozenDurationSeconds(state.connectedAt, endedAt),
      }
    }
    case "local_end_requested": {
      const endedAt = event.endedAt
      return {
        ...state,
        phase: "ending",
        voiceCallId: event.voiceCallId ?? state.voiceCallId,
        sessionId: event.sessionId ?? state.sessionId,
        endedAt,
        frozenDurationSeconds: computeFrozenDurationSeconds(state.connectedAt, endedAt),
      }
    }
    case "wrapup_confirmed":
      return createInitialCallLifecycleAuthority()
    case "decline_or_cancel":
      return createInitialCallLifecycleAuthority()
    case "bind_session":
      return {
        ...state,
        voiceCallId: event.voiceCallId ?? state.voiceCallId,
        sessionId: event.sessionId ?? state.sessionId,
      }
    default:
      return state
  }
}

function computeFrozenDurationSeconds(connectedAt: string | null, endedAt: string | null): number | null {
  if (!connectedAt || !endedAt) return null
  const start = Date.parse(connectedAt)
  const end = Date.parse(endedAt)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return Math.max(0, Math.floor((end - start) / 1000))
}

export function authorityPhaseToSessionStatus(
  phase: CallLifecycleAuthorityPhase,
): NativeCallWorkspaceSessionPublicView["status"] {
  switch (phase) {
    case "incoming":
      return "ringing"
    case "accepting":
    case "active":
      return "active"
    case "ending":
    case "wrapup":
      return "wrapping"
    case "completed":
      return "completed"
    default:
      return "ringing"
  }
}

export function mapAuthorityToWorkspacePhase(input: {
  authority: CallLifecycleAuthorityState
  bridgeSession?: boolean
}): GrowthCallWorkspacePhase {
  switch (input.authority.phase) {
    case "incoming":
      return "incoming"
    case "accepting":
    case "active":
      return input.bridgeSession ? "bridge_pending" : "active"
    case "ending":
    case "wrapup":
      return "wrapup"
    case "completed":
    case "idle":
    default:
      return "idle"
  }
}

const SESSION_METADATA_KEYS: (keyof NativeCallWorkspaceSessionPublicView)[] = [
  "leadId",
  "ownerUserId",
  "phoneNumber",
  "contactName",
  "companyName",
  "recordingState",
  "muted",
  "onHold",
  "transferTarget",
  "notesDraft",
  "realtimeSessionId",
  "callCopilotSessionId",
  "providerCallRef",
  "safeSummary",
  "voiceCallId",
  "provider",
  "fallbackProvider",
  "dialMode",
  "direction",
]

function pickSessionMetadata(
  server: NativeCallWorkspaceSessionPublicView,
): Partial<NativeCallWorkspaceSessionPublicView> {
  const patch: Partial<NativeCallWorkspaceSessionPublicView> = {}
  for (const key of SESSION_METADATA_KEYS) {
    const value = server[key]
    if (value !== null && value !== undefined && value !== "") {
      ;(patch as Record<string, unknown>)[key] = value
    }
  }
  if (server.connectedAt) patch.connectedAt = server.connectedAt
  if (server.durationSeconds) patch.durationSeconds = server.durationSeconds
  return patch
}

/** Server may enrich metadata but cannot override SDK-driven phase. */
export function applyServerSessionUnderAuthority(input: {
  local: NativeCallWorkspaceSessionPublicView | null
  server: NativeCallWorkspaceSessionPublicView | null
  authority: CallLifecycleAuthorityState
  acceptedSessionIds: ReadonlySet<string>
  endedVoiceCallIds: ReadonlySet<string>
  endedSessionIds?: ReadonlySet<string>
  completedSessionIds?: ReadonlySet<string>
  completedVoiceCallIds?: ReadonlySet<string>
}): NativeCallWorkspaceSessionPublicView | null {
  const { authority, server, local } = input

  if (isCallLifecycleAuthorityLive(authority.phase) || authority.phase === "ending") {
    const status = authorityPhaseToSessionStatus(authority.phase)
    const base = local ?? server
    if (!base && !server) return null
    const merged = {
      ...(base ?? server)!,
      ...(server ? pickSessionMetadata(server) : {}),
      status,
      id:
        resolveAuthoritativeNativeSessionId({
          authoritySessionId: authority.sessionId,
          localSessionId: local?.id,
          serverSessionId: server?.id,
        }) ?? (base ?? server)!.id,
      voiceCallId: authority.voiceCallId ?? local?.voiceCallId ?? server?.voiceCallId ?? null,
      connectedAt: authority.connectedAt ?? local?.connectedAt ?? server?.connectedAt ?? null,
    }
    return merged
  }

  if (authority.phase === "wrapup") {
    const base = local ?? server
    if (!base) return server
    if (server && local) {
      return {
        ...local,
        ...pickSessionMetadata(server),
        status: "wrapping",
        endedAt: authority.endedAt ?? local.endedAt ?? server.endedAt,
        durationSeconds:
          authority.frozenDurationSeconds ?? local.durationSeconds ?? server.durationSeconds,
      }
    }
    return {
      ...base,
      status: "wrapping",
      endedAt: authority.endedAt ?? base.endedAt,
      durationSeconds: authority.frozenDurationSeconds ?? base.durationSeconds,
    }
  }

  return mergeServerSessionIntoLocal({
    local,
    server,
    acceptedSessionIds: input.acceptedSessionIds,
    endedVoiceCallIds: input.endedVoiceCallIds,
    endedSessionIds: input.endedSessionIds,
    completedSessionIds: input.completedSessionIds,
    completedVoiceCallIds: input.completedVoiceCallIds,
  })
}

export function shouldHydrateInboundOfferUnderAuthority(input: {
  authority: CallLifecycleAuthorityState
  hasLiveSdkCall: boolean
}): boolean {
  if (input.hasLiveSdkCall) return false
  if (isCallLifecycleAuthorityLive(input.authority.phase)) return false
  if (isCallLifecycleAuthorityTerminal(input.authority.phase)) return false
  return true
}

export function shouldClearSessionOnIncomingCleared(input: {
  authority: CallLifecycleAuthorityState
  hasLiveSdkCall: boolean
  reason: string
}): boolean {
  if (input.hasLiveSdkCall || isCallLifecycleAuthorityLive(input.authority.phase)) return false
  if (input.authority.phase === "ending" || input.authority.phase === "wrapup") return false
  return input.reason === "cancel" || input.reason === "sync_offer_cleared"
}
