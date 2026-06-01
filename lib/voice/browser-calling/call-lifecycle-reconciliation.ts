/** Client-safe call lifecycle reconciliation — prevent sync from downgrading local state. */

import type { NativeCallWorkspaceSessionPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import type { VoiceInboundBrowserOfferView } from "@/lib/voice/browser-calling/types"

export const CALL_LIFECYCLE_RECONCILIATION_QA_MARKER = "call-lifecycle-reconciliation-v2" as const

const TERMINAL_SESSION_STATUSES = new Set<NativeCallWorkspaceSessionPublicView["status"]>([
  "completed",
  "failed",
  "missed",
  "no_answer",
  "cancelled",
])

const LIVE_CALL_SESSION_STATUSES = new Set<NativeCallWorkspaceSessionPublicView["status"]>([
  "active",
  "on_hold",
  "external_bridge_pending",
])

const RESURRECTABLE_SERVER_STATUSES = new Set<NativeCallWorkspaceSessionPublicView["status"]>([
  "ringing",
  "active",
  "on_hold",
  "external_bridge_pending",
])

export function isTerminalSessionStatus(
  status: NativeCallWorkspaceSessionPublicView["status"] | null | undefined,
): boolean {
  return status != null && TERMINAL_SESSION_STATUSES.has(status)
}

export function isActiveSessionStatus(
  status: NativeCallWorkspaceSessionPublicView["status"] | null | undefined,
): boolean {
  return status != null && (LIVE_CALL_SESSION_STATUSES.has(status) || status === "wrapping")
}

export function isLiveCallSessionStatus(
  status: NativeCallWorkspaceSessionPublicView["status"] | null | undefined,
): boolean {
  return status != null && LIVE_CALL_SESSION_STATUSES.has(status)
}

function isSameCallSession(
  local: NativeCallWorkspaceSessionPublicView,
  server: NativeCallWorkspaceSessionPublicView,
): boolean {
  return (
    local.id === server.id ||
    (Boolean(local.voiceCallId) && Boolean(server.voiceCallId) && local.voiceCallId === server.voiceCallId)
  )
}

function shouldIgnoreServerSessionResurrection(input: {
  server: NativeCallWorkspaceSessionPublicView
  endedVoiceCallIds: ReadonlySet<string>
  endedSessionIds: ReadonlySet<string>
  completedSessionIds: ReadonlySet<string>
  completedVoiceCallIds?: ReadonlySet<string>
}): boolean {
  if (input.completedSessionIds.has(input.server.id)) return true
  if (input.endedSessionIds.has(input.server.id)) {
    return RESURRECTABLE_SERVER_STATUSES.has(input.server.status)
  }
  if (input.server.voiceCallId && input.endedVoiceCallIds.has(input.server.voiceCallId)) {
    return RESURRECTABLE_SERVER_STATUSES.has(input.server.status)
  }
  if (input.server.voiceCallId && input.completedVoiceCallIds?.has(input.server.voiceCallId)) {
    return RESURRECTABLE_SERVER_STATUSES.has(input.server.status)
  }
  return false
}

export function shouldApplyInboundOfferToSession(input: {
  offer: VoiceInboundBrowserOfferView
  activeSession: NativeCallWorkspaceSessionPublicView | null
  acceptedVoiceCallIds: ReadonlySet<string>
  acceptedSessionIds: ReadonlySet<string>
  endedVoiceCallIds: ReadonlySet<string>
  endedSessionIds?: ReadonlySet<string>
  completedSessionIds?: ReadonlySet<string>
  completedVoiceCallIds?: ReadonlySet<string>
}): boolean {
  if (input.acceptedVoiceCallIds.has(input.offer.voiceCallId)) return false
  if (input.endedVoiceCallIds.has(input.offer.voiceCallId)) return false
  if (input.acceptedSessionIds.has(input.offer.workspaceSessionId)) return false
  if (input.endedSessionIds?.has(input.offer.workspaceSessionId)) return false
  if (input.completedSessionIds?.has(input.offer.workspaceSessionId)) return false
  if (input.completedVoiceCallIds?.has(input.offer.voiceCallId)) return false

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
  endedSessionIds?: ReadonlySet<string>
  completedSessionIds?: ReadonlySet<string>
  completedVoiceCallIds?: ReadonlySet<string>
}): VoiceInboundBrowserOfferView | null {
  if (!input.offer) return null
  return shouldApplyInboundOfferToSession({
    offer: input.offer,
    activeSession: input.activeSession,
    acceptedVoiceCallIds: input.acceptedVoiceCallIds,
    acceptedSessionIds: input.acceptedSessionIds,
    endedVoiceCallIds: input.endedVoiceCallIds,
    endedSessionIds: input.endedSessionIds,
    completedSessionIds: input.completedSessionIds,
    completedVoiceCallIds: input.completedVoiceCallIds,
  })
    ? input.offer
    : null
}

/** Never downgrade local accept/end/wrap-up state from stale server sync. */
export function mergeServerSessionIntoLocal(input: {
  local: NativeCallWorkspaceSessionPublicView | null
  server: NativeCallWorkspaceSessionPublicView | null
  acceptedSessionIds: ReadonlySet<string>
  endedVoiceCallIds: ReadonlySet<string>
  endedSessionIds?: ReadonlySet<string>
  completedSessionIds?: ReadonlySet<string>
  completedVoiceCallIds?: ReadonlySet<string>
}): NativeCallWorkspaceSessionPublicView | null {
  const { local, server } = input
  if (!server) return local
  if (
    shouldIgnoreServerSessionResurrection({
      server,
      endedVoiceCallIds: input.endedVoiceCallIds,
      endedSessionIds: input.endedSessionIds ?? new Set(),
      completedSessionIds: input.completedSessionIds ?? new Set(),
      completedVoiceCallIds: input.completedVoiceCallIds ?? new Set(),
    })
  ) {
    return local
  }
  if (!local) return server

  if (!isSameCallSession(local, server)) return server

  if (local.status === "wrapping") {
    if (RESURRECTABLE_SERVER_STATUSES.has(server.status)) return local
    if (server.status === "wrapping" || isTerminalSessionStatus(server.status)) return server
    return local
  }

  if (isTerminalSessionStatus(local.status)) {
    return isTerminalSessionStatus(server.status) ? server : local
  }

  const localIsLiveCall = isLiveCallSessionStatus(local.status)
  const serverIsRinging = server.status === "ringing"
  const locallyAccepted =
    input.acceptedSessionIds.has(local.id) ||
    input.acceptedSessionIds.has(server.id)

  if (localIsLiveCall && serverIsRinging && locallyAccepted) {
    return {
      ...server,
      status: local.status,
      connectedAt: local.connectedAt ?? server.connectedAt,
      safeSummary: local.safeSummary || server.safeSummary,
      recordingState: local.recordingState !== "pending" ? local.recordingState : server.recordingState,
    }
  }

  if (localIsLiveCall && isLiveCallSessionStatus(server.status) && locallyAccepted) {
    return {
      ...server,
      status: local.status,
      connectedAt: local.connectedAt ?? server.connectedAt,
      endedAt: local.endedAt ?? server.endedAt,
      durationSeconds: local.durationSeconds ?? server.durationSeconds,
      safeSummary: local.safeSummary || server.safeSummary,
    }
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
  endedSessionIds: Set<string>
  voiceCallId?: string | null
  sessionId?: string | null
}): void {
  if (input.voiceCallId) input.endedVoiceCallIds.add(input.voiceCallId)
  if (input.sessionId && !input.sessionId.startsWith("pending-inbound-")) {
    input.endedSessionIds.add(input.sessionId)
  }
}

export function registerCompletedCallLifecycle(input: {
  completedSessionIds: Set<string>
  completedVoiceCallIds: Set<string>
  voiceCallId?: string | null
  sessionId?: string | null
}): void {
  if (input.voiceCallId) input.completedVoiceCallIds.add(input.voiceCallId)
  if (input.sessionId && !input.sessionId.startsWith("pending-inbound-")) {
    input.completedSessionIds.add(input.sessionId)
  }
}
