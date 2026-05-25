"use client"

import { useEffect, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Grid3X3,
  Headphones,
  Mic,
  Pause,
  PhoneOff,
  SquarePen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthActiveCallPanel } from "@/components/growth/growth-active-call-panel"
import { GrowthIncomingCallPanel } from "@/components/growth/growth-incoming-call-panel"
import { GrowthPostCallWrapup } from "@/components/growth/growth-post-call-wrapup"
import {
  GROWTH_CALL_WORKSPACE_GLASS_DOCK,
  GROWTH_CALL_WORKSPACE_PANEL,
  formatCallDuration,
} from "@/lib/growth/native-dialer/native-dialer-workspace-ui"
import type {
  NativeCallWrapupOutcome,
  NativeCallWrapupPublicView,
  NativeCallWorkspaceSessionPublicView,
} from "@/lib/growth/native-dialer/native-dialer-types"
import { cn } from "@/lib/utils"

type WorkspacePhase = "idle" | "incoming" | "active" | "wrapup"

function WorkspaceMetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string
  tone?: "neutral" | "healthy" | "attention"
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 dark:border-white/5 dark:bg-white/5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          tone === "healthy" && "text-emerald-600 dark:text-emerald-400",
          tone === "attention" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function ControlDockButton({
  label,
  icon: Icon,
  disabled,
  destructive,
  onClick,
}: {
  label: string
  icon: LucideIcon
  disabled?: boolean
  destructive?: boolean
  onClick?: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-14 flex-1 flex-col gap-1 rounded-xl text-[11px] font-medium",
        destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Button>
  )
}

export function GrowthCallWorkspaceCenterPanel({
  phase,
  activeSession,
  answering,
  declining,
  ending,
  submittingWrapup,
  onAnswer,
  onDecline,
  onEndCall,
  onSubmitWrapup,
}: {
  phase: WorkspacePhase
  activeSession: NativeCallWorkspaceSessionPublicView | null
  answering?: boolean
  declining?: boolean
  ending?: boolean
  submittingWrapup?: boolean
  onAnswer: () => void
  onDecline: () => void
  onEndCall: () => void
  onSubmitWrapup: (input: {
    outcome: NativeCallWrapupOutcome
    objectionCategory?: string | null
    buyingSignals?: string[]
    competitorMentioned?: boolean
    timelineDetected?: boolean
    budgetDetected?: boolean
    championIdentified?: boolean
    decisionMakerPresent?: boolean
    notes?: string
  }) => Promise<NativeCallWrapupPublicView | null>
}) {
  const [elapsed, setElapsed] = useState(activeSession?.durationSeconds ?? 0)

  useEffect(() => {
    if (!activeSession || !["active", "on_hold"].includes(activeSession.status)) {
      setElapsed(activeSession?.durationSeconds ?? 0)
      return
    }
    const anchor = activeSession.connectedAt
      ? Date.parse(activeSession.connectedAt)
      : Date.parse(activeSession.startedAt)
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - anchor) / 1000)))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [activeSession])

  const controlsEnabled = phase === "active"
  const coachingLabel = phase === "active" ? "Enabled" : phase === "idle" ? "Ready" : "Standby"
  const coachingTone = phase === "active" ? "healthy" : "neutral"
  const recordingLabel =
    phase === "active" && activeSession
      ? activeSession.recordingState === "recording"
        ? "On"
        : "Off"
      : "Off"
  const recordingTone = recordingLabel === "On" ? "attention" : "neutral"
  const callTimeLabel =
    phase === "active" || phase === "wrapup" ? formatCallDuration(elapsed) : "00:00"

  return (
    <section className={cn(GROWTH_CALL_WORKSPACE_PANEL, "flex min-h-[560px] flex-col p-4")}>
      {phase === "idle" ? (
        <div className="mb-4">
          <h3 className="text-base font-semibold">Ready to call</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Enter a number or pick a queue item. During calls, live coaching and realtime intelligence appear here.
            After the call, complete operator wrap-up.
          </p>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        {phase === "idle" ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 text-center">
            <span className="mb-4 flex size-20 items-center justify-center rounded-full bg-muted/40 text-muted-foreground dark:bg-white/5">
              <Headphones className="size-10" />
            </span>
            <p className="text-lg font-semibold">No active call</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Select a lead or dial a number to get started.
            </p>
          </div>
        ) : null}

        {phase === "incoming" && activeSession ? (
          <GrowthIncomingCallPanel
            session={activeSession}
            onAnswer={onAnswer}
            onDecline={onDecline}
            answering={answering}
            declining={declining}
            embedded
          />
        ) : null}

        {phase === "active" && activeSession ? (
          <GrowthActiveCallPanel
            session={activeSession}
            onEndCall={onEndCall}
            onNotesChange={() => undefined}
            ending={ending}
            embedded
          />
        ) : null}

        {phase === "wrapup" && activeSession ? (
          <GrowthPostCallWrapup session={activeSession} submitting={submittingWrapup} onSubmit={onSubmitWrapup} embedded />
        ) : null}
      </div>

      <div className="mt-auto space-y-3 pt-4">
        <div className={GROWTH_CALL_WORKSPACE_GLASS_DOCK}>
          <div className="flex gap-1">
            <ControlDockButton label="Mute" icon={Mic} disabled={!controlsEnabled} />
            <ControlDockButton label="Hold" icon={Pause} disabled={!controlsEnabled} />
            <ControlDockButton label="Keypad" icon={Grid3X3} disabled={!controlsEnabled} />
            <ControlDockButton label="Notes" icon={SquarePen} disabled={phase === "idle"} />
            <ControlDockButton
              label={ending ? "Ending…" : "End"}
              icon={PhoneOff}
              disabled={!controlsEnabled || ending}
              destructive
              onClick={onEndCall}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <WorkspaceMetricCard label="Live Coaching" value={coachingLabel} tone={coachingTone} />
          <WorkspaceMetricCard label="Recording" value={recordingLabel} tone={recordingTone} />
          <WorkspaceMetricCard label="Call Time" value={callTimeLabel} />
        </div>
      </div>
    </section>
  )
}
