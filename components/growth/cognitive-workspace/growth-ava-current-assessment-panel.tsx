"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthAvaCurrentAssessment } from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"

type Props = {
  assessment: GrowthAvaCurrentAssessment
}

export function GrowthAvaCurrentAssessmentPanel({ assessment }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <GrowthBadge label={assessment.accountStatus} tone="status" />
        {assessment.matchRating ? <GrowthBadge label={assessment.matchRating} tone="medium" /> : null}
        {assessment.opportunityLevel ? (
          <GrowthBadge label={`Opportunity ${assessment.opportunityLevel}`} tone="neutral" />
        ) : null}
        {assessment.confidence ? (
          <GrowthBadge label={`Confidence ${assessment.confidence.label}`} tone="neutral" />
        ) : null}
      </div>

      <div className="space-y-2 text-sm leading-relaxed text-foreground">
        {assessment.briefingParagraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {assessment.conclusion ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current conclusion</dt>
            <dd className="mt-1">{assessment.conclusion}</dd>
          </div>
        ) : null}
        {assessment.recommendation ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current recommendation</dt>
            <dd className="mt-1">{assessment.recommendation}</dd>
          </div>
        ) : null}
        {assessment.objective ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current objective</dt>
            <dd className="mt-1">{assessment.objective}</dd>
          </div>
        ) : null}
        {assessment.confidence ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Confidence</dt>
            <dd className="mt-1">
              {assessment.confidence.label}
              <span className="mt-0.5 block text-xs text-muted-foreground">{assessment.confidence.measures}</span>
            </dd>
          </div>
        ) : null}
        {assessment.blocker ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current blocker</dt>
            <dd className="mt-1 text-amber-900 dark:text-amber-200">{assessment.blocker}</dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Operator involvement</dt>
          <dd className="mt-1">{assessment.operatorInvolvementSummary}</dd>
        </div>
        {assessment.lastUpdatedLabel ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last updated</dt>
            <dd className="mt-1">{assessment.lastUpdatedLabel}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}
