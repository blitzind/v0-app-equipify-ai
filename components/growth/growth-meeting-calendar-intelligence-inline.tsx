"use client"

import { ArrowRight, Target, TriangleAlert } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type {
  CalendarRiskLevel,
  GrowthCalendarEventIntelligence,
} from "@/lib/growth/meeting-intelligence/calendar-event-intelligence-types"
import { cn } from "@/lib/utils"

function riskTone(level: CalendarRiskLevel): "attention" | "healthy" | "medium" | "neutral" {
  switch (level) {
    case "critical":
      return "attention"
    case "high":
      return "healthy"
    case "medium":
      return "medium"
    default:
      return "neutral"
  }
}

function riskLabel(level: CalendarRiskLevel): string {
  switch (level) {
    case "critical":
      return "Critical"
    case "high":
      return "High"
    case "medium":
      return "Medium"
    default:
      return "Low"
  }
}

export function GrowthMeetingCalendarIntelligenceInline({
  intelligence,
  compact = false,
}: {
  intelligence: GrowthCalendarEventIntelligence
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <GrowthBadge label={`Ready ${intelligence.meetingReadiness}%`} tone="neutral" />
        <GrowthBadge label={riskLabel(intelligence.riskLevel)} tone={riskTone(intelligence.riskLevel)} />
        {intelligence.leadScore != null ? (
          <span className="text-[11px] text-muted-foreground">Score {intelligence.leadScore}</span>
        ) : null}
        {intelligence.suggestedNextAction ? (
          <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
            → {intelligence.suggestedNextAction.action}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="mt-2 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2"
      data-qa-marker="growth-calendar-intelligence-v1"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <GrowthBadge label={`Ready ${intelligence.meetingReadiness}%`} tone="neutral" />
        <GrowthBadge label={riskLabel(intelligence.riskLevel)} tone={riskTone(intelligence.riskLevel)} />
        {intelligence.calendarAttached ? <GrowthBadge label="Calendar" tone="healthy" /> : null}
      </div>

      <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
        <p>
          <span className="font-medium text-foreground">Lead score:</span>{" "}
          {intelligence.leadScore ?? "—"}
          {intelligence.leadScoreLabel ? ` · ${intelligence.leadScoreLabel}` : ""}
        </p>
        <p>
          <span className="font-medium text-foreground">Buying stage:</span>{" "}
          {intelligence.buyingStage?.replace(/_/g, " ") ?? "Unknown"}
        </p>
        <p>
          <span className="font-medium text-foreground">Decision makers:</span> {intelligence.decisionMakerCount}
          {intelligence.committeeCoveragePct != null ? ` · Committee ${intelligence.committeeCoveragePct}%` : ""}
        </p>
      </div>

      {intelligence.topObjective ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs">
          <Target className="mt-0.5 size-3 shrink-0 text-violet-600" />
          <span>
            <span className="font-medium">Top objective:</span> {intelligence.topObjective}
          </span>
        </p>
      ) : null}

      {intelligence.topRisk ? (
        <p className="mt-1 flex items-start gap-1.5 text-xs">
          <TriangleAlert className="mt-0.5 size-3 shrink-0 text-amber-600" />
          <span>
            <span className="font-medium">Top risk:</span> {intelligence.topRisk}
          </span>
        </p>
      ) : null}

      {intelligence.suggestedNextAction ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-md border border-indigo-200/70 bg-indigo-50/50 px-2 py-1.5 text-xs dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <ArrowRight className="mt-0.5 size-3 shrink-0 text-indigo-600" />
          <span>
            <span className="font-medium text-indigo-950 dark:text-indigo-100">Next:</span>{" "}
            {intelligence.suggestedNextAction.action}
          </span>
        </p>
      ) : null}

      {intelligence.followUpRisks.length > 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {intelligence.followUpRisks.length} follow-up risk{intelligence.followUpRisks.length === 1 ? "" : "s"} flagged
        </p>
      ) : null}
    </div>
  )
}

export function GrowthMeetingCalendarIntelligenceRow({
  intelligence,
  selected,
  onSelect,
}: {
  intelligence: GrowthCalendarEventIntelligence
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border px-2 py-1 text-left transition-colors",
        selected
          ? "border-indigo-300 bg-indigo-50/60 dark:border-indigo-500/40 dark:bg-indigo-500/10"
          : "border-transparent hover:border-border hover:bg-muted/30",
      )}
    >
      <GrowthMeetingCalendarIntelligenceInline intelligence={intelligence} compact />
    </button>
  )
}
