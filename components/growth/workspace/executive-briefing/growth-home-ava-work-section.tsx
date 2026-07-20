"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  GROWTH_PORTFOLIO_READY_NO_ELIGIBLE_ACCOUNTS_COPY,
} from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a-types"
import { GROWTH_HOME_STARTUP_STEP_PATHS } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import { GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"
import {
  GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER,
  GROWTH_HOME_SECTION_PROGRESS_SUBTITLE,
  GROWTH_HOME_SECTION_PROGRESS_TITLE,
  type GrowthHomeMeasurableProgressPresentation,
} from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"

type Props = {
  progress: GrowthHomeMeasurableProgressPresentation | null
  eligibleLeadCount?: number | null
}

export function GrowthHomeAvaWorkSection({ progress, eligibleLeadCount = null }: Props) {
  const items = progress?.items ?? []

  return (
    <section
      data-qa-section="home-ava-progress"
      data-qa-marker-operator-story={GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER}
      data-qa-marker-live-3b={GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm"
    >
      <div className="mb-4 border-b border-border/50 pb-3 space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {progress?.title ?? GROWTH_HOME_SECTION_PROGRESS_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground">
          {progress?.subtitle ?? GROWTH_HOME_SECTION_PROGRESS_SUBTITLE}
        </p>
      </div>

      {items.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-border/50 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{item.value}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {eligibleLeadCount === 0
              ? GROWTH_PORTFOLIO_READY_NO_ELIGIBLE_ACCOUNTS_COPY
              : "Mission progress will appear here as companies are discovered, researched, and prepared."}
          </p>
          {eligibleLeadCount === 0 ? null : (
            <Link
              href={GROWTH_HOME_STARTUP_STEP_PATHS.findLeads}
              className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300"
            >
              Find Leads
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
