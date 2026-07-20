"use client"

import Link from "next/link"
import { ArrowRight, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GrowthPortfolioManagerOperatorProjection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import {
  buildManualProspectSearchDiscoverHref,
  GROWTH_PORTFOLIO_MANAGER_MANUAL_FIND_OPTIONS,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-operator-projection-1a"
import { GROWTH_OPERATOR_PORTFOLIO_EXPLANATION } from "@/lib/growth/aios/operator-experience/growth-operator-home-language-2c"
import { GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR } from "@/lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"
import { GrowthHomeProgressBar } from "@/components/growth/workspace/executive-briefing/growth-home-progress-bar"
import {
  GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER,
  GROWTH_HOME_SECTION_PORTFOLIO_SUBTITLE,
  GROWTH_HOME_SECTION_PORTFOLIO_TITLE,
  humanizeOperatorFacingCopy,
} from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"

type Props = {
  portfolio: GrowthPortfolioManagerOperatorProjection | null | undefined
}

function portfolioFillPercent(portfolio: GrowthPortfolioManagerOperatorProjection): number {
  if (portfolio.targetActiveCompanies <= 0) return 0
  return Math.round((portfolio.currentActiveCompanies / portfolio.targetActiveCompanies) * 100)
}

export function GrowthHomePortfolioManagerSection({ portfolio }: Props) {
  if (!portfolio) return null

  const healthy = portfolio.healthState === "healthy"
  const fillPercent = portfolioFillPercent(portfolio)

  return (
    <section
      data-qa-section="home-portfolio-manager"
      data-qa-marker-live-3b={GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm"
    >
      <div className="mb-4 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-indigo-600 dark:text-indigo-300" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {GROWTH_HOME_SECTION_PORTFOLIO_TITLE}
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{GROWTH_HOME_SECTION_PORTFOLIO_SUBTITLE}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <p className="text-base font-semibold text-foreground">{humanizeOperatorFacingCopy(portfolio.healthLabel)}</p>
            <p className="text-sm font-medium tabular-nums text-foreground">
              {portfolio.currentActiveCompanies} / {portfolio.targetActiveCompanies}
            </p>
          </div>
          <GrowthHomeProgressBar percent={fillPercent} />
          <p className="text-xs text-muted-foreground">{GROWTH_OPERATOR_PORTFOLIO_EXPLANATION}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-border/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">Needs</p>
            <p className="text-sm font-medium tabular-nums text-foreground">{portfolio.needsCount}</p>
          </div>
          <div className="rounded-lg border border-border/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">Research</p>
            <p className="text-sm font-medium text-foreground">
              {portfolio.researchRunning ? `Running (${portfolio.researchRunningCount})` : "Idle"}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">Discovery</p>
            <p className="text-sm font-medium text-foreground">{portfolio.discoveryStatusDisplay}</p>
          </div>
          <div className="rounded-lg border border-border/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">Admissions pending</p>
            <p className="text-sm font-medium tabular-nums text-foreground">{portfolio.admissionsPending}</p>
          </div>
        </div>
      </div>

      {!healthy ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {GROWTH_PORTFOLIO_MANAGER_MANUAL_FIND_OPTIONS.map((count) => (
            <Button key={count} asChild variant="outline" size="sm">
              <Link href={buildManualProspectSearchDiscoverHref(count)}>
                Find {count}
                <ArrowRight className="ml-1 size-3" aria-hidden />
              </Link>
            </Button>
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-xs text-muted-foreground">
        Adjust target, minimum, batch size, and daily limits in your{" "}
        <Link href={`/#${GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR}`} className="font-medium text-indigo-700 hover:underline dark:text-indigo-300">
          Company Profile
        </Link>
        .
      </p>
    </section>
  )
}
