"use client"

import Link from "next/link"
import type { GrowthHomeRevenueMission } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  AI_REVENUE_ACTIVE_MISSIONS_TITLE,
  AI_REVENUE_MISSION_HEALTH_LABELS,
} from "@/lib/workspace/ai-autonomous-revenue-operator"
import { GrowthHomeProgressBar } from "@/components/growth/workspace/executive-briefing/growth-home-progress-bar"
import { Button } from "@/components/ui/button"

type Props = {
  missions: GrowthHomeRevenueMission[]
}

export function GrowthHomeActiveRevenueMissionsSection({ missions }: Props) {
  if (missions.length === 0) return null

  return (
    <section data-qa-section="home-active-revenue-missions" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_REVENUE_ACTIVE_MISSIONS_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Revenue Director orchestrates existing workflow stages — no duplicate engines.
        </p>
      </div>
      <div className="space-y-4">
        {missions.map((mission) => (
          <article key={mission.id} className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground">{mission.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{mission.objective}</p>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {AI_REVENUE_MISSION_HEALTH_LABELS[mission.health]}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{mission.progressPercent}%</span>
              </div>
              <GrowthHomeProgressBar percent={mission.progressPercent} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-muted-foreground">Current stage</p>
                <p className="font-medium">{mission.currentStage}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Estimated completion</p>
                <p className="font-medium">{mission.estimatedCompletion}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Next milestone</p>
                <p className="font-medium">{mission.nextMilestone}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Next action</p>
                <p className="font-medium">{mission.nextAction}</p>
              </div>
            </div>

            {mission.blocker ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                <span className="font-medium">Blocker · </span>
                {mission.blocker}
              </p>
            ) : null}

            <dl className="grid gap-2 sm:grid-cols-3">
              {mission.metrics.map((metric) => (
                <div key={metric.label} className="rounded-lg bg-muted/30 px-3 py-2 text-sm">
                  <dt className="text-muted-foreground">{metric.label}</dt>
                  <dd className="font-medium">{metric.value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
              {mission.controls.map((control) => (
                <Button
                  key={`${mission.id}-${control.kind}`}
                  asChild
                  variant={control.kind === "open_approvals" ? "default" : "outline"}
                  size="sm"
                  disabled={control.disabled}
                >
                  <Link href={control.href}>{control.label}</Link>
                </Button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
