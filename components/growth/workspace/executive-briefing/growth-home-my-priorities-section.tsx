"use client"

import Link from "next/link"
import type { GrowthHomeMyPriority } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_OWNERSHIP_MY_PRIORITIES_TITLE } from "@/lib/workspace/ai-ownership-accountability"
import { GrowthHomeProgressBar } from "@/components/growth/workspace/executive-briefing/growth-home-progress-bar"

type Props = {
  priorities: GrowthHomeMyPriority[]
}

export function GrowthHomeMyPrioritiesSection({ priorities }: Props) {
  if (priorities.length === 0) return null

  return (
    <section data-qa-section="home-my-priorities" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_OWNERSHIP_MY_PRIORITIES_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">What I own right now and what each priority needs next.</p>
      </div>
      <div className="space-y-4">
        {priorities.map((priority) => {
          const inner = (
            <article className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">{priority.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{priority.whyItMatters}</p>
              </div>
              <GrowthHomeProgressBar percent={priority.progressPercent} label={`Progress · ${priority.progressLabel}`} />
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                {priority.waitingOnMe.length > 0 ? (
                  <div>
                    <p className="font-medium text-muted-foreground">Waiting on me</p>
                    <ul className="mt-1 space-y-1">
                      {priority.waitingOnMe.map((line) => (
                        <li key={line}>• {line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {priority.waitingOnYou.length > 0 ? (
                  <div>
                    <p className="font-medium text-muted-foreground">Waiting on you</p>
                    <ul className="mt-1 space-y-1">
                      {priority.waitingOnYou.map((line) => (
                        <li key={line}>• {line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <p className="text-sm">
                <span className="font-medium text-muted-foreground">Next step · </span>
                {priority.nextStep}
              </p>
            </article>
          )

          if (priority.href) {
            return (
              <Link key={priority.id} href={priority.href} className="block transition-opacity hover:opacity-90">
                {inner}
              </Link>
            )
          }

          return <div key={priority.id}>{inner}</div>
        })}
      </div>
    </section>
  )
}
