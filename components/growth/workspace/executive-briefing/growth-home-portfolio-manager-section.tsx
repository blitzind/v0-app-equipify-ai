"use client"

import Link from "next/link"
import { ArrowRight, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GrowthPortfolioManagerOperatorProjection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import {
  buildManualProspectSearchDiscoverHref,
  GROWTH_PORTFOLIO_MANAGER_MANUAL_FIND_OPTIONS,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-operator-projection-1a"
import {
  GROWTH_OPERATOR_REVIEW_CTA_LABEL,
  GROWTH_OPERATOR_PORTFOLIO_EXPLANATION,
} from "@/lib/growth/aios/operator-experience/growth-operator-home-language-2c"
import { GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR } from "@/lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"

type Props = {
  portfolio: GrowthPortfolioManagerOperatorProjection | null | undefined
}

function StatusRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

export function GrowthHomePortfolioManagerSection({ portfolio }: Props) {
  if (!portfolio) return null

  const healthy = portfolio.healthState === "healthy"

  return (
    <section
      data-qa-section="home-portfolio-manager"
      className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm"
    >
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-border/50 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-indigo-600 dark:text-indigo-300" aria-hidden />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Portfolio
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">{portfolio.healthLabel}</p>
          <p className="text-xs text-muted-foreground">{GROWTH_OPERATOR_PORTFOLIO_EXPLANATION}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatusRow label="Target" value={portfolio.targetActiveCompanies} />
        <StatusRow label="Current" value={portfolio.currentActiveCompanies} />
        <StatusRow label="Healthy minimum" value={portfolio.minimumHealthyCompanies} />
        <StatusRow label="Needs" value={portfolio.needsCount} />
        <StatusRow
          label="Discovery"
          value={portfolio.discoveryStatusDisplay}
        />
        {portfolio.nextBatchSize != null && !portfolio.discoveryRunning ? (
          <StatusRow label="Next batch" value={portfolio.nextBatchSize} />
        ) : null}
        <StatusRow
          label="Research"
          value={portfolio.researchRunning ? `Running (${portfolio.researchRunningCount})` : "Idle"}
        />
        <StatusRow label="Admissions pending" value={portfolio.admissionsPending} />
        {portfolio.projectedCompletionLabel && portfolio.showEstimatedHealthy ? (
          <StatusRow label="Estimated healthy" value={portfolio.projectedCompletionLabel} />
        ) : null}
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
