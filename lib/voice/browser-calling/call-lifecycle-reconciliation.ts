/** Client-safe call lifecycle reconciliation — prevent sync from downgrading local state. */

import type { NativeCallWorkspaceSessionPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import type { VoiceInboundBrowserOfferView } from "@/lib/voice/browser-calling/types"

export const CALL_LIFECYCLE_RECONCILIATION_QA_MARKER = "call-lifecycle-reconciliation-v3" as const

const NATIVE_SESSION_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isNativeSessionIdServerReady(sessionId: string | null | undefined): boolean {
  if (!sessionId || sessionId.startsWith("pending-inbound-")) return false
  return NATIVE_SESSION_UUID_PATTERN.test(sessionId)
}

/** Prefer the first server-ready native UUID across authority/local/server sources. */
export function resolveAuthoritativeNativeSessionId(input: {
  authoritySessionId?: string | null
  localSessionId?: string | null
  serverSessionId?: string | null
}): string | null {
  for (const id of [input.serverSessionId, input.authoritySessionId, input.localSessionId]) {
    if (isNativeSessionIdServerReady(id)) return id!.trim()
  }
  return input.serverSessionId ?? input.authoritySessionId ?? input.localSessionId ?? null
}

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

export type CallLifecycleLockSnapshot = {
  endedVoiceCallIds: ReadonlySet<string>
  endedSessionIds: ReadonlySet<string>
  completedSessionIds: ReadonlySet<string>
  completedVoiceCallIds: ReadonlySet<string>
}

export function isCallLifecycleEndedLocked(input: {
  voiceCallId?: string | null
  sessionId?: string | null
  locks: CallLifecycleLockSnapshot
}): boolean {
  if (input.sessionId && input.locks.endedSessionIds.has(input.sessionId)) return true
  if (input.sessionId && input.locks.completedSessionIds.has(input.sessionId)) return true
  if (input.voiceCallId && input.locks.endedVoiceCallIds.has(input.voiceCallId)) return true
  if (input.voiceCallId && input.locks.completedVoiceCallIds.has(input.voiceCallId)) return true
  return false
}

/** SDK incoming must not drive workspace phase after local end for the same call. */
export function shouldHonorSdkIncomingForLifecycle(input: {
  sdkIncoming: boolean
  voiceCallId?: string | null
  sessionId?: string | null
  locks: CallLifecycleLockSnapshot
}): boolean {
  if (!input.sdkIncoming) return false
  return !isCallLifecycleEndedLocked({
    voiceCallId: input.voiceCallId,
    sessionId: input.sessionId,
    locks: input.locks,
  })
}

const NATIVE_SESSION_SYNC_PROTECTED_STATUSES = new Set<NativeCallWorkspaceSessionPublicView["status"]>([
  "wrapping",
  "completed",
  "missed",
  "failed",
  "no_answer",
  "cancelled",
])

export function shouldSyncNativeSessionFromVoiceCall(
  sessionStatus: NativeCallWorkspaceSessionPublicView["status"] | null | undefined,
): boolean {
  return sessionStatus != null && !NATIVE_SESSION_SYNC_PROTECTED_STATUSES.has(sessionStatus)
}

export type BrowserSyncWorkspaceSessionPinAuthorityPhase =
  | "idle"
  | "incoming"
  | "accepting"
  | "active"
  | "ending"
  | "wrapup"
  | "completed"

const BROWSER_SYNC_LIVE_PIN_AUTHORITY_PHASES = new Set<BrowserSyncWorkspaceSessionPinAuthorityPhase>([
  "incoming",
  "accepting",
  "active",
])

export function isTerminalNativeSessionStatusForBrowserSync(
  sessionStatus: NativeCallWorkspaceSessionPublicView["status"] | null | undefined,
): boolean {
  return sessionStatus != null && NATIVE_SESSION_SYNC_PROTECTED_STATUSES.has(sessionStatus)
}

/** Only pin a workspace session id on browser sync while the call is genuinely live locally. */
export function resolveWorkspaceSessionPinForBrowserSync(input: {
  authorityPhase: BrowserSyncWorkspaceSessionPinAuthorityPhase
  activeSession: NativeCallWorkspaceSessionPublicView | null
  authoritySessionId: string | null
  lastKnownSessionId: string | null
  locks: CallLifecycleLockSnapshot
}): string | null {
  if (
    input.authorityPhase === "idle" ||
    input.authorityPhase === "ending" ||
    input.authorityPhase === "wrapup" ||
    input.authorityPhase === "completed"
  ) {
    return null
  }

  const candidateId =
    input.activeSession?.id ?? input.authoritySessionId ?? input.lastKnownSessionId ?? null
  if (!candidateId) return null

  const sessionForStatus =
    input.activeSession?.id === candidateId ? input.activeSession : null
  if (isTerminalNativeSessionStatusForBrowserSync(sessionForStatus?.status)) {
    return null
  }

  if (
    isCallLifecycleEndedLocked({
      sessionId: candidateId,
      voiceCallId: sessionForStatus?.voiceCallId ?? null,
      locks: input.locks,
    })
  ) {
    return null
  }

  if (BROWSER_SYNC_LIVE_PIN_AUTHORITY_PHASES.has(input.authorityPhase)) {
    return candidateId
  }

  return input.activeSession?.id ?? null
}

export const RECOVERABLE_BROWSER_SYNC_SESSION_ERRORS = new Set([
  "session_lookup_failed",
  "not_found",
])

const TERMINAL_VOICE_CALL_STATUSES = new Set([
  "completed",
  "canceled",
  "cancelled",
  "failed",
  "busy",
  "no_answer",
])

export function isVoiceCallOfferable(input: {
  status: string | null | undefined
  answeredAt: string | null | undefined
}): boolean {
  if (input.answeredAt) return false
  const status = (input.status ?? "").trim()
  if (!status) return false
  if (TERMINAL_VOICE_CALL_STATUSES.has(status)) return false
  if (status === "in_progress") return false
  return status === "ringing" || status === "queued"
}

export function isTerminalVoiceCallStatus(status: string | null | undefined): boolean {
  return TERMINAL_VOICE_CALL_STATUSES.has((status ?? "").trim())
}

function parseVoiceCallTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Positive when `rightCreatedAt` is newer than `leftCreatedAt`. */
export function compareVoiceCallRecency(
  leftCreatedAt: string | null | undefined,
  rightCreatedAt: string | null | undefined,
): number {
  return parseVoiceCallTimestamp(rightCreatedAt) - parseVoiceCallTimestamp(leftCreatedAt)
}

export function reconcileBrowserSyncInboundSelection(input: {
  activeVoiceCallId: string | null
  workspaceSessionId: string | null
  sessionStatusForSync: NativeCallWorkspaceSessionPublicView["status"] | null
  activeVoiceCallCreatedAt: string | null
  inboundOffer: VoiceInboundBrowserOfferView | null
  baseSelectionReason: string
  inboundSelectionReason: string
}): {
  activeVoiceCallId: string | null
  workspaceSessionId: string | null
  sessionStatusForSync: NativeCallWorkspaceSessionPublicView["status"] | null
  selectionReason: string
} {
  const inboundOffer = input.inboundOffer
  let activeVoiceCallId = input.activeVoiceCallId
  let workspaceSessionId = input.workspaceSessionId
  let sessionStatusForSync = input.sessionStatusForSync
  let selectionReason = input.baseSelectionReason

  if (!inboundOffer) {
    return { activeVoiceCallId, workspaceSessionId, sessionStatusForSync, selectionReason }
  }

  if (!activeVoiceCallId) {
    return {
      activeVoiceCallId: inboundOffer.voiceCallId,
      workspaceSessionId: inboundOffer.workspaceSessionId,
      sessionStatusForSync: "ringing",
      selectionReason: input.inboundSelectionReason,
    }
  }

  if (activeVoiceCallId === inboundOffer.voiceCallId) {
    if (sessionStatusForSync === "ringing" && workspaceSessionId !== inboundOffer.workspaceSessionId) {
      workspaceSessionId = inboundOffer.workspaceSessionId
      selectionReason = "inbound_offer_session_reconciled"
    }
    return { activeVoiceCallId, workspaceSessionId, sessionStatusForSync, selectionReason }
  }

  if (isLiveCallSessionStatus(sessionStatusForSync)) {
    return { activeVoiceCallId, workspaceSessionId, sessionStatusForSync, selectionReason }
  }

  if (sessionStatusForSync === "ringing") {
    const inboundIsNewer =
      compareVoiceCallRecency(input.activeVoiceCallCreatedAt, inboundOffer.voiceCallCreatedAt) > 0
    if (inboundIsNewer) {
      return {
        activeVoiceCallId: inboundOffer.voiceCallId,
        workspaceSessionId: inboundOffer.workspaceSessionId,
        sessionStatusForSync: "ringing",
        selectionReason: "inbound_offer_supersedes_stale_pin",
      }
    }
  }

  return { activeVoiceCallId, workspaceSessionId, sessionStatusForSync, selectionReason }
}
