/** Client-safe call lifecycle reconciliation — prevent sync from downgrading local state. */

import type { NativeCallWorkspaceSessionPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import type { VoiceInboundBrowserOfferView } from "@/lib/voice/browser-calling/types"

export const CALL_LIFECYCLE_RECONCILIATION_QA_MARKER = "call-lifecycle-reconciliation-v1" as const

const TERMINAL_SESSION_STATUSES = new Set<NativeCallWorkspaceSessionPublicView["status"]>([
  "completed",
  "failed",
  "missed",
  "no_answer",
  "cancelled",
])

const ACTIVE_SESSION_STATUSES = new Set<NativeCallWorkspaceSessionPublicView["status"]>([
  "active",
  "on_hold",
  "external_bridge_pending",
  "wrapping",
])

export function isTerminalSessionStatus(
  status: NativeCallWorkspaceSessionPublicView["status"] | null | undefined,
): boolean {
  return status != null && TERMINAL_SESSION_STATUSES.has(status)
}

export function isActiveSessionStatus(
  status: NativeCallWorkspaceSessionPublicView["status"] | null | undefined,
): boolean {
  return status != null && ACTIVE_SESSION_STATUSES.has(status)
}

export function shouldApplyInboundOfferToSession(input: {
  offer: VoiceInboundBrowserOfferView
  activeSession: NativeCallWorkspaceSessionPublicView | null
  acceptedVoiceCallIds: ReadonlySet<string>
  acceptedSessionIds: ReadonlySet<string>
  endedVoiceCallIds: ReadonlySet<string>
}): boolean {
  if (input.acceptedVoiceCallIds.has(input.offer.voiceCallId)) return false
  if (input.endedVoiceCallIds.has(input.offer.voiceCallId)) return false
  if (input.acceptedSessionIds.has(input.offer.workspaceSessionId)) return false

  const session = input.activeSession
  if (!session) return true

  if (session.voiceCallId === input.offer.voiceCallId && isActiveSessionStatus(session.status)) {
    return false
  }

  if (session.id === input.offer.workspaceSessionId && isActiveSessionStatus(session.status)) {
    return false
  }

  if (isTerminalSessionStatus(session.status) && session.voiceCallId === input.offer.voiceCallId) {
    return false
  }

  return true
}

export function filterInboundOfferForLifecycle(input: {
  offer: VoiceInboundBrowserOfferView | null
  activeSession: NativeCallWorkspaceSessionPublicView | null
  acceptedVoiceCallIds: ReadonlySet<string>
  acceptedSessionIds: ReadonlySet<string>
  endedVoiceCallIds: ReadonlySet<string>
}): VoiceInboundBrowserOfferView | null {
  if (!input.offer) return null
  return shouldApplyInboundOfferToSession({
    offer: input.offer,
    activeSession: input.activeSession,
    acceptedVoiceCallIds: input.acceptedVoiceCallIds,
    acceptedSessionIds: input.acceptedSessionIds,
    endedVoiceCallIds: input.endedVoiceCallIds,
  })
    ? input.offer
    : null
}

/** Never downgrade an locally-active session back to ringing/incoming. */
export function mergeServerSessionIntoLocal(input: {
  local: NativeCallWorkspaceSessionPublicView | null
  server: NativeCallWorkspaceSessionPublicView | null
  acceptedSessionIds: ReadonlySet<string>
  endedVoiceCallIds: ReadonlySet<string>
}): NativeCallWorkspaceSessionPublicView | null {
  const { local, server } = input
  if (!server) return local
  if (!local) return server

  const sameSession = local.id === server.id
  const sameVoiceCall =
    Boolean(local.voiceCallId) && Boolean(server.voiceCallId) && local.voiceCallId === server.voiceCallId

  if (!sameSession && !sameVoiceCall) return server

  if (input.endedVoiceCallIds.has(server.voiceCallId ?? "") || input.endedVoiceCallIds.has(local.voiceCallId ?? "")) {
    if (local.status === "wrapping" || isTerminalSessionStatus(local.status)) {
      return isTerminalSessionStatus(server.status) || server.status === "wrapping" ? server : local
    }
  }

  const localIsActive = isActiveSessionStatus(local.status)
  const serverIsRinging = server.status === "ringing"
  const locallyAccepted =
    input.acceptedSessionIds.has(local.id) ||
    (local.voiceCallId ? input.acceptedSessionIds.has(local.id) : false)

  if (localIsActive && serverIsRinging && (sameSession || sameVoiceCall || locallyAccepted)) {
    return {
      ...server,
      status: local.status,
      connectedAt: local.connectedAt ?? server.connectedAt,
      safeSummary: local.safeSummary || server.safeSummary,
      recordingState: local.recordingState !== "pending" ? local.recordingState : server.recordingState,
    }
  }

  if (local.status === "wrapping" && serverIsRinging) {
    return local
  }

  return server
}

export function buildOptimisticWrappingSession(
  session: NativeCallWorkspaceSessionPublicView,
  endedAt: string,
): NativeCallWorkspaceSessionPublicView {
  const connectedMs = session.connectedAt ? Date.parse(session.connectedAt) : NaN
  const endedMs = Date.parse(endedAt)
  const durationSeconds =
    Number.isFinite(connectedMs) && Number.isFinite(endedMs)
      ? Math.max(0, Math.floor((endedMs - connectedMs) / 1000))
      : session.durationSeconds

  return {
    ...session,
    status: "wrapping",
    endedAt,
    durationSeconds,
    recordingState: session.recordingState === "active" ? "stopped" : session.recordingState,
    safeSummary: "Call ended — completing wrap-up.",
  }
}

export function registerAcceptedCallLifecycle(input: {
  acceptedVoiceCallIds: Set<string>
  acceptedSessionIds: Set<string>
  voiceCallId?: string | null
  sessionId?: string | null
}): void {
  if (input.voiceCallId) input.acceptedVoiceCallIds.add(input.voiceCallId)
  if (input.sessionId && !input.sessionId.startsWith("pending-inbound-")) {
    input.acceptedSessionIds.add(input.sessionId)
  }
}

export function registerEndedCallLifecycle(input: {
  endedVoiceCallIds: Set<string>
  voiceCallId?: string | null
}): void {
  if (input.voiceCallId) input.endedVoiceCallIds.add(input.voiceCallId)
}
