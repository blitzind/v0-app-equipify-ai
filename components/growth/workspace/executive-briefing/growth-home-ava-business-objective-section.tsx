"use client"

import { useState } from "react"
import { Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_AIOS_NEXT_1E_AVA_BUSINESS_OBJECTIVE_QA_MARKER,
  type GrowthHomeAvaBusinessObjectiveLeadershipPayload,
  type GrowthHomeAvaBusinessObjectiveProjection,
  type GrowthHomeAvaObjectiveHealthStatus,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e-types"

type Props = {
  leadership: GrowthHomeAvaBusinessObjectiveLeadershipPayload
}

function healthTone(status: GrowthHomeAvaObjectiveHealthStatus): string {
  if (status === "completed" || status === "ahead" || status === "on_track") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"
  }
  if (status === "waiting_on_you") {
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
  }
  if (status === "blocked" || status === "confidence_risk") {
    return "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100"
  }
  return "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-100"
}

function ProgressBar({ percent }: { percent: number | null }) {
  if (percent == null) return null
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)))
  return (
    <div className="font-mono text-sm tracking-widest text-indigo-700 dark:text-indigo-200" aria-hidden>
      {"█".repeat(filled)}
      {"░".repeat(10 - filled)}
    </div>
  )
}

function ObjectiveCard({
  objective,
  heading,
}: {
  objective: GrowthHomeAvaBusinessObjectiveProjection
  heading: string
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</p>
        <p className="text-base font-semibold leading-snug text-foreground">{objective.title}</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progress</p>
        <ProgressBar percent={objective.progressPercent} />
        <p className="text-sm text-foreground">{objective.progressLabel}</p>
        {objective.milestoneLabel ? (
          <p className="text-xs text-muted-foreground">Current milestone · {objective.milestoneLabel}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${healthTone(objective.health)}`}>
          Forecast · {objective.forecastLabel}
        </span>
        <span className="text-xs text-muted-foreground">Owner · {objective.ownerLabel}</span>
      </div>
      {objective.completionMessage ? (
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{objective.completionMessage}</p>
      ) : null}
      {objective.nextObjectiveTitle ? (
        <p className="text-sm text-foreground">
          I recommend beginning our next objective: <span className="font-medium">{objective.nextObjectiveTitle}</span>
        </p>
      ) : null}
      {objective.blockers.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current blockers</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {objective.blockers.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function GrowthHomeAvaBusinessObjectiveSection({ leadership }: Props) {
  const [showWhy, setShowWhy] = useState(false)
  const primary = leadership.primaryObjective

  if (!primary) return null

  return (
    <section
      data-qa-section="home-ava-business-objective"
      data-qa-marker={GROWTH_AIOS_NEXT_1E_AVA_BUSINESS_OBJECTIVE_QA_MARKER}
      className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800/60 dark:bg-slate-950/20 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <Target className="mt-0.5 size-4 shrink-0 text-slate-700 dark:text-slate-200" aria-hidden />
        <div className="min-w-0 flex-1 space-y-4">
          <ObjectiveCard objective={primary} heading={leadership.teamObjectiveLine} />

          {leadership.executiveReasoningLine ? (
            <p className="text-sm leading-relaxed text-muted-foreground" data-qa-field="business-objective-reasoning">
              {leadership.executiveReasoningLine}
            </p>
          ) : null}

          {leadership.organizationalLearningLine ? (
            <p className="text-sm leading-relaxed text-muted-foreground" data-qa-field="business-objective-organizational-learning">
              {leadership.organizationalLearningLine}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setShowWhy((value) => !value)}>
              Why this objective?
            </Button>
          </div>

          {showWhy && primary.whyPriority.length > 0 ? (
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3" data-qa-field="business-objective-why">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this objective</p>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                {primary.whyPriority.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {leadership.secondaryObjective ? (
            <div className="rounded-lg border border-border/40 bg-background/50 p-3" data-qa-field="business-objective-secondary">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Supporting objective
              </p>
              <p className="text-sm font-medium text-foreground">{leadership.secondaryObjective.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{leadership.secondaryObjective.progressLabel}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
