"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Mic, Radio, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthKnowledgeContextSection } from "@/components/growth/growth-knowledge-context-section"
import { GrowthKnowledgeRecommendationsSection } from "@/components/growth/growth-knowledge-recommendations-section"
import { GrowthConversationalPlaybooksPanel } from "@/components/growth/growth-conversational-playbooks-panel"
import { GrowthHumanInterventionsPanel } from "@/components/growth/growth-human-interventions-panel"
import { GrowthSmartFollowUpPoliciesPanel } from "@/components/growth/growth-smart-follow-up-policies-panel"
import {
  LiveCoachingExecutionScorePanel,
  LiveCoachingGuidancePanel,
} from "@/components/growth/live-coaching/live-coaching-guidance-ui"
import { GROWTH_CALL_DIALER_SAFETY_COPY } from "@/lib/growth/call-workflow-copy"
import type { GrowthLiveCoachingState } from "@/lib/growth/live-guidance/live-guidance-types"
import {
  CALL_WORKSPACE_COACHING_NO_LEAD_COPY,
  CALL_WORKSPACE_TRANSCRIPT_ONLY_COACHING_COPY,
  GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER,
  type CallWorkspaceCoachingMode,
} from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import { GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER } from "@/lib/growth/native-dialer/native-dialer-types"
import { isNativeSessionIdServerReady } from "@/lib/voice/browser-calling/call-lifecycle-reconciliation"
import type { GrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-types"

type WorkspaceCoachingPayload = {
  coachingLeadId: string
  sessionLeadId: string | null
  coachingMode: CallWorkspaceCoachingMode
  leadLinked: boolean
  realtimeSession: GrowthRealtimeCallSession | null
  coachingState: GrowthLiveCoachingState | null
}

export function GrowthCallWorkspaceLiveCoachingPanel({
  phase,
  nativeSessionId,
  sessionLeadId,
  coachingMode,
  leadLinked,
  startSignal,
}: {
  phase: "idle" | "incoming" | "bridge_pending" | "active" | "wrapup"
  nativeSessionId: string | null
  sessionLeadId: string | null
  coachingMode: CallWorkspaceCoachingMode
  leadLinked: boolean
  startSignal?: number
}) {
  const [coachingPayload, setCoachingPayload] = useState<WorkspaceCoachingPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeRealtimeSession = coachingPayload?.realtimeSession ?? null
  const coachingState = coachingPayload?.coachingState ?? null
  const snapshot = activeRealtimeSession?.liveSnapshot ?? null
  const guidanceEvents = coachingState?.activeGuidance ?? []

  const coachingActive = activeRealtimeSession?.status === "active"
  const coachingListening =
    coachingActive &&
    (activeRealtimeSession?.transcriptStatus === "live" ||
      activeRealtimeSession?.browserAudioCaptureStatus === "active")

  const canStartCoaching =
    (phase === "bridge_pending" || phase === "active") &&
    isNativeSessionIdServerReady(nativeSessionId)

  const loadCoaching = useCallback(async () => {
    if (!nativeSessionId || !isNativeSessionIdServerReady(nativeSessionId)) {
      if (phase !== "active" && phase !== "bridge_pending") {
        setCoachingPayload(null)
      }
      return
    }
    if (phase !== "active" && phase !== "bridge_pending") {
      setCoachingPayload(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/calls/sessions/${nativeSessionId}/live-coaching`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        coaching?: WorkspaceCoachingPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.coaching) {
        throw new Error(data.message ?? "Could not load live coaching.")
      }
      setCoachingPayload(data.coaching)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Live coaching load failed.")
    } finally {
      setLoading(false)
    }
  }, [nativeSessionId, phase])

  useEffect(() => {
    void loadCoaching()
  }, [loadCoaching, sessionLeadId, coachingMode, leadLinked])

  async function startCoaching() {
    if (!nativeSessionId || !isNativeSessionIdServerReady(nativeSessionId)) return
    setActing(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/calls/sessions/${nativeSessionId}/live-coaching`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        coaching?: WorkspaceCoachingPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.coaching) {
        throw new Error(data.message ?? "Could not start live coaching.")
      }
      setCoachingPayload(data.coaching)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start coaching.")
    } finally {
      setActing(false)
    }
  }

  useEffect(() => {
    if (!startSignal || !nativeSessionId) return
    if (!isNativeSessionIdServerReady(nativeSessionId)) return
    if (phase !== "bridge_pending" && phase !== "active") return
    void startCoaching()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- explicit operator trigger via startSignal
  }, [nativeSessionId, phase, startSignal])

  const modeLabel = useMemo(() => {
    if (leadLinked || coachingMode === "lead_linked") return "Lead-linked intelligence"
    return "Transcript-only guidance"
  }, [coachingMode, leadLinked])

  if (phase === "idle" || phase === "incoming") {
    return (
      <div
        className="flex flex-1 flex-col rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/5"
        data-qa-marker={GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER}
        data-google-voice-bridge-coaching-qa-marker={GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <h4 className="text-lg font-semibold">Live Coaching Ready</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Browser mic / meeting capture available. Live Coaching starts when the call begins or when the operator
              manually starts coaching. Top 3 priority actions appear here during the conversation.
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>• Operator-controlled only — no autonomous capture</li>
          <li>• Works with or without a linked lead (transcript-only mode)</li>
          <li>• Critical risks, objections, and buying signals surface first</li>
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
        data-google-voice-bridge-coaching-qa-marker={GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER}
      >
        Live Coaching paused for operator wrap-up. Complete wrap-up to start the next call.
      </div>
    )
  }

  const bridgeOrActivePanel = (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <h4 className="font-semibold">Live Coaching</h4>
          {coachingListening ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
              Listening
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label={modeLabel} tone={leadLinked ? "healthy" : "attention"} />
          <GrowthBadge
            label={coachingActive ? "Active" : "Standby"}
            tone={coachingActive ? "healthy" : "neutral"}
          />
          {!coachingActive ? (
            <Button
              type="button"
              size="sm"
              disabled={!canStartCoaching || acting}
              data-qa-action="call-workspace-start-coaching"
              onClick={() => void startCoaching()}
            >
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

      {!leadLinked && !sessionLeadId ? (
        <p className="mb-2 text-sm text-muted-foreground">{CALL_WORKSPACE_COACHING_NO_LEAD_COPY}</p>
      ) : null}

      {!leadLinked && !sessionLeadId ? (
        <p className="mb-2 text-xs text-muted-foreground">{CALL_WORKSPACE_TRANSCRIPT_ONLY_COACHING_COPY}</p>
      ) : null}

      {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading coaching…
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto">
          {coachingState && snapshot ? (
            <LiveCoachingExecutionScorePanel coachingState={coachingState} snapshot={snapshot} compact />
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

          {snapshot ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/50 px-3 py-2 dark:border-white/5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Talk ratio</p>
                <p className="text-sm font-semibold tabular-nums">
                  {snapshot.talkRatio.repTalkPercent}% rep · {snapshot.talkRatio.prospectTalkPercent}% prospect
                </p>
              </div>
              <div className="rounded-lg border border-border/50 px-3 py-2 dark:border-white/5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Buying signals</p>
                <p className="text-sm font-semibold tabular-nums">{snapshot.buyingSignals.length}</p>
              </div>
            </div>
          ) : null}

          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Top actions</p>
            {guidanceEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center dark:border-white/10">
                <Radio className="mx-auto mb-2 size-6 text-muted-foreground" />
                <p className="text-sm font-medium">No guidance yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {coachingActive
                    ? "Top priority guidance appears as transcript events are captured."
                    : "Click Start Coaching, then enable mic/meeting capture for transcript guidance."}
                </p>
              </div>
            ) : (
              <LiveCoachingGuidancePanel events={guidanceEvents} compact />
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">{GROWTH_CALL_DIALER_SAFETY_COPY}</p>

          {sessionLeadId ? (
            <>
              <GrowthKnowledgeContextSection
                consumer="call_coaching"
                title="Talk Track References"
                leadId={sessionLeadId}
                compact
              />
              <GrowthKnowledgeRecommendationsSection
                consumer="call_coaching"
                title="Recommended Coaching Actions"
                leadId={sessionLeadId}
                compact
              />
              <GrowthConversationalPlaybooksPanel
                consumer="call_coaching"
                title="Call Coaching Playbook"
                leadId={sessionLeadId}
                compact
              />
              <GrowthHumanInterventionsPanel title="Human Interventions" leadId={sessionLeadId} compact />
              <GrowthSmartFollowUpPoliciesPanel title="Smart Follow-Up Policies" leadId={sessionLeadId} compact />
            </>
          ) : null}
        </div>
      )}
    </>
  )

  if (phase === "bridge_pending") {
    return (
      <div
        className="rounded-2xl border border-border/60 bg-muted/20 p-4 dark:border-white/5"
        data-qa-marker={GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER}
        data-google-voice-bridge-coaching-qa-marker={GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER}
      >
        {bridgeOrActivePanel}
      </div>
    )
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/50 p-4 dark:border-white/10 dark:bg-white/[0.02]"
      data-qa-marker={GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER}
      data-google-voice-bridge-coaching-qa-marker={GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER}
    >
      {bridgeOrActivePanel}
    </div>
  )
}
