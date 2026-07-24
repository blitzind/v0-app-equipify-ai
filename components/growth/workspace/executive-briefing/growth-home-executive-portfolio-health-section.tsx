"use client"

import { Target } from "lucide-react"
import {
  AVA_GROWTH_OPERATOR_2A_EXECUTIVE_EXPERIENCE_QA_MARKER,
  GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_SECTION_PORTFOLIO,
  type GrowthHomeExecutivePortfolioHealthPresentation,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-experience-2a"
import { GROWTH_HOME_SECTION_PORTFOLIO_SUBTITLE } from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"
import { GrowthHomeProgressBar } from "@/components/growth/workspace/executive-briefing/growth-home-progress-bar"

type Props = {
  presentation: GrowthHomeExecutivePortfolioHealthPresentation | null
}

export function GrowthHomeExecutivePortfolioHealthSection({ presentation }: Props) {
  if (!presentation) return null

  const toneClass =
    presentation.tone === "healthy"
      ? "border-emerald-200/70 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20"
      : "border-amber-200/70 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20"

  return (
    <section
      data-qa-section="home-executive-portfolio-health"
      data-qa-marker={AVA_GROWTH_OPERATOR_2A_EXECUTIVE_EXPERIENCE_QA_MARKER}
      className={`rounded-2xl border p-5 shadow-sm space-y-4 ${toneClass}`}
    >
      <div className="flex items-start gap-3">
        <Target className="mt-0.5 size-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_SECTION_PORTFOLIO}
          </h2>
          <p className="text-sm text-muted-foreground">{GROWTH_HOME_SECTION_PORTFOLIO_SUBTITLE}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <p className="text-base font-semibold text-foreground">{presentation.headline}</p>
          {presentation.activeCompanies != null && presentation.targetCompanies != null ? (
            <p className="text-sm font-medium tabular-nums text-foreground">
              {presentation.activeCompanies} / {presentation.targetCompanies}
            </p>
          ) : null}
        </div>
        {presentation.fillPercent != null ? <GrowthHomeProgressBar percent={presentation.fillPercent} /> : null}
        {presentation.detail ? (
          <p className="text-sm text-muted-foreground">{presentation.detail}</p>
        ) : null}
      </div>
    </section>
  )
}
