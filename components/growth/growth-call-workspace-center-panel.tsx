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
import { Textarea } from "@/components/ui/textarea"
import { GrowthIncomingCallPanel } from "@/components/growth/growth-incoming-call-panel"
import { GrowthCallWorkspaceGoogleVoiceBridgePanel } from "@/components/growth/growth-call-workspace-google-voice-bridge-panel"
import { GrowthCallWorkspaceLiveCoachingPanel } from "@/components/growth/growth-call-workspace-live-coaching-panel"
import { GrowthPostCallWrapup } from "@/components/growth/growth-post-call-wrapup"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { isExternalBridgeSession } from "@/lib/growth/native-dialer/native-dialer-bridge"
import {
  GROWTH_CALL_WORKSPACE_GLASS_DOCK,
  GROWTH_CALL_WORKSPACE_PANEL,
  formatCallDuration,
  formatDisplayPhone,
} from "@/lib/growth/native-dialer/native-dialer-workspace-ui"
import type {
  NativeCallWrapupOutcome,
  NativeCallWrapupPublicView,
  NativeCallWorkspaceSessionPublicView,
} from "@/lib/growth/native-dialer/native-dialer-types"
import { NATIVE_DIALER_PROVIDER_LABELS } from "@/lib/growth/native-dialer/native-dialer-types"
import { cn } from "@/lib/utils"

export type GrowthCallWorkspacePhase = "idle" | "incoming" | "bridge_pending" | "active" | "wrapup"

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

function ActiveCallHeader({
  session,
  elapsed,
  externalBridge,
}: {
  session: NativeCallWorkspaceSessionPublicView
  elapsed: number
  externalBridge: boolean
}) {
  return (
    <div className="mb-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 dark:border-white/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{externalBridge ? "External bridge call" : "Active call"}</p>
          <p className="font-semibold">{session.companyName ?? session.contactName ?? "Prospect"}</p>
          <p className="text-sm text-muted-foreground">
            {formatDisplayPhone(session.phoneNumber)} · {session.contactName ?? "Contact"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label={NATIVE_DIALER_PROVIDER_LABELS[session.provider]} tone="neutral" />
          {externalBridge ? <GrowthBadge label="Bridge mode" tone="attention" /> : null}
          {externalBridge && !session.connectedAt ? null : (
            <GrowthBadge label={formatCallDuration(elapsed)} tone="healthy" />
          )}
        </div>
      </div>
    </div>
  )
}

export function GrowthCallWorkspaceCenterPanel({
  phase,
  activeSession,
  answering,
  declining,
  ending,
  markingBridgeStarted,
  submittingWrapup,
  coachingStartSignal,
  onAnswer,
  onDecline,
  onEndCall,
  onMarkBridgeStarted,
  onStartLiveCoaching,
  onSubmitWrapup,
}: {
  phase: GrowthCallWorkspacePhase
  activeSession: NativeCallWorkspaceSessionPublicView | null
  answering?: boolean
  declining?: boolean
  ending?: boolean
  markingBridgeStarted?: boolean
  submittingWrapup?: boolean
  coachingStartSignal?: number
  onAnswer: () => void
  onDecline: () => void
  onEndCall: () => void
  onMarkBridgeStarted: () => void
  onStartLiveCoaching: () => void
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
  const externalBridge = isExternalBridgeSession(activeSession)

  useEffect(() => {
    if (!activeSession || !["active", "on_hold"].includes(activeSession.status) || !activeSession.connectedAt) {
      setElapsed(activeSession?.durationSeconds ?? 0)
      return
    }
    const anchor = Date.parse(activeSession.connectedAt)
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - anchor) / 1000)))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [activeSession])

  const controlsEnabled = phase === "active" && !externalBridge
  const bridgeControlsEnabled = phase === "bridge_pending" || (phase === "active" && externalBridge)
  const recordingLabel =
    externalBridge
      ? "N/A"
      : phase === "active" && activeSession
        ? activeSession.recordingState === "active"
          ? "On"
          : "Off"
        : "Off"
  const recordingTone = recordingLabel === "On" ? "attention" : "neutral"
  const callTimeLabel =
    phase === "bridge_pending"
      ? "00:00"
      : phase === "active" || phase === "wrapup"
        ? formatCallDuration(elapsed)
        : "00:00"
  const providerLabel =
    activeSession && (phase === "active" || phase === "bridge_pending")
      ? NATIVE_DIALER_PROVIDER_LABELS[activeSession.provider]
      : "—"

  return (
    <section className={cn(GROWTH_CALL_WORKSPACE_PANEL, "flex min-h-[560px] flex-col p-4")}>
      {phase === "idle" ? (
        <div className="mb-3">
          <h3 className="text-base font-semibold">Ready to call</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Enter a number or pick a queue item. During calls, live coaching and realtime intelligence appear here.
            After the call, complete operator wrap-up.
          </p>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {phase === "idle" ? (
          <>
            <GrowthCallWorkspaceLiveCoachingPanel phase="idle" leadId={null} nativeSessionId={null} />
            <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 px-4 py-3 text-center text-sm text-muted-foreground dark:border-white/10">
              <Headphones className="size-4 shrink-0" />
              <span>No active call — select a lead or dial a number to get started.</span>
            </div>
          </>
        ) : null}

        {phase === "incoming" && activeSession ? (
          <>
            <GrowthIncomingCallPanel
              session={activeSession}
              onAnswer={onAnswer}
              onDecline={onDecline}
              answering={answering}
              declining={declining}
              embedded
            />
            <GrowthCallWorkspaceLiveCoachingPanel
              phase="incoming"
              leadId={activeSession.leadId}
              nativeSessionId={activeSession.id}
            />
          </>
        ) : null}

        {phase === "bridge_pending" && activeSession ? (
          <>
            <GrowthCallWorkspaceGoogleVoiceBridgePanel
              session={activeSession}
              markingStarted={markingBridgeStarted}
              ending={ending}
              onMarkCallStarted={onMarkBridgeStarted}
              onStartLiveCoaching={onStartLiveCoaching}
              onEndCall={onEndCall}
            />
            <GrowthCallWorkspaceLiveCoachingPanel
              phase="bridge_pending"
              leadId={activeSession.leadId}
              nativeSessionId={activeSession.id}
              startSignal={coachingStartSignal}
            />
          </>
        ) : null}

        {phase === "active" && activeSession ? (
          <>
            <ActiveCallHeader session={activeSession} elapsed={elapsed} externalBridge={externalBridge} />
            <GrowthCallWorkspaceLiveCoachingPanel
              phase="active"
              leadId={activeSession.leadId}
              nativeSessionId={activeSession.id}
              startSignal={coachingStartSignal}
            />
            <Textarea
              placeholder="Call notes (operator)"
              value={activeSession.notesDraft}
              readOnly
              rows={2}
              className="resize-none text-sm"
            />
          </>
        ) : null}

        {phase === "wrapup" && activeSession ? (
          <>
            <GrowthCallWorkspaceLiveCoachingPanel
              phase="wrapup"
              leadId={activeSession.leadId}
              nativeSessionId={activeSession.id}
            />
            <GrowthPostCallWrapup session={activeSession} submitting={submittingWrapup} onSubmit={onSubmitWrapup} embedded />
          </>
        ) : null}
      </div>

      {phase !== "bridge_pending" ? (
        <div className="mt-auto space-y-3 pt-4">
          <div className={GROWTH_CALL_WORKSPACE_GLASS_DOCK}>
            <div className="flex gap-1">
              {!externalBridge ? (
                <>
                  <ControlDockButton label="Mute" icon={Mic} disabled={!controlsEnabled} />
                  <ControlDockButton label="Hold" icon={Pause} disabled={!controlsEnabled} />
                </>
              ) : null}
              <ControlDockButton label="Keypad" icon={Grid3X3} disabled={!controlsEnabled && !bridgeControlsEnabled} />
              <ControlDockButton label="Notes" icon={SquarePen} disabled={phase === "idle"} />
              <ControlDockButton
                label={ending ? "Ending…" : "End"}
                icon={PhoneOff}
                disabled={(!controlsEnabled && !bridgeControlsEnabled) || ending}
                destructive
                onClick={onEndCall}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {!externalBridge ? (
              <WorkspaceMetricCard label="Recording" value={recordingLabel} tone={recordingTone} />
            ) : (
              <WorkspaceMetricCard label="Recording" value="N/A" tone="neutral" />
            )}
            <WorkspaceMetricCard label="Call Time" value={callTimeLabel} />
            <WorkspaceMetricCard label="Provider" value={providerLabel} />
          </div>
        </div>
      ) : null}
    </section>
  )
}
