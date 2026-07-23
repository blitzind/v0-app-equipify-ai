"use client"

import { useState } from "react"
import { TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_AIOS_GROWTH_OPERATOR_1E_QA_MARKER,
  type GrowthExecutiveGrowthIntelligenceReadModel,
} from "@/lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-types-1e"
import { GROWTH_EXECUTIVE_SHOW_AVA_WORK_LABEL } from "@/lib/growth/aios/operator-experience/growth-executive-experience-1d"

type Props = {
  intelligence: GrowthExecutiveGrowthIntelligenceReadModel | null | undefined
}

function confidenceLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function GrowthHomeExecutiveGrowthReportSection({ intelligence }: Props) {
  const [showWork, setShowWork] = useState(false)

  if (!intelligence?.report.topRecommendations.length) return null

  const report = intelligence.report

  return (
    <section
      data-qa-section="home-executive-growth-report"
      data-qa-marker={GROWTH_AIOS_GROWTH_OPERATOR_1E_QA_MARKER}
      className="space-y-4 rounded-xl border border-emerald-200/80 bg-emerald-50/35 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <TrendingUp className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-200" aria-hidden />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {report.title}
            </p>
            <p className="text-sm font-medium text-foreground">{report.subtitle}</p>
          </div>

          {report.whatImproved.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What improved
              </p>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {report.whatImproved.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {report.whatDeclined.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What declined
              </p>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {report.whatDeclined.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What I recommend we change
            </p>
            <ul className="mt-2 space-y-2">
              {report.topRecommendations.map((rec) => (
                <li
                  key={rec.id}
                  className="rounded-lg border border-border/60 bg-background/70 px-3 py-2"
                  data-qa-recommendation-category={rec.category}
                >
                  <p className="text-sm font-medium text-foreground">{rec.headline}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{rec.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Expected impact: {rec.expectedImpact} · {confidenceLabel(rec.confidence)} confidence
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {report.whereToFocusNext.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Where we should focus next
              </p>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {report.whereToFocusNext.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Every recommendation requires your approval — I will not change ICP, budgets, providers, or policies
            automatically.
          </p>

          <Button type="button" variant="outline" size="sm" onClick={() => setShowWork((open) => !open)}>
            {showWork ? "Hide details" : GROWTH_EXECUTIVE_SHOW_AVA_WORK_LABEL}
          </Button>

          {showWork ? (
            <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3 text-sm">
              {report.whatsWastingResources.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    What's wasting resources
                  </p>
                  <ul className="mt-1 space-y-1">
                    {report.whatsWastingResources.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {report.sections.map((section) => (
                <div key={section.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.title}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {section.paragraphs.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
