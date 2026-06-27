"use client"

import Link from "next/link"
import type { GrowthHomeCsMission } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_CUSTOMER_GROWTH_OPPORTUNITIES_TITLE } from "@/lib/workspace/ai-autonomous-customer-success-operator"
import { GrowthHomeProgressBar } from "@/components/growth/workspace/executive-briefing/growth-home-progress-bar"
import { Button } from "@/components/ui/button"

type Props = {
  missions: GrowthHomeCsMission[]
}

export function GrowthHomeCustomerSuccessMissionsSection({ missions }: Props) {
  if (missions.length === 0) return null

  return (
    <section data-qa-section="home-customer-success-missions" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_CUSTOMER_GROWTH_OPPORTUNITIES_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Onboarding, adoption, expansion, renewals, and advocacy for Equipify customer accounts.
        </p>
      </div>
      <div className="space-y-4">
        {missions.map((mission) => (
          <article key={mission.id} className="rounded-2xl border border-violet-100 bg-violet-50/30 dark:border-violet-900/30 dark:bg-violet-950/10 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground">{mission.customer}</p>
                <p className="mt-1 text-sm text-muted-foreground">{mission.renewalStatus}</p>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                {mission.currentStage}
              </span>
            </div>
            <GrowthHomeProgressBar percent={mission.progressPercent} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-muted-foreground">Current health</p>
                <p className="font-medium">{mission.currentHealth}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Next milestone</p>
                <p className="font-medium">{mission.nextMilestone}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Expected value</p>
                <p className="font-medium">{mission.expectedValue}</p>
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
              <Link href={mission.reviewHref}>Review mission</Link>
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}
