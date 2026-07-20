"use client"

import {
  GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER,
  GROWTH_HOME_SECTION_COMPLETED_TODAY_SUBTITLE,
  GROWTH_HOME_SECTION_COMPLETED_TODAY_TITLE,
  type GrowthHomeCompletedTodayTimelineEntry,
} from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"

type Props = {
  entries: GrowthHomeCompletedTodayTimelineEntry[]
}

export function GrowthHomeCompletedTodayTimelineSection({ entries }: Props) {
  if (entries.length === 0) return null

  return (
    <section
      data-qa-section="home-completed-today-timeline"
      data-qa-marker-live-3b={GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm"
    >
      <div className="mb-4 border-b border-border/50 pb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {GROWTH_HOME_SECTION_COMPLETED_TODAY_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground">{GROWTH_HOME_SECTION_COMPLETED_TODAY_SUBTITLE}</p>
      </div>

      <ol className="space-y-3">
        {entries.slice(0, 8).map((entry) => (
          <li key={entry.id} className="grid grid-cols-[4.5rem_1fr] gap-3 text-sm">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{entry.timeLabel}</span>
            <span className="text-foreground">{entry.summary}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
