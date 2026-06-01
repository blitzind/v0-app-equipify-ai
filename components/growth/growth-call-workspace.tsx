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
  resolveInboundWorkspacePhase,
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
  buildOptimisticActiveInboundSession,
  buildOptimisticInboundAnswerCoachTurn,
} from "@/lib/growth/live-coaching/optimistic-inbound-answer"
import {
  buildOptimisticWrappingSession,
  filterInboundOfferForLifecycle,
  isActiveSessionStatus,
  mergeServerSessionIntoLocal,
  registerAcceptedCallLifecycle,
  registerEndedCallLifecycle,
  shouldApplyInboundOfferToSession,
} from "@/lib/voice/browser-calling/call-lifecycle-reconciliation"

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
  const endCallInFlightRef = useRef(false)

  const clearStaleRingingSession = useCallback((reason: string) => {
    logInboundRingDiagnostic(INBOUND_RING_DIAG_EVENTS.INBOUND_OFFER_CLEARED, { reason })
    lastInboundOfferVoiceCallIdRef.current = null
    setActiveSession((prev) => (prev?.status === "ringing" ? null : prev))
  }, [])

  const handleIncomingCleared = useCallback(
    (reason: string) => {
      if (lastInboundOfferVoiceCallIdRef.current) {
        suppressedInboundOfferVoiceCallIdRef.current = lastInboundOfferVoiceCallIdRef.current
      }
      clearStaleRingingSession(`sdk_${reason}`)
    },
    [clearStaleRingingSession],
  )

  const load = useCallback(async () => {
    setLoading(true)
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
        setActiveSession((prev) => {
          const next = dashData.workspaceDashboard?.activeSession ?? null
          return mergeServerSessionIntoLocal({
            local: prev,
            server: next,
            acceptedSessionIds: acceptedSessionIdsRef.current,
            endedVoiceCallIds: endedVoiceCallIdsRef.current,
          })
        })
      }
      setQueue(queueData.queue ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load call workspace.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLeadContext = useCallback(async (leadId: string) => {
    const res = await fetch(`/api/platform/growth/calls/workspace/lead/${leadId}`, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as { leadContext?: NativeDialerLeadContext | null }
    setLeadContext(data.leadContext ?? null)
    if (data.leadContext?.contactPhone && !phone) {
      setPhone(normalizeDialPhoneDigits(data.leadContext.contactPhone))
    }
  }, [phone])

  const voiceBrowser = useVoiceBrowserCalling({
    workspaceSessionId: activeSession?.id ?? null,
    onIncomingCleared: handleIncomingCleared,
  })

  const inboundOfferRaw = voiceBrowser.snapshot?.inboundRinging ?? null
  const inboundOffer = useMemo(
    () =>
      filterInboundOfferForLifecycle({
        offer: inboundOfferRaw,
        activeSession,
        acceptedVoiceCallIds: acceptedVoiceCallIdsRef.current,
        acceptedSessionIds: acceptedSessionIdsRef.current,
        endedVoiceCallIds: endedVoiceCallIdsRef.current,
      }),
    [activeSession, inboundOfferRaw],
  )
  const hasSdkIncoming = Boolean(voiceBrowser.incomingCall)

  useEffect(() => {
    const offer = inboundOffer
    if (!offer) {
      if (!inboundOfferRaw && lastInboundOfferVoiceCallIdRef.current) {
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
    }

    setActiveSession((prev) => {
      if (
        !shouldApplyInboundOfferToSession({
          offer,
          activeSession: prev,
          acceptedVoiceCallIds: acceptedVoiceCallIdsRef.current,
          acceptedSessionIds: acceptedSessionIdsRef.current,
          endedVoiceCallIds: endedVoiceCallIdsRef.current,
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
      return next
    })
  }, [clearStaleRingingSession, inboundOffer, inboundOfferRaw])

  const incomingSession = useMemo((): NativeCallWorkspaceSessionPublicView | null => {
    if (activeSession?.status === "ringing") return activeSession
    if (activeSession && (isActiveSessionStatus(activeSession.status) || activeSession.status === "wrapping")) {
      return null
    }
    if (!hasSdkIncoming || !voiceBrowser.incomingCall) return null
    return buildInboundRingingSessionPlaceholder({
      incomingCall: voiceBrowser.incomingCall,
      inboundOffer,
      workspaceSessionId: voiceBrowser.snapshot?.workspaceSessionId ?? null,
      voiceCallId: voiceBrowser.snapshot?.activeVoiceCallId ?? inboundOffer?.voiceCallId ?? null,
    })
  }, [activeSession, hasSdkIncoming, inboundOffer, voiceBrowser.incomingCall, voiceBrowser.snapshot])

  const displaySession = incomingSession ?? activeSession

  const workspacePhase = useMemo((): GrowthCallWorkspacePhase => {
    return resolveInboundWorkspacePhase({
      activeSessionStatus: activeSession?.status ?? incomingSession?.status,
      sdkIncoming: hasSdkIncoming,
    })
  }, [incomingSession?.status, activeSession?.status, hasSdkIncoming])

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
    await load()
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
    void load()
  }, [load])

  useEffect(() => {
    if (initialLeadId) void loadLeadContext(initialLeadId)
  }, [initialLeadId, loadLeadContext])

  const workspaceContext = useMemo(() => {
    const input = buildWorkspaceContextInputFromVoiceSnapshot({
      callPhase: workspacePhase,
      startingCall: starting,
      leadLinked,
      operatorAssist: voiceBrowser.snapshot?.operatorAssist ?? null,
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
  }, [workspacePhase, starting, leadLinked, voiceBrowser.snapshot, leadContext])

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
      setActiveSession(data.session)
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
      setActiveSession(data.session)
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

  async function endCall() {
    const sessionToEnd = activeSession ?? incomingSession
    if (!sessionToEnd) return
    if (sessionToEnd.status === "wrapping" || sessionToEnd.status === "completed") return
    if (endCallInFlightRef.current) return

    endCallInFlightRef.current = true
    setError(null)
    const endedAt = new Date().toISOString()
    registerEndedCallLifecycle({
      endedVoiceCallIds: endedVoiceCallIdsRef.current,
      voiceCallId: sessionToEnd.voiceCallId,
    })
    setOptimisticCoachTurn(null)
    setActiveSession(buildOptimisticWrappingSession(sessionToEnd, endedAt))
    setEnding(false)

    try {
      await voiceBrowser.disconnectActiveCall().catch(() => undefined)
      if (!sessionToEnd.id.startsWith("pending-inbound-")) {
        const res = await fetch("/api/platform/growth/calls/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionToEnd.id }),
        })
        const data = (await res.json().catch(() => ({}))) as { session?: NativeCallWorkspaceSessionPublicView }
        if (!res.ok || !data.session) throw new Error("Could not end call.")
        setActiveSession((prev) =>
          mergeServerSessionIntoLocal({
            local: prev,
            server: data.session ?? null,
            acceptedSessionIds: acceptedSessionIdsRef.current,
            endedVoiceCallIds: endedVoiceCallIdsRef.current,
          }),
        )
      } else {
        setActiveSession(null)
      }
      void voiceBrowser.refresh().catch(() => undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : "End failed.")
    } finally {
      endCallInFlightRef.current = false
    }
  }

  async function reconcileInboundAnswer(input: {
    sessionForAnswer: NativeCallWorkspaceSessionPublicView
    hadSdkIncoming: boolean
  }) {
    try {
      let sessionId = input.sessionForAnswer.id
      if (!sessionId || sessionId.startsWith("pending-inbound-")) {
        const synced = await voiceBrowser.refresh().catch(() => null)
        sessionId =
          synced?.inboundRinging?.workspaceSessionId ??
          synced?.workspaceSessionId ??
          sessionId
      }

      if (sessionId && !sessionId.startsWith("pending-inbound-")) {
        const res = await fetch("/api/platform/growth/calls/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          session?: NativeCallWorkspaceSessionPublicView
          message?: string
        }
        if (!res.ok || !data.session) throw new Error(data.message ?? "Could not answer call.")
        registerAcceptedCallLifecycle({
          acceptedVoiceCallIds: acceptedVoiceCallIdsRef.current,
          acceptedSessionIds: acceptedSessionIdsRef.current,
          voiceCallId: data.session.voiceCallId,
          sessionId: data.session.id,
        })
        setActiveSession((prev) =>
          mergeServerSessionIntoLocal({
            local: prev,
            server: data.session ?? null,
            acceptedSessionIds: acceptedSessionIdsRef.current,
            endedVoiceCallIds: endedVoiceCallIdsRef.current,
          }),
        )
      } else {
        await load()
      }
      void voiceBrowser.refresh().catch(() => undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Answer failed.")
    }
  }

  async function answerCall() {
    const capturedSession = incomingSession ?? activeSession
    if (!capturedSession && !hasSdkIncoming) return
    setAnswering(true)
    setError(null)
    try {
      if (hasSdkIncoming) {
        await voiceBrowser.acceptIncomingCall()
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
        setActiveSession(buildOptimisticActiveInboundSession(capturedSession, connectedAt))
        setOptimisticCoachTurn(buildOptimisticInboundAnswerCoachTurn())
      }
      setAnswering(false)

      void voiceBrowser.refresh().catch(() => undefined)

      if (capturedSession) {
        void reconcileInboundAnswer({
          sessionForAnswer: capturedSession,
          hadSdkIncoming: hasSdkIncoming,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Answer failed.")
      setAnswering(false)
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
      await voiceBrowser.refresh().catch(() => undefined)
      await load()
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
    if (!activeSession) return null
    setSubmittingWrapup(true)
    try {
      const res = await fetch("/api/platform/growth/calls/wrapup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession.id,
          companyName: activeSession.companyName,
          ...input,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { wrapup?: NativeCallWrapupPublicView; message?: string }
      if (!res.ok || !data.wrapup) throw new Error(data.message ?? "Wrap-up failed.")
      setActiveSession(null)
      await load()
      return data.wrapup
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wrap-up failed.")
      return null
    } finally {
      setSubmittingWrapup(false)
    }
  }

  const showIncomingDuringLoad =
    workspacePhase === "incoming" || hasSdkIncoming || Boolean(inboundOffer)

  if (loading && !showIncomingDuringLoad) {
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
              if (session) setActiveSession(session)
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
          activeSession={workspacePhase === "incoming" ? displaySession : activeSession}
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
          operatorAssist={voiceBrowser.snapshot?.operatorAssist ?? null}
          aiCopilot={voiceBrowser.snapshot?.aiCopilot ?? null}
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
          operatorAssist={voiceBrowser.snapshot?.operatorAssist ?? null}
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
            if (session) setActiveSession(session)
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
