"use client"

import Link from "next/link"
import type { GrowthHomeMarketingMission } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_GROWTH_INITIATIVES_TITLE } from "@/lib/workspace/ai-autonomous-marketing-operator"
import { GrowthHomeProgressBar } from "@/components/growth/workspace/executive-briefing/growth-home-progress-bar"
import { Button } from "@/components/ui/button"

type Props = {
  missions: GrowthHomeMarketingMission[]
}

export function GrowthHomeMarketingMissionsSection({ missions }: Props) {
  if (missions.length === 0) return null

  return (
    <section
      data-qa-section="home-marketing-missions"
      className="rounded-2xl border border-border/70 bg-card p-6 space-y-5"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{AI_GROWTH_INITIATIVES_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Campaigns and channels that help sell Equipify — SEO, ads, content, ICP, and landing pages.
        </p>
      </div>
      <div className="space-y-4">
        {missions.map((mission) => (
          <article key={mission.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/10 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground">{mission.campaign}</p>
                <p className="mt-1 text-sm text-muted-foreground">{mission.goal}</p>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                {mission.currentStage}
              </span>
            </div>
            <GrowthHomeProgressBar percent={mission.progressPercent} />
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-muted-foreground">Expected impact</p>
                <p className="font-medium">{mission.expectedImpact}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Next milestone</p>
                <p className="font-medium">{mission.nextMilestone}</p>
              </div>
            </div>
            {mission.blocker ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                <span className="font-medium">Blocker · </span>
                {mission.blocker}
              </p>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href={mission.reviewHref}>Review mission</Link>
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}
