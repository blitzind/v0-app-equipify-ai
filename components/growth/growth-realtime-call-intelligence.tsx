"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Mic, MicOff, MonitorSpeaker, Pause, Play, Square, StopCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useGrowthCallWorkflow } from "@/components/growth/growth-call-workflow-context"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthLiveCoachingSessionTimeline } from "@/components/growth/growth-live-coaching-session-timeline"
import { GrowthLiveCoachingSessionInsights } from "@/components/growth/growth-live-coaching-session-insights"
import { GrowthCallIntelligenceScorecardCard } from "@/components/growth/growth-call-intelligence-scorecard-card"
import {
  LiveCoachingExecutionScorePanel,
  LiveCoachingGuidancePanel,
  LiveCoachingSection,
  StableLiveTranscriptList,
} from "@/components/growth/live-coaching/live-coaching-guidance-ui"
import { useGrowthBrowserAudioCapture } from "@/hooks/growth/use-growth-browser-audio-capture"
import { GROWTH_CALL_AUDIO_CAPTURE_ENABLED, GROWTH_CALL_DIALER_SAFETY_COPY } from "@/lib/growth/call-workflow-copy"
import { formatGrowthCallDialerNextStep } from "@/lib/growth/call-workflow"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import { browserAudioCaptureStatusLabel } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-reducer"
import { GROWTH_BROWSER_AUDIO_CAPTURE_SAFETY_COPY, GROWTH_MEETING_CAPTURE_SAFETY_COPY } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-invariants"
import type { GrowthBrowserAudioCaptureCapability } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-types"
import { GROWTH_MEETING_PROVIDER_LABELS } from "@/lib/growth/realtime/browser-audio/meeting-capture-types"
import { growthBrowserAudioStreamStatusLabel } from "@/lib/growth/realtime/browser-audio/browser-audio-stream-types"
import { REALTIME_PROVIDER_LABELS } from "@/lib/growth/realtime/browser-audio/provider-labels"
import type {
  GrowthLiveCoachingState,
  GrowthLiveGuidanceEvent,
} from "@/lib/growth/live-guidance/live-guidance-types"
import type {
  GrowthRealtimeCallSession,
  GrowthRealtimeCallSpeaker,
  GrowthRealtimeTranscriptEvent,
} from "@/lib/growth/realtime/realtime-call-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthRealtimeCallIntelligenceProps = {
  lead: GrowthLead
}

function formatTranscriptSourceLabel(session: GrowthRealtimeCallSession): string {
  const providerLabel = session.providerId
    ? REALTIME_PROVIDER_LABELS[session.providerId] ?? session.providerId
    : null
  if (session.transcriptSource === "browser_mic" && providerLabel) {
    return `Browser Mic → ${providerLabel}`
  }
  if (session.transcriptSource === "meeting_audio" && providerLabel) {
    return `Meeting Mode → ${providerLabel}`
  }
  return session.transcriptSource.replace(/_/g, " ")
}

export function GrowthRealtimeCallIntelligence({ lead }: GrowthRealtimeCallIntelligenceProps) {
  const { state: callWorkflow, expandToken, refreshToken, registerHandles } = useGrowthCallWorkflow()
  const [sessions, setSessions] = useState<GrowthRealtimeCallSession[]>([])
  const [events, setEvents] = useState<GrowthRealtimeTranscriptEvent[]>([])
  const [coachingState, setCoachingState] = useState<GrowthLiveCoachingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speaker, setSpeaker] = useState<GrowthRealtimeCallSpeaker>("rep")
  const [draft, setDraft] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [captureCapability, setCaptureCapability] = useState<GrowthBrowserAudioCaptureCapability | null>(null)
  const [captureQaProof, setCaptureQaProof] = useState<{ marker: string; verified: boolean } | null>(null)

  const activeSession = useMemo(
    () => sessions.find((session) => ["preparing", "active", "paused"].includes(session.status)) ?? null,
    [sessions],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/realtime-call/sessions`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        sessions?: GrowthRealtimeCallSession[]
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load realtime sessions.")

      const nextSessions = data.sessions ?? []
      setSessions(nextSessions)
      const current = nextSessions.find((session) => ["preparing", "active", "paused"].includes(session.status))
      if (current) {
        const detailRes = await fetch(
          `/api/platform/growth/leads/${lead.id}/realtime-call/sessions/${current.id}`,
          { cache: "no-store" },
        )
        const detail = (await detailRes.json().catch(() => ({}))) as {
          ok?: boolean
          events?: GrowthRealtimeTranscriptEvent[]
          session?: GrowthRealtimeCallSession
          coachingState?: GrowthLiveCoachingState | null
        }
        if (detailRes.ok && detail.ok) {
          setEvents(detail.events ?? [])
          setCoachingState(detail.coachingState ?? null)
          if (detail.session) {
            setSessions((prev) => prev.map((item) => (item.id === detail.session!.id ? detail.session! : item)))
          }
        }
      } else {
        setEvents([])
        setCoachingState(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  const refreshCoachingDetail = useCallback(async () => {
    const current = sessions.find((session) => ["preparing", "active", "paused"].includes(session.status))
    if (!current) return
    try {
      const detailRes = await fetch(
        `/api/platform/growth/leads/${lead.id}/realtime-call/sessions/${current.id}`,
        { cache: "no-store" },
      )
      const detail = (await detailRes.json().catch(() => ({}))) as {
        ok?: boolean
        events?: GrowthRealtimeTranscriptEvent[]
        session?: GrowthRealtimeCallSession
        coachingState?: GrowthLiveCoachingState | null
      }
      if (!detailRes.ok || !detail.ok) return
      setEvents(detail.events ?? [])
      setCoachingState(detail.coachingState ?? null)
      if (detail.session) {
        setSessions((prev) => prev.map((item) => (item.id === detail.session!.id ? detail.session! : item)))
      }
    } catch {
      /* silent refresh — avoid UI flash */
    }
  }, [lead.id, sessions])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  const loadCaptureCapability = useCallback(async (session: GrowthRealtimeCallSession) => {
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${lead.id}/realtime-call/sessions/${session.id}/browser-audio-capture`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        capability?: GrowthBrowserAudioCaptureCapability
        session?: GrowthRealtimeCallSession
        qaProof?: { marker: string; verified: boolean }
      }
      if (res.ok && data.ok) {
        setCaptureCapability(data.capability ?? null)
        setCaptureQaProof(data.qaProof ?? null)
        if (data.session) {
          setSessions((prev) => prev.map((item) => (item.id === data.session!.id ? data.session! : item)))
        }
      }
    } catch {
      setCaptureCapability(null)
    }
  }, [lead.id])

  useEffect(() => {
    if (!activeSession) {
      setCaptureCapability(null)
      setCaptureQaProof(null)
      return
    }
    void loadCaptureCapability(activeSession)
  }, [activeSession?.id, activeSession?.transcriptSource, activeSession?.status, loadCaptureCapability])

  const browserAudio = useGrowthBrowserAudioCapture({
    leadId: lead.id,
    session: activeSession,
    capability: captureCapability,
    onSessionUpdated: (updated) => {
      setSessions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      void loadCaptureCapability(updated)
      void refreshCoachingDetail()
    },
  })

  useEffect(() => {
    if (!activeSession || activeSession.status !== "active") return
    if (!browserAudio.isCaptureActive && activeSession.transcriptStatus !== "live") return
    const interval = window.setInterval(() => {
      void refreshCoachingDetail()
    }, 4000)
    return () => window.clearInterval(interval)
  }, [
    activeSession?.id,
    activeSession?.status,
    activeSession?.transcriptStatus,
    browserAudio.isCaptureActive,
    refreshCoachingDetail,
  ])

  async function createSession() {
    setActing("create")
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/realtime-call/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not create session.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.")
    } finally {
      setActing(null)
    }
  }

  async function sessionAction(action: "start" | "pause" | "complete" | "discard") {
    if (!activeSession) return
    setActing(action)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${lead.id}/realtime-call/sessions/${activeSession.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Action failed.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.")
    } finally {
      setActing(null)
    }
  }

  const startRealtimeCoachingFlow = useCallback(async () => {
    let session = sessions.find((item) => ["preparing", "active", "paused"].includes(item.status)) ?? null

    if (!session) {
      setActing("create")
      setError(null)
      try {
        const res = await fetch(`/api/platform/growth/leads/${lead.id}/realtime-call/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
        if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not create session.")
        await load()
        const listRes = await fetch(`/api/platform/growth/leads/${lead.id}/realtime-call/sessions`, { cache: "no-store" })
        const listData = (await listRes.json().catch(() => ({}))) as {
          ok?: boolean
          sessions?: GrowthRealtimeCallSession[]
        }
        session =
          listData.sessions?.find((item) => ["preparing", "active", "paused"].includes(item.status)) ?? null
      } finally {
        setActing(null)
      }
    }

    if (session && (session.status === "preparing" || session.status === "paused")) {
      setActing("start")
      setError(null)
      try {
        const res = await fetch(
          `/api/platform/growth/leads/${lead.id}/realtime-call/sessions/${session.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "start" }),
          },
        )
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
        if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not go live.")
        await load()
      } finally {
        setActing(null)
      }
    }
  }, [lead.id, load, sessions])

  useEffect(() => {
    registerHandles({
      startRealtimeCoaching: startRealtimeCoachingFlow,
      refreshCallPanels: load,
    })
  }, [registerHandles, startRealtimeCoachingFlow, load])

  async function appendTranscript() {
    if (!activeSession || !draft.trim()) return
    setActing("transcript")
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${lead.id}/realtime-call/sessions/${activeSession.id}/transcript`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            speaker,
            content: draft.trim(),
            sequenceNumber: events.length,
            timestampMs: Date.now(),
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        session?: GrowthRealtimeCallSession
        event?: GrowthRealtimeTranscriptEvent
        coachingState?: GrowthLiveCoachingState | null
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not append transcript.")
      if (data.session) {
        setSessions((prev) => prev.map((item) => (item.id === data.session!.id ? data.session! : item)))
      }
      if (data.event) setEvents((prev) => [...prev, data.event!])
      if (data.coachingState) setCoachingState(data.coachingState)
      setDraft("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcript append failed.")
    } finally {
      setActing(null)
    }
  }

  async function guidanceAction(eventId: string, action: "dismiss" | "accept") {
    if (!activeSession) return
    setActing(`${action}:${eventId}`)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${lead.id}/realtime-call/sessions/${activeSession.id}/guidance/${eventId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Guidance action failed.")
      setCoachingState((prev) =>
        prev
          ? {
              ...prev,
              activeGuidance: prev.activeGuidance.filter((event) => event.id !== eventId),
            }
          : prev,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Guidance action failed.")
    } finally {
      setActing(null)
    }
  }

  async function copyRecommendation(event: GrowthLiveGuidanceEvent) {
    try {
      await navigator.clipboard.writeText(event.recommendation)
      setCopiedId(event.id)
      window.setTimeout(() => setCopiedId(null), 1500)
    } catch {
      setError("Could not copy to clipboard.")
    }
  }

  const timelineSessionId = useMemo(
    () => activeSession?.id ?? sessions.find((session) => session.status === "completed")?.id ?? null,
    [activeSession?.id, sessions],
  )

  const snapshot = activeSession?.liveSnapshot
  const dialNextStep =
    callWorkflow.callWorkflowActive && callWorkflow.dialLabel
      ? formatGrowthCallDialerNextStep(callWorkflow.dialLabel)
      : null

  return (
    <GrowthCollapsibleEngineCard
      id="growth-realtime-call"
      title="Realtime Call Intelligence"
      icon={<Mic className="size-4" />}
      headerAside={
        activeSession
          ? `${activeSession.status.replace(/_/g, " ")} · ${formatTranscriptSourceLabel(activeSession)} · ${activeSession.transcriptStatus}`
          : callWorkflow.callWorkflowActive
            ? "Dial logged — start coaching"
            : "Live guidance"
      }
      defaultOpen={callWorkflow.callWorkflowActive}
      persistKey={GROWTH_DRAWER_CARD_KEYS.realtimeCall}
      expandToken={expandToken}
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">{GROWTH_CALL_DIALER_SAFETY_COPY}</p>

        {dialNextStep && !activeSession ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-950">
            {dialNextStep}
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading realtime intelligence…
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {!activeSession ? (
            <Button size="sm" disabled={acting !== null} onClick={() => void startRealtimeCoachingFlow()}>
              {acting === "create" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
              Start Realtime Coaching
            </Button>
          ) : (
            <>
              {activeSession.status === "preparing" || activeSession.status === "paused" ? (
                <Button size="sm" disabled={acting !== null} onClick={() => void sessionAction("start")}>
                  <Play className="mr-2 size-4" />
                  Go Live
                </Button>
              ) : null}
              {activeSession.status === "active" ? (
                <Button size="sm" variant="outline" disabled={acting !== null} onClick={() => void sessionAction("pause")}>
                  <Pause className="mr-2 size-4" />
                  Pause
                </Button>
              ) : null}
              <Button size="sm" variant="outline" disabled={acting !== null} onClick={() => void sessionAction("complete")}>
                <Square className="mr-2 size-4" />
                Complete
              </Button>
              <Button size="sm" variant="ghost" disabled={acting !== null} onClick={() => void sessionAction("discard")}>
                <StopCircle className="mr-2 size-4" />
                Discard
              </Button>
            </>
          )}
        </div>

        {activeSession && activeSession.status !== "completed" && GROWTH_CALL_AUDIO_CAPTURE_ENABLED ? (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4" data-qa-marker={captureQaProof?.marker}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Browser audio capture</p>
              <div className="flex flex-wrap items-center gap-2">
                <GrowthBadge
                  label={browserAudioCaptureStatusLabel(
                    activeSession.browserAudioCaptureStatus ?? browserAudio.state.status,
                  )}
                  tone={browserAudio.isCaptureActive ? "attention" : "neutral"}
                />
                {browserAudio.isMicActive ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                    <span className="size-2 animate-pulse rounded-full bg-amber-500" />
                    Microphone Active
                  </span>
                ) : null}
                {browserAudio.isMeetingAudioActive ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700">
                    <span className="size-2 animate-pulse rounded-full bg-indigo-500" />
                    Meeting Audio Active
                  </span>
                ) : null}
                {browserAudio.isMixedAudioActive ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <MonitorSpeaker className="size-3.5" />
                    Mixed Audio Active
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={browserAudio.captureUiMode === "microphone" ? "default" : "outline"}
                onClick={() => browserAudio.setCaptureUiMode("microphone")}
                disabled={browserAudio.isCaptureActive}
              >
                Microphone
              </Button>
              <Button
                size="sm"
                variant={browserAudio.captureUiMode === "meeting_mode" ? "default" : "outline"}
                onClick={() => browserAudio.setCaptureUiMode("meeting_mode")}
                disabled={browserAudio.isCaptureActive}
              >
                Meeting Mode
              </Button>
            </div>

            {browserAudio.captureUiMode === "meeting_mode" ? (
              <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <p>{GROWTH_MEETING_CAPTURE_SAFETY_COPY}</p>
                <p>Share Tab → choose Google Meet, Zoom, or Teams tab → optional microphone → connect provider → listening.</p>
                <label className="flex items-center gap-2 text-foreground">
                  <input
                    type="checkbox"
                    checked={browserAudio.includeMicrophoneInMeeting}
                    onChange={(event) => browserAudio.setIncludeMicrophoneInMeeting(event.target.checked)}
                    disabled={browserAudio.isCaptureActive}
                  />
                  Include microphone in mixed meeting stream
                </label>
                {browserAudio.state.meetingProvider ? (
                  <p>
                    Meeting source detected:{" "}
                    <span className="font-medium text-foreground">
                      {GROWTH_MEETING_PROVIDER_LABELS[browserAudio.state.meetingProvider]}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">{GROWTH_BROWSER_AUDIO_CAPTURE_SAFETY_COPY}</p>
            )}

            {!captureCapability?.canStart && captureCapability?.disabledReason ? (
              <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {captureCapability.disabledReason}
              </p>
            ) : null}

            {browserAudio.state.error ? (
              <p className="rounded-md border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-950">
                {browserAudio.state.error}
              </p>
            ) : null}

            {browserAudio.streamState && browserAudio.streamState.status !== "inactive" ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <GrowthBadge
                  label={growthBrowserAudioStreamStatusLabel(browserAudio.streamState.status)}
                  tone={browserAudio.streamState.status === "listening" ? "healthy" : "neutral"}
                />
                {browserAudio.streamState.metrics.streamFailureReason ? (
                  <span>{browserAudio.streamState.metrics.streamFailureReason}</span>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                size="sm"
                className="min-h-11 w-full justify-center gap-2 px-5 font-medium whitespace-nowrap"
                disabled={!captureCapability?.canStart || browserAudio.isCaptureActive}
                onClick={() => void browserAudio.startCapture()}
              >
                {browserAudio.captureUiMode === "meeting_mode" ? (
                  <>
                    <MonitorSpeaker className="mr-2 h-4 w-4 shrink-0" />
                    Share Tab & Start Meeting Capture
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-4 w-4 shrink-0" />
                    Start Mic Capture
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11 w-full justify-center gap-2 px-5 font-medium whitespace-nowrap"
                disabled={!["active", "paused"].includes(browserAudio.state.status)}
                onClick={() => void browserAudio.pauseCapture()}
              >
                <Pause className="mr-2 h-4 w-4 shrink-0" />
                Pause Mic Capture
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11 w-full justify-center gap-2 px-5 font-medium whitespace-nowrap"
                disabled={browserAudio.state.status === "inactive" || browserAudio.state.status === "stopped"}
                onClick={() => void browserAudio.stopCapture()}
              >
                <StopCircle className="mr-2 h-4 w-4 shrink-0" />
                Stop Mic Capture
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="min-h-11 w-full justify-center gap-2 px-5 font-medium whitespace-nowrap"
                disabled={!["active", "paused"].includes(browserAudio.state.status)}
                onClick={() => browserAudio.toggleMute()}
              >
                {browserAudio.state.muted ? (
                  <MicOff className="mr-2 h-4 w-4 shrink-0" />
                ) : (
                  <Mic className="mr-2 h-4 w-4 shrink-0" />
                )}
                {browserAudio.state.muted ? "Unmute Capture" : "Mute Capture"}
              </Button>
              {browserAudio.streamState?.status === "interrupted" && browserAudio.streamState.metrics.canRetry ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-h-11 w-full justify-center gap-2 px-5 font-medium whitespace-nowrap sm:col-span-2"
                  onClick={() => void browserAudio.retryStream()}
                >
                  Retry Stream
                </Button>
              ) : null}
            </div>

            {browserAudio.state.metrics.chunkCount > 0 || browserAudio.streamState ? (
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <p>Chunks sent: {browserAudio.state.metrics.chunkCount}</p>
                <p>Failed chunks: {browserAudio.state.metrics.failedChunkCount}</p>
                <p>Avg send latency: {browserAudio.state.metrics.averageChunkSendLatencyMs}ms</p>
                <p>Provider latency: {browserAudio.state.metrics.providerTranscriptLatencyMs}ms</p>
                {browserAudio.streamState ? (
                  <>
                    <p>Stream opens: {browserAudio.streamState.metrics.streamOpenCount}</p>
                    <p>Stream closes: {browserAudio.streamState.metrics.streamCloseCount}</p>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeSession && activeSession.status !== "completed" ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manual transcript</p>
              <GrowthBadge label={formatTranscriptSourceLabel(activeSession)} tone="neutral" />
              <GrowthBadge label={activeSession.transcriptStatus.replace(/_/g, " ")} tone="neutral" />
            </div>
            <div className="flex gap-2">
              {(["rep", "prospect"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={speaker === value ? "default" : "outline"}
                  onClick={() => setSpeaker(value)}
                >
                  {value === "rep" ? "Rep" : "Prospect"}
                </Button>
              ))}
            </div>
            <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} placeholder="Type utterance…" />
            <Button size="sm" disabled={acting !== null || !draft.trim()} onClick={() => void appendTranscript()}>
              Append Transcript
            </Button>
          </div>
        ) : null}

        {snapshot && coachingState ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
            <div className="min-w-0 space-y-4">
              <LiveCoachingExecutionScorePanel coachingState={coachingState} snapshot={snapshot} />

              {coachingState.suggestedNextQuestion ? (
                <div className="rounded-xl border-2 border-violet-200 bg-violet-50/50 p-4 dark:border-violet-500/30 dark:bg-violet-500/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-200">
                    Suggested Next Question
                  </p>
                  <p className="mt-2 text-base font-medium leading-relaxed">{coachingState.suggestedNextQuestion}</p>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Rep talk" value={`${snapshot.talkRatio.repTalkPercent}%`} />
                <MetricCard
                  label="Prospect talk"
                  value={`${snapshot.talkRatio.prospectTalkPercent}%`}
                  hint={snapshot.talkRatio.inGoalRange ? "In 45–60% goal" : "Outside goal range"}
                />
              </div>

              <LiveCoachingSection title="Detected objections">
                {snapshot.objections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {snapshot.objections.map((entry) => (
                      <li key={entry.key} className="rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2 text-sm">
                        <p className="font-medium">{entry.label}</p>
                        <p className="text-muted-foreground">{entry.excerpt}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </LiveCoachingSection>

              <LiveCoachingSection title="Buying signals">
                {snapshot.buyingSignals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {snapshot.buyingSignals.map((entry) => (
                      <li key={entry.key} className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm">
                        <p className="font-medium">{entry.label}</p>
                        <p className="text-muted-foreground">{entry.excerpt}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </LiveCoachingSection>

              <LiveCoachingSection title="Missing discovery">
                {snapshot.discovery.missing.length === 0 ? (
                  <GrowthBadge label="Discovery complete" tone="healthy" />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {snapshot.discovery.missing.map((area) => (
                      <GrowthBadge key={area} label={area.replace(/_/g, " ")} tone="neutral" />
                    ))}
                  </div>
                )}
              </LiveCoachingSection>

              <LiveCoachingSection title="Live transcript">
                <StableLiveTranscriptList events={events} />
              </LiveCoachingSection>
            </div>

            <aside className="min-w-0 space-y-3 xl:sticky xl:top-4 xl:self-start">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live Guidance</p>
              <LiveCoachingGuidancePanel
                events={coachingState.activeGuidance}
                acting={acting}
                copiedId={copiedId}
                onCopy={(event) => void copyRecommendation(event)}
                onDismiss={(eventId) => void guidanceAction(eventId, "dismiss")}
                onAccept={(eventId) => void guidanceAction(eventId, "accept")}
              />
            </aside>
          </div>
        ) : snapshot ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Rep talk" value={`${snapshot.talkRatio.repTalkPercent}%`} />
              <MetricCard
                label="Prospect talk"
                value={`${snapshot.talkRatio.prospectTalkPercent}%`}
                hint={snapshot.talkRatio.inGoalRange ? "In 45–60% goal" : "Outside goal range"}
              />
            </div>
            <LiveCoachingSection title="Live transcript">
              <StableLiveTranscriptList events={events} />
            </LiveCoachingSection>
          </>
        ) : null}
      </div>

      <GrowthLiveCoachingSessionInsights
        leadId={lead.id}
        sessionId={timelineSessionId}
        refreshToken={refreshToken}
      />

      <GrowthCallIntelligenceScorecardCard
        leadId={lead.id}
        companyName={lead.companyName}
        realtimeSessionId={timelineSessionId}
        compact
      />

      <GrowthLiveCoachingSessionTimeline
        leadId={lead.id}
        sessionId={timelineSessionId}
        refreshToken={refreshToken}
      />
    </GrowthCollapsibleEngineCard>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
