"use client"

import { useMemo, useState } from "react"
import { Clock3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ProspectSearchAccountTimeline } from "@/lib/growth/prospect-search/prospect-search-account-timeline"
import {
  filterProspectSearchAccountTimeline,
  GROWTH_ACCOUNT_TIMELINE_QA_MARKER,
  type ProspectSearchAccountTimelineFilter,
} from "@/lib/growth/prospect-search/prospect-search-account-timeline"
import type { ProspectSearchAccountProgression } from "@/lib/growth/prospect-search/prospect-search-account-progression"
import { GROWTH_ACCOUNT_PROGRESSION_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-account-progression"

const FILTERS: ProspectSearchAccountTimelineFilter[] = [
  "all",
  "discovery",
  "outreach",
  "relationship",
  "compliance",
  "verification",
]

export function ProspectSearchAccountTimelinePanel({
  timeline,
  progression,
  compact = false,
}: {
  timeline: ProspectSearchAccountTimeline | null | undefined
  progression?: ProspectSearchAccountProgression | null
  compact?: boolean
}) {
  const [filter, setFilter] = useState<ProspectSearchAccountTimelineFilter>("all")

  const visibleEvents = useMemo(() => {
    if (!timeline) return []
    return filterProspectSearchAccountTimeline(timeline, filter).slice(0, compact ? 5 : 12)
  }, [timeline, filter, compact])

  if (!timeline) return null

  return (
    <section
      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
      data-account-timeline-marker={GROWTH_ACCOUNT_TIMELINE_QA_MARKER}
      data-account-progression-marker={GROWTH_ACCOUNT_PROGRESSION_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Clock3 className="size-4 text-slate-700" />
        <h4 className="text-sm font-semibold text-slate-950">Account timeline</h4>
        {progression ? (
          <Badge variant="outline">{progression.progression_state.replace(/_/g, " ")}</Badge>
        ) : null}
      </div>

      {timeline.timeline_summary ? (
        <p className="mt-2 text-xs text-muted-foreground">{timeline.timeline_summary}</p>
      ) : null}

      {progression?.next_best_action ? (
        <p className="mt-1 text-xs font-medium text-slate-800">{progression.next_best_action}</p>
      ) : null}

      {timeline.recommended_next_action ? (
        <p className="mt-1 text-[10px] text-muted-foreground">{timeline.recommended_next_action}</p>
      ) : null}

      {!compact ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={filter === item ? "default" : "outline"}
              className="h-7 text-[10px]"
              onClick={() => setFilter(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      ) : null}

      <ul className="mt-3 space-y-2">
        {visibleEvents.map((event) => (
          <li key={event.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{event.label}</span>
              <Badge variant="outline">{event.kind.replace(/_/g, " ")}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{event.detail}</p>
            {event.occurred_at ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {new Date(event.occurred_at).toLocaleString()} · {event.source}
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-muted-foreground">Source: {event.source}</p>
            )}
          </li>
        ))}
      </ul>

      {progression && progression.progression_blockers.length > 0 ? (
        <ul className="mt-3 list-disc space-y-0.5 pl-4 text-xs text-amber-900">
          {progression.progression_blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
