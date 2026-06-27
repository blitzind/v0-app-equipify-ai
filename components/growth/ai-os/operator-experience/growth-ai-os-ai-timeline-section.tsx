"use client"

import Link from "next/link"
import type { GrowthAiOsOperatorTimelineItem } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"

export function GrowthAiOsAiTimelineSection({ items }: { items: GrowthAiOsOperatorTimelineItem[] }) {
  return (
    <section data-qa-section="operator-ai-timeline" className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Recent AI Timeline</h2>
        <p className="mt-1 text-muted-foreground">What happened recently — translated for operators.</p>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground">No recent AI activity to show.</p>
      ) : (
        <ol className="space-y-0 border-l border-border/70 pl-4">
          {items.map((item) => (
            <li key={item.id} className="relative pb-6 pl-4 last:pb-0">
              <span
                className="absolute -left-[0.27rem] top-1.5 size-2 rounded-full bg-indigo-500"
                aria-hidden
              />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <time className="text-sm font-semibold tabular-nums text-muted-foreground">{item.timeLabel}</time>
                {item.href ? (
                  <Link href={item.href} className="text-base font-medium text-foreground hover:text-indigo-700">
                    {item.headline}
                  </Link>
                ) : (
                  <p className="text-base font-medium text-foreground">{item.headline}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
