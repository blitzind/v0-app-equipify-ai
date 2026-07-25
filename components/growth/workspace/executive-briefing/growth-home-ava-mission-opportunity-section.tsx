"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER,
  GROWTH_HOME_SIMPLIFICATION_MISSION_TITLE,
  type GrowthHomeMissionOpportunityPresentation,
} from "@/lib/growth/home/growth-home-simplification-1a"

type Props = {
  presentation: GrowthHomeMissionOpportunityPresentation
}

export function GrowthHomeAvaMissionOpportunitySection({ presentation }: Props) {
  return (
    <section
      data-qa-section="home-ava-mission-opportunity"
      data-qa-marker-simplification-1a={GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card p-5 space-y-4"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {GROWTH_HOME_SIMPLIFICATION_MISSION_TITLE}
      </h2>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mission</p>
        <p className="text-base font-semibold text-foreground">{presentation.missionLabel}</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opportunity Queue</p>
        <ul className="space-y-1.5">
          {presentation.opportunityQueue.map((row) => (
            <li key={row.companyName}>
              <Link
                href={row.href}
                className={`inline-flex items-center gap-1 text-sm hover:underline ${
                  row.isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {row.isCurrent ? "• " : "• "}
                {row.companyName}
                {row.isCurrent ? " (current)" : null}
                <ArrowRight className="size-3 opacity-60" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        {presentation.overflowCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            +{presentation.overflowCount} more in the queue
          </p>
        ) : null}
      </div>
    </section>
  )
}
