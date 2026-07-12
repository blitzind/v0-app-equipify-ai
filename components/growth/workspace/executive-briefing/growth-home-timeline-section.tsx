"use client"

import { CalendarClock, CheckCircle2, Sparkles } from "lucide-react"
import type { GrowthHomeTimelinePeriod } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  GROWTH_HOME_AVA_ACCOMPLISHED_SUBTITLE,
} from "@/lib/growth/workspace/executive-briefing/growth-home-premium-ux-1a"
import { buildActivityFeedItems } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-2a"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"

function feedIcon(periodLabel: string) {
  const lower = periodLabel.toLowerCase()
  if (lower.includes("today")) return CheckCircle2
  if (lower.includes("week")) return CalendarClock
  return Sparkles
}

export function GrowthHomeTimelineSection({ periods }: { periods: GrowthHomeTimelinePeriod[] }) {
  const { teammate } = useAiTeammateIdentity()
  const feedItems = buildActivityFeedItems(periods)
  if (feedItems.length === 0) return null

  return (
    <section
      data-qa-section="home-timeline"
      className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">What {teammate.name} Accomplished</h2>
        <p className="mt-1 text-sm text-muted-foreground">{GROWTH_HOME_AVA_ACCOMPLISHED_SUBTITLE}</p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {feedItems.map((item) => {
          const Icon = feedIcon(item.periodLabel)
          return (
            <article
              key={item.id}
              className="min-w-[220px] max-w-[260px] shrink-0 rounded-xl border border-border/60 bg-background/80 p-3"
            >
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span>{item.periodLabel}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground line-clamp-4">{item.description}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
