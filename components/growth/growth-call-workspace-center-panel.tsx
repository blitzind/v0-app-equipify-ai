"use client"

import { useEffect, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Grid3X3,
  Headphones,
  Mic,
  MicOff,
  Pause,
  PhoneForwarded,
  PhoneOff,
  Play,
  SquarePen,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { GrowthIncomingCallPanel } from "@/components/growth/growth-incoming-call-panel"
import { GrowthCallWorkspaceGoogleVoiceBridgePanel } from "@/components/growth/growth-call-workspace-google-voice-bridge-panel"
import { GrowthCallWorkspaceUnifiedAssistPanel } from "@/components/growth/growth-call-workspace-unified-assist-panel"
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
import type {
  VoiceBrowserCallState,
  VoiceCallRecordingVisibilityView,
  VoiceCallTimelineEventView,
} from "@/lib/voice/browser-calling/types"
import type {
  VoiceCallTransferPublicView,
  VoiceConferenceParticipantPublicView,
} from "@/lib/voice/transfer-control/types"
import type { VoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/types"
import type { UnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/types"
import type { VoiceAiCopilotWorkspaceSnapshot } from "@/lib/voice/ai-copilot/types"
import type { VoiceAiReceptionistWorkspaceSnapshot } from "@/lib/voice/ai-receptionist/types"
import type { VoiceMissedCallRecoveryWorkspaceSnapshot } from "@/lib/voice/missed-call-recovery/types"
import type { CallWorkspaceCoachingMode } from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import { GrowthCallWorkspaceLiveTranscriptPanel } from "@/components/growth/growth-call-workspace-live-transcript-panel"
import { GrowthCallWorkspaceSimplifiedTimeline } from "@/components/growth/growth-call-workspace-simplified-timeline"
import { NATIVE_DIALER_PROVIDER_LABELS } from "@/lib/growth/native-dialer/native-dialer-types"
import type { VoiceWorkspaceContextSnapshot } from "@/lib/voice/workspace-context/types"
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
  active,
  onClick,
}: {
  label: string
  icon: LucideIcon
  disabled?: boolean
  destructive?: boolean
  active?: boolean
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
        active && "bg-primary/10 text-primary",
        destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Button>
  )
}

function ActiveParticipantsPanel({
  participants,
  activeTransfer,
}: {
  participants: VoiceConferenceParticipantPublicView[]
  activeTransfer: VoiceCallTransferPublicView | null
}) {
  if (participants.length <= 1 && !activeTransfer) return null

  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2 text-sm dark:border-white/5">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Users className="size-3.5" />
        Active participants
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {participants.map((participant) => (
          <li key={participant.id} className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{participant.label}</span>
            <span>{participant.participantRole.replace("_", " ")}</span>
            {participant.isMuted ? <span>· muted</span> : null}
            {participant.isOnHold ? <span>· hold</span> : null}
          </li>
        ))}
      </ul>
      {activeTransfer ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Transfer in progress ({activeTransfer.transferKind}) →{" "}
          {activeTransfer.targetPhoneNumber || activeTransfer.targetClientIdentity || "target pending"}
        </p>
      ) : null}
    </div>
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

function VoiceCallTimelinePanel({
  timeline,
  recording,
  browserCallStateLabel,
  workspaceMode,
}: {
  timeline: VoiceCallTimelineEventView[]
  recording: VoiceCallRecordingVisibilityView | null
  browserCallStateLabel: string | null
  workspaceMode?: VoiceWorkspaceContextSnapshot["mode"]
}) {
  return (
    <GrowthCallWorkspaceSimplifiedTimeline
      timeline={timeline}
      recording={recording}
      browserCallStateLabel={browserCallStateLabel}
      workspaceMode={workspaceMode}
    />
  )
}

export function GrowthCallWorkspaceCenterPanel({
  phase,
  activeSession,
  voiceBrowserCallState,
  voiceBrowserCallStateLabel,
  voiceTimeline = [],
  voiceRecording = null,
  voiceParticipants = [],
  voiceActiveTransfer = null,
  voiceLiveTranscript = null,
  operatorAssist = null,
  aiCopilot = null,
  aiReceptionist = null,
  missedCallRecovery = null,
  voiceCallId = null,
  onOperatorAssistRefresh,
  muted = false,
  onHold = false,
  transferTarget = "",
  onTransferTargetChange,
  callActionPending = false,
  answering,
  declining,
  ending,
  markingBridgeStarted,
  submittingWrapup,
  coachingStartSignal,
  coachingMode,
  leadLinked,
  workspaceContext = null,
  onAnswer,
  onDecline,
  onEndCall,
  onToggleMute,
  onToggleHold,
  onStartTransfer,
  onMarkBridgeStarted,
  onStartLiveCoaching,
  onSubmitWrapup,
}: {
  phase: GrowthCallWorkspacePhase
  activeSession: NativeCallWorkspaceSessionPublicView | null
  voiceBrowserCallState?: VoiceBrowserCallState | null
  voiceBrowserCallStateLabel?: string | null
  voiceTimeline?: VoiceCallTimelineEventView[]
  voiceRecording?: VoiceCallRecordingVisibilityView | null
  voiceParticipants?: VoiceConferenceParticipantPublicView[]
  voiceActiveTransfer?: VoiceCallTransferPublicView | null
  voiceLiveTranscript?: VoiceCallTranscriptSnapshot | null
  operatorAssist?: UnifiedOperatorAssistSnapshot | null
  aiCopilot?: VoiceAiCopilotWorkspaceSnapshot | null
  aiReceptionist?: VoiceAiReceptionistWorkspaceSnapshot | null
  missedCallRecovery?: VoiceMissedCallRecoveryWorkspaceSnapshot | null
  voiceCallId?: string | null
  onOperatorAssistRefresh?: () => Promise<void>
  muted?: boolean
  onHold?: boolean
  transferTarget?: string
  onTransferTargetChange?: (value: string) => void
  callActionPending?: boolean
  answering?: boolean
  declining?: boolean
  ending?: boolean
  markingBridgeStarted?: boolean
  submittingWrapup?: boolean
  coachingStartSignal?: number
  coachingMode: CallWorkspaceCoachingMode
  leadLinked: boolean
  workspaceContext?: VoiceWorkspaceContextSnapshot | null
  onAnswer: () => void
  onDecline: () => void
  onEndCall: () => void
  onToggleMute?: () => void
  onToggleHold?: () => void
  onStartTransfer?: () => void
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
  const showSecondaryAssist = !workspaceContext?.deferredAnalytics
  const assistCompactMode = workspaceContext?.deferredAnalytics ?? false

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
          <h3 className="text-base font-semibold">Operator command workspace</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Relationship workflow center — dial, assist, and wrap-up without context switching. Intelligence expands
            when workflows are active.
          </p>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {phase === "idle" ? (
          <>
            <GrowthCallWorkspaceUnifiedAssistPanel
              phase="idle"
              nativeSessionId={null}
              sessionLeadId={null}
              coachingMode="transcript_only"
              leadLinked={false}
              operatorAssist={null}
            />
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
            <GrowthCallWorkspaceUnifiedAssistPanel
              phase="incoming"
              nativeSessionId={activeSession.id}
              sessionLeadId={activeSession.leadId}
              coachingMode={coachingMode}
              leadLinked={leadLinked}
              operatorAssist={operatorAssist}
              aiCopilot={aiCopilot}
              aiReceptionist={aiReceptionist}
              missedCallRecovery={missedCallRecovery}
              voiceCallId={voiceCallId}
              onSnapshotRefresh={onOperatorAssistRefresh}
              contextualCompactMode={assistCompactMode}
              showSecondaryAssistSections={showSecondaryAssist}
              workspaceMode={workspaceContext?.mode}
            />
            <VoiceCallTimelinePanel
              timeline={voiceTimeline}
              recording={voiceRecording}
              browserCallStateLabel={voiceBrowserCallStateLabel ?? null}
              workspaceMode={workspaceContext?.mode}
            />
            <GrowthCallWorkspaceLiveTranscriptPanel transcript={voiceLiveTranscript} />
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
            <GrowthCallWorkspaceUnifiedAssistPanel
              phase="bridge_pending"
              nativeSessionId={activeSession.id}
              sessionLeadId={activeSession.leadId}
              coachingMode={coachingMode}
              leadLinked={leadLinked}
              startSignal={coachingStartSignal}
              operatorAssist={operatorAssist}
              aiCopilot={aiCopilot}
              aiReceptionist={aiReceptionist}
              missedCallRecovery={missedCallRecovery}
              voiceCallId={voiceCallId}
              onSnapshotRefresh={onOperatorAssistRefresh}
              contextualCompactMode={assistCompactMode}
              showSecondaryAssistSections={showSecondaryAssist}
              workspaceMode={workspaceContext?.mode}
            />
          </>
        ) : null}

        {phase === "active" && activeSession ? (
          <>
            <ActiveCallHeader session={activeSession} elapsed={elapsed} externalBridge={externalBridge} />
            <GrowthCallWorkspaceUnifiedAssistPanel
              phase="active"
              nativeSessionId={activeSession.id}
              sessionLeadId={activeSession.leadId}
              coachingMode={coachingMode}
              leadLinked={leadLinked}
              startSignal={coachingStartSignal}
              operatorAssist={operatorAssist}
              aiCopilot={aiCopilot}
              aiReceptionist={aiReceptionist}
              missedCallRecovery={missedCallRecovery}
              voiceCallId={voiceCallId}
              onSnapshotRefresh={onOperatorAssistRefresh}
              contextualCompactMode={assistCompactMode}
              showSecondaryAssistSections={showSecondaryAssist}
              workspaceMode={workspaceContext?.mode}
            />
            <Textarea
              placeholder="Call notes (operator)"
              value={activeSession.notesDraft}
              readOnly
              rows={2}
              className="resize-none text-sm"
            />
            <VoiceCallTimelinePanel
              timeline={voiceTimeline}
              recording={voiceRecording}
              browserCallStateLabel={voiceBrowserCallStateLabel ?? null}
              workspaceMode={workspaceContext?.mode}
            />
            <GrowthCallWorkspaceLiveTranscriptPanel transcript={voiceLiveTranscript} />
            <ActiveParticipantsPanel participants={voiceParticipants} activeTransfer={voiceActiveTransfer} />
            {controlsEnabled ? (
              <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 px-3 py-2 dark:border-white/5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="transfer-target">
                  Transfer target (E.164 or client identity)
                </label>
                <input
                  id="transfer-target"
                  className="rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                  value={transferTarget}
                  onChange={(event) => onTransferTargetChange?.(event.target.value)}
                  placeholder="+14155550199"
                />
              </div>
            ) : null}
          </>
        ) : null}

        {phase === "wrapup" && activeSession ? (
          <>
            <GrowthCallWorkspaceUnifiedAssistPanel
              phase="wrapup"
              nativeSessionId={activeSession.id}
              sessionLeadId={activeSession.leadId}
              coachingMode={coachingMode}
              leadLinked={leadLinked}
              operatorAssist={operatorAssist}
              aiCopilot={aiCopilot}
              aiReceptionist={aiReceptionist}
              missedCallRecovery={missedCallRecovery}
              voiceCallId={voiceCallId}
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
                  <ControlDockButton
                    label={muted ? "Unmute" : "Mute"}
                    icon={muted ? MicOff : Mic}
                    disabled={!controlsEnabled || callActionPending}
                    active={muted}
                    onClick={onToggleMute}
                  />
                  <ControlDockButton
                    label={onHold ? "Resume" : "Hold"}
                    icon={onHold ? Play : Pause}
                    disabled={!controlsEnabled || callActionPending}
                    active={onHold}
                    onClick={onToggleHold}
                  />
                  <ControlDockButton
                    label="Transfer"
                    icon={PhoneForwarded}
                    disabled={!controlsEnabled || callActionPending || !transferTarget.trim()}
                    onClick={onStartTransfer}
                  />
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
