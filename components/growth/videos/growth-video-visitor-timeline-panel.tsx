"use client"

import type { GrowthVideoEngagementTimelineStep } from "@/lib/growth/videos/growth-video-types"

export function GrowthVideoVisitorTimelinePanel({
  items,
  visitorLabel,
}: {
  items: GrowthVideoEngagementTimelineStep[]
  visitorLabel?: string
}) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        No engagement timeline events yet.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-medium">
        {visitorLabel ? `Visitor journey — ${visitorLabel}` : "Engagement timeline"}
      </h3>
      <ol className="mt-4 space-y-0">
        {items.map((step, index) => (
          <li key={step.id} className="relative flex gap-3 pb-6 last:pb-0">
            {index < items.length - 1 ? (
              <span className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-border" />
            ) : null}
            <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-[10px] font-medium text-muted-foreground">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{step.label}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(step.occurredAt).toLocaleString()}
                {step.sessionId ? ` · session ${step.sessionId.slice(0, 8)}…` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
