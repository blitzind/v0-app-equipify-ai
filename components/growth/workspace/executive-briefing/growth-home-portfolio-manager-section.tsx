"use client"

import Link from "next/link"
import { ArrowRight, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GrowthPortfolioManagerOperatorProjection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import {
  buildManualProspectSearchDiscoverHref,
  GROWTH_PORTFOLIO_MANAGER_MANUAL_FIND_OPTIONS,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-operator-projection-1a"
import { GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import { GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER } from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"
import { GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR } from "@/lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"

type Props = {
  portfolio: GrowthPortfolioManagerOperatorProjection | null | undefined
  marketIntelligence?: import("@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types").MarketIntelligenceOperatorProjection | null
}

function StatusRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

export function GrowthHomePortfolioManagerSection({ portfolio, marketIntelligence }: Props) {
  if (!portfolio) return null

  const healthy = portfolio.healthState === "healthy"

  return (
    <section
      data-qa-section="home-portfolio-manager"
      data-qa-marker={GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER}
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
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatusRow label="Target" value={portfolio.targetActiveCompanies} />
        <StatusRow label="Current" value={portfolio.currentActiveCompanies} />
        <StatusRow label="Healthy minimum" value={portfolio.minimumHealthyCompanies} />
        <StatusRow label="Needs" value={portfolio.needsCount} />
        <StatusRow
          label="Discovery"
          value={portfolio.discoveryRunning ? `Running (${portfolio.discoveryRunningCount})` : "Idle"}
        />
        <StatusRow
          label="Research"
          value={portfolio.researchRunning ? `Running (${portfolio.researchRunningCount})` : "Idle"}
        />
        <StatusRow label="Admissions pending" value={portfolio.admissionsPending} />
        {portfolio.projectedCompletionLabel ? (
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

      {marketIntelligence ? (
        <div
          className="mt-5 space-y-3 border-t border-border/50 pt-4"
          data-qa-section="home-market-intelligence"
          data-qa-marker={GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Market strategy
          </p>
          <p className="text-sm text-foreground">{marketIntelligence.currentStrategySummary}</p>
          {marketIntelligence.pendingReview && marketIntelligence.pendingProposalSummary ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
              <p className="font-medium text-foreground">Suggested improvement pending review</p>
              <p className="mt-1 text-muted-foreground">{marketIntelligence.pendingProposalSummary}</p>
              {marketIntelligence.pendingProposalConfidencePercent != null ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Confidence: {marketIntelligence.pendingProposalConfidencePercent}%
                </p>
              ) : null}
              <Button asChild variant="link" size="sm" className="mt-2 h-auto px-0">
                <Link href={marketIntelligence.profileDraftHref}>Review in Company Profile</Link>
              </Button>
            </div>
          ) : marketIntelligence.suggestedImprovements.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Suggested improvements
              </p>
              {marketIntelligence.suggestedImprovements.slice(0, 1).map((recommendation) => (
                <p key={recommendation.id} className="text-sm text-muted-foreground">
                  {recommendation.explainabilityLines[0]}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{marketIntelligence.emptyMessage}</p>
          )}
          {marketIntelligence.lastAcceptedImprovementSummary ? (
            <p className="text-xs text-muted-foreground">
              {marketIntelligence.lastAcceptedImprovementSummary}
            </p>
          ) : null}
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
