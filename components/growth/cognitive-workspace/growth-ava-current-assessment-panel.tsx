"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthAvaCurrentAssessment } from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"

type Props = {
  assessment: GrowthAvaCurrentAssessment
}

export function GrowthAvaCurrentAssessmentPanel({ assessment }: Props) {
  const bullets =
    assessment.summaryBullets?.length > 0
      ? assessment.summaryBullets
      : assessment.briefingParagraphs

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <GrowthBadge label={assessment.accountStatus} tone="status" />
        {assessment.matchRating ? <GrowthBadge label={assessment.matchRating} tone="medium" /> : null}
        {assessment.confidence ? (
          <GrowthBadge label={`Confidence ${assessment.confidence.label}`} tone="neutral" />
        ) : null}
      </div>

      <ul className="space-y-1 text-sm text-foreground">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground/70" aria-hidden />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <dl className="grid gap-2 border-t border-border/50 pt-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Current focus
          </dt>
          <dd className="mt-0.5 font-medium">{assessment.objective ?? "Continue account work"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Blocked by
          </dt>
          <dd className={`mt-0.5 font-medium ${assessment.blocker ? "text-amber-900 dark:text-amber-200" : ""}`}>
            {assessment.blocker ?? "Nothing blocking"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Next step
          </dt>
          <dd className="mt-0.5 font-medium">{assessment.recommendation ?? "Await next signal"}</dd>
        </div>
      </dl>

      {assessment.lastUpdatedLabel ? (
        <p className="text-[11px] text-muted-foreground">Updated {assessment.lastUpdatedLabel}</p>
      ) : null}
    </div>
  )
}
