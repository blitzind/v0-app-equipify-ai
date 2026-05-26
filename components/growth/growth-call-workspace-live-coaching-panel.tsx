"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Mic, Radio, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_CALL_DIALER_SAFETY_COPY } from "@/lib/growth/call-workflow-copy"
import type { GrowthLiveCoachingState, GrowthLiveGuidanceEvent } from "@/lib/growth/live-guidance/live-guidance-types"
import { GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER } from "@/lib/growth/native-dialer/native-dialer-types"
import type { GrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-types"

function GuidanceRow({ event }: { event: GrowthLiveGuidanceEvent }) {
  return (
    <li className="rounded-lg border border-border/50 px-3 py-2 text-sm dark:border-white/5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <p className="font-medium">{event.title}</p>
        <GrowthBadge label={event.severity} tone={event.severity === "high" ? "attention" : "medium"} />
      </div>
      <p className="text-muted-foreground">{event.operatorPrompt}</p>
      {event.recommendation ? (
        <p className="mt-1 text-xs text-foreground/80">Suggested: {event.recommendation}</p>
      ) : null}
    </li>
  )
}

export function GrowthCallWorkspaceLiveCoachingPanel({
  phase,
  leadId,
  nativeSessionId,
  startSignal,
}: {
  phase: "idle" | "incoming" | "bridge_pending" | "active" | "wrapup"
  leadId: string | null
  nativeSessionId: string | null
  startSignal?: number
}) {
  const [sessions, setSessions] = useState<GrowthRealtimeCallSession[]>([])
  const [coachingState, setCoachingState] = useState<GrowthLiveCoachingState | null>(null)
  const [guidanceEvents, setGuidanceEvents] = useState<GrowthLiveGuidanceEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeRealtimeSession = useMemo(
    () => sessions.find((session) => ["preparing", "active", "paused"].includes(session.status)) ?? null,
    [sessions],
  )

  const coachingActive = activeRealtimeSession?.status === "active"
  const coachingListening =
    coachingActive &&
    (activeRealtimeSession?.transcriptStatus === "live" ||
      activeRealtimeSession?.browserAudioCaptureStatus === "active")

  const loadCoaching = useCallback(async () => {
    if (!leadId || (phase !== "active" && phase !== "bridge_pending")) {
      setSessions([])
      setCoachingState(null)
      setGuidanceEvents([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${leadId}/realtime-call/sessions`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        sessions?: GrowthRealtimeCallSession[]
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load live coaching sessions.")

      const nextSessions = data.sessions ?? []
      setSessions(nextSessions)
      const current = nextSessions.find((session) => ["preparing", "active", "paused"].includes(session.status))
      if (!current) {
        setCoachingState(null)
        setGuidanceEvents([])
        return
      }

      const detailRes = await fetch(
        `/api/platform/growth/leads/${leadId}/realtime-call/sessions/${current.id}`,
        { cache: "no-store" },
      )
      const detail = (await detailRes.json().catch(() => ({}))) as {
        ok?: boolean
        coachingState?: GrowthLiveCoachingState | null
        message?: string
      }
      if (detailRes.ok && detail.ok) {
        setCoachingState(detail.coachingState ?? null)
        setGuidanceEvents(detail.coachingState?.activeGuidance ?? [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Live coaching load failed.")
    } finally {
      setLoading(false)
    }
  }, [leadId, phase])

  useEffect(() => {
    void loadCoaching()
  }, [loadCoaching, nativeSessionId])

  useEffect(() => {
    if (!startSignal || !leadId) return
    if (phase !== "bridge_pending" && phase !== "active") return
    void startCoaching()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- explicit operator trigger via startSignal
  }, [startSignal])

  async function startCoaching() {
    if (!leadId) return
    setActing(true)
    setError(null)
    try {
      let session = sessions.find((item) => ["preparing", "active", "paused"].includes(item.status)) ?? null

      if (!session) {
        const createRes = await fetch(`/api/platform/growth/leads/${leadId}/realtime-call/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
        const createData = (await createRes.json().catch(() => ({}))) as { ok?: boolean; message?: string }
        if (!createRes.ok || !createData.ok) throw new Error(createData.message ?? "Could not create coaching session.")
      }

      await loadCoaching()
      const refreshed = await fetch(`/api/platform/growth/leads/${leadId}/realtime-call/sessions`, { cache: "no-store" })
      const refreshedData = (await refreshed.json().catch(() => ({}))) as { sessions?: GrowthRealtimeCallSession[] }
      session =
        refreshedData.sessions?.find((item) => ["preparing", "active", "paused"].includes(item.status)) ?? null

      if (session && (session.status === "preparing" || session.status === "paused")) {
        const startRes = await fetch(
          `/api/platform/growth/leads/${leadId}/realtime-call/sessions/${session.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "start" }),
          },
        )
        const startData = (await startRes.json().catch(() => ({}))) as { ok?: boolean; message?: string }
        if (!startRes.ok || !startData.ok) throw new Error(startData.message ?? "Could not start live coaching.")
      }

      await loadCoaching()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start coaching.")
    } finally {
      setActing(false)
    }
  }

  if (phase === "idle" || phase === "incoming") {
    return (
      <div
        className="flex flex-1 flex-col rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/5"
        data-qa-marker={GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h4 className="text-lg font-semibold">Live Coaching Ready</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Browser mic / meeting capture available. Live Coaching starts when the call begins or when the operator
              manually starts coaching. Guidance appears here during the conversation.
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>• Operator-controlled only — no autonomous capture</li>
          <li>• Live Coaching starts after capture begins</li>
          <li>• Objections, responses, and buying signals surface in this panel</li>
        </ul>
        <GrowthBadge label="Standby" tone="neutral" className="mt-4 w-fit" />
      </div>
    )
  }

  if (phase === "wrapup") {
    return (
      <div
        className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground dark:border-white/5"
        data-qa-marker={GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER}
      >
        Live Coaching paused for operator wrap-up. Complete wrap-up to start the next call.
      </div>
    )
  }

  if (phase === "bridge_pending") {
    return (
      <div
        className="rounded-2xl border border-border/60 bg-muted/20 p-4 dark:border-white/5"
        data-qa-marker={GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-semibold">Live Coaching</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Available through browser capture once you start coaching from the bridge panel.
            </p>
          </div>
          <GrowthBadge label={coachingActive ? "Active" : "Standby"} tone={coachingActive ? "healthy" : "neutral"} />
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        {acting ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Starting Live Coaching…
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border/70 bg-background/50 p-4 dark:border-white/10 dark:bg-white/[0.02]"
      data-qa-marker={GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
          <h4 className="font-semibold">Live Coaching</h4>
          {coachingListening ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
              Listening
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge
            label={coachingActive ? "Active" : "Standby"}
            tone={coachingActive ? "healthy" : "neutral"}
          />
          {!coachingActive ? (
            <Button type="button" size="sm" disabled={!leadId || acting} onClick={() => void startCoaching()}>
              {acting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  <Mic className="mr-2 size-4" />
                  Start Coaching
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {!leadId ? (
        <p className="text-sm text-muted-foreground">
          Link a lead to this call to enable Live Coaching. Dial from the queue or open a lead in the workspace.
        </p>
      ) : null}

      {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading coaching…
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-auto">
          {coachingState ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border/50 px-3 py-2 dark:border-white/5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Momentum</p>
                <p className="text-sm font-semibold capitalize">{coachingState.momentum.replace(/_/g, " ")}</p>
              </div>
              <div className="rounded-lg border border-border/50 px-3 py-2 dark:border-white/5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk</p>
                <p className="text-sm font-semibold capitalize">{coachingState.riskLevel}</p>
              </div>
              <div className="rounded-lg border border-border/50 px-3 py-2 dark:border-white/5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Talk ratio</p>
                <p className="text-sm font-semibold">
                  {coachingState.executionScore.factors.talkRatio != null
                    ? `${coachingState.executionScore.factors.talkRatio}% rep`
                    : "—"}
                </p>
              </div>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Guidance stream</p>
            {guidanceEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center dark:border-white/10">
                <Radio className="mx-auto mb-2 size-6 text-muted-foreground" />
                <p className="text-sm font-medium">No guidance yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {coachingActive
                    ? "Guidance appears as transcript events are captured. Start browser mic capture from the lead drawer for audio."
                    : "Live Coaching starts after capture begins. Click Start Coaching, then enable mic/meeting capture."}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {guidanceEvents.slice(0, 8).map((event) => (
                  <GuidanceRow key={event.id} event={event} />
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">{GROWTH_CALL_DIALER_SAFETY_COPY}</p>
        </div>
      )}
    </div>
  )
}
