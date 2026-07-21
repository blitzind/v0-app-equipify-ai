"use client"

import { CircleDashed } from "lucide-react"
import {
  GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER,
  GROWTH_HOME_SECTION_WORKING_NOW_SUBTITLE,
  GROWTH_HOME_SECTION_WORKING_NOW_TITLE,
  type GrowthHomeWorkingNowPresentation,
} from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"

type Props = {
  presentation: GrowthHomeWorkingNowPresentation | null
}

export function GrowthHomeAvaWorkingNowSection({ presentation }: Props) {
  if (!presentation?.activeTask && !presentation?.nextStep && presentation?.blockers.length === 0) {
    return null
  }

  return (
    <section
      data-qa-section="home-ava-working-now"
      data-qa-marker-live-3b={GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm"
    >
      <div className="mb-4 border-b border-border/50 pb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {GROWTH_HOME_SECTION_WORKING_NOW_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground">{GROWTH_HOME_SECTION_WORKING_NOW_SUBTITLE}</p>
      </div>

      <div className="space-y-4">
        {presentation.activeTask ? (
          <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 px-4 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
              Active task
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{presentation.activeTask}</p>
            {(presentation.startedLabel || presentation.expectedCompletionLabel) && (
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                {presentation.startedLabel ? <span>Started: {presentation.startedLabel}</span> : null}
                {presentation.expectedCompletionLabel ? (
                  <span>Expected completion: {presentation.expectedCompletionLabel}</span>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {presentation.currentPhase ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current phase</p>
            <p className="mt-1 text-sm text-foreground">{presentation.currentPhase}</p>
          </div>
        ) : null}

        {presentation.nextStep ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next step</p>
            <p className="mt-1 text-sm text-foreground">{presentation.nextStep}</p>
          </div>
        ) : null}

        {presentation.blockers.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Blockers
            </p>
            <ul className="mt-2 space-y-1.5">
              {presentation.blockers.map((blocker) => (
                <li key={blocker} className="flex items-start gap-2 text-sm text-foreground">
                  <CircleDashed className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
