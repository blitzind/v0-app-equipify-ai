"use client"

import { GrowthAiTeammateProfile } from "@/components/growth/ai-teammate/growth-ai-teammate-profile"
import type { GrowthHomeExecutiveBriefingHero } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { GrowthHomeConfidenceBadge } from "@/components/growth/workspace/executive-briefing/growth-home-confidence-badge"

type Props = {
  hero: GrowthHomeExecutiveBriefingHero
  statusLabel?: string | null
  activityLabel?: string | null
  lastUpdateLabel?: string | null
}

export function GrowthHomeExecutiveBriefingHeroSection({
  hero,
  statusLabel = "Working",
  activityLabel = null,
  lastUpdateLabel = null,
}: Props) {
  const teammate = resolveAiTeammatePresentation()

  return (
    <section
      data-qa-section="home-executive-briefing-hero"
      className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-background to-background p-6 sm:p-8 lg:p-10 shadow-sm space-y-8"
    >
      <GrowthAiTeammateProfile
        teammate={teammate}
        statusLabel={statusLabel}
        activityLabel={activityLabel}
        lastUpdateLabel={lastUpdateLabel}
        className="border-0 bg-transparent p-0 shadow-none"
      />

      <div className="max-w-3xl space-y-8">
        <div className="space-y-2">
          <p className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{hero.greeting}</p>
          <p className="text-lg text-muted-foreground">{hero.introLine}</p>
        </div>

        {hero.revenueToday.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Revenue Today</p>
            <ul className="space-y-3">
              {hero.revenueToday.map((metric) => (
                <li key={metric.label} className="flex flex-wrap items-center justify-between gap-3 text-base">
                  <span className="text-foreground">{metric.label}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium tabular-nums">{metric.value}</span>
                    <GrowthHomeConfidenceBadge
                      percent={metric.confidencePercent}
                      label={metric.confidenceLabel}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {hero.biggestOpportunity ? (
            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Biggest Opportunity
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{hero.biggestOpportunity}</p>
            </div>
          ) : null}
          {hero.biggestRisk ? (
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Biggest Risk
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{hero.biggestRisk}</p>
            </div>
          ) : null}
        </div>

        {hero.expectedOutcomeToday ? (
          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expected outcome today</p>
            <p className="mt-2 text-base leading-relaxed text-foreground">{hero.expectedOutcomeToday}</p>
            <GrowthHomeConfidenceBadge
              percent={hero.overallConfidencePercent}
              label={hero.overallConfidenceLabel}
              className="mt-3 block"
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}
