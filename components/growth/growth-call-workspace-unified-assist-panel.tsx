"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Eye, Loader2, Mic, Radio, Sparkles, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  LiveCoachingExecutionScorePanel,
  LiveCoachingGuidancePanel,
} from "@/components/growth/live-coaching/live-coaching-guidance-ui"
import { GROWTH_CALL_DIALER_SAFETY_COPY } from "@/lib/growth/call-workflow-copy"
import {
  CALL_WORKSPACE_COACHING_NO_LEAD_COPY,
  CALL_WORKSPACE_TRANSCRIPT_ONLY_COACHING_COPY,
  GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER,
  type CallWorkspaceCoachingMode,
} from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import { GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  parseUnifiedAssistEventId,
  unifiedAssistEventToGuidanceEvent,
} from "@/lib/growth/operator-assist/unified-assist-ui-mapper"
import {
  VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER,
  type UnifiedOperatorAssistEvent,
  type UnifiedOperatorAssistSnapshot,
} from "@/lib/growth/operator-assist/types"
import { cn } from "@/lib/utils"

export function GrowthCallWorkspaceUnifiedAssistPanel({
  phase,
  nativeSessionId,
  sessionLeadId,
  coachingMode,
  leadLinked,
  startSignal,
  operatorAssist,
  onSnapshotRefresh,
}: {
  phase: "idle" | "incoming" | "bridge_pending" | "active" | "wrapup"
  nativeSessionId: string | null
  sessionLeadId: string | null
  coachingMode: CallWorkspaceCoachingMode
  leadLinked: boolean
  startSignal?: number
  operatorAssist: UnifiedOperatorAssistSnapshot | null
  onSnapshotRefresh?: () => Promise<void>
}) {
  const [acting, setActing] = useState<string | null>(null)
  const [startingCoaching, setStartingCoaching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissedInterruptionKeys, setDismissedInterruptionKeys] = useState<Set<string>>(new Set())

  const coachingState = operatorAssist?.coachingState ?? null
  const liveSnapshot = operatorAssist?.liveSnapshot ?? null
  const canStartCoaching = (phase === "bridge_pending" || phase === "active") && Boolean(nativeSessionId)

  const visibleFeed = useMemo(() => {
    const feed = operatorAssist?.feed ?? []
    return feed.filter((event) => {
      if (event.source !== "interruption") return true
      return !dismissedInterruptionKeys.has(event.dedupeKey)
    })
  }, [dismissedInterruptionKeys, operatorAssist?.feed])

  const guidanceEvents = useMemo(
    () => visibleFeed.map(unifiedAssistEventToGuidanceEvent),
    [visibleFeed],
  )

  const modeLabel = useMemo(() => {
    if (leadLinked || coachingMode === "lead_linked") return "Lead-linked intelligence"
    return "Transcript-only guidance"
  }, [coachingMode, leadLinked])

  const startCoaching = useCallback(async () => {
    if (!nativeSessionId) return
    setStartingCoaching(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/calls/sessions/${nativeSessionId}/live-coaching`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not start live coaching.")
      await onSnapshotRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start coaching.")
    } finally {
      setStartingCoaching(false)
    }
  }, [nativeSessionId, onSnapshotRefresh])

  useEffect(() => {
    if (!startSignal || !nativeSessionId) return
    if (phase !== "bridge_pending" && phase !== "active") return
    void startCoaching()
  }, [nativeSessionId, phase, startCoaching, startSignal])

  const patchAssistEvent = useCallback(
    async (event: UnifiedOperatorAssistEvent, action: "accept" | "dismiss") => {
      if (event.source === "interruption") {
        setDismissedInterruptionKeys((current) => new Set(current).add(event.dedupeKey))
        return
      }

      setActing(`${action}:${event.id}`)
      setError(null)
      try {
        if (event.source === "growth_guidance" && event.growthGuidanceEventId && event.coachingLeadId && event.realtimeSessionId) {
          const res = await fetch(
            `/api/platform/growth/leads/${event.coachingLeadId}/realtime-call/sessions/${event.realtimeSessionId}/guidance/${event.growthGuidanceEventId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: action === "accept" ? "accept" : "dismiss" }),
            },
          )
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
          if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not update guidance.")
        } else if (event.source === "voice_intelligence" && event.voiceCallId) {
          const { rawId } = parseUnifiedAssistEventId(event.id)
          const res = await fetch(
            `/api/platform/growth/voice/calls/${event.voiceCallId}/intelligence/events/${rawId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: action === "accept" ? "acknowledge" : "dismiss" }),
            },
          )
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
          if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not update assist event.")
        }
        await onSnapshotRefresh?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Assist action failed.")
      } finally {
        setActing(null)
      }
    },
    [onSnapshotRefresh],
  )

  const handleAccept = useCallback(
    (prefixedId: string) => {
      const event = visibleFeed.find((item) => item.id === prefixedId)
      if (event) void patchAssistEvent(event, "accept")
    },
    [patchAssistEvent, visibleFeed],
  )

  const handleDismiss = useCallback(
    (prefixedId: string) => {
      const event = visibleFeed.find((item) => item.id === prefixedId)
      if (event) void patchAssistEvent(event, "dismiss")
    },
    [patchAssistEvent, visibleFeed],
  )

  const qaProps = {
    "data-qa-marker": GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER,
    "data-google-voice-bridge-coaching-qa-marker": GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER,
    "data-voice-unified-operator-assist-qa-marker": VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER,
  }

  if (phase === "idle" || phase === "incoming") {
    return (
      <div
        className="flex flex-1 flex-col rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/5"
        {...qaProps}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <h4 className="text-lg font-semibold">Operator Assist Ready</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Unified coaching and conversation intelligence merge here during calls — one prioritized feed, no duplicate
              cards. Operator-controlled only.
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>• Growth live coaching + voice intelligence orchestrated together</li>
          <li>• Evidence-backed cards ranked by existing live guidance priority</li>
          <li>• Passive mode — no autonomous actions or AI speaking</li>
        </ul>
        <GrowthBadge label="Standby" tone="neutral" className="mt-4 w-fit" />
      </div>
    )
  }

  if (phase === "wrapup") {
    return (
      <div
        className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground dark:border-white/5"
        {...qaProps}
      >
        Operator assist paused for wrap-up. Complete wrap-up to start the next call.
      </div>
    )
  }

  const coachingActive = coachingState != null
  const nextBest = operatorAssist?.nextBestAction.primary ?? null
  const supervisor = operatorAssist?.supervisorVisibility
  const interruptionSummary = operatorAssist?.interruptionSummary

  const panelBody = (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <h4 className="font-semibold">Operator Assist</h4>
          {coachingActive ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label={modeLabel} tone={leadLinked ? "healthy" : "attention"} />
          <GrowthBadge label={coachingActive ? "Coaching active" : "Coaching standby"} tone={coachingActive ? "healthy" : "neutral"} />
          <GrowthBadge label="Passive mode" tone="neutral" />
          {!coachingActive ? (
            <Button
              type="button"
              size="sm"
              disabled={!canStartCoaching || startingCoaching}
              data-qa-action="call-workspace-start-coaching"
              onClick={() => void startCoaching()}
            >
              {startingCoaching ? (
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

      {supervisor ? (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-sky-200/70 bg-sky-50/50 px-3 py-2 text-xs dark:border-sky-900/40 dark:bg-sky-950/20"
          data-qa-action="supervisor-visibility-strip"
        >
          <Eye className="size-3.5 text-sky-700 dark:text-sky-300" />
          <span className="text-sky-900 dark:text-sky-100">
            {supervisor.message}
            {supervisor.activeSupervisorCount > 0
              ? ` · ${supervisor.activeSupervisorCount} supervisor${supervisor.activeSupervisorCount === 1 ? "" : "s"} connected`
              : ""}
          </span>
          {supervisor.participantsVisible ? <GrowthBadge label="Participants visible" tone="neutral" /> : null}
          <GrowthBadge label="Read-only feed" tone="neutral" />
        </div>
      ) : null}

      {!leadLinked && !sessionLeadId ? (
        <p className="mb-2 text-sm text-muted-foreground">{CALL_WORKSPACE_COACHING_NO_LEAD_COPY}</p>
      ) : null}
      {!leadLinked && !sessionLeadId ? (
        <p className="mb-2 text-xs text-muted-foreground">{CALL_WORKSPACE_TRANSCRIPT_ONLY_COACHING_COPY}</p>
      ) : null}

      {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}

      {nextBest ? (
        <div className="mb-3 rounded-xl border border-violet-200/70 bg-violet-50/40 px-3 py-2 dark:border-violet-900/40 dark:bg-violet-950/20">
          <div className="mb-1 flex items-center gap-2">
            <Target className="size-3.5 text-violet-700 dark:text-violet-300" />
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
              Next best action
            </p>
            <GrowthBadge label={`${Math.round(nextBest.confidenceScore <= 1 ? nextBest.confidenceScore * 100 : nextBest.confidenceScore)}%`} tone="healthy" />
          </div>
          <p className="text-sm font-medium">{nextBest.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{nextBest.prompt}</p>
          {nextBest.evidenceText ? (
            <p className="mt-1 text-xs text-muted-foreground">Evidence: {nextBest.evidenceText}</p>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto">
        {coachingState && liveSnapshot ? (
          <LiveCoachingExecutionScorePanel coachingState={coachingState} snapshot={liveSnapshot} compact />
        ) : coachingState ? (
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
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Execution</p>
              <p className="text-sm font-semibold tabular-nums">{coachingState.executionScore.score}</p>
            </div>
          </div>
        ) : null}

        {liveSnapshot ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border/50 px-3 py-2 dark:border-white/5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Talk ratio</p>
              <p className="text-sm font-semibold tabular-nums">
                {liveSnapshot.talkRatio.repTalkPercent}% rep · {liveSnapshot.talkRatio.prospectTalkPercent}% prospect
              </p>
            </div>
            <div className="rounded-lg border border-border/50 px-3 py-2 dark:border-white/5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Buying signals</p>
              <p className="text-sm font-semibold tabular-nums">{liveSnapshot.buyingSignals.length}</p>
            </div>
          </div>
        ) : null}

        {interruptionSummary && interruptionSummary.totalInterruptions > 0 ? (
          <div className="rounded-lg border border-amber-200/70 bg-amber-50/40 px-3 py-2 text-xs dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="font-semibold text-amber-900 dark:text-amber-100">Conversational interruptions</p>
            <p className="mt-1 text-amber-800/90 dark:text-amber-100/90">
              Operator {interruptionSummary.operatorInterruptions} · Customer {interruptionSummary.customerInterruptions}{" "}
              · Assistive coaching only (not punitive)
            </p>
          </div>
        ) : null}

        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Unified assist feed</p>
          {guidanceEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center dark:border-white/10">
              <Radio className="mx-auto mb-2 size-6 text-muted-foreground" />
              <p className="text-sm font-medium">No assist cards yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {coachingActive
                  ? "Growth coaching and voice intelligence merge here as transcript evidence arrives."
                  : "Start coaching or connect voice transcript for unified assist cards."}
              </p>
            </div>
          ) : (
            <LiveCoachingGuidancePanel
              events={guidanceEvents}
              acting={acting}
              onAccept={handleAccept}
              onDismiss={handleDismiss}
            />
          )}
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">{GROWTH_CALL_DIALER_SAFETY_COPY}</p>
      </div>
    </>
  )

  if (phase === "bridge_pending") {
    return (
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 dark:border-white/5" {...qaProps}>
        {panelBody}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/50 p-4 dark:border-white/10 dark:bg-white/[0.02]",
      )}
      {...qaProps}
    >
      {panelBody}
    </div>
  )
}
