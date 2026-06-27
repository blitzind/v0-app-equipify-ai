"use client"

import Link from "next/link"
import type { GrowthHomeServiceMission } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_DELIVERY_INTELLIGENCE_TITLE } from "@/lib/workspace/ai-autonomous-service-operator"
import { GrowthHomeProgressBar } from "@/components/growth/workspace/executive-briefing/growth-home-progress-bar"
import { Button } from "@/components/ui/button"

type Props = {
  missions: GrowthHomeServiceMission[]
}

export function GrowthHomeServiceMissionsSection({ missions }: Props) {
  if (missions.length === 0) return null

  return (
    <section data-qa-section="home-service-missions" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_DELIVERY_INTELLIGENCE_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Post-sale visibility for Equipify customer onboarding and adoption — future vision, hidden in v1 by default.
        </p>
      </div>
      <div className="space-y-4">
        {missions.map((mission) => (
          <article key={mission.id} className="rounded-2xl border border-sky-100 bg-sky-50/30 dark:border-sky-900/30 dark:bg-sky-950/10 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground">{mission.customer}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mission.workOrder} · {mission.technician}
                </p>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                {mission.currentStage}
              </span>
            </div>
            <GrowthHomeProgressBar percent={mission.progressPercent} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-muted-foreground">Target</p>
                <p className="font-medium">{mission.eta}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Expected value</p>
                <p className="font-medium">{mission.expectedValue}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Owner</p>
                <p className="font-medium">{mission.technician}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Progress</p>
                <p className="font-medium">{mission.progressPercent}%</p>
              </div>
            </div>
            {mission.blocker ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                <span className="font-medium">Blocker · </span>
                {mission.blocker}
              </p>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href={mission.reviewHref}>Review journey</Link>
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}
