"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, TrendingUp } from "lucide-react"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthCommandSectionLinks } from "@/components/growth/growth-command-section-links"
import { GROWTH_COMMAND_PIPELINE_SECTION_LINKS } from "@/lib/growth/command/command-center-navigation"
import type { GrowthOpportunityPipelineDashboard } from "@/lib/growth/opportunity-pipeline/pipeline-types"
import type { GrowthRevenueExecutiveCommandSummary } from "@/lib/growth/revenue-operating/revenue-operating-types"
import type { GrowthCommandAction } from "@/lib/growth/command/command-action-types"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

type GrowthCommandPipelineRevenueSectionProps = {
  atRiskActions?: GrowthCommandAction[]
}

export function GrowthCommandPipelineRevenueSection({ atRiskActions = [] }: GrowthCommandPipelineRevenueSectionProps) {
  const [revenue, setRevenue] = useState<GrowthRevenueExecutiveCommandSummary | null>(null)
  const [pipeline, setPipeline] = useState<GrowthOpportunityPipelineDashboard | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setSetupMessage(null)
    try {
      const [revenueRes, pipelineRes] = await Promise.all([
        fetch("/api/platform/growth/revenue-operating/command-summary", { cache: "no-store" }),
        fetch("/api/platform/growth/opportunities/pipeline?view=all_pipeline&limit=1", { cache: "no-store" }),
      ])
      const revenueData = (await revenueRes.json().catch(() => ({}))) as {
        ok?: boolean
        summary?: GrowthRevenueExecutiveCommandSummary
      }
      const pipelineData = (await pipelineRes.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        dashboard?: GrowthOpportunityPipelineDashboard | null
      }
      if (revenueRes.ok && revenueData.ok) setRevenue(revenueData.summary ?? null)
      if (pipelineRes.ok && pipelineData.ok) {
        if (pipelineData.meta?.schemaReady === false) {
          setSetupMessage(pipelineData.meta.setupMessage ?? null)
          setPipeline(null)
        } else {
          setPipeline(pipelineData.dashboard ?? null)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const forecastGap =
    revenue && revenue.activeGoal > 0
      ? Math.max(0, revenue.activeGoal - Math.round((revenue.activeGoal * revenue.forecastToGoalRatio) / 100))
      : 0

  const hasContent =
    revenue ||
    pipeline ||
    setupMessage ||
    atRiskActions.length > 0

  if (loading) {
    return (
      <GrowthEngineCard title="Pipeline + Revenue" icon={<TrendingUp className="size-4" />}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading pipeline and revenue…
        </div>
        <GrowthCommandSectionLinks links={GROWTH_COMMAND_PIPELINE_SECTION_LINKS} className="mt-3" />
      </GrowthEngineCard>
    )
  }

  if (!hasContent) {
    return (
      <GrowthEngineCard title="Pipeline + Revenue" icon={<TrendingUp className="size-4" />}>
        <p className="text-sm text-muted-foreground">No pipeline or revenue data available yet.</p>
        <GrowthCommandSectionLinks links={GROWTH_COMMAND_PIPELINE_SECTION_LINKS} className="mt-3" />
      </GrowthEngineCard>
    )
  }

  return (
    <GrowthEngineCard title="Pipeline + Revenue" icon={<TrendingUp className="size-4" />}>
      {setupMessage ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">{setupMessage}</p>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Combined forecast and pipeline health — deterministic only.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Forecast to goal" value={`${revenue?.forecastToGoalRatio ?? 0}%`} />
        <StatTile label="Forecast gap" value={formatCurrency(forecastGap)} />
        <StatTile label="Open pipeline" value={formatCurrency(pipeline?.forecastTotals.pipeline.amount ?? 0)} />
        <StatTile label="Weighted pipeline" value={formatCurrency(pipeline?.forecastTotals.pipeline.weightedAmount ?? 0)} />
        <StatTile label="Commit forecast" value={formatCurrency(revenue?.commitForecast ?? pipeline?.forecastTotals.commit.weightedAmount ?? 0)} />
        <StatTile label="Coverage ratio" value={`${revenue?.pipelineCoverage ?? 0}x`} />
        <StatTile label="Deals needing action" value={pipeline?.dealsNeedingAction ?? 0} />
        <StatTile label="Stale opportunities" value={pipeline?.staleOpportunityCount ?? revenue?.highValueStaleCount ?? 0} />
        <StatTile label="Won revenue" value={formatCurrency(pipeline?.wonRevenue ?? 0)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {revenue && revenue.forecastToGoalRatio < 100 ? (
          <GrowthBadge label="Below goal" tone="attention" />
        ) : (
          <GrowthBadge label="On pace" tone="healthy" />
        )}
        {(pipeline?.atRiskCount ?? revenue?.revenueRiskCount ?? 0) > 0 ? (
          <GrowthBadge label={`${pipeline?.atRiskCount ?? revenue?.revenueRiskCount ?? 0} at risk`} tone="high" />
        ) : null}
      </div>
      {atRiskActions.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Top at-risk opportunities</p>
          <ul className="space-y-2">
            {atRiskActions.slice(0, 3).map((action) => (
              <li key={action.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <span>
                  {action.companyName} · {action.title}
                </span>
                <Link href={action.ctaHref} className="text-indigo-600 hover:underline">
                  {action.ctaLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <GrowthCommandSectionLinks links={GROWTH_COMMAND_PIPELINE_SECTION_LINKS} className="mt-4" />
    </GrowthEngineCard>
  )
}
