"use client"

import Link from "next/link"
import { Mail, Target } from "lucide-react"
import type { GrowthHomeMarketingMission } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_GROWTH_INITIATIVES_TITLE } from "@/lib/workspace/ai-autonomous-marketing-operator"
import { GROWTH_HOME_GROWTH_INITIATIVES_SUBTITLE } from "@/lib/growth/workspace/executive-briefing/growth-home-premium-ux-1a"
import { parseEmailsFromMarketingCopy } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-2a"
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
      className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{AI_GROWTH_INITIATIVES_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{GROWTH_HOME_GROWTH_INITIATIVES_SUBTITLE}</p>
      </div>
      <div className="space-y-3">
        {missions.map((mission) => {
          const emailStat = parseEmailsFromMarketingCopy(mission.expectedImpact)
          return (
            <article
              key={mission.id}
              className="rounded-xl border border-emerald-100/80 bg-emerald-50/25 p-4 space-y-3 dark:border-emerald-900/30 dark:bg-emerald-950/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">{mission.campaign}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{mission.goal}</p>
                </div>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                  {mission.currentStage}
                </span>
              </div>

              <GrowthHomeProgressBar percent={mission.progressPercent} />

              <div className="grid gap-2 text-sm sm:grid-cols-3">
                {emailStat ? (
                  <div className="flex items-center gap-2 rounded-lg bg-background/70 px-2.5 py-2">
                    <Mail className="size-3.5 text-muted-foreground" aria-hidden />
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Emails</p>
                      <p className="font-medium">{emailStat}</p>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center gap-2 rounded-lg bg-background/70 px-2.5 py-2 sm:col-span-2">
                  <Target className="size-3.5 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Next milestone</p>
                    <p className="font-medium line-clamp-1">{mission.nextMilestone}</p>
                  </div>
                </div>
              </div>

              {mission.blocker ? (
                <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                  <span className="font-medium">Blocker · </span>
                  {mission.blocker}
                </p>
              ) : null}

              <Button asChild variant="outline" size="sm">
                <Link href={mission.reviewHref}>Review initiative</Link>
              </Button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
