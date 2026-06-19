"use client"

import type { GrowthSharePageOperatorTimelineEntry } from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"

function formatWhen(value: string): string {
  return new Date(value).toLocaleString()
}

export function GrowthSharePageTimelinePanel({ timeline }: { timeline: GrowthSharePageOperatorTimelineEntry[] }) {
  return (
    <section className="rounded-lg border p-4" aria-labelledby="sp-timeline">
      <h3 id="sp-timeline" className="text-sm font-semibold">
        Activity timeline
      </h3>
      {timeline.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No timeline events yet.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {timeline.map((entry) => (
            <li key={entry.id} className="relative border-l pl-4">
              <span className="absolute -left-1 top-1 size-2 rounded-full bg-primary" aria-hidden />
              <div className="text-xs">
                <p className="font-medium">{entry.title}</p>
                <p className="text-muted-foreground">{entry.summary}</p>
                <time className="mt-1 block text-[11px] text-muted-foreground" dateTime={entry.occurredAt}>
                  {formatWhen(entry.occurredAt)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
