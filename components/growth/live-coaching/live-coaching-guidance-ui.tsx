"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Check, ChevronDown, ChevronUp, Copy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  buildExecutionScoreContributors,
  guidanceConfidenceReasonLines,
  guidancePriorityLabel,
  partitionLiveCoachingGuidance,
  type GrowthLiveGuidancePriorityLabel,
} from "@/lib/growth/live-guidance/live-guidance-priority"
import {
  GROWTH_LIVE_EXECUTION_BADGE_LABELS,
  type GrowthLiveCoachingState,
  type GrowthLiveGuidanceEvent,
  type GrowthLiveGuidanceSeverity,
} from "@/lib/growth/live-guidance/live-guidance-types"
import type {
  GrowthRealtimeLiveSnapshot,
  GrowthRealtimeTranscriptEvent,
} from "@/lib/growth/realtime/realtime-call-types"
import { cn } from "@/lib/utils"

function priorityTone(label: GrowthLiveGuidancePriorityLabel): "attention" | "healthy" | "medium" | "neutral" {
  switch (label) {
    case "Critical":
      return "attention"
    case "High":
      return "healthy"
    case "Medium":
      return "medium"
    default:
      return "neutral"
  }
}

function severityStyles(severity: GrowthLiveGuidanceSeverity, eventType: string) {
  if (eventType === "buying_signal_detected") {
    return "border-emerald-300 bg-emerald-50/80 dark:border-emerald-500/40 dark:bg-emerald-500/10"
  }
  switch (severity) {
    case "high":
      return "border-rose-300 bg-rose-50/80 dark:border-rose-500/40 dark:bg-rose-500/10"
    case "medium":
      return "border-amber-300 bg-amber-50/80 dark:border-amber-500/40 dark:bg-amber-500/10"
    default:
      return "border-sky-300 bg-sky-50/80 dark:border-sky-500/40 dark:bg-sky-500/10"
  }
}

export function LiveCoachingExecutionScorePanel({
  coachingState,
  snapshot,
  compact = false,
}: {
  coachingState: GrowthLiveCoachingState
  snapshot: Pick<
    GrowthRealtimeLiveSnapshot,
    "talkRatio" | "buyingSignals" | "discovery" | "objections"
  >
  compact?: boolean
}) {
  const score = coachingState.executionScore
  const { topContributors, opportunities } = buildExecutionScoreContributors({ score, snapshot })

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white",
        compact && "p-3",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Execution</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <p className={cn("font-bold tabular-nums", compact ? "text-3xl" : "text-4xl")}>{score.score}</p>
            <p className="text-sm font-medium text-emerald-300">
              {GROWTH_LIVE_EXECUTION_BADGE_LABELS[score.badge]}
            </p>
          </div>
        </div>
        {!compact ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
            <StatPill label="Risk" value={coachingState.riskLevel} />
            <StatPill label="Momentum" value={coachingState.momentum.replace(/_/g, " ")} />
            <StatPill label="Latency" value={`${coachingState.guidanceLatencyMs}ms`} />
          </div>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Top contributors</p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {topContributors.map((item) => (
            <li
              key={item.label}
              className={cn(
                "rounded-lg px-2.5 py-2 text-xs",
                item.emphasis ? "bg-white/10" : "bg-white/5",
              )}
            >
              <p className="text-slate-400">{item.label}</p>
              <p className="mt-0.5 font-semibold leading-snug">{item.value}</p>
            </li>
          ))}
        </ul>
      </div>

      {opportunities.length > 0 ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
          <p className="font-semibold text-slate-300">Strongest opportunities</p>
          <ul className="mt-1 space-y-1 text-slate-200">
            {opportunities.map((item) => (
              <li key={item.label}>
                <span className="font-medium">{item.label}:</span> {item.value}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400">{label}</p>
      <p className="font-semibold capitalize">{value}</p>
    </div>
  )
}

export function LiveCoachingGuidancePanel({
  events,
  acting,
  copiedId,
  onCopy,
  onDismiss,
  onAccept,
  compact = false,
}: {
  events: GrowthLiveGuidanceEvent[]
  acting?: string | null
  copiedId?: string | null
  onCopy?: (event: GrowthLiveGuidanceEvent) => void
  onDismiss?: (eventId: string) => void
  onAccept?: (eventId: string) => void
  compact?: boolean
}) {
  const { topPriority, additional } = useMemo(() => partitionLiveCoachingGuidance(events), [events])
  const [showMore, setShowMore] = useState(false)

  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
        Coaching cards appear here as the call progresses.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2 dark:border-violet-500/30 dark:bg-violet-500/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
          Top {topPriority.length} actions
        </p>
        <p className="mt-0.5 text-[11px] text-violet-900/80 dark:text-violet-100/80">
          Critical risks and highest-confidence guidance first.
        </p>
      </div>

      {topPriority.map((event, index) =>
        compact ? (
          <LiveCoachingGuidanceRow key={event.id} event={event} rank={index + 1} emphasized />
        ) : (
          <LiveCoachingGuidanceCard
            key={event.id}
            event={event}
            rank={index + 1}
            acting={acting ?? null}
            copied={copiedId === event.id}
            emphasized
            onCopy={onCopy ? () => onCopy(event) : undefined}
            onDismiss={onDismiss ? () => onDismiss(event.id) : undefined}
            onAccept={onAccept ? () => onAccept(event.id) : undefined}
          />
        ),
      )}

      {additional.length > 0 ? (
        <div className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-between px-2 text-xs"
            onClick={() => setShowMore((value) => !value)}
          >
            {showMore ? "Hide lower-priority guidance" : `Show ${additional.length} more`}
            {showMore ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </Button>
          {showMore
            ? additional.map((event) =>
                compact ? (
                  <LiveCoachingGuidanceRow key={event.id} event={event} />
                ) : (
                  <LiveCoachingGuidanceCard
                    key={event.id}
                    event={event}
                    acting={acting ?? null}
                    copied={copiedId === event.id}
                    onCopy={onCopy ? () => onCopy(event) : undefined}
                    onDismiss={onDismiss ? () => onDismiss(event.id) : undefined}
                    onAccept={onAccept ? () => onAccept(event.id) : undefined}
                  />
                ),
              )
            : null}
        </div>
      ) : null}
    </div>
  )
}

export function LiveCoachingGuidanceRow({
  event,
  rank,
  emphasized = false,
}: {
  event: GrowthLiveGuidanceEvent
  rank?: number
  emphasized?: boolean
}) {
  const priority = guidancePriorityLabel(event)
  const reasons = guidanceConfidenceReasonLines(event)

  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        emphasized ? "border-violet-300/60 bg-violet-50/30 dark:border-violet-500/30" : "border-border/50",
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        {rank ? <span className="text-xs font-semibold text-muted-foreground">#{rank}</span> : null}
        <p className="min-w-0 flex-1 font-medium">{event.title}</p>
        <GrowthBadge label={priority} tone={priorityTone(priority)} />
        <GrowthBadge label={`${event.confidenceScore}%`} tone="neutral" />
      </div>
      <p className="text-muted-foreground">{event.operatorPrompt}</p>
      {reasons.length > 0 ? (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      {event.recommendation ? (
        <p className="mt-1 text-xs text-foreground/80">Suggested: {event.recommendation}</p>
      ) : null}
    </li>
  )
}

export function LiveCoachingGuidanceCard({
  event,
  rank,
  acting,
  copied,
  emphasized = false,
  onCopy,
  onDismiss,
  onAccept,
}: {
  event: GrowthLiveGuidanceEvent
  rank?: number
  acting: string | null
  copied: boolean
  emphasized?: boolean
  onCopy?: () => void
  onDismiss?: () => void
  onAccept?: () => void
}) {
  const priority = guidancePriorityLabel(event)
  const reasons = guidanceConfidenceReasonLines(event)
  const busy = acting?.startsWith("dismiss:") || acting?.startsWith("accept:")

  return (
    <div
      className={cn(
        "rounded-xl border p-3 shadow-sm",
        severityStyles(event.severity, event.eventType),
        emphasized && "ring-2 ring-violet-300/60 dark:ring-violet-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {rank ? <p className="text-[10px] font-semibold uppercase text-muted-foreground">Action #{rank}</p> : null}
          <p className="text-sm font-semibold">{event.title}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <GrowthBadge label={priority} tone={priorityTone(priority)} />
          <GrowthBadge label={`${event.confidenceScore}%`} tone="neutral" />
        </div>
      </div>

      <div className="mt-2 rounded-md bg-background/60 px-2 py-1.5 text-xs">
        <p className="font-medium text-foreground">Why {event.confidenceScore}% confidence</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      <p className="mt-2 text-sm font-medium">{event.operatorPrompt}</p>
      <p className="mt-2 rounded-lg bg-background/70 px-2 py-1.5 text-sm italic">
        &ldquo;{event.recommendation}&rdquo;
      </p>

      {onCopy || onDismiss || onAccept ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {onCopy ? (
            <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={onCopy}>
              {copied ? <Check className="mr-1 size-3.5" /> : <Copy className="mr-1 size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          ) : null}
          {onDismiss ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={acting === `dismiss:${event.id}`}
              onClick={onDismiss}
            >
              <X className="mr-1 size-3.5" />
              Dismiss
            </Button>
          ) : null}
          {onAccept ? (
            <Button type="button" size="sm" disabled={acting === `accept:${event.id}`} onClick={onAccept}>
              <Check className="mr-1 size-3.5" />
              Accept
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function StableLiveTranscriptList({
  events,
  className,
  maxHeightClass = "max-h-56",
}: {
  events: GrowthRealtimeTranscriptEvent[]
  className?: string
  maxHeightClass?: string
}) {
  const containerRef = useRef<HTMLUListElement>(null)
  const stickToBottomRef = useRef(true)
  const previousLengthRef = useRef(events.length)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      stickToBottomRef.current = distanceFromBottom < 48
    }

    container.addEventListener("scroll", onScroll, { passive: true })
    return () => container.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const grew = events.length > previousLengthRef.current
    previousLengthRef.current = events.length
    if (!grew || !stickToBottomRef.current) return
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
  }, [events])

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No transcript lines yet.</p>
  }

  return (
    <ul
      ref={containerRef}
      className={cn("space-y-2 overflow-y-auto overscroll-contain scroll-smooth", maxHeightClass, className)}
    >
      {events.map((event) => (
        <li
          key={event.id}
          className={cn(
            "rounded-lg px-3 py-2 text-sm transition-colors duration-150",
            event.speaker === "rep" ? "bg-muted/40" : "bg-background border border-border",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{event.speaker}</p>
          <p className="break-words">{event.content}</p>
        </li>
      ))}
    </ul>
  )
}

export function LiveCoachingSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}
