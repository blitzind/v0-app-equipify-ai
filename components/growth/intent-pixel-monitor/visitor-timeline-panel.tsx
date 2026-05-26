"use client"

import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { GrowthVisitorTimelineEntry } from "@/lib/growth/intent-pixel/live-visitor-monitor-types"

export function VisitorTimelinePanel({ timeline }: { timeline: GrowthVisitorTimelineEntry[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-violet-600" />
          <div>
            <h2 className="text-lg font-semibold">Visitor timeline</h2>
            <p className="text-sm text-muted-foreground">Newest first — page paths and intent badges only.</p>
          </div>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {timeline.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted-foreground">
            No recent pageviews in the timeline window.
          </li>
        ) : (
          timeline.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{entry.display_label}</p>
                  <span className="text-xs text-muted-foreground">{entry.active_duration_label}</span>
                </div>
                <p className="mt-1 text-sm">
                  {entry.page_title !== entry.page_path ? (
                    <>
                      <span className="font-medium">{entry.page_title}</span>
                      <span className="text-muted-foreground"> · {entry.page_path}</span>
                    </>
                  ) : (
                    entry.page_path
                  )}
                </p>
                {entry.search_intent_label ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Search intent: {entry.search_intent_label}
                  </p>
                ) : null}
                {entry.buying_stage_candidate ? (
                  <p className="text-xs text-muted-foreground">
                    Buying stage: {entry.buying_stage_candidate}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  {entry.timeline_badges.map((badge) => (
                    <Badge key={badge} variant="outline" className="text-xs">
                      {badge}
                    </Badge>
                  ))}
                </div>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">
                {new Date(entry.captured_at).toLocaleString()}
              </time>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
