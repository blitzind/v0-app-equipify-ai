"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Headphones, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthCallWorkspaceCenterPanel } from "@/components/growth/growth-call-workspace-center-panel"
import { GrowthCallWorkspaceDialerCard } from "@/components/growth/growth-call-workspace-dialer-card"
import { GrowthCallWorkspaceUnifiedContextRail } from "@/components/growth/growth-call-workspace-unified-context-rail"
import { GrowthCallWorkspaceActiveWorkflowStrip } from "@/components/growth/growth-call-workspace-active-workflow-strip"
import { GrowthCallWorkspaceMobileActionBar } from "@/components/growth/growth-call-workspace-mobile-action-bar"
import { GrowthCallWorkspaceQueueCard } from "@/components/growth/growth-call-workspace-queue-card"
import type {
  NativeCallWrapupOutcome,
  NativeCallWrapupPublicView,
  NativeCallWorkspaceDashboard,
  NativeCallWorkspaceSessionPublicView,
  NativeDialerLeadContext,
  NativeDialerQueueItemPublicView,
} from "@/lib/growth/native-dialer/native-dialer-types"
import {
  GROWTH_NATIVE_DIALER_CALL_START_FIX_QA_MARKER,
  GROWTH_NATIVE_DIALER_LAYOUT_QA_MARKER,
  GROWTH_NATIVE_DIALER_QA_MARKER,
  GROWTH_GOOGLE_VOICE_BRIDGE_QA_MARKER,
} from "@/lib/growth/native-dialer/native-dialer-types"
import {
  GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER,
  type CallWorkspaceCoachingMode,
} from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import {
  beginGoogleVoiceBridgeDialFlow,
  GOOGLE_VOICE_BRIDGE_COPY_BLOCKED_TOAST,
  GOOGLE_VOICE_BRIDGE_COPY_SUCCESS_TOAST,
} from "@/lib/growth/native-dialer/native-dialer-bridge"
import { useToast } from "@/hooks/use-toast"
import type { GrowthCallWorkspacePhase } from "@/components/growth/growth-call-workspace-center-panel"
import {
  normalizeDialPhoneDigits,
  normalizeDialPhoneForApi,
  optionalUuid,
} from "@/lib/growth/native-dialer/native-dialer-workspace-ui"
import { useVoiceBrowserCalling } from "@/hooks/voice/use-voice-browser-calling"
import {
  buildInboundRingingSessionFromOffer,
  buildInboundRingingSessionPlaceholder,
} from "@/lib/voice/browser-calling/browser-incoming-call"
import {
  INBOUND_RING_DIAG_EVENTS,
  logInboundRingDiagnostic,
  withInboundRingElapsed,
  inboundRingElapsedMs,
} from "@/lib/voice/browser-calling/inbound-ring-diagnostics"
import { mapBrowserCallStateLabel } from "@/lib/voice/browser-calling/status-mapping"
import { VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER } from "@/lib/voice/browser-calling/types"
import { VOICE_TRANSFER_CONTROL_QA_MARKER } from "@/lib/voice/transfer-control/types"
import { VOICE_MEDIA_STREAMING_QA_MARKER } from "@/lib/voice/media-streaming/types"
import { VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER } from "@/lib/voice/intelligence/types"
import { VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER } from "@/lib/growth/operator-assist/types"
import { VOICE_RELATIONSHIP_MEMORY_QA_MARKER } from "@/lib/voice/relationship-memory/types"
import { VOICE_REVENUE_INTELLIGENCE_QA_MARKER } from "@/lib/voice/revenue-intelligence/types"
import { VOICE_RETENTION_INTELLIGENCE_QA_MARKER } from "@/lib/voice/retention-intelligence/types"
import { VOICE_AI_COPILOT_QA_MARKER, VOICE_DEEP_COPILOT_QA_MARKER } from "@/lib/voice/ai-copilot/types"
import { VOICE_AI_RECEPTIONIST_QA_MARKER } from "@/lib/voice/ai-receptionist/types"
import { VOICE_MISSED_CALL_RECOVERY_QA_MARKER } from "@/lib/voice/missed-call-recovery/types"
import { VOICE_UNIFIED_OPERATOR_WORKSPACE_UX_QA_MARKER } from "@/lib/voice/workspace-context/types"
import { buildWorkspaceContextInputFromVoiceSnapshot } from "@/lib/voice/workspace-context/snapshot-input-mapper"
import { buildWorkspaceContextSnapshot } from "@/lib/voice/workspace-context/workspace-context-builder"
import type { ConversationCoachTurn } from "@/lib/growth/live-coaching/types"
import {
  mergeOperatorAssistPreferringNewerCoach,
  pickDisplayOperatorAssistSnapshot,
} from "@/lib/growth/operator-assist/resolve-say-this-next"
import {
  buildOptimisticActiveInboundSession,
} from "@/lib/growth/live-coaching/optimistic-inbound-answer"
import type { CallWorkspaceAnswerPipelineDiagnostics } from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import {
  CALL_WORKSPACE_COACHING_LINK_FAILED_COPY,
  CALL_WORKSPACE_MEDIA_STREAM_RESTART_FAILED_COPY,
} from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import {
  applyServerSessionUnderAuthority,
  createInitialCallLifecycleAuthority,
  mapAuthorityToWorkspacePhase,
  shouldClearSessionOnIncomingCleared,
  shouldHydrateInboundOfferUnderAuthority,
  transitionCallLifecycleAuthority,
  type CallLifecycleAuthorityState,
} from "@/lib/voice/browser-calling/call-lifecycle-authority"
import {
  buildOptimisticWrappingSession,
  filterInboundOfferForLifecycle,
  isCallLifecycleEndedLocked,
  isNativeSessionIdServerReady,
  registerAcceptedCallLifecycle,
  registerCompletedCallLifecycle,
  registerEndedCallLifecycle,
  shouldApplyInboundOfferToSession,
  type CallLifecycleLockSnapshot,
} from "@/lib/voice/browser-calling/call-lifecycle-reconciliation"

const CALLS_END_CLIENT_TIMEOUT_MS = 12_000
const LIVE_COACHING_AUTO_START_QA_MARKER = "growth-live-coaching-auto-start-qa-v1" as const

function logLiveCoachingAutoStartQa(event: string, details: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      source: "growth-call-workspace",
      qaMarker: LIVE_COACHING_AUTO_START_QA_MARKER,
      event,
      ts: new Date().toISOString(),
      ...details,
    }),
  )
}

function isClientFetchAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true
  if (error instanceof Error && /aborted/i.test(error.message)) return true
  return false
}

export function GrowthCallWorkspace({ hidePageHeader = false }: { hidePageHeader?: boolean }) {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const initialLeadId = searchParams.get("leadId")
  const initialPhone = searchParams.get("phone")
  const initialQueueItemId = searchParams.get("queueItemId")

  const [dashboard, setDashboard] = useState<NativeCallWorkspaceDashboard | null>(null)
  const [queue, setQueue] = useState<NativeDialerQueueItemPublicView[]>([])
  const [activeSession, setActiveSession] = useState<NativeCallWorkspaceSessionPublicView | null>(null)
  const [leadContext, setLeadContext] = useState<NativeDialerLeadContext | null>(null)
  const [phone, setPhone] = useState(() => normalizeDialPhoneDigits(initialPhone ?? ""))
  const [loading, setLoading] = useState(true)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [setupWarning, setSetupWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [submittingWrapup, setSubmittingWrapup] = useState(false)
  const [dialingQueueId, setDialingQueueId] = useState<string | null>(null)
  const [answering, setAnswering] = useState(false)
  const [optimisticCoachTurn, setOptimisticCoachTurn] = useState<ConversationCoachTurn | null>(null)
  const [answerPipelineDiagnostic, setAnswerPipelineDiagnostic] = useState<string | null>(null)
  const [mediaStreamDiagnostic, setMediaStreamDiagnostic] = useState<string | null>(null)
  const [declining, setDeclining] = useState(false)
  const [markingBridgeStarted, setMarkingBridgeStarted] = useState(false)
  const [coachingStartSignal, setCoachingStartSignal] = useState(0)
  const [coachingMode, setCoachingMode] = useState<CallWorkspaceCoachingMode>("transcript_only")
  const [leadLinked, setLeadLinked] = useState(false)
  const [transferTarget, setTransferTarget] = useState("")
  const [callActionPending, setCallActionPending] = useState(false)
  const [contextRailExpanded, setContextRailExpanded] = useState(false)
  const [deepIntelligenceExpanded, setDeepIntelligenceExpanded] = useState(false)
  const lastInboundOfferVoiceCallIdRef = useRef<string | null>(null)
  const lastRenderedIncomingSessionIdRef = useRef<string | null>(null)
  const suppressedInboundOfferVoiceCallIdRef = useRef<string | null>(null)
  const acceptedVoiceCallIdsRef = useRef(new Set<string>())
  const acceptedSessionIdsRef = useRef(new Set<string>())
  const endedVoiceCallIdsRef = useRef(new Set<string>())
  const endedSessionIdsRef = useRef(new Set<string>())
  const completedSessionIdsRef = useRef(new Set<string>())
  const completedVoiceCallIdsRef = useRef(new Set<string>())
  const endCallInFlightRef = useRef(false)
  const wrapupInFlightSessionIdRef = useRef<string | null>(null)
  const wrapupConfirmedSessionIdsRef = useRef(new Set<string>())
  const callsEndRetryEpochRef = useRef(0)
  const callsEndBackgroundRetryRef = useRef<AbortController | null>(null)
  const lastKnownSessionRef = useRef<NativeCallWorkspaceSessionPublicView | null>(null)
  const operatorAssistStableRef = useRef<import("@/lib/growth/operator-assist/types").UnifiedOperatorAssistSnapshot | null>(null)
  const idleWorkspaceContextRef = useRef<import("@/lib/voice/workspace-context/types").VoiceWorkspaceContextSnapshot | null>(null)
  const idleWorkspaceContextKeyRef = useRef<string | null>(null)
  const [callAuthority, setCallAuthority] = useState<CallLifecycleAuthorityState>(
    createInitialCallLifecycleAuthority,
  )
  const callAuthorityRef = useRef(callAuthority)
  callAuthorityRef.current = callAuthority
  const hasLiveSdkCallRef = useRef(false)

  const getLifecycleLocks = useCallback((): CallLifecycleLockSnapshot => {
    return {
      endedVoiceCallIds: endedVoiceCallIdsRef.current,
      endedSessionIds: endedSessionIdsRef.current,
      completedSessionIds: completedSessionIdsRef.current,
      completedVoiceCallIds: completedVoiceCallIdsRef.current,
    }
  }, [])

  function clearLifecycleLocksForAnsweredSession(session: NativeCallWorkspaceSessionPublicView): void {
    endedSessionIdsRef.current.delete(session.id)
    completedSessionIdsRef.current.delete(session.id)
    if (session.voiceCallId) {
      endedVoiceCallIdsRef.current.delete(session.voiceCallId)
      completedVoiceCallIdsRef.current.delete(session.voiceCallId)
    }
  }

  function isAuthoritativeLinkedAnswerResponse(input: {
    session: NativeCallWorkspaceSessionPublicView
    pipeline?: CallWorkspaceAnswerPipelineDiagnostics
  }): boolean {
    return (
      input.session.direction === "inbound" &&
      (input.session.status === "active" || input.session.status === "on_hold") &&
      Boolean(input.session.realtimeSessionId) &&
      input.pipeline?.liveCoachingLinked === true &&
      Boolean(input.pipeline.realtimeSessionId)
    )
  }

  const applyServerSession = useCallback(
    (server: NativeCallWorkspaceSessionPublicView | null | undefined) => {
      logLiveCoachingAutoStartQa("applyServerSession", {
        sessionId: server?.id ?? null,
        voiceCallId: server?.voiceCallId ?? null,
        status: server?.status ?? null,
        direction: server?.direction ?? null,
        realtimeSessionId: server?.realtimeSessionId ?? null,
      })
      if (server?.id && wrapupConfirmedSessionIdsRef.current.has(server.id)) {
        return
      }
      const locks = getLifecycleLocks()
      setActiveSession((prev) => {
        const next = applyServerSessionUnderAuthority({
          local: prev,
          server: server ?? null,
          authority: callAuthorityRef.current,
          acceptedSessionIds: acceptedSessionIdsRef.current,
          endedVoiceCallIds: locks.endedVoiceCallIds,
          endedSessionIds: locks.endedSessionIds,
          completedSessionIds: locks.completedSessionIds,
          completedVoiceCallIds: locks.completedVoiceCallIds,
        })
        if (next) lastKnownSessionRef.current = next
        return next
      })
    },
    [getLifecycleLocks],
  )

  const clearStaleRingingSession = useCallback((reason: string) => {
    logInboundRingDiagnostic(INBOUND_RING_DIAG_EVENTS.INBOUND_OFFER_CLEARED, { reason })
    lastInboundOfferVoiceCallIdRef.current = null
    setActiveSession((prev) => (prev?.status === "ringing" ? null : prev))
  }, [])

  const handleSdkCallDisconnected = useCallback(
    (event: { reason: string; callSid: string | null }) => {
      const session = lastKnownSessionRef.current
      registerEndedCallLifecycle({
        endedVoiceCallIds: endedVoiceCallIdsRef.current,
        endedSessionIds: endedSessionIdsRef.current,
        voiceCallId: session?.voiceCallId ?? callAuthorityRef.current.voiceCallId,
        sessionId: session?.id ?? callAuthorityRef.current.sessionId,
      })
      setCallAuthority((prev) => transitionCallLifecycleAuthority(prev, { type: "sdk_disconnected", reason: event.reason }))
      setOptimisticCoachTurn(null)
      setActiveSession((prev) => {
        const base = prev ?? lastKnownSessionRef.current
        if (!base) return prev
        const endedAt = new Date().toISOString()
        const wrapped = buildOptimisticWrappingSession(base, endedAt)
        lastKnownSessionRef.current = wrapped
        return wrapped
      })
    },
    [],
  )

  const handleIncomingCleared = useCallback(
    (reason: string) => {
      if (
        !shouldClearSessionOnIncomingCleared({
          authority: callAuthorityRef.current,
          hasLiveSdkCall: hasLiveSdkCallRef.current,
          reason,
        })
      ) {
        return
      }
      if (lastInboundOfferVoiceCallIdRef.current) {
        suppressedInboundOfferVoiceCallIdRef.current = lastInboundOfferVoiceCallIdRef.current
      }
      clearStaleRingingSession(`sdk_${reason}`)
    },
    [clearStaleRingingSession],
  )

  const load = useCallback(async (options?: { background?: boolean }) => {
    if (!options?.background) setLoading(true)
    setError(null)
    try {
      const [dashRes, queueRes] = await Promise.all([
        fetch("/api/platform/growth/calls/dashboard", { cache: "no-store" }),
        fetch("/api/platform/growth/calls/queue", { cache: "no-store" }),
      ])
      const dashData = (await dashRes.json().catch(() => ({}))) as {
        workspaceDashboard?: NativeCallWorkspaceDashboard | null
        meta?: {
          schemaReady?: boolean
          probeUncertain?: boolean
          setupMessage?: string
        }
      }
      const queueData = (await queueRes.json().catch(() => ({}))) as { queue?: NativeDialerQueueItemPublicView[] }

      if (dashData.meta?.schemaReady === false) {
        setSetupMessage(dashData.meta.setupMessage ?? null)
        setSetupWarning(null)
        setDashboard(null)
      } else {
        setSetupMessage(null)
        setSetupWarning(
          dashData.meta?.probeUncertain ? dashData.meta.setupMessage ?? null : null,
        )
        setDashboard(dashData.workspaceDashboard ?? null)
        applyServerSession(dashData.workspaceDashboard?.activeSession ?? null)
      }
      setQueue(queueData.queue ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load call workspace.")
    } finally {
      if (!options?.background) setLoading(false)
    }
  }, [applyServerSession])

  const loadLeadContext = useCallback(async (leadId: string) => {
    const res = await fetch(`/api/platform/growth/calls/workspace/lead/${leadId}`, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as { leadContext?: NativeDialerLeadContext | null }
    setLeadContext(data.leadContext ?? null)
    if (data.leadContext?.contactPhone && !phone) {
      setPhone(normalizeDialPhoneDigits(data.leadContext.contactPhone))
    }
  }, [phone])

  const lifecycleLocks = getLifecycleLocks()
  const syncWorkspaceSessionId =
    callAuthority.phase === "active" ||
    callAuthority.phase === "accepting" ||
    callAuthority.phase === "incoming"
      ? activeSession?.id ?? callAuthority.sessionId ?? lastKnownSessionRef.current?.id ?? null
      : activeSession &&
          (activeSession.status === "wrapping" ||
            activeSession.status === "completed" ||
            isCallLifecycleEndedLocked({
              sessionId: activeSession.id,
              voiceCallId: activeSession.voiceCallId,
              locks: lifecycleLocks,
            }))
        ? null
        : activeSession?.id ?? null

  const voiceBrowser = useVoiceBrowserCalling({
    workspaceSessionId: syncWorkspaceSessionId,
    onIncomingCleared: handleIncomingCleared,
    onSdkCallDisconnected: handleSdkCallDisconnected,
  })
  hasLiveSdkCallRef.current = voiceBrowser.hasLiveSdkCall

  const inboundOfferRaw = voiceBrowser.snapshot?.inboundRinging ?? null
  const inboundOffer = useMemo(() => {
    if (
      !shouldHydrateInboundOfferUnderAuthority({
        authority: callAuthority,
        hasLiveSdkCall: voiceBrowser.hasLiveSdkCall,
      })
    ) {
      return null
    }
    return filterInboundOfferForLifecycle({
      offer: inboundOfferRaw,
      activeSession,
      acceptedVoiceCallIds: acceptedVoiceCallIdsRef.current,
      acceptedSessionIds: acceptedSessionIdsRef.current,
      endedVoiceCallIds: endedVoiceCallIdsRef.current,
      endedSessionIds: endedSessionIdsRef.current,
      completedSessionIds: completedSessionIdsRef.current,
      completedVoiceCallIds: completedVoiceCallIdsRef.current,
    })
  }, [activeSession, inboundOfferRaw, callAuthority, voiceBrowser.hasLiveSdkCall])

  const hasSdkIncoming = voiceBrowser.hasSdkIncoming

  useEffect(() => {
    if (voiceBrowser.sdkCallPhase === "incoming") {
      setCallAuthority((prev) =>
        transitionCallLifecycleAuthority(prev, {
          type: "sdk_incoming",
          callSid: voiceBrowser.incomingCall?.callSid ?? null,
          voiceCallId: inboundOffer?.voiceCallId ?? voiceBrowser.snapshot?.activeVoiceCallId ?? prev.voiceCallId,
          sessionId: inboundOffer?.workspaceSessionId ?? voiceBrowser.snapshot?.workspaceSessionId ?? prev.sessionId,
        }),
      )
    }
  }, [
    voiceBrowser.sdkCallPhase,
    voiceBrowser.incomingCall?.callSid,
    inboundOffer?.voiceCallId,
    inboundOffer?.workspaceSessionId,
    voiceBrowser.snapshot?.activeVoiceCallId,
    voiceBrowser.snapshot?.workspaceSessionId,
  ])

  useEffect(() => {
    if (voiceBrowser.sdkCallPhase === "active" && callAuthority.phase !== "active" && callAuthority.phase !== "ending" && callAuthority.phase !== "wrapup") {
      setCallAuthority((prev) =>
        transitionCallLifecycleAuthority(prev, {
          type: "sdk_accept_succeeded",
          callSid: voiceBrowser.incomingCall?.callSid ?? prev.callSid,
          connectedAt: activeSession?.connectedAt ?? prev.connectedAt ?? new Date().toISOString(),
        }),
      )
    }
  }, [voiceBrowser.sdkCallPhase, callAuthority.phase, voiceBrowser.incomingCall?.callSid, activeSession?.connectedAt])

  useEffect(() => {
    const offer = inboundOffer
    if (!offer) {
      if (
        !inboundOfferRaw &&
        lastInboundOfferVoiceCallIdRef.current &&
        shouldClearSessionOnIncomingCleared({
          authority: callAuthority,
          hasLiveSdkCall: voiceBrowser.hasLiveSdkCall,
          reason: "sync_offer_cleared",
        })
      ) {
        clearStaleRingingSession("sync_offer_cleared")
      }
      return
    }

    if (offer.voiceCallId === suppressedInboundOfferVoiceCallIdRef.current) {
      return
    }

    const isNewOffer = lastInboundOfferVoiceCallIdRef.current !== offer.voiceCallId
    if (isNewOffer) {
      logInboundRingDiagnostic(
        INBOUND_RING_DIAG_EVENTS.INBOUND_OFFER_RECEIVED,
        withInboundRingElapsed(offer.voiceCallCreatedAt, {
          voice_call_id: offer.voiceCallId,
          native_session_id: offer.workspaceSessionId,
          from_number: offer.fromNumber,
        }),
      )
      const latencyMs = inboundRingElapsedMs(offer.voiceCallCreatedAt)
      if (latencyMs !== null) {
        logInboundRingDiagnostic(INBOUND_RING_DIAG_EVENTS.INBOUND_OFFER_LATENCY_MS, {
          voice_call_id: offer.voiceCallId,
          native_session_id: offer.workspaceSessionId,
          inbound_offer_latency_ms: latencyMs,
          elapsed_ms_since_voice_call_created: latencyMs,
        })
      }
      lastInboundOfferVoiceCallIdRef.current = offer.voiceCallId
      setCallAuthority((prev) =>
        transitionCallLifecycleAuthority(prev, {
          type: "bind_session",
          voiceCallId: offer.voiceCallId,
          sessionId: offer.workspaceSessionId,
        }),
      )
    }

    setActiveSession((prev) => {
      if (
        !shouldApplyInboundOfferToSession({
          offer,
          activeSession: prev,
          acceptedVoiceCallIds: acceptedVoiceCallIdsRef.current,
          acceptedSessionIds: acceptedSessionIdsRef.current,
          endedVoiceCallIds: endedVoiceCallIdsRef.current,
          endedSessionIds: endedSessionIdsRef.current,
          completedSessionIds: completedSessionIdsRef.current,
          completedVoiceCallIds: completedVoiceCallIdsRef.current,
        }) ||
        !shouldHydrateInboundOfferUnderAuthority({
          authority: callAuthority,
          hasLiveSdkCall: voiceBrowser.hasLiveSdkCall,
        })
      ) {
        return prev
      }
      const next = buildInboundRingingSessionFromOffer(offer)
      if (
        prev?.id === next.id &&
        prev.status === "ringing" &&
        prev.voiceCallId === next.voiceCallId
      ) {
        return prev
      }
      lastKnownSessionRef.current = next
      return next
    })
  }, [callAuthority, clearStaleRingingSession, inboundOffer, inboundOfferRaw, voiceBrowser.hasLiveSdkCall])

  const incomingSession = useMemo((): NativeCallWorkspaceSessionPublicView | null => {
    if (callAuthority.phase !== "incoming" && callAuthority.phase !== "idle") return null
    if (activeSession?.status === "ringing") return activeSession
    if (voiceBrowser.hasLiveSdkCall) return null
    if (!hasSdkIncoming || !voiceBrowser.incomingCall) return null
    return buildInboundRingingSessionPlaceholder({
      incomingCall: voiceBrowser.incomingCall,
      inboundOffer,
      workspaceSessionId: voiceBrowser.snapshot?.workspaceSessionId ?? null,
      voiceCallId: voiceBrowser.snapshot?.activeVoiceCallId ?? inboundOffer?.voiceCallId ?? null,
    })
  }, [
    activeSession,
    callAuthority.phase,
    hasSdkIncoming,
    inboundOffer,
    voiceBrowser.hasLiveSdkCall,
    voiceBrowser.incomingCall,
    voiceBrowser.snapshot,
  ])

  const displaySession =
    callAuthority.phase === "incoming"
      ? incomingSession ?? activeSession
      : activeSession ?? lastKnownSessionRef.current

  const workspacePhase = useMemo((): GrowthCallWorkspacePhase => {
    return mapAuthorityToWorkspacePhase({
      authority: callAuthority,
      bridgeSession: activeSession?.status === "external_bridge_pending",
    })
  }, [activeSession?.status, callAuthority])

  const displayOperatorAssist = useMemo(() => {
    if (workspacePhase === "idle") return null
    return pickDisplayOperatorAssistSnapshot(
      operatorAssistStableRef.current,
      voiceBrowser.snapshot?.operatorAssist ?? null,
    )
  }, [voiceBrowser.snapshot?.operatorAssist, workspacePhase])

  useEffect(() => {
    if (workspacePhase !== "incoming") {
      lastRenderedIncomingSessionIdRef.current = null
      return
    }
    const sessionId = displaySession?.id
    if (!sessionId || lastRenderedIncomingSessionIdRef.current === sessionId) return
    lastRenderedIncomingSessionIdRef.current = sessionId
    logInboundRingDiagnostic(
      INBOUND_RING_DIAG_EVENTS.INBOUND_OFFER_RENDERED,
      withInboundRingElapsed(inboundOffer?.voiceCallCreatedAt ?? null, {
        session_id: sessionId,
        native_session_id: sessionId,
        voice_call_id: displaySession?.voiceCallId ?? null,
        source: hasSdkIncoming ? "sdk" : "sync_offer",
      }),
    )
  }, [displaySession?.id, displaySession?.voiceCallId, hasSdkIncoming, inboundOffer?.voiceCallCreatedAt, workspacePhase])

  useEffect(() => {
    if (!optimisticCoachTurn) return
    if (voiceBrowser.snapshot?.operatorAssist?.coachingState?.primaryCoach) {
      setOptimisticCoachTurn(null)
    }
  }, [optimisticCoachTurn, voiceBrowser.snapshot?.operatorAssist?.coachingState?.primaryCoach])

  const voiceCallId =
    voiceBrowser.snapshot?.activeVoiceCallId ??
    activeSession?.voiceCallId ??
    inboundOffer?.voiceCallId ??
    null
  const operatorParticipant =
    voiceBrowser.snapshot?.participants.find((participant) => participant.participantRole === "operator") ??
    voiceBrowser.snapshot?.participants[0] ??
    null
  const sessionMuted = activeSession?.muted ?? false
  const sessionOnHold = activeSession?.onHold ?? false

  useEffect(() => {
    if (activeSession?.transferTarget && !transferTarget) {
      setTransferTarget(activeSession.transferTarget)
    }
  }, [activeSession?.transferTarget, transferTarget])

  async function postCallControl(path: string, body: Record<string, unknown>) {
    if (!voiceCallId) throw new Error("No canonical voice call linked to this workspace session.")
    const res = await fetch(`/api/platform/growth/voice/calls/${voiceCallId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { message?: string; ok?: boolean }
    if (!res.ok || !data.ok) throw new Error(data.message ?? "Call control action failed.")
    await voiceBrowser.refresh()
    await load({ background: true })
  }

  async function toggleMute() {
    setCallActionPending(true)
    setError(null)
    try {
      await postCallControl("participants/mute", {
        ...(operatorParticipant ? { participantId: operatorParticipant.id } : {}),
        muted: !sessionMuted,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mute action failed.")
    } finally {
      setCallActionPending(false)
    }
  }

  async function toggleHold() {
    setCallActionPending(true)
    setError(null)
    try {
      await postCallControl("participants/hold", {
        ...(operatorParticipant ? { participantId: operatorParticipant.id } : {}),
        hold: !sessionOnHold,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hold action failed.")
    } finally {
      setCallActionPending(false)
    }
  }

  async function startTransfer() {
    const target = transferTarget.trim()
    if (!target) {
      setError("Enter a transfer target before starting transfer.")
      return
    }
    setCallActionPending(true)
    setError(null)
    try {
      const isClientIdentity = target.startsWith("org_")
      await postCallControl("transfer/start", {
        transferKind: "cold",
        ...(isClientIdentity ? { targetClientIdentity: target } : { targetPhoneNumber: target }),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed.")
    } finally {
      setCallActionPending(false)
    }
  }

  useEffect(() => {
    logLiveCoachingAutoStartQa("final_activeSession_observed", {
      sessionId: activeSession?.id ?? null,
      voiceCallId: activeSession?.voiceCallId ?? null,
      status: activeSession?.status ?? null,
      direction: activeSession?.direction ?? null,
      realtimeSessionId: activeSession?.realtimeSessionId ?? null,
      workspacePhase,
    })
  }, [
    activeSession?.id,
    activeSession?.voiceCallId,
    activeSession?.status,
    activeSession?.direction,
    activeSession?.realtimeSessionId,
    workspacePhase,
  ])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (initialLeadId) void loadLeadContext(initialLeadId)
  }, [initialLeadId, loadLeadContext])

  const workspaceContext = useMemo(() => {
    if (workspacePhase === "idle") {
      const idleKey = leadContext?.leadId ?? "none"
      if (idleWorkspaceContextRef.current && idleWorkspaceContextKeyRef.current === idleKey) {
        return idleWorkspaceContextRef.current
      }
      const input = buildWorkspaceContextInputFromVoiceSnapshot({
        callPhase: "idle",
        startingCall: false,
        leadLinked,
        operatorAssist: null,
        aiCopilot: null,
        aiReceptionist: null,
        missedCallRecovery: null,
        hasActiveTransfer: false,
        relationshipSummary: leadContext
          ? `${leadContext.companyName ?? "Account"} · ${leadContext.contactName ?? "Contact"}`
          : null,
        preferredChannel: "voice",
        workflowStatusLabel: "Ready",
      })
      const snapshot = buildWorkspaceContextSnapshot(input)
      idleWorkspaceContextRef.current = snapshot
      idleWorkspaceContextKeyRef.current = idleKey
      return snapshot
    }

    idleWorkspaceContextRef.current = null
    idleWorkspaceContextKeyRef.current = null
    const operatorAssistSnapshot = displayOperatorAssist
    const input = buildWorkspaceContextInputFromVoiceSnapshot({
      callPhase: workspacePhase,
      startingCall: starting,
      leadLinked,
      operatorAssist: operatorAssistSnapshot,
      aiCopilot: voiceBrowser.snapshot?.aiCopilot ?? null,
      aiReceptionist: voiceBrowser.snapshot?.aiReceptionist ?? null,
      missedCallRecovery: voiceBrowser.snapshot?.missedCallRecovery ?? null,
      hasActiveTransfer: Boolean(voiceBrowser.snapshot?.activeTransfer),
      relationshipSummary: leadContext
        ? `${leadContext.companyName ?? "Account"} · ${leadContext.contactName ?? "Contact"}`
        : null,
      preferredChannel: "voice",
      workflowStatusLabel: workspacePhase === "idle" ? "Ready" : workspacePhase,
    })
    return buildWorkspaceContextSnapshot(input)
  }, [workspacePhase, starting, leadLinked, leadContext, voiceBrowser.snapshot, displayOperatorAssist])

  useEffect(() => {
    const nextAssist = voiceBrowser.snapshot?.operatorAssist ?? null
    if (
      nextAssist &&
      (callAuthority.phase === "active" ||
        callAuthority.phase === "accepting" ||
        callAuthority.phase === "wrapup" ||
        callAuthority.phase === "ending")
    ) {
      operatorAssistStableRef.current = mergeOperatorAssistPreferringNewerCoach(
        operatorAssistStableRef.current,
        nextAssist,
      )
      return
    }
    if (callAuthority.phase === "idle" || callAuthority.phase === "completed") {
      operatorAssistStableRef.current = null
      idleWorkspaceContextRef.current = null
      idleWorkspaceContextKeyRef.current = null
    }
  }, [voiceBrowser.snapshot?.operatorAssist, callAuthority.phase])

  useEffect(() => {
    if (workspaceContext.contextRailExpanded) {
      setContextRailExpanded(true)
      return
    }
    if (workspacePhase === "active" || workspacePhase === "bridge_pending") {
      setContextRailExpanded(false)
    }
  }, [workspaceContext.contextRailExpanded, workspaceContext.mode, workspacePhase])

  async function startCall(input?: { phoneNumber?: string; leadId?: string | null; queueItemId?: string | null }) {
    const phoneNumber = normalizeDialPhoneForApi(input?.phoneNumber ?? phone)
    if (!phoneNumber) {
      setError("Enter a valid phone number with at least 3 digits.")
      return
    }

    setStarting(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/calls/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber,
          leadId: optionalUuid(input?.leadId ?? initialLeadId),
          queueItemId: optionalUuid(input?.queueItemId ?? initialQueueItemId),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        session?: NativeCallWorkspaceSessionPublicView
        message?: string
      }
      if (!res.ok || !data.session) throw new Error(data.message ?? "Could not start call.")
      applyServerSession(data.session)
      if (data.session.status === "external_bridge_pending") {
        const { copied } = await beginGoogleVoiceBridgeDialFlow(data.session.phoneNumber)
        toast({
          title: copied ? GOOGLE_VOICE_BRIDGE_COPY_SUCCESS_TOAST : GOOGLE_VOICE_BRIDGE_COPY_BLOCKED_TOAST,
        })
      }
      if (data.session.leadId) {
        setLeadLinked(true)
        setCoachingMode("lead_linked")
        void loadLeadContext(data.session.leadId)
      } else {
        setLeadLinked(false)
        setCoachingMode("transcript_only")
        setLeadContext(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Start failed.")
    } finally {
      setStarting(false)
      setDialingQueueId(null)
    }
  }

  async function markBridgeStarted() {
    if (!activeSession) return
    setMarkingBridgeStarted(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/calls/bridge-started", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        session?: NativeCallWorkspaceSessionPublicView
        message?: string
      }
      if (!res.ok || !data.session) throw new Error(data.message ?? "Could not mark call started.")
      applyServerSession(data.session)
      if (data.session.leadId) {
        setLeadLinked(true)
        setCoachingMode("lead_linked")
        void loadLeadContext(data.session.leadId)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mark call started failed.")
    } finally {
      setMarkingBridgeStarted(false)
    }
  }

  function cancelCallsEndBackgroundRetry() {
    callsEndRetryEpochRef.current += 1
    callsEndBackgroundRetryRef.current?.abort()
    callsEndBackgroundRetryRef.current = null
  }

  function scheduleCallsEndBackgroundRetry(sessionId: string, retryEpoch: number) {
    callsEndBackgroundRetryRef.current?.abort()
    const controller = new AbortController()
    callsEndBackgroundRetryRef.current = controller
    void fetch("/api/platform/growth/calls/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (retryEpoch !== callsEndRetryEpochRef.current) return
        if (wrapupConfirmedSessionIdsRef.current.has(sessionId)) return
        if (completedSessionIdsRef.current.has(sessionId)) return
        if (!res.ok) return
        const data = (await res.json().catch(() => ({}))) as { session?: NativeCallWorkspaceSessionPublicView }
        if (data.session) applyServerSession(data.session)
      })
      .catch((error) => {
        if (isClientFetchAbortError(error)) return
        console.warn("[growth-call-workspace] POST /api/platform/growth/calls/end background retry failed", {
          sessionId,
          message: error instanceof Error ? error.message : String(error),
        })
      })
  }

  function finalizeWrapupLocally(input: { sessionId: string; voiceCallId?: string | null }) {
    registerCompletedCallLifecycle({
      completedSessionIds: completedSessionIdsRef.current,
      completedVoiceCallIds: completedVoiceCallIdsRef.current,
      sessionId: input.sessionId,
      voiceCallId: input.voiceCallId,
    })
    wrapupConfirmedSessionIdsRef.current.add(input.sessionId)
    cancelCallsEndBackgroundRetry()
    setCallAuthority((prev) => transitionCallLifecycleAuthority(prev, { type: "wrapup_confirmed" }))
    setActiveSession(null)
    lastKnownSessionRef.current = null
    operatorAssistStableRef.current = null
    idleWorkspaceContextRef.current = null
    idleWorkspaceContextKeyRef.current = null
  }

  async function persistWrapupWithRetry(
    payload: Record<string, unknown>,
    sessionId: string,
  ): Promise<NativeCallWrapupPublicView | null> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await fetch("/api/platform/growth/calls/wrapup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = (await res.json().catch(() => ({}))) as { wrapup?: NativeCallWrapupPublicView; message?: string }
        if (res.ok && data.wrapup) return data.wrapup
        if (attempt === 2) {
          console.warn("[growth-call-workspace] POST /api/platform/growth/calls/wrapup failed after retries", {
            sessionId,
            status: res.status,
            message: data.message ?? null,
          })
        }
      } catch (error) {
        if (attempt === 2) {
          console.warn("[growth-call-workspace] POST /api/platform/growth/calls/wrapup request failed after retries", {
            sessionId,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 800 * (attempt + 1)))
    }
    return null
  }

  async function endCall() {
    const sessionToEnd = activeSession ?? incomingSession ?? lastKnownSessionRef.current
    if (!sessionToEnd && !voiceBrowser.hasLiveSdkCall) return
    if (sessionToEnd?.status === "wrapping" || sessionToEnd?.status === "completed") return
    if (endCallInFlightRef.current) return

    endCallInFlightRef.current = true
    setError(null)
    const endedAt = new Date().toISOString()
    const endTarget = sessionToEnd ?? lastKnownSessionRef.current
    registerEndedCallLifecycle({
      endedVoiceCallIds: endedVoiceCallIdsRef.current,
      endedSessionIds: endedSessionIdsRef.current,
      voiceCallId: endTarget?.voiceCallId,
      sessionId: endTarget?.id,
    })
    setCallAuthority((prev) =>
      transitionCallLifecycleAuthority(prev, {
        type: "local_end_requested",
        endedAt,
        voiceCallId: endTarget?.voiceCallId ?? prev.voiceCallId,
        sessionId: endTarget?.id ?? prev.sessionId,
      }),
    )
    setOptimisticCoachTurn(null)
    if (endTarget) {
      const wrapped = buildOptimisticWrappingSession(endTarget, endedAt)
      lastKnownSessionRef.current = wrapped
      setActiveSession(wrapped)
    }
    setEnding(false)

    try {
      await voiceBrowser.disconnectActiveCall().catch(() => undefined)
      setCallAuthority((prev) =>
        transitionCallLifecycleAuthority(prev, { type: "sdk_disconnected", reason: "operator_end" }),
      )
      const sessionId = endTarget?.id
      const endRetryEpoch = callsEndRetryEpochRef.current
      if (sessionId && !sessionId.startsWith("pending-inbound-")) {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), CALLS_END_CLIENT_TIMEOUT_MS)
        try {
          const res = await fetch("/api/platform/growth/calls/end", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
            signal: controller.signal,
          })
          const data = (await res.json().catch(() => ({}))) as { session?: NativeCallWorkspaceSessionPublicView }
          if (!res.ok || !data.session) throw new Error("Could not end call.")
          if (
            endRetryEpoch === callsEndRetryEpochRef.current &&
            !wrapupConfirmedSessionIdsRef.current.has(sessionId)
          ) {
            applyServerSession(data.session)
          }
        } finally {
          window.clearTimeout(timeoutId)
        }
      } else if (!endTarget) {
        setCallAuthority((prev) => transitionCallLifecycleAuthority(prev, { type: "sdk_disconnected", reason: "local_end_no_session" }))
      }
    } catch (e) {
      const sessionId = endTarget?.id
      if (isClientFetchAbortError(e) && sessionId && !sessionId.startsWith("pending-inbound-")) {
        console.warn("[growth-call-workspace] POST /api/platform/growth/calls/end aborted after client timeout", {
          sessionId,
          timeoutMs: CALLS_END_CLIENT_TIMEOUT_MS,
        })
        scheduleCallsEndBackgroundRetry(sessionId, callsEndRetryEpochRef.current)
      } else {
        setError(e instanceof Error ? e.message : "End failed.")
      }
    } finally {
      endCallInFlightRef.current = false
    }
  }

  async function reconcileInboundAnswer(input: {
    sessionForAnswer: NativeCallWorkspaceSessionPublicView
    hadSdkIncoming: boolean
  }) {
    logLiveCoachingAutoStartQa("reconcileInboundAnswer_start", {
      sessionId: input.sessionForAnswer.id,
      voiceCallId: input.sessionForAnswer.voiceCallId,
      status: input.sessionForAnswer.status,
      direction: input.sessionForAnswer.direction,
      realtimeSessionId: input.sessionForAnswer.realtimeSessionId,
      hadSdkIncoming: input.hadSdkIncoming,
    })
    if (
      isCallLifecycleEndedLocked({
        sessionId: input.sessionForAnswer.id,
        voiceCallId: input.sessionForAnswer.voiceCallId,
        locks: getLifecycleLocks(),
      })
    ) {
      logLiveCoachingAutoStartQa("reconcileInboundAnswer_skipped_lifecycle_locked", {
        sessionId: input.sessionForAnswer.id,
        voiceCallId: input.sessionForAnswer.voiceCallId,
      })
      return
    }
    try {
      let sessionId = input.sessionForAnswer.id
      if (!sessionId || sessionId.startsWith("pending-inbound-")) {
        logLiveCoachingAutoStartQa("operator_assist_refresh_start", {
          reason: "resolve_pending_inbound_session",
          sessionId,
          voiceCallId: input.sessionForAnswer.voiceCallId,
        })
        const synced = await voiceBrowser.refresh().catch(() => null)
        logLiveCoachingAutoStartQa("operator_assist_refresh_success", {
          reason: "resolve_pending_inbound_session",
          requestedSessionId: sessionId,
          resolvedWorkspaceSessionId: synced?.workspaceSessionId ?? null,
          resolvedInboundRingingSessionId: synced?.inboundRinging?.workspaceSessionId ?? null,
          activeVoiceCallId: synced?.activeVoiceCallId ?? null,
        })
        sessionId =
          synced?.inboundRinging?.workspaceSessionId ??
          synced?.workspaceSessionId ??
          sessionId
      }

      if (sessionId && !sessionId.startsWith("pending-inbound-")) {
        logLiveCoachingAutoStartQa("answer_api_request_start", {
          sessionId,
          voiceCallId: input.sessionForAnswer.voiceCallId,
        })
        const res = await fetch("/api/platform/growth/calls/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          session?: NativeCallWorkspaceSessionPublicView
          pipeline?: CallWorkspaceAnswerPipelineDiagnostics
          message?: string
        }
        logLiveCoachingAutoStartQa("answer_api_response", {
          sessionId,
          httpStatus: res.status,
          ok: res.ok,
          responseSessionId: data.session?.id ?? null,
          responseVoiceCallId: data.session?.voiceCallId ?? null,
          responseStatus: data.session?.status ?? null,
          responseDirection: data.session?.direction ?? null,
          responseRealtimeSessionId: data.session?.realtimeSessionId ?? null,
          liveCoachingLinked: data.pipeline?.liveCoachingLinked ?? null,
          liveCoachingFailureReason: data.pipeline?.liveCoachingFailureReason ?? null,
          realtimeSessionId: data.pipeline?.realtimeSessionId ?? null,
          createdRealtimeSessionId: data.pipeline?.createdRealtimeSessionId ?? null,
          linkResultLinked: data.pipeline?.linkResult?.linked ?? null,
          linkResultReason: data.pipeline?.linkResult?.reason ?? null,
        })
        if (!res.ok || !data.session) throw new Error(data.message ?? "Could not answer call.")
        const answeredSession = data.session
        if (data.pipeline?.liveCoachingLinked) {
          setAnswerPipelineDiagnostic(null)
          setOptimisticCoachTurn(null)
        } else {
          setOptimisticCoachTurn(null)
          setAnswerPipelineDiagnostic(
            data.pipeline?.liveCoachingError ?? CALL_WORKSPACE_COACHING_LINK_FAILED_COPY,
          )
        }
        if (data.pipeline && !data.pipeline.mediaStreamStarted) {
          setMediaStreamDiagnostic(
            data.pipeline.mediaStreamReason ?? CALL_WORKSPACE_MEDIA_STREAM_RESTART_FAILED_COPY,
          )
        } else {
          setMediaStreamDiagnostic(null)
        }
        registerAcceptedCallLifecycle({
          acceptedVoiceCallIds: acceptedVoiceCallIdsRef.current,
          acceptedSessionIds: acceptedSessionIdsRef.current,
          voiceCallId: answeredSession.voiceCallId,
          sessionId: answeredSession.id,
        })
        const authoritativeLinkedAnswer = isAuthoritativeLinkedAnswerResponse({
          session: answeredSession,
          pipeline: data.pipeline,
        })
        const responseLifecycleLocked = isCallLifecycleEndedLocked({
          sessionId: answeredSession.id,
          voiceCallId: answeredSession.voiceCallId,
          locks: getLifecycleLocks(),
        })
        if (responseLifecycleLocked && !authoritativeLinkedAnswer) {
          logLiveCoachingAutoStartQa("reconcileInboundAnswer_skipped_response_lifecycle_locked", {
            sessionId: answeredSession.id,
            voiceCallId: answeredSession.voiceCallId,
            realtimeSessionId: answeredSession.realtimeSessionId,
          })
          return
        }
        if (authoritativeLinkedAnswer) {
          if (responseLifecycleLocked) {
            logLiveCoachingAutoStartQa("reconcileInboundAnswer_cleared_stale_lifecycle_lock", {
              sessionId: answeredSession.id,
              voiceCallId: answeredSession.voiceCallId,
              realtimeSessionId: answeredSession.realtimeSessionId,
            })
          }
          clearLifecycleLocksForAnsweredSession(answeredSession)
          setCallAuthority((prev) => ({
            ...prev,
            phase: "active",
            voiceCallId: answeredSession.voiceCallId ?? prev.voiceCallId,
            sessionId: answeredSession.id,
            connectedAt: answeredSession.connectedAt ?? prev.connectedAt ?? new Date().toISOString(),
            endedAt: null,
            frozenDurationSeconds: null,
          }))
        }
        applyServerSession(answeredSession)
        logLiveCoachingAutoStartQa("reconcileInboundAnswer_success", {
          sessionId: answeredSession.id,
          voiceCallId: answeredSession.voiceCallId,
          status: answeredSession.status,
          direction: answeredSession.direction,
          realtimeSessionId: answeredSession.realtimeSessionId,
          liveCoachingLinked: data.pipeline?.liveCoachingLinked ?? null,
          liveCoachingFailureReason: data.pipeline?.liveCoachingFailureReason ?? null,
        })
      } else {
        await load({ background: true })
      }
      logLiveCoachingAutoStartQa("operator_assist_refresh_start", {
        reason: "post_answer_reconcile",
        sessionId,
        voiceCallId: input.sessionForAnswer.voiceCallId,
      })
      void voiceBrowser.refresh()
        .then((synced) => {
          logLiveCoachingAutoStartQa("operator_assist_refresh_success", {
            reason: "post_answer_reconcile",
            sessionId,
            workspaceSessionId: synced?.workspaceSessionId ?? null,
            activeVoiceCallId: synced?.activeVoiceCallId ?? null,
            operatorAssistHasPrimaryCoach: Boolean(synced?.operatorAssist?.coachingState?.primaryCoach),
            activeSessionRealtimeSessionId: lastKnownSessionRef.current?.realtimeSessionId ?? null,
          })
        })
        .catch((error: unknown) => {
          logLiveCoachingAutoStartQa("operator_assist_refresh_failure", {
            reason: "post_answer_reconcile",
            sessionId,
            message: error instanceof Error ? error.message : String(error),
          })
        })
    } catch (e) {
      logLiveCoachingAutoStartQa("reconcileInboundAnswer_failure", {
        sessionId: input.sessionForAnswer.id,
        voiceCallId: input.sessionForAnswer.voiceCallId,
        message: e instanceof Error ? e.message : "Answer failed.",
      })
      setError(e instanceof Error ? e.message : "Answer failed.")
    }
  }

  async function retryMediaStream() {
    const sessionId = activeSession?.id
    if (!sessionId) return
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/calls/sessions/${sessionId}/media-stream/restart`,
        { method: "POST" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        started?: boolean
        reason?: string
        message?: string
      }
      if (!res.ok || !data.started) {
        throw new Error(data.message ?? data.reason ?? "Media stream restart failed.")
      }
      setMediaStreamDiagnostic(null)
      await voiceBrowser.refresh()
    } catch (e) {
      setMediaStreamDiagnostic(e instanceof Error ? e.message : CALL_WORKSPACE_MEDIA_STREAM_RESTART_FAILED_COPY)
    }
  }

  async function answerCall() {
    const capturedSession = incomingSession ?? activeSession
    if (!capturedSession && !hasSdkIncoming) return
    setAnswering(true)
    setError(null)
    setCallAuthority((prev) => transitionCallLifecycleAuthority(prev, { type: "sdk_accept_started" }))
    try {
      if (hasSdkIncoming) {
        logLiveCoachingAutoStartQa("sdk_accept_start", {
          sessionId: capturedSession?.id ?? null,
          voiceCallId: capturedSession?.voiceCallId ?? null,
          status: capturedSession?.status ?? null,
          direction: capturedSession?.direction ?? null,
          realtimeSessionId: capturedSession?.realtimeSessionId ?? null,
        })
        await voiceBrowser.acceptIncomingCall()
        logLiveCoachingAutoStartQa("sdk_accept_success", {
          sessionId: capturedSession?.id ?? null,
          voiceCallId: capturedSession?.voiceCallId ?? null,
          callSid: voiceBrowser.incomingCall?.callSid ?? null,
        })
      }

      if (capturedSession) {
        const connectedAt = new Date().toISOString()
        registerAcceptedCallLifecycle({
          acceptedVoiceCallIds: acceptedVoiceCallIdsRef.current,
          acceptedSessionIds: acceptedSessionIdsRef.current,
          voiceCallId: capturedSession.voiceCallId,
          sessionId: capturedSession.id,
        })
        if (capturedSession.voiceCallId) {
          suppressedInboundOfferVoiceCallIdRef.current = capturedSession.voiceCallId
        }
        const optimisticSession = buildOptimisticActiveInboundSession(capturedSession, connectedAt)
        lastKnownSessionRef.current = optimisticSession
        setActiveSession(optimisticSession)
        setAnswerPipelineDiagnostic(null)
        setMediaStreamDiagnostic(null)
        setCallAuthority((prev) =>
          transitionCallLifecycleAuthority(prev, {
            type: "sdk_accept_succeeded",
            callSid: voiceBrowser.incomingCall?.callSid ?? prev.callSid,
            connectedAt,
          }),
        )
        setCallAuthority((prev) =>
          transitionCallLifecycleAuthority(prev, {
            type: "bind_session",
            voiceCallId: capturedSession.voiceCallId,
            sessionId: capturedSession.id,
          }),
        )
      }
      if (capturedSession) {
        await reconcileInboundAnswer({
          sessionForAnswer: capturedSession,
          hadSdkIncoming: hasSdkIncoming,
        })
      } else {
        await voiceBrowser.refresh().catch(() => undefined)
      }
      setAnswering(false)
    } catch (e) {
	      setError(e instanceof Error ? e.message : "Answer failed.")
	      setAnswering(false)
      setCallAuthority((prev) => transitionCallLifecycleAuthority(prev, { type: "decline_or_cancel" }))
    }
  }

  async function declineCall() {
    const sessionForDecline = incomingSession ?? activeSession
    if (!sessionForDecline && !hasSdkIncoming) return
    setDeclining(true)
    setError(null)
    try {
      if (hasSdkIncoming) {
        await voiceBrowser.rejectIncomingCall()
      }

      const sessionId = sessionForDecline?.id
      if (sessionId && !sessionId.startsWith("pending-inbound-")) {
        const res = await fetch("/api/platform/growth/calls/decline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          session?: NativeCallWorkspaceSessionPublicView
          message?: string
        }
        if (!res.ok || !data.session) throw new Error(data.message ?? "Could not decline call.")
      }
      setActiveSession(null)
      lastKnownSessionRef.current = null
      setCallAuthority((prev) => transitionCallLifecycleAuthority(prev, { type: "decline_or_cancel" }))
      await voiceBrowser.refresh().catch(() => undefined)
      await load({ background: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decline failed.")
    } finally {
      setDeclining(false)
    }
  }

  async function submitWrapup(input: {
    outcome: NativeCallWrapupOutcome
    objectionCategory?: string | null
    buyingSignals?: string[]
    competitorMentioned?: boolean
    timelineDetected?: boolean
    budgetDetected?: boolean
    championIdentified?: boolean
    decisionMakerPresent?: boolean
    notes?: string
  }): Promise<NativeCallWrapupPublicView | null> {
    const sessionForWrapup =
      activeSession ??
      (callAuthority.phase === "wrapup" || callAuthority.phase === "ending"
        ? lastKnownSessionRef.current
        : null)
    if (!sessionForWrapup || sessionForWrapup.status !== "wrapping") return null
    if (submittingWrapup) return null

    let sessionId = sessionForWrapup.id
    if (!isNativeSessionIdServerReady(sessionId)) {
      const synced = await voiceBrowser.refresh().catch(() => null)
      sessionId =
        synced?.inboundRinging?.workspaceSessionId ??
        synced?.workspaceSessionId ??
        sessionId
    }
    if (!isNativeSessionIdServerReady(sessionId)) {
      setError("Call session is still syncing. Wait a moment and try again.")
      return null
    }
    if (wrapupConfirmedSessionIdsRef.current.has(sessionId)) {
      finalizeWrapupLocally({ sessionId, voiceCallId: sessionForWrapup.voiceCallId })
      return null
    }
    if (wrapupInFlightSessionIdRef.current === sessionId) return null

    wrapupInFlightSessionIdRef.current = sessionId
    const companyName = sessionForWrapup.companyName
    const voiceCallId = sessionForWrapup.voiceCallId
    setSubmittingWrapup(true)
    setError(null)

    const payload = {
      sessionId,
      companyName,
      outcome: input.outcome,
      objectionCategory: input.objectionCategory ?? null,
      buyingSignals: input.buyingSignals ?? [],
      competitorMentioned: input.competitorMentioned ?? false,
      timelineDetected: input.timelineDetected ?? false,
      budgetDetected: input.budgetDetected ?? false,
      championIdentified: input.championIdentified ?? false,
      decisionMakerPresent: input.decisionMakerPresent ?? false,
      notes: input.notes ?? "",
    }

    finalizeWrapupLocally({ sessionId, voiceCallId })

    try {
      const wrapup = await persistWrapupWithRetry(payload, sessionId)
      void load({ background: true })
      void voiceBrowser.refresh().catch(() => undefined)
      return wrapup
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wrap-up failed.")
      return null
    } finally {
      wrapupInFlightSessionIdRef.current = null
      setSubmittingWrapup(false)
    }
  }

  const showIncomingDuringLoad =
    workspacePhase === "incoming" || callAuthority.phase === "incoming" || Boolean(inboundOffer)

  if (loading && !showIncomingDuringLoad && workspacePhase !== "wrapup" && workspacePhase !== "active") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading call workspace…
      </div>
    )
  }

  if (setupMessage) {
    return <p className="text-sm text-muted-foreground">{setupMessage}</p>
  }

  return (
    <div
      className="w-full min-w-0 space-y-4"
      data-qa-marker={GROWTH_NATIVE_DIALER_QA_MARKER}
      data-layout-qa-marker={GROWTH_NATIVE_DIALER_LAYOUT_QA_MARKER}
      data-call-start-fix-qa-marker={GROWTH_NATIVE_DIALER_CALL_START_FIX_QA_MARKER}
      data-google-voice-bridge-qa-marker={GROWTH_GOOGLE_VOICE_BRIDGE_QA_MARKER}
      data-google-voice-bridge-coaching-qa-marker={GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER}
      data-voice-native-dialer-integration-qa-marker={VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER}
      data-voice-transfer-control-qa-marker={VOICE_TRANSFER_CONTROL_QA_MARKER}
      data-voice-media-streaming-qa-marker={VOICE_MEDIA_STREAMING_QA_MARKER}
      data-voice-conversation-intelligence-qa-marker={VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER}
      data-voice-unified-operator-assist-qa-marker={VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER}
      data-voice-relationship-memory-qa-marker={VOICE_RELATIONSHIP_MEMORY_QA_MARKER}
      data-voice-revenue-intelligence-qa-marker={VOICE_REVENUE_INTELLIGENCE_QA_MARKER}
      data-voice-retention-intelligence-qa-marker={VOICE_RETENTION_INTELLIGENCE_QA_MARKER}
      data-voice-ai-copilot-qa-marker={VOICE_AI_COPILOT_QA_MARKER}
      data-voice-deep-copilot-qa-marker={VOICE_DEEP_COPILOT_QA_MARKER}
      data-voice-ai-receptionist-qa-marker={VOICE_AI_RECEPTIONIST_QA_MARKER}
      data-voice-missed-call-recovery-qa-marker={VOICE_MISSED_CALL_RECOVERY_QA_MARKER}
      data-voice-unified-operator-workspace-ux-qa-marker={VOICE_UNIFIED_OPERATOR_WORKSPACE_UX_QA_MARKER}
      data-workspace-mode={workspaceContext.mode}
    >
      {voiceBrowser.registrationState === "error" && voiceBrowser.error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          Browser calling: {voiceBrowser.error}
        </p>
      ) : null}

      {hidePageHeader ? null : (
      <section className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Headphones size={18} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Calls</h1>
              <p className="text-sm text-muted-foreground">
                Unified operator command workspace — relationship workflows, contextual intelligence, operator-controlled
                assist.
              </p>
            </div>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>
      </section>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {setupWarning ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {setupWarning}
        </p>
      ) : null}

      <GrowthCallWorkspaceActiveWorkflowStrip workspaceContext={workspaceContext} />

      <div className="grid grid-cols-1 gap-4 pb-16 lg:grid-cols-[320px_minmax(0,1fr)_320px] lg:pb-0">
        <aside className="w-full min-w-0 space-y-4 lg:max-w-[320px]">
          <GrowthCallWorkspaceDialerCard
            phone={phone}
            onPhoneChange={(value) => setPhone(normalizeDialPhoneDigits(value))}
            onStartCall={() =>
              void startCall({
                phoneNumber: normalizeDialPhoneForApi(phone),
                leadId: optionalUuid(initialLeadId),
              })
            }
            disabled={workspacePhase !== "idle"}
            loading={starting}
            recentSessions={dashboard?.recentSessions ?? []}
            nativeSessionId={activeSession?.id ?? null}
            leadContextAttached={Boolean(leadContext)}
            onLeadAttached={(leadId, session) => {
              void loadLeadContext(leadId)
              setLeadLinked(true)
              setCoachingMode("lead_linked")
              if (session) applyServerSession(session)
              else if (activeSession) setActiveSession({ ...activeSession, leadId })
            }}
          />

          <GrowthCallWorkspaceQueueCard
            items={queue}
            dialingId={dialingQueueId}
            onDialItem={(item) => {
              const phoneNumber = normalizeDialPhoneForApi(item.phoneNumber ?? phone)
              setDialingQueueId(item.id)
              setPhone(normalizeDialPhoneDigits(item.phoneNumber ?? phone))
              void startCall({
                phoneNumber,
                leadId: item.leadId,
                queueItemId: item.id,
              })
            }}
          />
        </aside>

        <GrowthCallWorkspaceCenterPanel
          phase={workspacePhase}
          workspaceContext={workspaceContext}
          activeSession={workspacePhase === "incoming" ? displaySession : activeSession ?? lastKnownSessionRef.current}
          voiceBrowserCallState={voiceBrowser.snapshot?.browserCallState ?? null}
          voiceBrowserCallStateLabel={
            voiceBrowser.snapshot?.browserCallState
              ? mapBrowserCallStateLabel(voiceBrowser.snapshot.browserCallState)
              : null
          }
          voiceTimeline={voiceBrowser.snapshot?.timeline ?? []}
          voiceRecording={voiceBrowser.snapshot?.recording ?? null}
          voiceParticipants={voiceBrowser.snapshot?.participants ?? []}
          voiceActiveTransfer={voiceBrowser.snapshot?.activeTransfer ?? null}
          voiceLiveTranscript={voiceBrowser.snapshot?.liveTranscript ?? null}
          operatorAssist={displayOperatorAssist}
          aiCopilot={workspacePhase === "idle" ? null : voiceBrowser.snapshot?.aiCopilot ?? null}
          aiReceptionist={voiceBrowser.snapshot?.aiReceptionist ?? null}
          missedCallRecovery={voiceBrowser.snapshot?.missedCallRecovery ?? null}
          voiceCallId={voiceCallId}
          onOperatorAssistRefresh={voiceBrowser.refresh}
          muted={sessionMuted}
          onHold={sessionOnHold}
          transferTarget={transferTarget}
          onTransferTargetChange={setTransferTarget}
          callActionPending={callActionPending}
          answering={answering}
          declining={declining}
          ending={ending}
          markingBridgeStarted={markingBridgeStarted}
          submittingWrapup={submittingWrapup}
          coachingStartSignal={coachingStartSignal}
          coachingMode={coachingMode}
          leadLinked={leadLinked}
          inboundVoiceCallCreatedAt={inboundOffer?.voiceCallCreatedAt ?? null}
          onAnswer={() => void answerCall()}
          onDecline={() => void declineCall()}
          onEndCall={() => void endCall()}
          onToggleMute={() => void toggleMute()}
          onToggleHold={() => void toggleHold()}
          onStartTransfer={() => void startTransfer()}
          onMarkBridgeStarted={() => void markBridgeStarted()}
          onStartLiveCoaching={() => setCoachingStartSignal((value) => value + 1)}
          optimisticCoachTurn={optimisticCoachTurn}
          answerPipelineDiagnostic={answerPipelineDiagnostic}
          mediaStreamDiagnostic={mediaStreamDiagnostic}
          onRetryMediaStream={() => void retryMediaStream()}
          onSubmitWrapup={submitWrapup}
        />

        <GrowthCallWorkspaceUnifiedContextRail
          workspaceContext={workspaceContext}
          expanded={contextRailExpanded}
          onToggleExpanded={() => setContextRailExpanded((value) => !value)}
          deepIntelligenceExpanded={deepIntelligenceExpanded}
          onToggleDeepIntelligence={() => setDeepIntelligenceExpanded((value) => !value)}
          leadContext={leadContext}
          nativeSessionId={activeSession?.id ?? null}
          sessionPhone={activeSession?.phoneNumber ?? phone}
          operatorAssist={displayOperatorAssist}
          relationshipMemory={voiceBrowser.snapshot?.relationshipMemory ?? null}
          revenueIntelligence={voiceBrowser.snapshot?.revenueIntelligence ?? null}
          retentionIntelligence={voiceBrowser.snapshot?.retentionIntelligence ?? null}
          onRelationshipMemoryRefresh={voiceBrowser.refresh}
          onRevenueIntelligenceRefresh={voiceBrowser.refresh}
          onRetentionIntelligenceRefresh={voiceBrowser.refresh}
          onLeadAttached={(leadId, session) => {
            void loadLeadContext(leadId)
            setLeadLinked(true)
            setCoachingMode("lead_linked")
            if (session) applyServerSession(session)
            else if (activeSession) setActiveSession({ ...activeSession, leadId })
          }}
        />
      </div>

      <GrowthCallWorkspaceMobileActionBar
        workspaceContext={workspaceContext}
        disabled={starting || ending || answering || declining}
        onDial={() =>
          void startCall({
            phoneNumber: normalizeDialPhoneForApi(phone),
            leadId: optionalUuid(initialLeadId),
          })
        }
        onAnswer={() => void answerCall()}
        onEndCall={() => void endCall()}
        onTransfer={() => void startTransfer()}
      />
    </div>
  )
}
